import { useEffect, useRef } from 'react';
import type { MessageEntry } from '../../shared/types';
import { OutlineEntry } from './OutlineEntry';
import styles from './OutlineList.module.css';

interface OutlineListProps {
  entries: MessageEntry[];
  selectedId: string | null;
  onNavigate: (id: string) => void;
  onBookmark: (entry: MessageEntry) => void;
}

const BOTTOM_THRESHOLD_PX = 50;

function EmptyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  );
}

export function OutlineList({ entries, selectedId, onNavigate, onBookmark }: OutlineListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(entries.length);

  // Auto-scroll only when already near the bottom
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (entries.length <= prevLengthRef.current) {
      prevLengthRef.current = entries.length;
      return;
    }
    prevLengthRef.current = entries.length;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom <= BOTTOM_THRESHOLD_PX) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className={styles.empty} role="status">
        <div className={styles.emptyIcon}>
          <EmptyIcon />
        </div>
        <p className={styles.emptyTagline}>Your AI conversation navigator</p>
        <p className={styles.emptyDesc}>Jump to any message in a long ChatGPT chat — instantly.</p>
        <ol className={styles.emptySteps}>
          <li>Open a conversation on ChatGPT</li>
          <li>Click <strong>Load</strong> to scan the chat</li>
          <li>Click any entry to jump to that message</li>
          <li>Bookmark AI replies into custom or existing lists</li>
          <li>Browse saved lists &amp; export to MD, JSON, or TXT</li>
        </ol>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className={styles.list}
      role="list"
      aria-label="Conversation outline"
    >
      {entries.map((entry) => (
        <OutlineEntry
          key={entry.id}
          entry={entry}
          isSelected={entry.id === selectedId}
          onNavigate={onNavigate}
          onBookmark={onBookmark}
        />
      ))}
    </div>
  );
}
