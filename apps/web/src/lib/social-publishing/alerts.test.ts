import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sendSocialAlert } from './alerts';

const originalFetch = globalThis.fetch;

describe('sendSocialAlert', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('no-op + false quand aucune URL configurée', async () => {
    const ok = await sendSocialAlert({ title: 'X' }, { webhookUrl: undefined });
    expect(ok).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('POST JSON Slack-compatible quand URL configurée', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ok = await sendSocialAlert(
      {
        title: 'Postiz 503',
        detail: 'instagram',
        severity: 'critical',
        fields: [{ label: 'jobId', value: 'job_1' }],
      },
      { webhookUrl: 'https://hooks.slack.test/abc' },
    );
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error('expected one fetch call');
    expect(call[0]).toBe('https://hooks.slack.test/abc');
    expect(call[1]?.method).toBe('POST');
    const body = JSON.parse(call[1]?.body as string);
    expect(body.text).toBe('Postiz 503');
    expect(body.attachments?.[0]?.color).toBe('#dc2626');
    expect(body.attachments?.[0]?.fields?.[0]).toMatchObject({ title: 'jobId', value: 'job_1' });
  });

  it('renvoie false si fetch lève', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ok = await sendSocialAlert({ title: 'X' }, { webhookUrl: 'https://hooks.slack.test/abc' });
    expect(ok).toBe(false);
  });

  it('renvoie false sur status != 2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ok = await sendSocialAlert({ title: 'X' }, { webhookUrl: 'https://hooks.slack.test/abc' });
    expect(ok).toBe(false);
  });
});
