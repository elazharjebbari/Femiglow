import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import {
  getTrackingSetting,
  TRACKING_SETTING_KEYS,
} from '@/lib/db/queries/tracking/settings';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

vi.mock('@/lib/tracking/server/audit', () => ({
  auditTrackingChange: vi.fn(async () => {}),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { GET, PATCH } from './route';

const adminSession = {
  adminId: 'adm_tracking_settings',
  email: 'admin@femiglow.test',
  issuedAt: 0,
  expiresAt: Date.now() + 60_000,
} as never;

function req(body: unknown): Request {
  return new Request('https://femiglow.test/api/admin/tracking/settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
  vi.mocked(getAdminSession).mockResolvedValue(adminSession);
});

describe('/api/admin/tracking/settings', () => {
  it('GET retourne les defaults lead webhook avec session admin', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { settings: Record<string, unknown> };
    expect(body.settings).toMatchObject({
      leadStep2WebhookEnabled: true,
      leadStep1AbandonEnabled: true,
      leadStep1AbandonTimeoutMinutes: 5,
      leadWebhookConversationEnabled: true,
      leadWebhookConversationMaxMessages: 50,
      leadWebhookConversationMaxBytes: 30000,
      leadInlineContactWebhookEnabled: true,
    });
  });

  it('PATCH persiste un patch partiel sans écraser les autres réglages', async () => {
    const res = await PATCH(req({ leadStep1AbandonTimeoutMinutes: 12 }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { settings: Record<string, unknown> };
    expect(body.settings.leadStep1AbandonTimeoutMinutes).toBe(12);
    await expect(
      getTrackingSetting(TRACKING_SETTING_KEYS.LEAD_STEP2_WEBHOOK_ENABLED, true),
    ).resolves.toBe(true);
    await expect(
      getTrackingSetting(TRACKING_SETTING_KEYS.LEAD_STEP1_ABANDON_TIMEOUT_MINUTES, 5),
    ).resolves.toBe(12);
  });

  it.each([
    [{ leadStep1AbandonTimeoutMinutes: 0 }, 'timeout min'],
    [{ leadStep1AbandonTimeoutMinutes: 61 }, 'timeout max'],
    [{ leadWebhookConversationMaxMessages: 0 }, 'messages min'],
    [{ leadWebhookConversationMaxMessages: 51 }, 'messages max'],
    [{ leadWebhookConversationMaxBytes: 999 }, 'bytes min'],
    [{ leadWebhookConversationMaxBytes: 50001 }, 'bytes max'],
    [{ unknown: true }, 'strict unknown key'],
  ])('PATCH rejette les payloads invalides: %s', async (payload, _label) => {
    const res = await PATCH(req(payload));
    expect(res.status).toBe(400);
  });

  it('PATCH retourne 401 sans session et ne persiste rien', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null as never);
    const res = await PATCH(req({ leadStep2WebhookEnabled: false }));

    expect(res.status).toBe(401);
    await expect(
      getTrackingSetting(TRACKING_SETTING_KEYS.LEAD_STEP2_WEBHOOK_ENABLED, true),
    ).resolves.toBe(true);
  });

  it('PATCH toggle leadInlineContactWebhookEnabled à false', async () => {
    const res = await PATCH(req({ leadInlineContactWebhookEnabled: false }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { settings: Record<string, unknown> };
    expect(body.settings.leadInlineContactWebhookEnabled).toBe(false);
    await expect(
      getTrackingSetting(TRACKING_SETTING_KEYS.LEAD_INLINE_CONTACT_WEBHOOK_ENABLED, true),
    ).resolves.toBe(false);
  });

  it('PATCH rejette leadInlineContactWebhookEnabled non-boolean', async () => {
    const res = await PATCH(req({ leadInlineContactWebhookEnabled: 'yes' as unknown as boolean }));

    expect(res.status).toBe(400);
  });
});
