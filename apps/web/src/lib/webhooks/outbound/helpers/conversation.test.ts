import { describe, expect, it } from 'vitest';

import {
  limitConversationPayload,
  snapshotMessagesToConversation,
} from './conversation';

describe('snapshotMessagesToConversation', () => {
  it('retourne undefined pour snapshot vide', () => {
    expect(snapshotMessagesToConversation(null)).toBeUndefined();
    expect(snapshotMessagesToConversation([])).toBeUndefined();
  });

  it('mappe user et assistant vers le contrat webhook', () => {
    const out = snapshotMessagesToConversation(
      [
        { role: 'user', content: 'Salam', at: '2026-05-14T10:00:00Z' },
        { role: 'assistant', content: 'Bonjour', at: '2026-05-14T10:00:01Z' },
      ],
      { userName: 'Sara' },
    );
    expect(out).toEqual([
      { role: 'user', name: 'Sara', text: 'Salam', ts: '2026-05-14T10:00:00.000Z' },
      { role: 'bot', name: 'Assistant', text: 'Bonjour', ts: '2026-05-14T10:00:01.000Z' },
    ]);
  });

  it('filtre system/tool et conserve les derniers messages', () => {
    const out = snapshotMessagesToConversation(
      [
        { role: 'system', content: 'hidden', at: '2026-05-14T10:00:00Z' },
        { role: 'user', content: 'one', at: '2026-05-14T10:00:01Z' },
        { role: 'tool', content: 'hidden', at: '2026-05-14T10:00:02Z' },
        { role: 'assistant', content: 'two', at: '2026-05-14T10:00:03Z' },
      ],
      { maxMessages: 1 },
    );
    expect(out).toHaveLength(1);
    expect(out?.[0]?.text).toBe('two');
  });

  it('tronque texte et budget bytes de facon deterministe', () => {
    const out = limitConversationPayload(
      [
        { role: 'user', name: 'A', text: 'a'.repeat(500), ts: '2026-05-14T10:00:00.000Z' },
        { role: 'bot', name: 'Assistant', text: 'b'.repeat(500), ts: '2026-05-14T10:00:01.000Z' },
      ],
      { maxTextLength: 10, maxBytes: 120 },
    );
    expect(out).toHaveLength(1);
    expect(out?.[0]?.text).toBe('b'.repeat(10));
  });
});
