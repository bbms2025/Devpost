import type { ConversationStats } from '../store';
import styles from './StatsCard.module.css';

interface StatsCardProps {
  stats: ConversationStats;
  stale: boolean;
  onReload: () => void;
}

function UserIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function StatsCard({ stats, stale, onReload }: StatsCardProps) {
  return (
    <div className={`${styles.card} ${stale ? styles.stale : ''}`}>
      {stale ? (
        <div className={styles.staleRow}>
          <span className={styles.staleIcon}><AlertIcon /></span>
          <span className={styles.staleMsg}>Scroll detected — some entries may be outdated.</span>
          <button className={styles.reloadBtn} onClick={onReload} aria-label="Reload conversation">
            Reload
          </button>
        </div>
      ) : (
        <div className={styles.statsRow}>
          <span className={styles.stat}>
            <span className={styles.statIcon}><UserIcon /></span>
            <span className={styles.statLabel}>You</span>
            <span className={styles.statValue}>{stats.userCount}</span>
          </span>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.stat}>
            <span className={styles.statIcon}><BotIcon /></span>
            <span className={styles.statLabel}>AI</span>
            <span className={styles.statValue}>{stats.assistantCount}</span>
          </span>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.stat}>
            <span className={styles.statIcon}><LayersIcon /></span>
            <span className={styles.statLabel}>Total</span>
            <span className={styles.statValue}>{stats.totalCount}</span>
          </span>
        </div>
      )}
    </div>
  );
}
