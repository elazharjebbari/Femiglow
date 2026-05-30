import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ACT-BE-034 (BUG-060) — un corps non-multipart ne doit plus produire un
 * TypeError 500 opaque (request.formData() throw) mais un 400 invalid_input.
 */
vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(async () => ({ adminId: 'adm_test', email: 'a@b.test' })),
}));
vi.mock('@/lib/rate-limit/check', () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true, remaining: 30 })),
}));

describe('POST /media/upload-and-crop — garde multipart', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CONTENT_STUDIO_V2_ENABLED = 'true';
    process.env.ADMIN_SESSION_PASSWORD = 'a'.repeat(32);
    process.env.WEBHOOK_SECRET_KEY = 'b'.repeat(32);
    process.env.CRON_SECRET = 'c'.repeat(32);
  });
  afterEach(() => vi.restoreAllMocks());

  it('corps JSON (non-multipart) → 400 invalid_input (pas 500)', async () => {
    const { POST } = await import('./route');
    const req = new Request(
      'http://localhost/api/admin/content-studio-v2/media/upload-and-crop',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ not: 'multipart' }),
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('invalid_input');
  });
});
