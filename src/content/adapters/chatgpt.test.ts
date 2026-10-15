import { describe, expect, it } from 'vitest';
import { ChatGPTAdapter } from './chatgpt';

describe('ChatGPTAdapter', () => {
  it('reads speaker, site id, and text from message nodes', () => {
    document.body.innerHTML = `
      <div data-message-author-role="user" data-message-id="u1">Hello world</div>
      <div data-message-author-role="assistant" data-message-id="a1">
        <div class="markdown">Here is a reply with enough text to identify it.</div>
      </div>
    `;

    const adapter = new ChatGPTAdapter();
    const messages = adapter.findMessages();
    expect(messages).toHaveLength(2);
    expect(adapter.getSpeaker(messages[0])).toBe('user');
    expect(adapter.getSiteId(messages[0])).toBe('u1');
    expect(adapter.getText(messages[0])).toBe('Hello world');
    expect(adapter.getSpeaker(messages[1])).toBe('assistant');
    expect(adapter.getText(messages[1])).toContain('Here is a reply');
  });
});
