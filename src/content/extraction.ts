import type { ContentMessage } from '../shared/messages';
import type { ExtractionStatus, MessageEntry } from '../shared/types';
import { ChatGPTAdapter } from './adapters/chatgpt';
import { MessageIdentityService, fingerprintText } from './identity';

const BATCH_SIZE = 25;
const DEBOUNCE_MS = 300;
const HIGHLIGHT_MS = 800;
const URL_POLL_MS = 500;

function isContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/** Conversation id from /c/{id} only — ignore query-string churn during load. */
function conversationKey(): string {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const chatId = path.match(/\/c\/([a-zA-Z0-9-]+)/);
  return chatId ? chatId[1] : path;
}

function postToPanel(message: ContentMessage) {
  if (!isContextValid()) return;
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

function findScrollContainer(): HTMLElement | null {
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

  const allScrollable = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((el) => {
    if (el === document.body || el === document.documentElement) return false;
    const s = window.getComputedStyle(el);
    return (
      (s.overflowY === 'auto' || s.overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight + 100
    );
  });

  return allScrollable.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? null;
}

async function scrollToLoadAll(container: HTMLElement): Promise<void> {
  const originalScrollTop = container.scrollTop;
  let lastScrollHeight = container.scrollHeight;
  container.scrollTop = 0;

  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((r) => setTimeout(r, 300));
    if (container.scrollHeight > lastScrollHeight) {
      lastScrollHeight = container.scrollHeight;
      container.scrollTop = 0;
    } else {
      break;
    }
  }

  await new Promise((r) => setTimeout(r, 300));
  container.scrollTop = originalScrollTop;
}

export class ExtractionOrchestrator {
  private adapter = new ChatGPTAdapter();
  private identity = new MessageIdentityService(this.adapter);
  private observer: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private urlPollTimer: ReturnType<typeof setInterval> | null = null;
  private lastConversation = conversationKey();
  private lastSent = new Map<string, Pick<MessageEntry, 'contentFingerprint' | 'status' | 'preview'>>();
  private extracting = false;
  private generation = 0;

  private isCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  private emit(
    message:
      | { type: 'OUTLINE_RESET' }
      | { type: 'STATUS_UPDATE'; status: ExtractionStatus }
      | { type: 'MESSAGE_BATCH'; entries: MessageEntry[] }
      | { type: 'MESSAGE_ADDED'; entry: MessageEntry }
      | { type: 'MESSAGE_UPDATED'; entry: MessageEntry }
      | { type: 'NAVIGATE_OK'; id: string }
      | { type: 'NAVIGATE_FAILED'; id: string; reason: string },
    generation: number = this.generation
  ) {
    if (!this.isCurrent(generation)) return;
    postToPanel({ ...message, generation } as ContentMessage);
  }

  start() {
    this.generation += 1;
    const generation = this.generation;
    injectHighlightStyles();
    this.identity.reset();
    this.lastSent.clear();
    this.lastConversation = conversationKey();
    this.extracting = false;
    this.emit({ type: 'OUTLINE_RESET' }, generation);
    this.emit({ type: 'STATUS_UPDATE', status: 'reading' }, generation);
    this.observe();
    this.watchUrl();
    void this.extractWithScroll(generation);
  }

  stop() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.urlPollTimer) clearInterval(this.urlPollTimer);
  }

  navigateTo(id: string) {
    let el = this.identity.resolve(id);
    if (!el) el = this.findElementById(id);

    if (!el) {
      this.emit({ type: 'NAVIGATE_FAILED', id, reason: 'Message element not found' });
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('aco-highlight');
    void el.offsetWidth;
    el.classList.add('aco-highlight');
    window.setTimeout(() => el!.classList.remove('aco-highlight'), HIGHLIGHT_MS);
    this.emit({ type: 'NAVIGATE_OK', id });
  }

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

  private async extractWithScroll(generation: number) {
    this.extracting = true;
    try {
      const container = findScrollContainer();
      if (container && container.scrollTop > 100) {
        console.log('[AI Chat Organizer] Scrolling to load all messages...');
        await scrollToLoadAll(container);
      }
      if (!this.isCurrent(generation)) return;

      const entries = this.collectEntries();
      if (entries.length === 0) {
        console.log('[AI Chat Organizer] No messages yet — waiting for MutationObserver');
        return;
      }
      await this.sendEntries(entries, generation);
    } finally {
      if (this.isCurrent(generation)) this.extracting = false;
    }
  }

  private async extractFull(generation: number) {
    this.extracting = true;
    try {
      if (!this.isCurrent(generation)) return;
      const entries = this.collectEntries();
      if (entries.length === 0) return;
      await this.sendEntries(entries, generation);
    } finally {
      if (this.isCurrent(generation)) this.extracting = false;
    }
  }

  private async sendEntries(entries: MessageEntry[], generation: number) {
    if (!this.isCurrent(generation)) return;
    this.emit({ type: 'STATUS_UPDATE', status: 'reading' }, generation);

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      if (!this.isCurrent(generation)) return;
      const batch = entries.slice(i, i + BATCH_SIZE);
      this.emit({ type: 'MESSAGE_BATCH', entries: batch }, generation);
      for (const entry of batch) {
        this.lastSent.set(entry.id, {
          contentFingerprint: entry.contentFingerprint,
          status: entry.status,
          preview: entry.preview,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    this.emit({
      type: 'STATUS_UPDATE',
      status: entries.some((e) => e.status === 'generating') ? 'reading' : 'ready',
    }, generation);
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

  private watchUrl() {
    if (this.urlPollTimer) clearInterval(this.urlPollTimer);
    this.urlPollTimer = setInterval(() => {
      if (!isContextValid()) {
        this.stop();
        return;
      }
      const currentKey = conversationKey();
      if (currentKey !== this.lastConversation) {
        // Debounce: wait 300ms for ChatGPT to fully load the new conversation
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.start();
        }, 300);
      }
    }, URL_POLL_MS);
  }

  private reconcile() {
    if (this.extracting) return;

    if (conversationKey() !== this.lastConversation) {
      this.start();
      return;
    }

    const entries = this.collectEntries();

    if (entries.length === 0) {
      if (this.lastSent.size === 0) return;
      this.emit({ type: 'STATUS_UPDATE', status: 'incomplete' });
      return;
    }

    if (this.lastSent.size === 0) {
      void this.extractFull(this.generation);
      return;
    }

    for (const entry of entries) {
      const prev = this.lastSent.get(entry.id);
      if (!prev) {
        this.emit({ type: 'MESSAGE_ADDED', entry });
      } else if (
        prev.contentFingerprint !== entry.contentFingerprint ||
        prev.status !== entry.status ||
        prev.preview !== entry.preview
      ) {
        this.emit({ type: 'MESSAGE_UPDATED', entry });
      }
      this.lastSent.set(entry.id, {
        contentFingerprint: entry.contentFingerprint,
        status: entry.status,
        preview: entry.preview,
      });
    }

    this.emit({
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
