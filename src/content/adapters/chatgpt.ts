import type { Speaker } from '../../shared/types';

// ChatGPT DOM selectors — reverse-engineered from live DOM, October 2026.
//
// User messages:    DIV[class*="bg-user-message"]
// Assistant turns:  DIV[class*="MarkdownRoot"]
// Collect both sets and sort by DOM position for chronological order.

const STREAMING_SELECTOR = [
  'button[data-testid="stop-button"]',
  'button[aria-label="Stop streaming"]',
  'button[aria-label="Stop generating"]',
  'button[aria-label="Stop"]',
  'button[aria-label="Stop response"]',
  '.result-streaming',
].join(', ');

export class ChatGPTAdapter {
  findMessages(root: ParentNode = document): HTMLElement[] {
    const searchRoot = (root === document
      ? document.getElementById('root') ?? document
      : root) as ParentNode;

    // Strategy 1: data-testid conversation turns (stable if present)
    const byTestId = Array.from(
      searchRoot.querySelectorAll<HTMLElement>('[data-testid*="conversation-turn"]')
    );
    if (byTestId.length > 0) {
      console.log('[AI Chat Organizer] Found by data-testid:', byTestId.length);
      return byTestId;
    }

    // Strategy 2: New ChatGPT (2026) — collect user + assistant elements separately
    const userEls = Array.from(
      searchRoot.querySelectorAll<HTMLElement>('[class*="bg-user-message"]')
    ).filter((el) => {
      // Only visible elements that are actually rendered
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && el.offsetParent !== null;
    });

    const assistantEls = Array.from(
      searchRoot.querySelectorAll<HTMLElement>('[class*="MarkdownRoot"]')
    ).filter((el) => {
      // Only visible elements that are actually rendered
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || el.offsetParent === null) return false;
      return (el.innerText || el.textContent || '').trim().length > 0;
    });

    if (userEls.length > 0 || assistantEls.length > 0) {
      const combined = [...userEls, ...assistantEls].sort((a, b) => {
        const pos = a.compareDocumentPosition(b);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });
      console.log('[AI Chat Organizer] Found user:', userEls.length, 'assistant:', assistantEls.length);
      return combined;
    }

    // Strategy 3: data-message-author-role (older ChatGPT)
    const byRole = Array.from(
      searchRoot.querySelectorAll<HTMLElement>(
        '[data-message-author-role="user"], [data-message-author-role="assistant"]'
      )
    );
    if (byRole.length > 0) {
      console.log('[AI Chat Organizer] Found by data-message-author-role:', byRole.length);
      return byRole;
    }

    // Strategy 4: article elements
    const topArticles = Array.from(
      searchRoot.querySelectorAll<HTMLElement>('article')
    ).filter((el) => !el.parentElement?.closest('article'));
    if (topArticles.length > 0) {
      console.log('[AI Chat Organizer] Found by article:', topArticles.length);
      return topArticles;
    }

    console.warn('[AI Chat Organizer] No messages found. Snapshot:', {
      articles: document.querySelectorAll('article').length,
      rootChildren: document.getElementById('root')?.children.length ?? 0,
      bgUserMessage: document.querySelectorAll('[class*="bg-user-message"]').length,
      markdownRoot: document.querySelectorAll('[class*="MarkdownRoot"]').length,
    });

    return [];
  }

  getSpeaker(el: HTMLElement): Speaker | null {
    const roleAttr =
      el.getAttribute('data-message-author-role') ??
      el.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role');
    if (roleAttr === 'user' || roleAttr === 'assistant') return roleAttr;

    const cls = el.className ?? '';
    if (cls.includes('bg-user-message')) return 'user';
    if (cls.includes('MarkdownRoot')) return 'assistant';

    const testId = el.getAttribute('data-testid') ?? '';
    const turnMatch = testId.match(/conversation-turn-(\d+)/);
    if (turnMatch) {
      return parseInt(turnMatch[1], 10) % 2 === 1 ? 'user' : 'assistant';
    }

    return null;
  }

  getSiteId(el: HTMLElement): string | undefined {
    return el.getAttribute('data-message-id') ?? undefined;
  }

  getText(el: HTMLElement): string {
    const cls = el.className ?? '';
    if (cls.includes('MarkdownRoot')) {
      return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    }
    const textEl = el.querySelector('p, [class*="whitespace-pre-wrap"]') ?? el;
    return ((textEl as HTMLElement).innerText || textEl.textContent || '').replace(/\s+/g, ' ').trim();
  }

  isPageStreaming(): boolean {
    return Boolean(document.querySelector(STREAMING_SELECTOR));
  }

  isElementStreaming(el: HTMLElement, all: HTMLElement[]): boolean {
    if (this.getSpeaker(el) !== 'assistant') return false;
    if (!this.isPageStreaming()) return false;
    return all[all.length - 1] === el;
  }
}
