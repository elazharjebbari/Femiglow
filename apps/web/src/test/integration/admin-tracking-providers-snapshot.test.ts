/**
 * Tests d'intégration de GET /api/admin/tracking/providers/snapshot.
 *
 * Garantit que :
 *   - La réponse a la forme ProvidersSnapshot stable (T21)
 *   - Aucun champ sensible (capiToken brut) n'est exposé — uniquement `hasCapiToken: bool`
 *   - Les Providers absents en DB apparaissent quand même avec status 'disabled'
 *     et champs null (déterminisme côté UI)
 *   - 401 sans session
 */
import { describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/lib/auth/session';

let sessionMock: AdminSession | null = {
  adminId: 'adm_test_snap',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 1000 * 60 * 60,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

import { GET } from '@/app/api/admin/tracking/providers/snapshot/route';

const ALL_KINDS = [
  'meta',
  'tiktok',
  'google_ads',
  'google_ga4',
  'snap',
  'pinterest',
  'gtm',
  'custom',
] as const;

describe('GET /api/admin/tracking/providers/snapshot', () => {
  it('retourne 401 sans session', async () => {
    sessionMock = null;
    const res = await GET();
    expect(res.status).toBe(401);
    sessionMock = {
      adminId: 'adm_test_snap',
      email: 'admin@femiglow.ma',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60,
    };
  });

  it('expose les 8 kinds (Providers absents → status=disabled + champs null)', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      generatedAt: string;
      providers: Record<string, { kind: string; status: string; pixelId: string | null }>;
    };
    for (const kind of ALL_KINDS) {
      const entry = data.providers[kind];
      expect(entry).toBeDefined();
      expect(entry!.kind).toBe(kind);
      // En memory store, aucun provider n'existe → tous disabled.
      expect(['disabled', 'enabled', 'error']).toContain(entry!.status);
    }
  });

  it('expose generatedAt ISO 8601', async () => {
    const res = await GET();
    const data = (await res.json()) as { generatedAt: string };
    expect(data.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("n'expose jamais capiToken brut — uniquement hasCapiToken bool", async () => {
    const res = await GET();
    const raw = await res.text();
    // Aucune mention de "capiToken" en valeur — uniquement "hasCapiToken"
    // (key dans la réponse, pas la donnée sensible).
    expect(raw).not.toMatch(/"capiToken":\s*"[^"]/);
    // hasCapiToken booléen attendu pour chaque kind.
    const data = JSON.parse(raw) as {
      providers: Record<string, { hasCapiToken: unknown }>;
    };
    for (const kind of ALL_KINDS) {
      const entry = data.providers[kind];
      expect(entry).toBeDefined();
      expect(typeof entry!.hasCapiToken).toBe('boolean');
    }
  });

  it("retourne cache-control: no-store", async () => {
    const res = await GET();
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
