import type { PanelMessage } from '../shared/messages';
import { ExtractionOrchestrator } from './extraction';

const orchestrator = new ExtractionOrchestrator();

chrome.runtime.onMessage.addListener((message: PanelMessage) => {
  if (message.type === 'PANEL_READY') {
    console.log('[AI Chat Organizer] PANEL_READY received — content script ready, waiting for manual load.');
    // Don't auto-extract — user triggers via the Load button
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

// Announce to the panel that we're ready — handles the case where
// the content script loads AFTER the panel has already opened and
// sent PANEL_READY (which went unheard). The panel listens for this
// message and triggers extraction on receipt.
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }, () => {
  // Suppress "no listeners" error — panel may not be open yet, that's fine
  void chrome.runtime.lastError;
});
