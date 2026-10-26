import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Collection, SavedAnswer } from '../../shared/bookmark-types';
import { BookmarkService } from '../services/BookmarkService';
import { ExportService } from '../services/ExportService';
import styles from './SavedViewsModal.module.css';

export interface SavedViewsModalProps {
  onClose: () => void;
  onNavigateToSource?: (messageId: string) => void;
}

type View = 'collections' | 'answers' | 'detail';

// Icons
function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function CollectionsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function AnswersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function DetailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

export function SavedViewsModal({ onClose, onNavigateToSource }: SavedViewsModalProps) {
  const [view, setView] = useState<View>('collections');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [answers, setAnswers] = useState<SavedAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<SavedAnswer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load collections on mount
  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    setIsLoading(true);
    try {
      const cols = await BookmarkService.listCollections();
      setCollections(cols);
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCollection = async (collection: Collection) => {
    setSelectedCollection(collection);
    setIsLoading(true);
    try {
      const ans = await BookmarkService.getAnswersByCollection(collection.id);
      setAnswers(ans);
      setView('answers');
    } catch (error) {
      console.error('Failed to load answers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAnswer = (answer: SavedAnswer) => {
    setSelectedAnswer(answer);
    setView('detail');
  };

  const handleBack = () => {
    if (view === 'detail') {
      setView('answers');
      setSelectedAnswer(null);
    } else if (view === 'answers') {
      setView('collections');
      setSelectedCollection(null);
      setAnswers([]);
    }
  };

  const handleDeleteAnswer = async (answerId: string) => {
    if (!confirm('Delete this saved answer?')) return;
    
    try {
      await BookmarkService.deleteAnswer(answerId);
      const updatedAnswers = answers.filter((a) => a.id !== answerId);
      setAnswers(updatedAnswers);
      if (selectedAnswer?.id === answerId) {
        setView('answers');
        setSelectedAnswer(null);
      }
    } catch (error) {
      console.error('Failed to delete answer:', error);
      alert('Could not delete answer. Please try again.');
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    const collection = collections.find((c) => c.id === collectionId);
    if (!confirm(`Delete collection "${collection?.title}"? This will delete all saved answers in it.`)) return;
    
    try {
      await BookmarkService.deleteCollection(collectionId);
      await loadCollections();
      setView('collections');
      setSelectedCollection(null);
      setAnswers([]);
    } catch (error) {
      console.error('Failed to delete collection:', error);
      alert('Could not delete collection. Please try again.');
    }
  };

  const handleExport = async (collection: Collection, format: 'md' | 'json' | 'txt') => {
    try {
      const answers = await BookmarkService.getAnswersByCollection(collection.id);
      
      if (answers.length === 0) {
        alert('No answers to export in this collection.');
        return;
      }

      let content: string;
      let mimeType: string;
      
      switch (format) {
        case 'md':
          content = ExportService.exportToMarkdown(collection, answers);
          mimeType = 'text/markdown';
          break;
        case 'json':
          content = ExportService.exportToJSON(collection, answers);
          mimeType = 'application/json';
          break;
        case 'txt':
          content = ExportService.exportToText(collection, answers);
          mimeType = 'text/plain';
          break;
      }

      const filename = ExportService.generateFilename(collection.title, format);
      ExportService.downloadFile(content, filename, mimeType);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('Could not export collection. Please try again.');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal} role="dialog" aria-labelledby="saved-views-title">
        {/* Header */}
        <div className={styles.header}>
          {view !== 'collections' && (
            <button className={styles.backButton} onClick={handleBack} aria-label="Go back">
              <BackIcon />
            </button>
          )}
          <div className={styles.titleWithIcon}>
            {view === 'collections' && <CollectionsIcon />}
            {view === 'answers' && <AnswersIcon />}
            {view === 'detail' && <DetailIcon />}
            <h2 id="saved-views-title" className={styles.title}>
              {view === 'collections' && 'Saved Collections'}
              {view === 'answers' && selectedCollection?.title}
              {view === 'detail' && selectedAnswer?.title}
            </h2>
          </div>
          
          {/* Export dropdown - only show in answers view */}
          {view === 'answers' && selectedCollection && (
            <ExportDropdown collection={selectedCollection} onExport={handleExport} />
          )}
          
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {isLoading && <div className={styles.loading}>Loading...</div>}

          {/* Collections View */}
          {!isLoading && view === 'collections' && (
            <>
              {collections.length === 0 ? (
                <div className={styles.empty}>
                  No saved collections yet. Bookmark an answer to get started.
                </div>
              ) : (
                <div className={styles.list}>
                  {collections.map((collection) => (
                    <div
                      key={collection.id}
                      className={styles.card}
                      onClick={() => handleSelectCollection(collection)}
                    >
                      <div className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}>{collection.title}</h3>
                        <button
                          className={styles.deleteButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCollection(collection.id);
                          }}
                          aria-label="Delete collection"
                        >
                          🗑️
                        </button>
                      </div>
                      <div className={styles.cardMeta}>
                        Updated {formatDate(collection.updatedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Answers View */}
          {!isLoading && view === 'answers' && (
            <>
              {answers.length === 0 ? (
                <div className={styles.empty}>
                  No saved answers in this collection yet.
                </div>
              ) : (
                <div className={styles.list}>
                  {answers.map((answer) => (
                    <div
                      key={answer.id}
                      className={styles.card}
                      onClick={() => handleSelectAnswer(answer)}
                    >
                      <div className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}>{answer.title}</h3>
                      </div>
                      <div className={styles.cardPreview}>
                        {answer.content.slice(0, 120)}
                        {answer.content.length > 120 && '...'}
                      </div>
                      <div className={styles.cardMeta}>
                        Saved {formatDate(answer.savedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Detail View */}
          {!isLoading && view === 'detail' && selectedAnswer && (
            <div className={styles.detail}>
              <div className={styles.detailContent}>{selectedAnswer.content}</div>
              <div className={styles.detailMeta}>
                Saved {formatDate(selectedAnswer.savedAt)}
              </div>
              <div className={styles.detailActions}>
                <button
                  className={styles.dangerButton}
                  onClick={() => handleDeleteAnswer(selectedAnswer.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}


// Export Dropdown Component
interface ExportDropdownProps {
  collection: Collection;
  onExport: (collection: Collection, format: 'md' | 'json' | 'txt') => void;
}

function ExportDropdown({ collection, onExport }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleExport = (format: 'md' | 'json' | 'txt') => {
    setIsOpen(false);
    onExport(collection, format);
  };

  return (
    <div className={styles.exportDropdown}>
      <button
        className={styles.exportButton}
        onClick={handleToggle}
        aria-label="Export collection"
        aria-expanded={isOpen}
      >
        Export ▼
      </button>
      {isOpen && (
        <>
          <div className={styles.exportBackdrop} onClick={() => setIsOpen(false)} />
          <div className={styles.exportMenu}>
            <button
              className={styles.exportMenuItem}
              onClick={() => handleExport('md')}
            >
              <span>📄</span>
              <span>.md File</span>
            </button>
            <button
              className={styles.exportMenuItem}
              onClick={() => handleExport('json')}
            >
              <span>📊</span>
              <span>.json File</span>
            </button>
            <button
              className={styles.exportMenuItem}
              onClick={() => handleExport('txt')}
            >
              <span>📝</span>
              <span>.txt File</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
