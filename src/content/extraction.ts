import type { ContentMessage } from '../shared/messages';
import type { MessageEntry } from '../shared/types';
import { ChatGPTAdapter } from './adapters/chatgpt';
import { MessageIdentityService } from './identity';

const BATCH_SIZE = 25;
const DEBOUNCE_MS = 300;
const HIGHLIGHT_MS = 800;

function postToPanel(message: ContentMessage) {
  chrome.runtime.sendMessage(message, () => {
    void chrome.runtime.lastError;
  });
}

function injectHighlightStyles() {
  if (document.getElementById('aco-highlight-style')) return;
  const style = document.createElement('style');
  style.id = 'aco-highlight-style';
  style.textContent = `
    @keyframes aco-highlight-fade {
      0% { background-color: rgba(59, 130, 246, 0.3); }
      100% { background-color: transparent; }
    }
    .aco-highlight {
      animation: aco-highlight-fade 800ms ease-out forwards;
      border-radius: 4px;
    }
  `;
  document.documentElement.appendChild(style);
}

export class ExtractionOrchestrator {
  private adapter = new ChatGPTAdapter();
  private identity = new MessageIdentityService(this.adapter);
  private observer: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPath = location.pathname;
  private lastSent = new Map<string, Pick<MessageEntry, 'contentFingerprint' | 'status' | 'preview'>>();
  private extracting = false;

  start() {
    injectHighlightStyles();
    this.identity.reset();
    this.lastSent.clear();
    this.lastPath = location.pathname;
    postToPanel({ type: 'OUTLINE_RESET' });
    postToPanel({ type: 'STATUS_UPDATE', status: 'reading' });
    // Start observing immediately — extraction will fire when messages appear
    this.observe();
    // Also try right away in case messages are already rendered
    void this.extractFull();
  }

  stop() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  navigateTo(id: string) {
    const el = this.identity.resolve(id);
    if (!el) {
      postToPanel({ type: 'NAVIGATE_FAILED', id, reason: 'Message element not found' });
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('aco-highlight');
    void el.offsetWidth;
    el.classList.add('aco-highlight');
    window.setTimeout(() => el.classList.remove('aco-highlight'), HIGHLIGHT_MS);
    postToPanel({ type: 'NAVIGATE_OK', id });
  }

  private async extractFull() {
    this.extracting = true;

    const entries = this.collectEntries();
    if (entries.length === 0) {
      // Nothing rendered yet — observer will call reconcile when DOM changes
      console.log('[AI Chat Organizer] No messages yet — waiting for DOM changes via MutationObserver');
      this.extracting = false;
      return;
    }

    postToPanel({ type: 'STATUS_UPDATE', status: 'reading' });

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      postToPanel({ type: 'MESSAGE_BATCH', entries: batch });
      for (const entry of batch) {
        this.lastSent.set(entry.id, {
          contentFingerprint: entry.contentFingerprint,
          status: entry.status,
          preview: entry.preview,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    postToPanel({
      type: 'STATUS_UPDATE',
      status: entries.some((e) => e.status === 'generating') ? 'reading' : 'ready',
    });
    this.extracting = false;
  }

  private observe() {
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.reconcile(), DEBOUNCE_MS);
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  private reconcile() {
    if (this.extracting) return;

    if (location.pathname !== this.lastPath) {
      this.start();
      return;
    }

    const entries = this.collectEntries();

    // If we haven't sent anything yet and found nothing, keep waiting silently
    if (entries.length === 0) {
      if (this.lastSent.size === 0) {
        return;
      }
      postToPanel({ type: 'STATUS_UPDATE', status: 'incomplete' });
      return;
    }

    // First time we find messages — do a full extraction
    if (this.lastSent.size === 0) {
      console.log('[AI Chat Organizer] Messages appeared in DOM — starting full extraction');
      void this.extractFull();
      return;
    }

    // Incremental update for subsequent changes
    for (const entry of entries) {
      const prev = this.lastSent.get(entry.id);
      if (!prev) {
        postToPanel({ type: 'MESSAGE_ADDED', entry });
      } else if (
        prev.contentFingerprint !== entry.contentFingerprint ||
        prev.status !== entry.status ||
        prev.preview !== entry.preview
      ) {
        postToPanel({ type: 'MESSAGE_UPDATED', entry });
      }
      this.lastSent.set(entry.id, {
        contentFingerprint: entry.contentFingerprint,
        status: entry.status,
        preview: entry.preview,
      });
    }

    postToPanel({
      type: 'STATUS_UPDATE',
      status: entries.some((e) => e.status === 'generating') ? 'reading' : 'ready',
    });
  }

  private collectEntries(): MessageEntry[] {
    const elements = this.adapter.findMessages();
    console.log(`[AI Chat Organizer] findMessages found ${elements.length} elements`);
    const entries: MessageEntry[] = [];
    for (const el of elements) {
      const streaming = this.adapter.isElementStreaming(el, elements);
      const entry = this.identity.register(el, streaming);
      if (entry) entries.push(entry);
    }
    return entries;
  }
}
