import type { ExtractionStatus } from '../../shared/types';
import styles from './Header.module.css';

interface HeaderProps {
  status: ExtractionStatus;
  onLoad: () => void;
  isLoading: boolean;
}

const STATUS_TEXT: Record<ExtractionStatus, string> = {
  waiting: 'Open a ChatGPT conversation, then click load',
  reading: 'Reading conversation\u2026',
  ready: 'Ready',
  incomplete: 'Outline may be incomplete',
};

function LoadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
    </svg>
  );
}

export function Header({ status, onLoad, isLoading }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <span className={styles.title}>AI Chat Organizer</span>
        <button
          className={styles.loadBtn}
          onClick={onLoad}
          disabled={isLoading}
          aria-label="Load conversation"
          title="Load conversation"
        >
          <LoadIcon />
        </button>
      </div>
      <span
        className={`${styles.status} ${styles[status]}`}
        aria-live="polite"
        aria-label={`Status: ${STATUS_TEXT[status]}`}
      >
        {STATUS_TEXT[status]}
      </span>
    </header>
  );
}
