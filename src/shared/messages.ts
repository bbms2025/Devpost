import type { MessageEntry, ExtractionStatus } from './types';

// Side panel → background service worker
export type BackgroundRequest =
  | { type: 'GET_TAB_ID' };

export type BackgroundResponse =
  | { type: 'TAB_ID'; tabId: number }
  | { type: 'TAB_ID_ERROR'; reason: string };

// Side panel → content script (via chrome.tabs.sendMessage)
export type PanelMessage =
  | { type: 'PANEL_READY' }
  | { type: 'LOAD_CONVERSATION' }
  | { type: 'NAVIGATE_TO'; id: string };

// Content script → side panel (via chrome.runtime.sendMessage, relayed by the worker)
export type ContentMessage =
  | { type: 'CONTENT_SCRIPT_READY' }
  | { type: 'OUTLINE_RESET' }
  | { type: 'STATUS_UPDATE'; status: ExtractionStatus }
  | { type: 'MESSAGE_BATCH'; entries: MessageEntry[] }
  | { type: 'MESSAGE_ADDED'; entry: MessageEntry }
  | { type: 'MESSAGE_UPDATED'; entry: MessageEntry }
  | { type: 'NAVIGATE_OK'; id: string }
  | { type: 'NAVIGATE_FAILED'; id: string; reason: string };

const CONTENT_MESSAGE_TYPES: ContentMessage['type'][] = [
  'CONTENT_SCRIPT_READY',
  'OUTLINE_RESET',
  'STATUS_UPDATE',
  'MESSAGE_BATCH',
  'MESSAGE_ADDED',
  'MESSAGE_UPDATED',
  'NAVIGATE_OK',
  'NAVIGATE_FAILED',
];

export function isContentMessage(message: unknown): message is ContentMessage {
  if (!message || typeof message !== 'object' || !('type' in message)) return false;
  return CONTENT_MESSAGE_TYPES.includes((message as { type: string }).type as ContentMessage['type']);
}
