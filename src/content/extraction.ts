import type { ContentMessage } from '../shared/messages';
import type { MessageEntry } from '../shared/types';
import { ChatGPTAdapter } from './adapters/chatgpt';
import { MessageIdentityService, fingerprintText } from './identity';

const BATCH_SIZE = 25;
const DEBOUNCE_MS = 300;
const HIGHLIGHT_MS = 800;
const URL_POLL_MS = 500; // poll for SPA navigation

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

/** Find ChatGPT's scrollable conversation container */
function findScrollContainer(): HTMLElement | null {
  // The main scroll area — look for a tall scrollable div inside main
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('main [class*="overflow"], main [style*="overflow"]')
  ).concat(
    Array.from(document.querySelectorAll<HTMLElement>('main'))
  );

  for (const el of candidates) {
    const style = window.getComputedStyle(el);
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight + 50
    ) {
      return el;
    }
  }

  // Fallback: find the element that is actually scrolled
  const allScrollable = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((el) => {
    if (el === document.body || el === document.documentElement) return false;
    const s = window.getComputedStyle(el);
    return (
      (s.overflowY === 'auto' || s.overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight + 100
    );
  });

  // Return the tallest scrollable element (most likely the conversation)
  return allScrollable.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? null;
}

/** Scroll to the top, wait for ChatGPT to render older messages, then restore */
async function scrollToLoadAll(container: HTMLElement): Promise<void> {
  const originalScrollTop = container.scrollTop;

  // Scroll to top incrementally so ChatGPT loads virtualized messages
  let lastScrollHeight = container.scrollHeight;
  container.scrollTop = 0;

  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((r) => setTimeout(r, 300));
    if (container.scrollHeight > lastScrollHeight) {
      lastScrollHeight = container.scrollHeight;
      container.scrollTop = 0; // keep scrolling up to load more
    } else {
      break; // no new content loaded
    }
  }

  // Small extra wait for React to render
  await new Promise((r) => setTimeout(r, 300));

  // Restore original position
  container.scrollTop = originalScrollTop;
}

export class ExtractionOrchestrator {
  private adapter = new ChatGPTAdapter();
  private identity = new MessageIdentityService(this.adapter);
  private observer: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private urlPollTimer: ReturnType<typeof setInterval> | null = null;
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
    this.observe();
    this.watchUrl();
    void this.extractWithScroll();
  }

  stop() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.urlPollTimer) clearInterval(this.urlPollTimer);
  }

  // Fix 3: re-query the DOM fresh at click time instead of trusting stale references
  navigateTo(id: string) {
    // First try the identity registry (fast path)
    let el = this.identity.resolve(id);

    // If not found or disconnected, do a fresh DOM scan
    if (!el) {
      el = this.findElementById(id);
    }

    if (!el) {
      postToPanel({ type: 'NAVIGATE_FAILED', id, reason: 'Message element not found' });
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('aco-highlight');
    void el.offsetWidth;
    el.classList.add('aco-highlight');
    window.setTimeout(() => el!.classList.remove('aco-highlight'), HIGHLIGHT_MS);
    postToPanel({ type: 'NAVIGATE_OK', id });
  }

  /** Fix 3: find an element by re-scanning the current DOM */
  private findElementById(id: string): HTMLElement | null {
    const elements = this.adapter.findMessages();
    for (const el of elements) {
      const siteId = this.adapter.getSiteId(el);
      if (siteId === id) return el;
      const record = this.identity.getRecord(id);
      if (record) {
        const speaker = this.adapter.getSpeaker(el);
        if (speaker === record.speaker) {
          const text = this.adapter.getText(el);
          if (fingerprintText(text) === record.contentFingerprint) return el;
        }
      }
    }
    return null;
  }

  // Fix 2: scroll to load all messages before extracting
  private async extractWithScroll() {
    this.extracting = true;

    const container = findScrollContainer();
    if (container && container.scrollTop > 100) {
      console.log('[AI Chat Organizer] Scrolling to load all messages...');
      await scrollToLoadAll(container);
    }

    const entries = this.collectEntries();
    if (entries.length === 0) {
      console.log('[AI Chat Organizer] No messages yet — waiting for MutationObserver');
      this.extracting = false;
      return;
    }

    await this.sendEntries(entries);
  }

  private async extractFull() {
    this.extracting = true;
    const entries = this.collectEntries();
    if (entries.length === 0) {
      this.extracting = false;
      return;
    }
    await this.sendEntries(entries);
  }

  private async sendEntries(entries: MessageEntry[]) {
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

  // Fix 1: poll for URL changes (SPA navigation doesn't always fire DOM mutations)
  private watchUrl() {
    if (this.urlPollTimer) clearInterval(this.urlPollTimer);
    this.urlPollTimer = setInterval(() => {
      if (location.pathname !== this.lastPath) {
        console.log('[AI Chat Organizer] URL changed — resetting for new conversation');
        this.lastPath = location.pathname;
        this.identity.reset();
        this.lastSent.clear();
        postToPanel({ type: 'OUTLINE_RESET' });
        postToPanel({ type: 'STATUS_UPDATE', status: 'waiting' });
      }
    }, URL_POLL_MS);
  }

  private reconcile() {
    if (this.extracting) return;

    // URL change handled by watchUrl() poll, but keep as safety net
    if (location.pathname !== this.lastPath) {
      this.lastPath = location.pathname;
      this.identity.reset();
      this.lastSent.clear();
      postToPanel({ type: 'OUTLINE_RESET' });
      postToPanel({ type: 'STATUS_UPDATE', status: 'waiting' });
      return;
    }

    const entries = this.collectEntries();

    if (entries.length === 0) {
      if (this.lastSent.size === 0) return; // still waiting for render
      postToPanel({ type: 'STATUS_UPDATE', status: 'incomplete' });
      return;
    }

    // First time we find messages — full extraction
    if (this.lastSent.size === 0) {
      void this.extractFull();
      return;
    }

    // Incremental update
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
    const entries: MessageEntry[] = [];
    for (const el of elements) {
      const streaming = this.adapter.isElementStreaming(el, elements);
      const entry = this.identity.register(el, streaming);
      if (entry) entries.push(entry);
    }
    return entries;
  }
}
