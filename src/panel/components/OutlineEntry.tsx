import type { MessageEntry } from '../../shared/types';
import styles from './OutlineEntry.module.css';

interface OutlineEntryProps {
  entry: MessageEntry;
  isSelected: boolean;
  onNavigate: (id: string) => void;
}

// Simple SVG icons — no external dependency
function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function AssistantIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function OutlineEntry({ entry, isSelected, onNavigate }: OutlineEntryProps) {
  const isDisabled = entry.status === 'generating' || entry.status === 'failed';
  const speakerLabel = entry.speaker === 'user' ? 'You' : 'ChatGPT';

  const handleClick = () => {
    if (!isDisabled) {
      onNavigate(entry.id);
    }
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
      `}
      role="listitem"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isDisabled ? -1 : 0}
      aria-label={`${speakerLabel}: ${entry.preview}`}
      aria-disabled={isDisabled}
    >
      <span className={styles.icon} aria-hidden="true">
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
    </div>
  );
}
