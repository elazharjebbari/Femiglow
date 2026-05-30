import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { server, http, HttpResponse } from '@/test/msw/server';

import { sendSocialAlert } from './alerts';

/**
 * ARC-004 (migration MSW) — ce test interceptait fetch via globalThis.fetch=vi.fn().
 * Migré vers MSW (handlers réseau fidèles) pour la parité mock/live et la
 * compatibilité avec le futur harnais global. server.listen est idempotent
 * (cf. test/msw/server.ts), donc le test fonctionne en isolé ET sous un montage
 * global. onUnhandledRequest:'error' garantit qu'aucun POST n'échappe au mock.
 */
const SLACK_URL = 'https://hooks.slack.test/abc';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('sendSocialAlert', () => {
  it('no-op + false quand aucune URL configurée', async () => {
    // Aucun handler enregistré : si un fetch partait, MSW lèverait (error).
    const ok = await sendSocialAlert({ title: 'X' }, { webhookUrl: undefined });
    expect(ok).toBe(false);
  });

  it('POST JSON Slack-compatible quand URL configurée', async () => {
    let captured: { url: string; method: string; body: Record<string, unknown> } | null = null;
    server.use(
      http.post(SLACK_URL, async ({ request }) => {
        captured = {
          url: request.url,
          method: request.method,
          body: (await request.json()) as Record<string, unknown>,
        };
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const ok = await sendSocialAlert(
      {
        title: 'Postiz 503',
        detail: 'instagram',
        severity: 'critical',
        fields: [{ label: 'jobId', value: 'job_1' }],
      },
      { webhookUrl: SLACK_URL },
    );

    expect(ok).toBe(true);
    expect(captured).not.toBeNull();
    expect(captured!.url).toBe(SLACK_URL);
    expect(captured!.method).toBe('POST');
    const body = captured!.body as {
      text?: string;
      attachments?: Array<{ color?: string; fields?: Array<Record<string, unknown>> }>;
    };
    expect(body.text).toBe('Postiz 503');
    expect(body.attachments?.[0]?.color).toBe('#dc2626');
    expect(body.attachments?.[0]?.fields?.[0]).toMatchObject({ title: 'jobId', value: 'job_1' });
  });

  it('renvoie false si fetch lève (erreur réseau)', async () => {
    server.use(http.post(SLACK_URL, () => HttpResponse.error()));
    const ok = await sendSocialAlert({ title: 'X' }, { webhookUrl: SLACK_URL });
    expect(ok).toBe(false);
  });

  it('renvoie false sur status != 2xx', async () => {
    server.use(http.post(SLACK_URL, () => new HttpResponse(null, { status: 500 })));
    const ok = await sendSocialAlert({ title: 'X' }, { webhookUrl: SLACK_URL });
    expect(ok).toBe(false);
  });
});
