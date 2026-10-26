import Dexie, { Table } from 'dexie';
import type { Collection, SavedAnswer } from '../../shared/bookmark-types';
import { DuplicateError } from '../../shared/bookmark-types';
import type { MessageEntry } from '../../shared/types';

// IndexedDB database for bookmarks
class BookmarkDatabase extends Dexie {
  collections!: Table<Collection, string>;
  savedAnswers!: Table<SavedAnswer, string>;

  constructor() {
    super('AIBookmarks');
    
    this.version(1).stores({
      collections: 'id, title, createdAt, updatedAt',
      savedAnswers: 'id, collectionId, conversationId, messageId, savedAt, [collectionId+conversationId+messageId]',
    });
  }
}

const db = new BookmarkDatabase();

export interface SaveAnswerParams {
  entry: MessageEntry;
  title: string;
  collectionId?: string;
  newCollectionTitle?: string;
}

class BookmarkServiceClass {
  /**
   * List all collections ordered by most recently updated
   */
  async listCollections(): Promise<Collection[]> {
    return await db.collections.orderBy('updatedAt').reverse().toArray();
  }

  /**
   * Get a single collection by ID
   */
  async getCollection(id: string): Promise<Collection | undefined> {
    return await db.collections.get(id);
  }

  /**
   * Create a new collection
   */
  async createCollection(title: string): Promise<Collection> {
    const collection: Collection = {
      id: crypto.randomUUID(),
      title: title.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    await db.collections.add(collection);
    return collection;
  }

  /**
   * Save an answer to a collection
   * Throws DuplicateError if the same answer already exists in the collection
   */
  async saveAnswer(params: SaveAnswerParams): Promise<SavedAnswer> {
    const { entry, title, collectionId, newCollectionTitle } = params;

    // Determine collection ID
    let targetCollectionId = collectionId;
    
    if (!targetCollectionId && newCollectionTitle) {
      // Create new collection
      const newCollection = await this.createCollection(newCollectionTitle);
      targetCollectionId = newCollection.id;
    }

    if (!targetCollectionId) {
      throw new Error('Must provide either collectionId or newCollectionTitle');
    }

    // Check for duplicate using compound index
    const conversationId = this.getCurrentConversationId();
    const messageId = entry.id;

    if (conversationId && messageId) {
      const existing = await db.savedAnswers
        .where('[collectionId+conversationId+messageId]')
        .equals([targetCollectionId, conversationId, messageId])
        .first();

      if (existing) {
        const collection = await this.getCollection(targetCollectionId);
        throw new DuplicateError(
          `This answer is already saved in ${collection?.title || 'this collection'}.`
        );
      }
    }

    // Create saved answer
    const savedAnswer: SavedAnswer = {
      id: crypto.randomUUID(),
      collectionId: targetCollectionId,
      title: title.trim(),
      content: entry.content || entry.preview, // Use full content if available, fallback to preview
      conversationId,
      messageId,
      savedAt: Date.now(),
    };

    await db.savedAnswers.add(savedAnswer);

    // Update collection's updatedAt
    await db.collections.update(targetCollectionId, {
      updatedAt: Date.now(),
    });

    return savedAnswer;
  }

  /**
   * Get all saved answers in a collection, ordered by most recent first
   */
  async getAnswersByCollection(collectionId: string): Promise<SavedAnswer[]> {
    return await db.savedAnswers
      .where('collectionId')
      .equals(collectionId)
      .reverse()
      .sortBy('savedAt');
  }

  /**
   * Delete a saved answer
   */
  async deleteAnswer(id: string): Promise<void> {
    const answer = await db.savedAnswers.get(id);
    if (!answer) return;

    await db.savedAnswers.delete(id);

    // Update parent collection's updatedAt
    await db.collections.update(answer.collectionId, {
      updatedAt: Date.now(),
    });
  }

  /**
   * Delete a collection and all its saved answers
   */
  async deleteCollection(id: string): Promise<void> {
    // Delete all answers in the collection
    await db.savedAnswers.where('collectionId').equals(id).delete();
    
    // Delete the collection itself
    await db.collections.delete(id);
  }

  /**
   * Get current conversation ID from URL
   * Helper method to extract conversation identifier
   */
  private getCurrentConversationId(): string | null {
    // This will be called from the panel context
    // We need to get the conversation ID from the active tab's URL
    // For now, return null - will be enhanced when we have tab communication
    // TODO: Get from chrome.tabs or pass from parent component
    return null;
  }
}

// Export singleton instance
export const BookmarkService = new BookmarkServiceClass();
