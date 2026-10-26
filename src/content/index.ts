import type { PanelMessage } from '../shared/messages';
import { ExtractionOrchestrator } from './extraction';

const orchestrator = new ExtractionOrchestrator();

// Guard: check if the extension context is still valid before any chrome API call
function isContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message: PanelMessage) => {
  if (!isContextValid()) return false;

  if (message.type === 'PANEL_READY') {
    // Panel opened — no auto-extract, user clicks Load
  }
  if (message.type === 'LOAD_CONVERSATION') {
    console.log('[AI Chat Organizer] LOAD_CONVERSATION received — starting extraction.');
    orchestrator.start();
  }
  if (message.type === 'NAVIGATE_TO') {
    orchestrator.navigateTo(message.id);
  }
  return false;
});

console.log('[AI Chat Organizer] Content script loaded on', location.href);

// Announce to panel that content script is ready
function announceReady() {
  if (!isContextValid()) return;
  chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }, () => {
    void chrome.runtime.lastError;
  });
}

announceReady();
