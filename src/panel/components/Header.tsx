import type { ExtractionStatus } from '../../shared/types';
import styles from './Header.module.css';

interface HeaderProps {
  status: ExtractionStatus;
  onLoad: () => void;
  isLoading: boolean;
  onOpenSavedViews: () => void;
}

const STATUS_TEXT: Record<ExtractionStatus, string> = {
  waiting: 'Open a ChatGPT conversation, then click Load',
  reading: 'Reading conversation\u2026',
  ready: 'Outline ready',
  incomplete: 'Incomplete \u2014 click Reload to refresh',
};

/* ── Lucide-style icons ── */

function AppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
    </svg>
  );
}

function BookmarksIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function Header({ status, onLoad, isLoading, onOpenSavedViews }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <div className={styles.titleGroup}>
          <span className={styles.appIcon}>
            <AppIcon />
          </span>
          <span className={styles.title}>AI Chat Organizer</span>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            onClick={onLoad}
            disabled={isLoading}
            aria-label="Load conversation"
          >
            <RefreshIcon />
            <span>{isLoading ? 'Loading…' : 'Load'}</span>
          </button>
          <button
            className={styles.actionBtn}
            onClick={onOpenSavedViews}
            aria-label="Open saved bookmarks"
          >
            <BookmarksIcon />
            <span>Archive</span>
          </button>
        </div>
      </div>

      <div className={`${styles.statusRow} ${styles[status]}`}>
        <span className={styles.statusDot} aria-hidden="true" />
        <span
          className={`${styles.status} ${styles[status]}`}
          aria-live="polite"
          aria-label={`Status: ${STATUS_TEXT[status]}`}
        >
          {STATUS_TEXT[status]}
        </span>
      </div>
    </header>
  );
}
