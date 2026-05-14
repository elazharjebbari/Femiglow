/**
 * Tests d'intégration de GET /api/admin/tracking/analytics/providers.
 *
 * Garantit :
 *   - Réponse 200 + shape stable même en mode memory (drizzle indispo)
 *   - generatedAt présent
 *   - 401 sans session
 *   - cache-control: no-store
 */
import { describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/lib/auth/session';

let sessionMock: AdminSession | null = {
  adminId: 'adm_test_analytics',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 1000 * 60 * 60,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

import { GET } from '@/app/api/admin/tracking/analytics/providers/route';

describe('GET /api/admin/tracking/analytics/providers', () => {
  it('retourne 401 sans session', async () => {
    sessionMock = null;
    const res = await GET();
    expect(res.status).toBe(401);
    sessionMock = {
      adminId: 'adm_test_analytics',
      email: 'admin@femiglow.ma',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60,
    };
  });

  it('retourne 200 avec providers[] + generatedAt en mode memory (DB indispo)', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      providers: Array<{ kind: string; total7d: number }>;
      generatedAt: string;
    };
    expect(Array.isArray(data.providers)).toBe(true);
    expect(data.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // En memory mode, providers est vide (pas d'agrégation possible).
    expect(data.providers).toHaveLength(0);
  });

  it("retourne cache-control: no-store (refresh 30s côté UI)", async () => {
    const res = await GET();
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
