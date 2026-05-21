import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { createDraftInPostiz } from '@/lib/content-studio/service';

import { POST as postizDraft } from './route';

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn(),
  requireContentStudioEnabled: vi.fn(),
}));

vi.mock('@/lib/content-studio/service', () => ({
  createDraftInPostiz: vi.fn(),
}));

const requireAdminApiMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const requireContentStudioEnabledMock = requireContentStudioEnabled as unknown as ReturnType<typeof vi.fn>;
const createDraftInPostizMock = createDraftInPostiz as unknown as ReturnType<typeof vi.fn>;

function adminSession() {
  return {
    adminId: 'adm_legacy_telemetry',
    email: 'admin@femiglow.local',
    issuedAt: 0,
    expiresAt: Date.now() + 60_000,
  };
}

function request(payload: Record<string, unknown>): Request {
  return new Request('http://localhost/api/admin/content-studio/posts/post_test/postiz-draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('POST /api/admin/content-studio/posts/[id]/postiz-draft — legacy deprecation', () => {
  beforeEach(() => {
    resetMemoryStore();
    requireContentStudioEnabledMock.mockReturnValue(undefined);
    requireAdminApiMock.mockResolvedValue(adminSession());
    createDraftInPostizMock.mockResolvedValue({
      delivery: { id: 'delivery_1', postId: 'post_test', integrationId: 'ig_1', status: 'sent' },
      post: { id: 'post_test', status: 'scheduled' },
    });
  });

  it('renvoie les headers RFC 8594 Deprecation + Sunset sur succès', async () => {
    const response = await postizDraft(
      request({ integrationId: 'ig_1' }),
      { params: { id: 'post_test' } },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('deprecation')).toBe('true');
    expect(response.headers.get('sunset')).toMatch(/2026/);
    expect(response.headers.get('link')).toMatch(/successor-version/);
  });

  it('renvoie les headers Deprecation aussi sur erreur', async () => {
    createDraftInPostizMock.mockRejectedValueOnce(new Error('boom'));
    const response = await postizDraft(
      request({ integrationId: 'ig_1' }),
      { params: { id: 'post_test' } },
    );
    expect(response.status).toBe(500);
    expect(response.headers.get('deprecation')).toBe('true');
  });

  it('émet un audit event social.legacy_route_used', async () => {
    await postizDraft(
      request({ integrationId: 'ig_1' }),
      { params: { id: 'post_test' } },
    );
    const events = Array.from(memoryStore().auditEvents.values()).filter(
      (event) => event.action === 'social.legacy_route_used',
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: 'social.legacy_route_used',
      actorId: 'adm_legacy_telemetry',
      resourceType: 'content_post',
      resourceId: 'post_test',
    });
  });
});
