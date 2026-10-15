import type { BackgroundRequest, BackgroundResponse, ContentMessage } from '../shared/messages';
import { isContentMessage } from '../shared/messages';

const panelPorts = new Set<chrome.runtime.Port>();
const pendingForPanel: ContentMessage[] = [];

function relayToPanel(message: ContentMessage) {
  if (panelPorts.size === 0) {
    pendingForPanel.push(message);
    if (pendingForPanel.length > 200) pendingForPanel.shift();
    return;
  }
  for (const port of panelPorts) {
    try {
      port.postMessage(message);
    } catch (err) {
      console.warn('[AI Chat Organizer] Failed to relay to panel:', err);
    }
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'panel') return;
  panelPorts.add(port);
  for (const message of pendingForPanel) {
    try {
      port.postMessage(message);
    } catch (err) {
      console.warn('[AI Chat Organizer] Failed to flush panel queue:', err);
    }
  }
  pendingForPanel.length = 0;
  port.onDisconnect.addListener(() => panelPorts.delete(port));
});

// Open the side panel when the extension icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// Log when content script tab is detected
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('chatgpt.com')) {
    console.log('[AI Chat Organizer] ChatGPT tab detected:', tabId, tab.url);
  }
});

const CHATGPT_URL_PATTERNS = ['https://chatgpt.com/*', 'https://chat.openai.com/*'];

function isChatGptUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('chatgpt.com') || url.includes('chat.openai.com');
}

function resolveChatGptTab(sendResponse: (response: BackgroundResponse) => void) {
  // Side panel / DevTools focus can make currentWindow the wrong window.
  // Prefer a ChatGPT tab in the last focused window, then any ChatGPT tab.
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (activeTabs) => {
    const focused = activeTabs.find((tab) => tab.id != null && isChatGptUrl(tab.url));
    if (focused?.id != null) {
      sendResponse({ type: 'TAB_ID', tabId: focused.id });
      return;
    }

    chrome.tabs.query({ url: CHATGPT_URL_PATTERNS }, (chatTabs) => {
      const tab = chatTabs.find((t) => t.active) ?? chatTabs[0];
      if (tab?.id != null) {
        sendResponse({ type: 'TAB_ID', tabId: tab.id });
      } else {
        sendResponse({ type: 'TAB_ID_ERROR', reason: 'No ChatGPT tab found' });
      }
    });
  });
}

// Bridge: tab ID for the side panel, and relay content-script messages
// to the panel (MV3 side panels do not always receive them directly).
chrome.runtime.onMessage.addListener(
  (request: BackgroundRequest | { type: string }, sender, sendResponse) => {
    if (request.type === 'GET_TAB_ID') {
      resolveChatGptTab(sendResponse as (response: BackgroundResponse) => void);
      return true;
    }

    if (sender.tab && isContentMessage(request)) {
      relayToPanel(request);
    }
  }
);
