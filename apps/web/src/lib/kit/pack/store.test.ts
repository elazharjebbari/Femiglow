/**
 * Tests du store kit-pack (memoryStore).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getKitPackOverride,
  publishKitPackOverride,
  resetKitPackOverride,
  unpublishKitPackOverride,
  upsertKitPackOverride,
} from './store';

beforeEach(() => {
  resetKitPackOverride();
});

afterEach(() => {
  resetKitPackOverride();
});

describe('kit-pack store', () => {
  it('getKitPackOverride() retourne null initialement', () => {
    expect(getKitPackOverride()).toBeNull();
  });

  it('upsertKitPackOverride crée le singleton avec id=kit:pack', () => {
    const o = upsertKitPackOverride({ ctaLabel: 'Custom' });
    expect(o.id).toBe('kit:pack');
    expect(o.ctaLabel).toBe('Custom');
    expect(o.draftedAt).not.toBeNull();
    expect(o.publishedAt).toBeNull();
  });

  it('upsert merge le patch champ par champ', () => {
    upsertKitPackOverride({ ctaLabel: 'X', kicker: 'K' });
    const after = upsertKitPackOverride({ ctaLabel: 'Y' });
    expect(after.ctaLabel).toBe('Y');
    expect(after.kicker).toBe('K');
  });

  it('upsert avec null efface le champ (retour mock)', () => {
    upsertKitPackOverride({ ctaLabel: 'X' });
    const after = upsertKitPackOverride({ ctaLabel: null });
    expect(after.ctaLabel).toBeNull();
  });

  it('publishKitPackOverride pose publishedAt + efface draftedAt', () => {
    upsertKitPackOverride({ title: 'T' });
    const p = publishKitPackOverride();
    expect(p?.publishedAt).not.toBeNull();
    expect(p?.draftedAt).toBeNull();
  });

  it('publishKitPackOverride sans override → null', () => {
    expect(publishKitPackOverride()).toBeNull();
  });

  it('unpublishKitPackOverride efface publishedAt + repose draftedAt', () => {
    upsertKitPackOverride({ title: 'T' });
    publishKitPackOverride();
    const u = unpublishKitPackOverride();
    expect(u?.publishedAt).toBeNull();
    expect(u?.draftedAt).not.toBeNull();
  });

  it('resetKitPackOverride supprime le singleton', () => {
    upsertKitPackOverride({ title: 'T' });
    resetKitPackOverride();
    expect(getKitPackOverride()).toBeNull();
  });

  it('upsert préserve createdAt + actorId entre 2 appels', () => {
    const o1 = upsertKitPackOverride({ title: 'A' }, { actorId: 'adm_1' });
    const o2 = upsertKitPackOverride({ title: 'B' });
    expect(o2.createdAt).toEqual(o1.createdAt);
    expect(o2.createdBy).toBe('adm_1');
  });

  it('valueBreakdown peut être patché (array)', () => {
    const o = upsertKitPackOverride({
      valueBreakdown: [{ label: 'A', valueLabel: '1 €' }],
    });
    expect(o.valueBreakdown).toEqual([{ label: 'A', valueLabel: '1 €' }]);
  });
});
