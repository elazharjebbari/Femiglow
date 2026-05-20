/**
 * Tests POST /api/admin/kit/video/cover/upload.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));
vi.mock('@/lib/audit/log-event', () => ({
  logAuditEvent: vi.fn(async () => ({ id: 'ae_test' })),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { resetMemoryStore } from '@/lib/db/client';
import { POST } from './route';
import { listKitVideoCoverFiles } from '@/lib/kit/video/cover-files-store';

function adminSession() {
  return {
    adminId: 'adm_1',
    email: 'a@b.c',
    issuedAt: 0,
    expiresAt: 0,
  } as never;
}

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
  vi.mocked(logAuditEvent).mockReset();
  vi.mocked(logAuditEvent).mockResolvedValue({ id: 'ae_test' } as never);
});

function svgRequest(content: string, contentType = 'application/json'): Request {
  const body = contentType === 'application/json' ? JSON.stringify({ content }) : content;
  return new Request('http://test/api/admin/kit/video/cover/upload', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });
}

const VALID_SVG = '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#E8EDE3"/></svg>';

describe('POST /api/admin/kit/video/cover/upload', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await POST(svgRequest(VALID_SVG));
    expect(res.status).toBe(401);
  });

  it('201 accepte un SVG valide via JSON et le stocke', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(svgRequest(VALID_SVG));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { fileMediaId: string; size: number };
    expect(body.fileMediaId).toMatch(/^kvc_/);
    expect(body.size).toBeGreaterThan(0);
    expect(listKitVideoCoverFiles()).toHaveLength(1);
  });

  it('201 accepte un SVG via raw image/svg+xml', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(svgRequest(VALID_SVG, 'image/svg+xml'));
    expect(res.status).toBe(201);
  });

  it('422 refuse un SVG sans viewBox', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(svgRequest('<svg><rect/></svg>'));
    expect(res.status).toBe(422);
  });

  it('422 refuse un SVG > 200 kB upload', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const huge = `<svg viewBox="0 0 100 100">${'<rect/>'.repeat(40_000)}</svg>`;
    const res = await POST(svgRequest(huge));
    expect([400, 422]).toContain(res.status);
  });

  it('refuse un content-type non supporté (400)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/x-binary' },
      body: 'whatever',
    });
    const res = await POST(req);
    expect([400, 422]).toContain(res.status);
  });

  it('strip script et émet audit avec warnings', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const dangerous =
      '<svg viewBox="0 0 100 100"><script>alert(1)</script><rect width="100" height="100"/></svg>';
    const res = await POST(svgRequest(dangerous));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { warnings: string[] };
    expect(body.warnings.join(' ')).toMatch(/script/i);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'kit_video.cover.upload' }),
    );
  });
});
