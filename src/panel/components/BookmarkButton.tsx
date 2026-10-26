import type { MessageEntry } from '../../shared/types';
import styles from './BookmarkButton.module.css';

export interface BookmarkButtonProps {
  entry: MessageEntry;
  onSave: (entry: MessageEntry) => void;
}

function BookmarkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function BookmarkButton({ entry, onSave }: BookmarkButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave(entry);
  };

  // Only show for assistant messages with 'ready' status
  if (entry.speaker !== 'assistant' || entry.status !== 'ready') {
    return null;
  }

  return (
    <button
      className={styles.button}
      onClick={handleClick}
      aria-label="Save answer to collection"
      title="Bookmark this answer"
    >
      <BookmarkIcon />
    </button>
  );
}
