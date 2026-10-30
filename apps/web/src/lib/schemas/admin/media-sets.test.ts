/**
 * Tests unitaires — schémas Zod des routes admin « médias par audience ».
 */
import { describe, expect, it } from 'vitest';
import {
  mediaSetBulkPublishSchema,
  mediaSetDraftSchema,
  mediaSetHistoryQuerySchema,
  mediaSetListQuerySchema,
  mediaSetResolveQuerySchema,
  mediaSetRestoreSchema,
  mediaSetScheduleSchema,
} from './media-sets';

describe('mediaSetDraftSchema', () => {
  it('applique les défauts du tuple (default / * / *)', () => {
    const parsed = mediaSetDraftSchema.parse({ slot: 'primary', items: [{ mediaId: 'me_1' }] });
    expect(parsed).toMatchObject({ variantDim: 'default', variantKey: '*', locale: '*' });
  });

  it('accepte un ensemble complet', () => {
    const ok = mediaSetDraftSchema.safeParse({
      slot: 'secondary',
      variantDim: 'ab:hero-media-2026-11',
      variantKey: 'b',
      locale: 'ar',
      crossLocale: true,
      items: [
        { mediaId: 'me_1', mobileMediaId: 'me_2', alt: { ar: 'نص', fr: 'Texte' }, objectPosition: 'top left', focalX: 0, focalY: 100 },
      ],
      notes: null,
      expectedUpdatedAt: '2026-10-30T10:00:00.000Z',
    });
    expect(ok.success).toBe(true);
  });

  it.each([
    ['champ inconnu', { slot: 'primary', items: [], extra: 1 }],
    ['slot mal formé', { slot: 'Primary Slot', items: [] }],
    ['langue inconnue', { slot: 'primary', locale: 'de', items: [] }],
    ['trop d’items (> plafond absolu)', { slot: 'secondary', items: Array.from({ length: 13 }, () => ({ mediaId: 'm' })) }],
    ['alt trop long', { slot: 'primary', items: [{ mediaId: 'm', alt: { fr: 'x'.repeat(301) } }] }],
    ['alt dans une langue inconnue', { slot: 'primary', items: [{ mediaId: 'm', alt: { de: 'x' } }] }],
    ['point focal hors bornes', { slot: 'primary', items: [{ mediaId: 'm', focalY: -1 }] }],
    ['point focal non entier', { slot: 'primary', items: [{ mediaId: 'm', focalX: 10.5 }] }],
    ['cadrage inconnu', { slot: 'primary', items: [{ mediaId: 'm', objectPosition: 'middle' }] }],
    ['mediaId vide', { slot: 'primary', items: [{ mediaId: '' }] }],
    ['expectedUpdatedAt non parsable', { slot: 'primary', items: [], expectedUpdatedAt: 'hier' }],
  ])('refuse : %s', (_label, payload) => {
    expect(mediaSetDraftSchema.safeParse(payload).success).toBe(false);
  });
});

describe('mediaSetScheduleSchema', () => {
  it('exige une date future', () => {
    expect(mediaSetScheduleSchema.safeParse({ scheduledAt: new Date(Date.now() + 3_600_000).toISOString() }).success).toBe(true);
    expect(mediaSetScheduleSchema.safeParse({ scheduledAt: '2000-01-01T00:00:00Z' }).success).toBe(false);
    expect(mediaSetScheduleSchema.safeParse({ scheduledAt: 'demain' }).success).toBe(false);
    expect(mediaSetScheduleSchema.safeParse({}).success).toBe(false);
  });
});

describe('mediaSetRestoreSchema / mediaSetBulkPublishSchema', () => {
  it('restore exige historyId', () => {
    expect(mediaSetRestoreSchema.safeParse({ historyId: 'cmsh_1' }).success).toBe(true);
    expect(mediaSetRestoreSchema.safeParse({}).success).toBe(false);
  });

  it('bulk-publish : filtre non vide OU `all: true`, dryRun faux par défaut, source bornée', () => {
    expect(mediaSetBulkPublishSchema.safeParse({}).success).toBe(false);
    expect(mediaSetBulkPublishSchema.safeParse({ filter: {} }).success).toBe(false);
    expect(mediaSetBulkPublishSchema.parse({ all: true })).toEqual({ filter: {}, all: true, dryRun: false });
    expect(mediaSetBulkPublishSchema.safeParse({ all: false }).success).toBe(false);
    expect(mediaSetBulkPublishSchema.safeParse({ all: true, filter: { slot: 'primary' } }).success).toBe(false);
    expect(mediaSetBulkPublishSchema.parse({ filter: { slot: 'primary' } })).toEqual({
      filter: { slot: 'primary' },
      dryRun: false,
    });
    expect(mediaSetBulkPublishSchema.safeParse({ filter: { source: 'import', locale: '*' }, dryRun: true }).success).toBe(true);
    expect(mediaSetBulkPublishSchema.safeParse({ filter: { source: 'script' } }).success).toBe(false);
    expect(mediaSetBulkPublishSchema.safeParse({ filter: { status: 'draft' } }).success).toBe(false);
  });
});

describe('query strings', () => {
  it('liste : statut borné', () => {
    expect(mediaSetListQuerySchema.safeParse({ status: 'all', locale: 'fr' }).success).toBe(true);
    expect(mediaSetListQuerySchema.safeParse({ status: 'deleted' }).success).toBe(false);
    expect(mediaSetListQuerySchema.parse({ status: 'archived' })).toMatchObject({ limit: 100, offset: 0 });
    expect(mediaSetListQuerySchema.parse({ limit: '20', offset: '40' })).toMatchObject({ limit: 20, offset: 40 });
    expect(mediaSetListQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });

  it('historique : slot requis, limit convertie et bornée', () => {
    expect(mediaSetHistoryQuerySchema.parse({ slot: 'primary', limit: '5' })).toMatchObject({
      slot: 'primary',
      variantDim: 'default',
      variantKey: '*',
      locale: '*',
      limit: 5,
    });
    expect(mediaSetHistoryQuerySchema.safeParse({}).success).toBe(false);
    expect(mediaSetHistoryQuerySchema.safeParse({ slot: 'primary', limit: '500' }).success).toBe(false);
  });

  it('résolution : langue du site et drapeau draft', () => {
    expect(mediaSetResolveQuerySchema.parse({})).toEqual({ locale: 'fr', draft: false });
    expect(mediaSetResolveQuerySchema.parse({ locale: 'ar', draft: '1' })).toEqual({ locale: 'ar', draft: true });
    expect(mediaSetResolveQuerySchema.safeParse({ locale: '*' }).success).toBe(false);
  });
});
