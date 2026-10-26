import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { MessageEntry } from '../../shared/types';
import type { Collection } from '../../shared/bookmark-types';
import { BookmarkService } from '../services/BookmarkService';
import { DuplicateError } from '../../shared/bookmark-types';
import styles from './SaveBookmarkModal.module.css';

export interface SaveBookmarkModalProps {
  entry: MessageEntry;
  onClose: () => void;
  onSuccess: (collectionTitle: string) => void;
}

function suggestTitle(content: string): string {
  // Use first sentence, max 60 chars
  const trimmed = content.trim();
  if (!trimmed) return 'Untitled answer';

  // Find first sentence
  const sentenceEnd = trimmed.search(/[.!?]\s/);
  if (sentenceEnd > 0) {
    const sentence = trimmed.slice(0, sentenceEnd + 1).trim();
    if (sentence.length <= 60) return sentence;
    return sentence.slice(0, 57).trim() + '...';
  }

  // No sentence boundary, use first 60 chars
  if (trimmed.length <= 60) return trimmed;
  return trimmed.slice(0, 57).trim() + '...';
}

// Icons
function SaveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
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

export function SaveBookmarkModal({ entry, onClose, onSuccess }: SaveBookmarkModalProps) {
  const [answerTitle, setAnswerTitle] = useState('');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');

  // Load collections and suggest title on mount
  useEffect(() => {
    BookmarkService.listCollections().then((cols) => {
      setCollections(cols);
      if (cols.length === 0) {
        setIsCreatingNew(true);
      } else {
        setSelectedCollectionId(cols[0]?.id || '');
      }
    });

    setAnswerTitle(suggestTitle(entry.content));
  }, [entry.content]);

  const handleSave = async () => {
    setError('');

    // Validation
    if (!answerTitle.trim()) {
      setError('Answer title is required');
      return;
    }

    if (isCreatingNew && !newCollectionTitle.trim()) {
      setError('Collection title is required');
      return;
    }

    if (isCreatingNew) {
      // Check for duplicate collection name
      const normalized = newCollectionTitle.trim().toLowerCase();
      const duplicate = collections.find((c) => c.title.toLowerCase() === normalized);
      if (duplicate) {
        setError(`A collection named "${duplicate.title}" already exists. Select it instead or choose a different name.`);
        return;
      }
    }

    setIsSaving(true);

    try {
      await BookmarkService.saveAnswer({
        entry,
        title: answerTitle.trim(),
        collectionId: isCreatingNew ? undefined : selectedCollectionId,
        newCollectionTitle: isCreatingNew ? newCollectionTitle.trim() : undefined,
      });

      const collectionTitle = isCreatingNew
        ? newCollectionTitle.trim()
        : collections.find((c) => c.id === selectedCollectionId)?.title || 'Unknown';

      onSuccess(collectionTitle);
      onClose();
    } catch (err) {
      if (err instanceof DuplicateError) {
        setError(err.message);
      } else {
        setError('Could not save. Please try again.');
        console.error('Save failed:', err);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCollectionChange = (value: string) => {
    if (value === '__CREATE_NEW__') {
      setIsCreatingNew(true);
      setSelectedCollectionId('');
    } else {
      setIsCreatingNew(false);
      setSelectedCollectionId(value);
    }
    setError('');
  };

  const isValid = answerTitle.trim() && (isCreatingNew ? newCollectionTitle.trim() : selectedCollectionId);

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal} role="dialog" aria-labelledby="save-bookmark-title">
        <div className={styles.header}>
          <div className={styles.titleWithIcon}>
            <SaveIcon />
            <h2 id="save-bookmark-title" className={styles.title}>
              Save bookmark
            </h2>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.content}>
          {/* Answer Title */}
          <div className={styles.field}>
            <label htmlFor="answer-title" className={styles.label}>
              Answer title
            </label>
            <input
              id="answer-title"
              type="text"
              className={styles.input}
              value={answerTitle}
              onChange={(e) => setAnswerTitle(e.target.value)}
              placeholder="Enter a title for this answer"
              autoFocus
            />
          </div>

          {/* Collection Selection */}
          <div className={styles.field}>
            <label htmlFor="collection-select" className={styles.label}>
              Save to collection
            </label>
            {collections.length > 0 && !isCreatingNew && (
              <select
                id="collection-select"
                className={styles.select}
                value={selectedCollectionId}
                onChange={(e) => handleCollectionChange(e.target.value)}
              >
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.title}
                  </option>
                ))}
                <option value="__CREATE_NEW__">+ Create new collection</option>
              </select>
            )}

            {(collections.length === 0 || isCreatingNew) && (
              <>
                {collections.length > 0 && (
                  <button
                    className={styles.linkButton}
                    onClick={() => handleCollectionChange(collections[0]?.id || '')}
                  >
                    ← Select existing collection
                  </button>
                )}
                <input
                  id="new-collection-title"
                  type="text"
                  className={styles.input}
                  value={newCollectionTitle}
                  onChange={(e) => setNewCollectionTitle(e.target.value)}
                  placeholder="Enter collection name"
                />
              </>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={!isValid || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
