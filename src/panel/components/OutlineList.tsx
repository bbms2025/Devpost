import { useEffect, useRef } from 'react';
import type { MessageEntry } from '../../shared/types';
import { OutlineEntry } from './OutlineEntry';
import styles from './OutlineList.module.css';

interface OutlineListProps {
  entries: MessageEntry[];
  selectedId: string | null;
  onNavigate: (id: string) => void;
}

const BOTTOM_THRESHOLD_PX = 50;

export function OutlineList({ entries, selectedId, onNavigate }: OutlineListProps) {
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
        Building your conversation outline&hellip;
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
        />
      ))}
    </div>
  );
}
