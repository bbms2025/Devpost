export type Speaker = 'user' | 'assistant';

export type EntryStatus =
  | 'ready'       // navigable
  | 'generating'  // streaming in progress
  | 'failed';     // cannot be navigated to

export interface MessageEntry {
  id: string;                  // local ID (stable within a session)
  siteId?: string;             // data-message-id from ChatGPT, if available
  speaker: Speaker;
  preview: string;             // first ~120 chars of message text, trimmed
  content: string;             // full message text (for bookmarks)
  contentFingerprint: string;  // normalized content for reconciliation
  status: EntryStatus;
}

export type ExtractionStatus = 'waiting' | 'reading' | 'ready' | 'incomplete';
