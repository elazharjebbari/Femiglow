/**
 * Tests des extensions Kolenda §4.4 sur les schemas vidéo
 * (`rituelVideoSchema` + `kitVideoSchema` + `videoChapterSchema`).
 *
 * Couvre :
 *  - Validation `videoChapterSchema` (key kebab-case, label, startSeconds).
 *  - Rétrocompat : un payload sans aucun champ étendu reste valide.
 *  - Validation `chapters` : 2-6 items, triés par startSeconds croissant.
 *  - Validation `provenance` : ponctuation finale obligatoire.
 *  - Validation `durationDisplay` 1-8 chars.
 *  - Validation `accentColor` enum.
 *  - Validation `posterCustom` (image schema).
 *
 * cf. docs/video-gestes-optim-2026-05/03-data-model.md
 */
import { describe, expect, it } from 'vitest';

import {
  kitVideoSchema,
  rituelVideoSchema,
  videoChapterSchema,
} from './page-content';

function baseRituelVideo(): Record<string, unknown> {
  return {
    sources: {
      mp4: '/videos/rituel.mp4',
      webm: '/videos/rituel.webm',
    },
    poster: {
      src: '/poster.jpg',
      alt: 'Poster vidéo',
      width: 1920,
      height: 1080,
    },
    captions: { fr: '/c-fr.vtt', ar: '/c-ar.vtt' },
    transcript: 'Texte de transcription.',
    durationSeconds: 90,
  };
}

describe('videoChapterSchema', () => {
  it('accepte un chapitre valide', () => {
    expect(
      videoChapterSchema.parse({ key: 'paste', label: 'Paste', startSeconds: 0 }),
    ).toEqual({ key: 'paste', label: 'Paste', startSeconds: 0 });
  });

  it('rejette une key non-kebab-case (majuscules)', () => {
    expect(() =>
      videoChapterSchema.parse({ key: 'Paste', label: 'P', startSeconds: 0 }),
    ).toThrow();
  });

  it('rejette une key avec underscore', () => {
    expect(() =>
      videoChapterSchema.parse({ key: 'step_4', label: 'P', startSeconds: 0 }),
    ).toThrow();
  });

  it('accepte une key kebab-case avec digits', () => {
    expect(
      videoChapterSchema.parse({ key: 'step-4', label: 'Step', startSeconds: 0 }),
    ).toBeDefined();
  });

  it('rejette un label > 24 chars', () => {
    expect(() =>
      videoChapterSchema.parse({
        key: 'x',
        label: 'Un label vraiment trop long pour la timeline',
        startSeconds: 0,
      }),
    ).toThrow();
  });

  it('rejette startSeconds négatif', () => {
    expect(() =>
      videoChapterSchema.parse({ key: 'x', label: 'L', startSeconds: -1 }),
    ).toThrow();
  });

  it('rejette startSeconds > 600', () => {
    expect(() =>
      videoChapterSchema.parse({ key: 'x', label: 'L', startSeconds: 601 }),
    ).toThrow();
  });
});

describe('rituelVideoSchema — extensions phase 1', () => {
  it('accepte un payload sans aucun champ étendu (rétrocompat)', () => {
    const parsed = rituelVideoSchema.parse(baseRituelVideo());
    expect(parsed.chapters).toBeUndefined();
    expect(parsed.provenance).toBeUndefined();
    expect(parsed.posterCustom).toBeUndefined();
    expect(parsed.durationDisplay).toBeUndefined();
    expect(parsed.accentColor).toBeUndefined();
  });

  it('accepte chapters triés', () => {
    const parsed = rituelVideoSchema.parse({
      ...baseRituelVideo(),
      chapters: [
        { key: 'a', label: 'A', startSeconds: 0 },
        { key: 'b', label: 'B', startSeconds: 18 },
        { key: 'c', label: 'C', startSeconds: 42 },
        { key: 'd', label: 'D', startSeconds: 68 },
      ],
    });
    expect(parsed.chapters?.length).toBe(4);
  });

  it('rejette chapters non triés', () => {
    expect(() =>
      rituelVideoSchema.parse({
        ...baseRituelVideo(),
        chapters: [
          { key: 'a', label: 'A', startSeconds: 18 },
          { key: 'b', label: 'B', startSeconds: 0 }, // inversé
        ],
      }),
    ).toThrow(/triés/);
  });

  it('rejette chapters < 2', () => {
    expect(() =>
      rituelVideoSchema.parse({
        ...baseRituelVideo(),
        chapters: [{ key: 'a', label: 'A', startSeconds: 0 }],
      }),
    ).toThrow();
  });

  it('rejette chapters > 6', () => {
    expect(() =>
      rituelVideoSchema.parse({
        ...baseRituelVideo(),
        chapters: Array.from({ length: 7 }, (_, i) => ({
          key: `c${i}`,
          label: `C${i}`,
          startSeconds: i * 10,
        })),
      }),
    ).toThrow();
  });

  it('accepte provenance avec point final', () => {
    const parsed = rituelVideoSchema.parse({
      ...baseRituelVideo(),
      provenance: 'Filmé à l’atelier de Rabat, mars 2026.',
    });
    expect(parsed.provenance).toContain('Rabat');
  });

  it('accepte provenance avec guillemet français »', () => {
    expect(() =>
      rituelVideoSchema.parse({
        ...baseRituelVideo(),
        provenance: '« Une saison »',
      }),
    ).not.toThrow();
  });

  it('rejette provenance sans ponctuation finale', () => {
    expect(() =>
      rituelVideoSchema.parse({ ...baseRituelVideo(), provenance: 'Sans point' }),
    ).toThrow(/ponctuation/);
  });

  it('rejette provenance > 120 chars', () => {
    expect(() =>
      rituelVideoSchema.parse({
        ...baseRituelVideo(),
        provenance: 'x'.repeat(121) + '.',
      }),
    ).toThrow();
  });

  it('accepte durationDisplay 1-8 chars', () => {
    expect(
      rituelVideoSchema.parse({ ...baseRituelVideo(), durationDisplay: '90″' })
        .durationDisplay,
    ).toBe('90″');
  });

  it('rejette durationDisplay > 8 chars', () => {
    expect(() =>
      rituelVideoSchema.parse({
        ...baseRituelVideo(),
        durationDisplay: 'beaucoup trop long',
      }),
    ).toThrow();
  });

  it('accepte accentColor enum (sauge/petale/ciel/champagne)', () => {
    for (const color of ['sauge', 'petale', 'ciel', 'champagne'] as const) {
      expect(
        rituelVideoSchema.parse({ ...baseRituelVideo(), accentColor: color })
          .accentColor,
      ).toBe(color);
    }
  });

  it('rejette accentColor inconnu', () => {
    expect(() =>
      rituelVideoSchema.parse({ ...baseRituelVideo(), accentColor: 'rouge' }),
    ).toThrow();
  });

  it('accepte posterCustom optionnel', () => {
    const parsed = rituelVideoSchema.parse({
      ...baseRituelVideo(),
      posterCustom: {
        src: '/poster-custom.jpg',
        alt: 'Geste paste',
        width: 1080,
        height: 1920,
      },
    });
    expect(parsed.posterCustom?.src).toBe('/poster-custom.jpg');
  });
});

describe('kitVideoSchema — aligné sur rituelVideoSchema', () => {
  it('accepte les mêmes extensions phase 1', () => {
    const parsed = kitVideoSchema.parse({
      ...baseRituelVideo(),
      chapters: [
        { key: 'a', label: 'A', startSeconds: 0 },
        { key: 'b', label: 'B', startSeconds: 30 },
      ],
      provenance: 'Filmé en atelier.',
      durationDisplay: '90″',
      accentColor: 'sauge',
    });
    expect(parsed.chapters?.length).toBe(2);
    expect(parsed.provenance).toBe('Filmé en atelier.');
  });
});
