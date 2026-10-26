import { useEffect, useCallback, useState } from 'react';
import { Header } from './components/Header';
import { OutlineList } from './components/OutlineList';
import { StatsCard } from './components/StatsCard';
import { SaveBookmarkModal } from './components/SaveBookmarkModal';
import { SavedViewsModal } from './components/SavedViewsModal';
import { Toast } from './components/Toast';
import { useOutlineStore } from './store';
import type { MessageEntry } from '../shared/types';
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

export function PanelApp() {
  const [state, dispatch] = useOutlineStore();
  
  // Bookmark modal state
  const [bookmarkEntry, setBookmarkEntry] = useState<MessageEntry | null>(null);
  
  // Saved views modal state
  const [isSavedViewsOpen, setIsSavedViewsOpen] = useState(false);
  
  // Toast state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Listen for messages relayed from the content script via the background
  useEffect(() => {
    const listener = (message: ContentMessage & { relayed?: boolean }) => {
      // Only process messages that were relayed by the background worker
      if (!message.relayed) return;

      switch (message.type) {
        case 'CONTENT_SCRIPT_READY':
          dispatch({ type: 'SET_STATUS', status: 'waiting' });
          break;
        case 'OUTLINE_RESET':
          dispatch({ type: 'RESET', generation: message.generation });
          break;
        case 'STATUS_UPDATE':
          dispatch({ type: 'SET_STATUS', status: message.status, generation: message.generation });
          break;
        case 'MESSAGE_BATCH':
          dispatch({
            type: 'APPEND_ENTRIES',
            entries: message.entries,
            generation: message.generation,
          });
          break;
        case 'MESSAGE_ADDED':
          dispatch({ type: 'ADD_ENTRY', entry: message.entry, generation: message.generation });
          break;
        case 'MESSAGE_UPDATED':
          dispatch({ type: 'UPDATE_ENTRY', entry: message.entry, generation: message.generation });
          break;
        case 'NAVIGATE_OK':
          dispatch({ type: 'SET_SELECTED', id: message.id });
          break;
        case 'NAVIGATE_FAILED':
          dispatch({ type: 'SET_ENTRY_FAILED', id: message.id });
          break;
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    // Reset state when panel opens (clear any stale data from previous session)
    dispatch({ type: 'RESET', generation: 0 });

    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [dispatch]);

  const handleLoad = useCallback(async () => {
    let attempts = 0;
    const tryLoad = async (): Promise<void> => {
      try {
        const tabId = await getActiveTabId();
        await chrome.tabs.sendMessage(tabId, { type: 'LOAD_CONVERSATION' });
      } catch {
        if (++attempts < 5) {
          await new Promise((r) => setTimeout(r, 1000));
          await tryLoad();
        } else {
          dispatch({ type: 'SET_STATUS', status: 'waiting' });
        }
      }
    };
    await tryLoad();
  }, [dispatch]);

  const handleNavigate = useCallback(async (id: string) => {
    try {
      const tabId = await getActiveTabId();
      await chrome.tabs.sendMessage(tabId, { type: 'NAVIGATE_TO', id });
    } catch {
      dispatch({ type: 'SET_ENTRY_FAILED', id });
    }
  }, [dispatch]);

  const isLoading = state.status === 'reading';

  const handleBookmark = useCallback((entry: MessageEntry) => {
    setBookmarkEntry(entry);
  }, []);

  const handleBookmarkSuccess = useCallback((collectionTitle: string) => {
    setToastType('success');
    setToastMessage(`Saved to ${collectionTitle}`);
  }, []);

  const handleBookmarkClose = useCallback(() => {
    setBookmarkEntry(null);
  }, []);

  const handleToastDismiss = useCallback(() => {
    setToastMessage('');
  }, []);

  const handleOpenSavedViews = useCallback(() => {
    setIsSavedViewsOpen(true);
  }, []);

  const handleCloseSavedViews = useCallback(() => {
    setIsSavedViewsOpen(false);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header 
        status={state.status} 
        onLoad={handleLoad} 
        isLoading={isLoading}
        onOpenSavedViews={handleOpenSavedViews}
      />
      {state.stats && (
        <StatsCard
          stats={state.stats}
          stale={state.staleNavigation}
          onReload={handleLoad}
        />
      )}
      <OutlineList
        key={state.generation}
        entries={state.entries}
        selectedId={state.selectedId}
        onNavigate={handleNavigate}
        onBookmark={handleBookmark}
      />
      
      {/* Bookmark Modal */}
      {bookmarkEntry && (
        <SaveBookmarkModal
          entry={bookmarkEntry}
          onClose={handleBookmarkClose}
          onSuccess={handleBookmarkSuccess}
        />
      )}
      
      {/* Saved Views Modal */}
      {isSavedViewsOpen && (
        <SavedViewsModal
          onClose={handleCloseSavedViews}
          onNavigateToSource={handleNavigate}
        />
      )}
      
      {/* Toast Notifications */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onDismiss={handleToastDismiss}
        />
      )}
    </div>
  );
}
