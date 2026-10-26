// Background service worker — Manifest V3
// Responsibilities:
//   1. Open the side panel when the extension icon is clicked
//   2. Supply the active ChatGPT tab ID to the side panel
//   3. Relay content-script messages to the side panel

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

const CHATGPT_PATTERNS = ['https://chatgpt.com/*', 'https://chat.openai.com/*'];

function isChatGptUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('chatgpt.com') || url.includes('chat.openai.com');
}

function resolveChatGptTabId(
  sendResponse: (r: { type: string; tabId?: number; reason?: string }) => void
) {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (activeTabs) => {
    const match = activeTabs.find((t) => t.id != null && isChatGptUrl(t.url));
    if (match?.id != null) {
      sendResponse({ type: 'TAB_ID', tabId: match.id });
      return;
    }
    chrome.tabs.query({ url: CHATGPT_PATTERNS }, (tabs) => {
      const tab = tabs.find((t) => t.active) ?? tabs[0];
      if (tab?.id != null) {
        sendResponse({ type: 'TAB_ID', tabId: tab.id });
      } else {
        sendResponse({ type: 'TAB_ID_ERROR', reason: 'No ChatGPT tab found' });
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type === 'GET_TAB_ID') {
    resolveChatGptTabId(sendResponse);
    return true;
  }

  // Relay content-script messages to the side panel.
  // Mark them so the panel can distinguish relayed from direct messages.
  if (sender.tab) {
    chrome.runtime.sendMessage({ ...request, relayed: true }).catch(() => {
      // Panel not open — suppress error
    });
  }
});
