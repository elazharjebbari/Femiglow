/**
 * Tests `lib/seo/seed.ts` — couverture des opérations seed/reset.
 *
 * Stratégie : on mocke `getSeoSettings`, `upsertSeoSettings` et
 * `logAuditEvent` pour rester en pur unit-test sans dépendre de la DB.
 *
 * Couvre :
 *  - `seedSeoDefaults` no-op quand DB déjà initialisée (`force=false`).
 *  - `seedSeoDefaults` écrit quand fresh install (`updatedAt = epoch`).
 *  - `seedSeoDefaults` écrit quand `force=true`, peu importe l'état.
 *  - Audit event `seo.settings.seed` posé uniquement quand l'opération
 *    écrit, avec `meta.reason` et `meta.forced` cohérents.
 *  - `resetSeoSettingsToDefaults` écrit toujours.
 *  - Audit event `seo.settings.reset` posé avec `meta.previous` non null.
 *  - Le payload upsert correspond exactement à `getSeoSettingsDefault()`.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/queries/seo', () => ({
  getSeoSettings: vi.fn(),
  upsertSeoSettings: vi.fn(),
}));
vi.mock('@/lib/audit/log-event', () => ({
  logAuditEvent: vi.fn(async () => undefined),
}));

import { getSeoSettings, upsertSeoSettings } from '@/lib/db/queries/seo';
import { logAuditEvent } from '@/lib/audit/log-event';
import { getSeoSettingsDefault } from './defaults';
import { resetSeoSettingsToDefaults, seedSeoDefaults } from './seed';

function makeSettings(overrides: Record<string, unknown> = {}) {
  const base = getSeoSettingsDefault();
  return {
    ...base,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('seedSeoDefaults', () => {
  it('no-op si la DB est déjà initialisée (updatedAt != epoch) et force=false', async () => {
    vi.mocked(getSeoSettings).mockResolvedValue(
      makeSettings({ updatedAt: new Date('2026-04-01T00:00:00Z') }),
    );

    const res = await seedSeoDefaults({ actorId: null });

    expect(res.applied).toBe(false);
    expect(res.reason).toBe('already-seeded');
    expect(upsertSeoSettings).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it('upsert quand fresh install (updatedAt = epoch)', async () => {
    vi.mocked(getSeoSettings).mockResolvedValue(
      makeSettings({ updatedAt: new Date(0) }),
    );
    vi.mocked(upsertSeoSettings).mockImplementation(async (input) => ({
      ...makeSettings(),
      ...input,
      updatedAt: new Date('2026-05-19T10:00:00Z'),
      updatedBy: input.actorId,
    }));

    const res = await seedSeoDefaults({ actorId: 'admin_1' });

    expect(res.applied).toBe(true);
    expect(res.reason).toBe('fresh-install');
    expect(upsertSeoSettings).toHaveBeenCalledTimes(1);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'seo.settings.seed',
        actorId: 'admin_1',
        meta: expect.objectContaining({ reason: 'fresh-install', forced: false }),
      }),
    );
  });

  it('upsert même si déjà initialisé quand force=true', async () => {
    vi.mocked(getSeoSettings).mockResolvedValue(
      makeSettings({ updatedAt: new Date('2026-04-01T00:00:00Z') }),
    );
    vi.mocked(upsertSeoSettings).mockImplementation(async (input) => ({
      ...makeSettings(),
      ...input,
      updatedAt: new Date(),
      updatedBy: input.actorId,
    }));

    const res = await seedSeoDefaults({ actorId: 'admin_1', force: true });

    expect(res.applied).toBe(true);
    expect(res.reason).toBe('forced');
    expect(upsertSeoSettings).toHaveBeenCalled();
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'seo.settings.seed',
        meta: expect.objectContaining({ reason: 'forced', forced: true }),
      }),
    );
  });

  it('passe un payload dérivé de getSeoSettingsDefault() (siteName, robots, organizationJsonLd)', async () => {
    vi.mocked(getSeoSettings).mockResolvedValue(
      makeSettings({ updatedAt: new Date(0) }),
    );
    vi.mocked(upsertSeoSettings).mockResolvedValue(makeSettings());

    await seedSeoDefaults({ actorId: null });

    const defaults = getSeoSettingsDefault();
    expect(upsertSeoSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        siteName: defaults.siteName,
        defaultDescription: defaults.defaultDescription,
        defaultRobotsIndex: defaults.defaultRobotsIndex,
        defaultRobotsFollow: defaults.defaultRobotsFollow,
        organizationJsonLd: defaults.organizationJsonLd,
        knownPages: defaults.knownPages,
        actorId: null,
      }),
    );
  });
});

describe('resetSeoSettingsToDefaults', () => {
  it('upsert toujours et log un event reset avec meta.previous', async () => {
    const previous = makeSettings({
      siteName: 'Custom',
      defaultDescription: 'description sur-mesure',
      updatedAt: new Date('2026-04-01T00:00:00Z'),
      updatedBy: 'admin_42',
    });
    vi.mocked(getSeoSettings).mockResolvedValue(previous);
    vi.mocked(upsertSeoSettings).mockImplementation(async (input) => ({
      ...makeSettings(),
      ...input,
      updatedAt: new Date(),
      updatedBy: input.actorId,
    }));

    const res = await resetSeoSettingsToDefaults({ actorId: 'admin_7' });

    expect(res.applied).toBe(true);
    expect(res.reason).toBe('reset');
    expect(upsertSeoSettings).toHaveBeenCalledTimes(1);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'seo.settings.reset',
        actorId: 'admin_7',
        resourceType: 'seo_settings',
        resourceId: 'singleton',
        meta: expect.objectContaining({
          previous: expect.objectContaining({
            siteName: 'Custom',
            defaultDescription: 'description sur-mesure',
            updatedBy: 'admin_42',
          }),
        }),
      }),
    );
  });

  it('utilise getSeoSettingsDefault() pour le payload upsert', async () => {
    vi.mocked(getSeoSettings).mockResolvedValue(makeSettings());
    vi.mocked(upsertSeoSettings).mockResolvedValue(makeSettings());

    await resetSeoSettingsToDefaults({ actorId: 'admin_1' });

    const defaults = getSeoSettingsDefault();
    expect(upsertSeoSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        siteName: defaults.siteName,
        defaultDescription: defaults.defaultDescription,
        organizationJsonLd: defaults.organizationJsonLd,
      }),
    );
  });
});

describe('getSeoSettingsDefault (immutabilité)', () => {
  it('retourne un nouvel objet à chaque appel', () => {
    const a = getSeoSettingsDefault();
    const b = getSeoSettingsDefault();
    expect(a).not.toBe(b);
    expect(a.knownPages).not.toBe(b.knownPages);
    expect(a.organizationJsonLd).not.toBe(b.organizationJsonLd);
  });

  it('la modification de la copie ne fuit pas vers les appels suivants', () => {
    const a = getSeoSettingsDefault();
    a.siteName = 'Mutated';
    a.knownPages.push({ key: 'evil', label: 'Evil', path: '/evil', scope: 'page' });
    const b = getSeoSettingsDefault();
    expect(b.siteName).toBe('FemiGlow');
    expect(b.knownPages.some((p) => p.key === 'evil')).toBe(false);
  });
});
