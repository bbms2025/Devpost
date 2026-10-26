import type { MessageEntry } from '../../shared/types';
import { BookmarkButton } from './BookmarkButton';
import styles from './OutlineEntry.module.css';

interface OutlineEntryProps {
  entry: MessageEntry;
  isSelected: boolean;
  onNavigate: (id: string) => void;
  onBookmark: (entry: MessageEntry) => void;
}

function UserIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function AssistantIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  );
}

export function OutlineEntry({ entry, isSelected, onNavigate, onBookmark }: OutlineEntryProps) {
  const isDisabled = entry.status === 'generating' || entry.status === 'failed';
  const speakerLabel = entry.speaker === 'user' ? 'You' : 'ChatGPT';

  const handleClick = () => {
    if (!isDisabled) onNavigate(entry.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
      e.preventDefault();
      onNavigate(entry.id);
    }
  };

  return (
    <div
      className={`
        ${styles.entry}
        ${styles[entry.speaker]}
        ${isSelected ? styles.selected : ''}
        ${entry.status === 'generating' ? styles.generating : ''}
        ${entry.status === 'failed' ? styles.failed : ''}
        entry
      `}
      role="listitem"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isDisabled ? -1 : 0}
      aria-label={`${speakerLabel}: ${entry.preview}`}
      aria-disabled={isDisabled}
    >
      <span className={styles.iconWrap} aria-hidden="true">
        {entry.speaker === 'user' ? <UserIcon /> : <AssistantIcon />}
      </span>
      <div className={styles.content}>
        <span className={styles.speaker}>{speakerLabel}</span>
        <span className={styles.preview}>
          {entry.status === 'generating' ? 'Generating\u2026' : entry.preview}
        </span>
        {entry.status === 'failed' && (
          <span className={styles.failedNote}>Navigation unavailable</span>
        )}
      </div>
      <BookmarkButton entry={entry} onSave={onBookmark} />
    </div>
  );
}
