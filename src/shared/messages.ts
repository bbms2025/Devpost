import type { MessageEntry, ExtractionStatus } from './types';

export type BackgroundRequest =
  | { type: 'GET_TAB_ID' };

export type BackgroundResponse =
  | { type: 'TAB_ID'; tabId: number }
  | { type: 'TAB_ID_ERROR'; reason: string };

export type PanelMessage =
  | { type: 'PANEL_READY' }
  | { type: 'LOAD_CONVERSATION' }
  | { type: 'NAVIGATE_TO'; id: string };

export type ContentMessage =
  | { type: 'CONTENT_SCRIPT_READY' }
  | { type: 'OUTLINE_RESET'; generation: number }
  | { type: 'STATUS_UPDATE'; status: ExtractionStatus; generation: number }
  | { type: 'MESSAGE_BATCH'; entries: MessageEntry[]; generation: number }
  | { type: 'MESSAGE_ADDED'; entry: MessageEntry; generation: number }
  | { type: 'MESSAGE_UPDATED'; entry: MessageEntry; generation: number }
  | { type: 'NAVIGATE_OK'; id: string; generation?: number }
  | { type: 'NAVIGATE_FAILED'; id: string; reason: string; generation?: number };

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
