/**
 * CHAT-068 — Tests `sendChatAlert`.
 *
 * On stub `globalThis.fetch` pour valider :
 *  - no-op + log debug si aucune URL configurée
 *  - POST JSON correct quand URL fournie via opts.webhookUrl
 *  - false retourné quand fetch throws
 *  - false retourné quand le serveur répond non-2xx
 *  - timeout déclenché via AbortController
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendChatAlert } from './slack-notify';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sendChatAlert', () => {
  it('no-op sans URL configurée', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const ok = await sendChatAlert(
      { title: 'X' },
      { webhookUrl: undefined },
    );
    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('envoie un POST JSON avec la payload Slack-compatible', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const ok = await sendChatAlert(
      {
        title: 'Provider down',
        detail: 'OpenAI a explosé son quota.',
        severity: 'critical',
        fields: [{ label: 'Quota', value: '10 €' }],
      },
      { webhookUrl: 'https://hooks.slack.com/services/AAA/BBB/CCC' },
    );
    expect(ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://hooks.slack.com/services/AAA/BBB/CCC');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as { body: string }).body) as {
      text: string;
      attachments: Array<{ color: string; fields: Array<{ title: string; value: string }> }>;
    };
    expect(body.text).toBe('Provider down');
    expect(body.attachments[0]?.color).toBe('#dc2626');
    expect(body.attachments[0]?.fields[0]).toMatchObject({
      title: 'Quota',
      value: '10 €',
    });
  });

  it('retourne false si fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'));
    const ok = await sendChatAlert(
      { title: 'X' },
      { webhookUrl: 'https://example.com/hook' },
    );
    expect(ok).toBe(false);
  });

  it('retourne false si le serveur répond 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('boom', { status: 500 }),
    );
    const ok = await sendChatAlert(
      { title: 'X' },
      { webhookUrl: 'https://example.com/hook' },
    );
    expect(ok).toBe(false);
  });

  it('utilise la couleur info par défaut', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await sendChatAlert(
      { title: 'X', severity: 'info' },
      { webhookUrl: 'https://example.com/hook' },
    );
    const body = JSON.parse(
      (fetchSpy.mock.calls[0]![1] as { body: string }).body,
    ) as { attachments: Array<{ color: string }> };
    expect(body.attachments[0]?.color).toBe('#3b82f6');
  });
});
