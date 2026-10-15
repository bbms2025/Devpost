import type { MessageEntry, Speaker } from '../shared/types';
import { ChatGPTAdapter } from './adapters/chatgpt';

export function fingerprintText(text: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `${normalized.length}:${hash}`;
}

function previewText(text: string): string {
  if (text.length <= 120) return text;
  return `${text.slice(0, 117).trimEnd()}...`;
}

export interface RegistryRecord {
  id: string;
  siteId?: string;
  speaker: Speaker;
  contentFingerprint: string;
  element: HTMLElement;
}

export class MessageIdentityService {
  private records = new Map<string, RegistryRecord>();
  private localSeq = 1;

  constructor(private adapter: ChatGPTAdapter) {}

  reset() {
    this.records.clear();
    this.localSeq = 1;
  }

  /** Expose a record for fresh DOM lookups in ExtractionOrchestrator */
  getRecord(id: string): RegistryRecord | undefined {
    return this.records.get(id);
  }

  register(el: HTMLElement, streaming: boolean): MessageEntry | null {
    const speaker = this.adapter.getSpeaker(el);
    if (!speaker) return null;

    const text = this.adapter.getText(el);
    const fingerprint = fingerprintText(text);
    const siteId = this.adapter.getSiteId(el);
    const existing = this.match(el, speaker, fingerprint, siteId);

    if (existing) {
      existing.element = el;
      existing.contentFingerprint = fingerprint;
      if (siteId) existing.siteId = siteId;
      return this.toEntry(existing, text, streaming);
    }

    const id = siteId ?? `local-${this.localSeq++}`;
    const record: RegistryRecord = {
      id,
      siteId,
      speaker,
      contentFingerprint: fingerprint,
      element: el,
    };
    this.records.set(id, record);
    return this.toEntry(record, text, streaming);
  }

  resolve(id: string): HTMLElement | null {
    const record = this.records.get(id);
    if (!record) return null;
    if (record.element.isConnected) return record.element;

    if (record.siteId) {
      const fresh = document.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(record.siteId)}"]`
      );
      if (fresh) {
        record.element = fresh;
        return fresh;
      }
    }

    return null;
  }

  private match(
    el: HTMLElement,
    speaker: Speaker,
    fingerprint: string,
    siteId?: string
  ): RegistryRecord | undefined {
    if (siteId) {
      const bySite = [...this.records.values()].find((r) => r.siteId === siteId);
      if (bySite) return bySite;
    }

    const byFingerprint = [...this.records.values()].filter(
      (r) => r.speaker === speaker && r.contentFingerprint === fingerprint
    );
    if (byFingerprint.length === 1) return byFingerprint[0];

    const connected = byFingerprint.find((r) => r.element === el);
    return connected;
  }

  private toEntry(record: RegistryRecord, text: string, streaming: boolean): MessageEntry {
    return {
      id: record.id,
      siteId: record.siteId,
      speaker: record.speaker,
      preview: streaming && !text ? 'Generating…' : previewText(text),
      contentFingerprint: record.contentFingerprint,
      status: streaming ? 'generating' : 'ready',
    };
  }
}
