/**
 * Tests — projection DTO de l'instantané mis en cache (`unstable_cache`).
 *
 * Un instantané réaliste du kit (7 dimensions × 4 langues × 2 slots =
 * 56 ensembles, 3 à 4 items, médias à 15 variants et flou `data:`) doit :
 *  - tenir très en dessous de la limite de 2 Mo par entrée de cache ;
 *  - donner EXACTEMENT les mêmes sélections et images après un aller-retour
 *    JSON (hit de cache) qu'avant.
 */
import { describe, expect, it } from 'vitest';
import { KIT_ANGLES } from '@/lib/kit/angle';
import type { MediaSetMedia, MediaVariant } from '@/lib/db/types';
import { LOCALES, type Locale } from '@/i18n.config';
import { toMediaSetDTO, toMediaSetDTOs } from './dto';
import { resolveMediaSlotsFromSets } from './resolve.server';
import { selectMediaSet } from './select';
import { KIT_POLICY, makeMedia, makeSetRow } from './__fixtures__/sets';
import type { AudienceContext, MediaSetDTO } from './types';

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs'] as const;
const FORMATS = ['webp', 'avif', 'jpeg'] as const;
/** Placeholder `data:` réaliste (~ 400 caractères, cf. pipeline blur). */
const BLUR = `data:image/webp;base64,${'UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoQABQAPm0ylUekIyIhKAqAgA2JZQAAW+'.repeat(6).slice(0, 380)}`;

function realisticMedia(id: string): MediaSetMedia {
  const t = new Date('2026-10-01T00:00:00Z');
  const variants: MediaVariant[] = SIZES.flatMap((bp) =>
    FORMATS.map((format) => ({
      id: `${id}_${bp}_${format}`,
      mediaId: id,
      format,
      breakpoint: bp,
      width: 1200,
      height: 1500,
      bitrateKbps: null,
      quality: 82,
      sizeBytes: 120_000,
      url: `/_media/${id}/${bp}.${format}`,
      checksum: `sha256-${id}-${bp}-${format}-0123456789abcdef0123456789abcdef`,
      createdAt: t,
    })),
  );
  return makeMedia(id, {
    blurDataUrl: BLUR,
    alt: `Kit FemiGlow — visuel ${id}, main droite à la première personne, lumière naturelle`,
    originalUrl: `/uploads/${id}.png`,
    originalFilename: `${id}-original-4x5.png`,
    variants,
  });
}

/** 56 ensembles publiés, 3 ou 4 items, mobile 3:4 sur un item sur deux. */
function kitSnapshotRows() {
  const dims: Array<[string, string]> = [['default', '*'], ...KIT_ANGLES.map((a) => ['angle', a] as [string, string])];
  const locales = ['*', 'fr', 'ar', 'en'];
  const rows = [];
  let n = 0;
  for (const slot of ['primary', 'secondary'])
    for (const [dim, key] of dims)
      for (const locale of locales) {
        n += 1;
        const count = n % 2 === 0 ? 4 : 3;
        rows.push(
          makeSetRow({
            id: `cms_${slot}_${dim}_${key}_${locale}`.replace('*', 'any').replace('*', 'any'),
            slot,
            dim,
            key,
            locale,
            crossLocale: locale === 'fr',
            version: 1 + (n % 5),
            items: Array.from({ length: count }, (_, i) => ({
              media: realisticMedia(`med_${n}_${i}`),
              mobileMedia: i % 2 === 0 ? realisticMedia(`med_${n}_${i}_m`) : null,
              alt: { fr: `Alt FR ${n}/${i}`, ar: `بديل ${n}/${i}`, en: `Alt EN ${n}/${i}` },
            })),
          }),
        );
      }
  return rows;
}

function contexts(): AudienceContext[] {
  const out: AudienceContext[] = [];
  for (const locale of LOCALES as readonly Locale[]) {
    out.push({ locale, variants: {} });
    for (const angle of KIT_ANGLES) out.push({ locale, variants: { angle } });
  }
  return out;
}

describe('toMediaSetDTO — instantané du kit en cache', () => {
  const rows = kitSnapshotRows();
  const dtos = toMediaSetDTOs(rows);
  const json = JSON.stringify(dtos);
  const roundTripped = JSON.parse(json) as MediaSetDTO[];

  it('56 ensembles × 3–4 items : bien sous la limite de 2 Mo (< 300 Ko)', () => {
    expect(rows).toHaveLength(56);
    const bytes = Buffer.byteLength(json, 'utf8');
    const fullBytes = Buffer.byteLength(JSON.stringify(rows), 'utf8');
    expect(bytes).toBeLessThan(300 * 1024);
    // L'ancien instantané (lignes complètes + variants) était bien plus lourd.
    expect(fullBytes).toBeGreaterThan(bytes * 4);
  });

  it('JSON pur : identique après aller-retour, aucune Date', () => {
    expect(roundTripped).toEqual(dtos);
    expect(json).not.toContain('"variants"');
    expect(typeof dtos[0]!.updatedAt).toBe('string');
    expect(dtos[0]!.publishedAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('sélection et images identiques avant / après aller-retour JSON, pour chaque contexte', () => {
    let resolved = 0;
    for (const ctx of contexts()) {
      for (const slot of ['primary', 'secondary']) {
        const before = selectMediaSet(dtos, slot, ctx, KIT_POLICY);
        const after = selectMediaSet(roundTripped, slot, ctx, KIT_POLICY);
        expect(after).toEqual(before);
        expect(after?.set.id).toBe(before?.set.id);
      }
      const r1 = resolveMediaSlotsFromSets(dtos, KIT_POLICY, ctx, 'Kit');
      const r2 = resolveMediaSlotsFromSets(roundTripped, KIT_POLICY, ctx, 'Kit');
      expect(r2).toEqual(r1);
      if (r1.slots.primary) resolved += 1;
    }
    expect(resolved).toBe(contexts().length);
  });

  it('projette l’URL choisie (xl/webp), dimensions, flou, alt et mobile', () => {
    const dto = toMediaSetDTO(rows[0]!);
    const item = dto.items[0]!;
    expect(item.desktop).toEqual({ src: '/_media/med_1_0/xl.webp', width: 1200, height: 1500, blurDataURL: BLUR });
    expect(item.mobile?.src).toBe('/_media/med_1_0_m/xl.webp');
    expect(dto.items[1]!.mobile).toBeNull();
    expect(item.mediaAlt).toMatch(/^Kit FemiGlow/);
    expect(item.alt).toEqual({ fr: 'Alt FR 1/0', ar: 'بديل 1/0', en: 'Alt EN 1/0' });
  });

  it('média supprimé / sans URL → desktop null (item non affichable)', () => {
    const row = makeSetRow({ items: [{ media: null }, { media: makeMedia('x', { variants: [], originalUrl: null }) }] });
    expect(toMediaSetDTO(row).items.map((i) => i.desktop)).toEqual([null, null]);
  });
});
