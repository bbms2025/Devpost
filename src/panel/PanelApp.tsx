import { useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { OutlineList } from './components/OutlineList';
import { useOutlineStore } from './store';
import type { ContentMessage } from '../shared/messages';
import type { BackgroundRequest, BackgroundResponse } from '../shared/messages';

async function getActiveTabId(): Promise<number> {
  return new Promise((resolve, reject) => {
    const request: BackgroundRequest = { type: 'GET_TAB_ID' };
    chrome.runtime.sendMessage(request, (response: BackgroundResponse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.type === 'TAB_ID') {
        resolve(response.tabId);
      } else {
        reject(new Error(response?.reason ?? 'Unknown error'));
      }
    });
  });
}

async function sendPanelReady(): Promise<boolean> {
  try {
    const tabId = await getActiveTabId();
    await chrome.tabs.sendMessage(tabId, { type: 'PANEL_READY' });
    console.log('[AI Chat Organizer] PANEL_READY sent to tab', tabId);
    return true;
  } catch {
    // Content script not ready yet — will retry or wait for CONTENT_SCRIPT_READY
    return false;
  }
}

export function PanelApp() {
  const [state, dispatch] = useOutlineStore();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extractionStartedRef = useRef(false);

  useEffect(() => {
    const applyMessage = (message: ContentMessage) => {
      switch (message.type) {
        case 'CONTENT_SCRIPT_READY':
          // Content script just loaded — send PANEL_READY now so it starts extracting
          console.log('[AI Chat Organizer] Content script announced ready — triggering extraction.');
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }
          extractionStartedRef.current = false; // reset so we send fresh PANEL_READY
          sendPanelReady().then(reached => {
            if (reached) extractionStartedRef.current = true;
          });
          break;
        case 'OUTLINE_RESET':
          dispatch({ type: 'RESET' });
          break;
        case 'STATUS_UPDATE':
          dispatch({ type: 'SET_STATUS', status: message.status });
          break;
        case 'MESSAGE_BATCH':
          dispatch({ type: 'APPEND_ENTRIES', entries: message.entries });
          break;
        case 'MESSAGE_ADDED':
          dispatch({ type: 'ADD_ENTRY', entry: message.entry });
          break;
        case 'MESSAGE_UPDATED':
          dispatch({ type: 'UPDATE_ENTRY', entry: message.entry });
          break;
        case 'NAVIGATE_OK':
          dispatch({ type: 'SET_SELECTED', id: message.id });
          break;
        case 'NAVIGATE_FAILED':
          dispatch({ type: 'SET_ENTRY_FAILED', id: message.id });
          break;
      }
    };

    chrome.runtime.onMessage.addListener(applyMessage);

    // Also try immediately — if the content script loaded before the panel opened
    let cancelled = false;
    async function tryNotify() {
      const reached = await sendPanelReady();
      if (cancelled) return;
      if (reached) {
        extractionStartedRef.current = true;
      } else {
        // Retry until content script loads (CONTENT_SCRIPT_READY will also trigger it)
        retryTimerRef.current = setTimeout(() => {
          if (!cancelled) tryNotify();
        }, 2000);
      }
    }

    tryNotify();

    return () => {
      cancelled = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      chrome.runtime.onMessage.removeListener(applyMessage);
    };
  }, [dispatch]);

  const handleNavigate = useCallback(async (id: string) => {
    try {
      const tabId = await getActiveTabId();
      await chrome.tabs.sendMessage(tabId, { type: 'NAVIGATE_TO', id });
    } catch (err) {
      console.warn('[AI Chat Organizer] Navigation failed:', err);
      dispatch({ type: 'SET_ENTRY_FAILED', id });
    }
  }, [dispatch]);

  const handleLoad = useCallback(async () => {
    try {
      dispatch({ type: 'RESET' });
      const tabId = await getActiveTabId();
      await chrome.tabs.sendMessage(tabId, { type: 'LOAD_CONVERSATION' });
    } catch (err) {
      console.warn('[AI Chat Organizer] Load failed:', err);
    }
  }, [dispatch]);

  const isLoading = state.status === 'reading';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header status={state.status} onLoad={handleLoad} isLoading={isLoading} />
      <OutlineList
        entries={state.entries}
        selectedId={state.selectedId}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
