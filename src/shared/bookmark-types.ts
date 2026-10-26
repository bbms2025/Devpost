// Bookmark-related types shared between components

export interface Collection {
  id: string; // UUID
  title: string; // user-defined, e.g. "Database Design"
  createdAt: number; // timestamp
  updatedAt: number; // timestamp (updated when answers added/removed)
}

export interface SavedAnswer {
  id: string; // UUID
  collectionId: string; // foreign key to Collection
  title: string; // user-editable answer title
  content: string; // full answer text
  conversationId: string | null; // from conversationKey() when saved
  messageId: string | null; // from MessageEntry.id when saved
  savedAt: number; // timestamp
}

export class DuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateError';
  }
}
