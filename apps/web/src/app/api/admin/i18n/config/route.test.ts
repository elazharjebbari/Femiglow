/**
 * Lot L11 — route admin config moteur `/api/admin/i18n/config`.
 * Couvre : authz (401), If-Match (400), validation stricte (422),
 * concurrence optimiste (409), publication (200 + snapshot + audit
 * `i18n-engine.update` before/after), invalidation, relecture GET.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import { DEFAULT_ENGINE_CONFIG } from '@/lib/i18n/engine-config-schema';

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

import { revalidateTag } from 'next/cache';

import { getAdminSession } from '@/lib/auth/require-admin';

import { GET, PUT } from './route';

const adminSession = {
  adminId: 'adm_i18n_engine',
  email: 'admin@femiglow.test',
  issuedAt: 0,
  expiresAt: Date.now() + 60_000,
} as never;

function putReq(
  body: unknown,
  headers: Record<string, string> = { 'If-Match': '0' },
): Request {
  return new Request('https://femiglow.test/api/admin/i18n/config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function engineOnPayload() {
  return {
    ...DEFAULT_ENGINE_CONFIG,
    engineEnabled: true,
    profiles: DEFAULT_ENGINE_CONFIG.profiles.map((p) =>
      p.id === 'TRIG-ENTRY-MISMATCH' ? { ...p, enabled: true } : p,
    ),
  };
}

function auditEvents(action: string) {
  return Array.from(memoryStore().auditEvents.values()).filter(
    (e) => e.action === action,
  );
}

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(revalidateTag).mockReset();
  vi.mocked(getAdminSession).mockReset();
  vi.mocked(getAdminSession).mockResolvedValue(adminSession);
});

describe('GET /api/admin/i18n/config', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('200 → défauts moteur OFF, version 0, isDefault (INV-13)', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      payload: { engineEnabled: boolean };
      meta: { version: number; isDefault: boolean };
    };
    expect(body.payload.engineEnabled).toBe(false);
    expect(body.meta).toMatchObject({ version: 0, isDefault: true });
  });
});

describe('PUT /api/admin/i18n/config', () => {
  it('401 sans session, aucune écriture', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null as never);
    const res = await PUT(putReq({ payload: engineOnPayload() }));
    expect(res.status).toBe(401);
    expect(auditEvents('i18n-engine.update')).toHaveLength(0);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('400 sans header If-Match', async () => {
    const res = await PUT(putReq({ payload: engineOnPayload() }, {}));
    expect(res.status).toBe(400);
  });

  it('422 payload invalide (clé inconnue, strict) — aucune écriture/audit', async () => {
    const res = await PUT(
      putReq({ payload: { ...engineOnPayload(), foo: 'bar' } }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_failed');
    expect(auditEvents('i18n-engine.update')).toHaveLength(0);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('422 borne hors limite (maxImpressionsPerVisitor)', async () => {
    const res = await PUT(
      putReq({ payload: { ...engineOnPayload(), maxImpressionsPerVisitor: 9 } }),
    );
    expect(res.status).toBe(422);
  });

  it('200 publie → version+1, snapshot, audit i18n-engine.update (before/after), revalidate', async () => {
    const res = await PUT(
      putReq({ payload: engineOnPayload(), note: 'A/B 50%' }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      payload: { engineEnabled: boolean };
      meta: { version: number; isDefault: boolean };
      snapshotId: string;
    };
    expect(body.payload.engineEnabled).toBe(true);
    expect(body.meta.version).toBe(1);
    expect(body.snapshotId).toMatch(/^snap/);
    expect(revalidateTag).toHaveBeenCalledWith('i18n-suggestion-engine');

    const audits = auditEvents('i18n-engine.update');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.meta).toMatchObject({
      version: 1,
      note: 'A/B 50%',
    });
    const meta = audits[0]?.meta as {
      before: { engineEnabled: boolean };
      after: { engineEnabled: boolean };
    };
    expect(meta.before.engineEnabled).toBe(false);
    expect(meta.after.engineEnabled).toBe(true);
  });

  it('409 sur version stale, aucune écriture supplémentaire', async () => {
    // 1re publication → version passe à 1.
    await PUT(putReq({ payload: engineOnPayload() }));
    vi.mocked(revalidateTag).mockReset();

    // 2e publication avec If-Match obsolète (0).
    const res = await PUT(
      putReq({ payload: engineOnPayload() }, { 'If-Match': '0' }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      error: { code: string; details: { currentVersion: number } };
    };
    expect(body.error.code).toBe('version_conflict');
    expect(body.error.details.currentVersion).toBe(1);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(auditEvents('i18n-engine.update')).toHaveLength(1);
  });

  it('après publication, GET reflète la nouvelle config (version 1)', async () => {
    await PUT(putReq({ payload: engineOnPayload() }));
    const res = await GET();
    const body = (await res.json()) as {
      payload: { engineEnabled: boolean };
      meta: { version: number; isDefault: boolean };
    };
    expect(body.payload.engineEnabled).toBe(true);
    expect(body.meta).toMatchObject({ version: 1, isDefault: false });
  });
});
