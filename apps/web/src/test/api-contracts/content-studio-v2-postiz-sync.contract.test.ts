import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpError } from '@/lib/errors/http-error';

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({ get: vi.fn() })) }));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'a1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const syncPostizIntegrations = vi.fn();
vi.mock('@/lib/content-studio/service', () => ({
  syncPostizIntegrations: (...args: unknown[]) => syncPostizIntegrations(...args),
}));

import { POST } from '@/app/api/admin/content-studio/postiz/integrations/sync/route';

describe('POST /postiz/integrations/sync — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncPostizIntegrations.mockResolvedValue({
      accounts: [{ id: 'sa_1', name: 'AlFenna', status: 'active' }],
      summary: { total: 1, added: 1, updated: 0, disabled: 0 },
    });
  });

  it('returns 200 happy path', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accounts.length).toBe(1);
  });

  it('returns 401 when Postiz auth fails', async () => {
    syncPostizIntegrations.mockRejectedValueOnce(
      new HttpError('unauthorized', 'Postiz auth failed'),
    );
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns 500 on unexpected error', async () => {
    syncPostizIntegrations.mockRejectedValueOnce(new Error('boom'));
    const res = await POST();
    expect(res.status).toBe(500);
  });

  it('summary contains total/added/updated/disabled', async () => {
    const res = await POST();
    const json = await res.json();
    expect(json.summary).toHaveProperty('total');
    expect(json.summary).toHaveProperty('added');
    expect(json.summary).toHaveProperty('updated');
    expect(json.summary).toHaveProperty('disabled');
  });

  it('calls service once', async () => {
    await POST();
    expect(syncPostizIntegrations).toHaveBeenCalledTimes(1);
  });
});
