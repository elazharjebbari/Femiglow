/**
 * Tests unitaires — `optimizeOptionsForSeed`.
 *
 * Cette fonction est la *source de vérité* qui traduit un slot du registre
 * en options pour le pipeline `optimizeImage`. Elle est exécutée à chaque
 * (re-)seed, ce qui rend critique de garantir :
 *  - les breakpoints suivent la politique du composant ;
 *  - le crop physique n'est demandé QUE si `cropToAspect && aspectRatioHint` ;
 *  - les tokens couleur (`creme`, `champagne-soft`…) sont résolus en hex
 *    pour sharp (qui ne comprend pas les CSS variables) ;
 *  - les valeurs hex/rgb passent telles quelles.
 */
import { describe, it, expect } from 'vitest';
import { optimizeOptionsForSeed } from './seed-pipeline';
import type { SiteComponentSeed } from './registry';
import type { SlotDefinition } from '@/lib/db/types';

function makeSeed(
  slots: SlotDefinition[],
  policy?: SiteComponentSeed['variantPolicy'],
): SiteComponentSeed {
  return {
    key: 'test-component',
    name: 'Test',
    description: '',
    category: 'media-block',
    pageGroup: 'shared',
    filePath: 'src/test.tsx',
    slots,
    defaultSvgFallback: null,
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: false,
    ...(policy ? { variantPolicy: policy } : {}),
  };
}

describe('optimizeOptionsForSeed — breakpoints par politique', () => {
  it('policy `default` (ou absente) → DEFAULT_BREAKPOINTS', () => {
    const seed = makeSeed([
      { key: 'primary', label: 'P', required: true, acceptKinds: ['image'] },
    ]);
    const out = optimizeOptionsForSeed(seed, 'primary');
    expect(out.breakpoints.length).toBeGreaterThan(0);
    // Convention : default contient 'md' (la taille pivot).
    expect(out.breakpoints).toContain('md');
  });

  it('policy `with-thumbnail` → inclut `xs`', () => {
    const seed = makeSeed(
      [{ key: 'primary', label: 'P', required: true, acceptKinds: ['image'] }],
      'with-thumbnail',
    );
    const out = optimizeOptionsForSeed(seed, 'primary');
    expect(out.breakpoints).toContain('xs');
  });

  it('policy `thumb-only` → uniquement `xs` + `sm`', () => {
    const seed = makeSeed(
      [{ key: 'primary', label: 'P', required: true, acceptKinds: ['image'] }],
      'thumb-only',
    );
    const out = optimizeOptionsForSeed(seed, 'primary');
    // L'idée est qu'on ne génère que de petits formats.
    expect(out.breakpoints.every((b) => b === 'xs' || b === 'sm')).toBe(true);
  });
});

describe('optimizeOptionsForSeed — targetAspectRatio (crop)', () => {
  it('cropToAspect=true + aspectRatioHint → targetAspectRatio renvoyé', () => {
    const seed = makeSeed([
      {
        key: 'primary',
        label: 'P',
        required: true,
        acceptKinds: ['image'],
        aspectRatioHint: '4/5',
        cropToAspect: true,
      },
    ]);
    const out = optimizeOptionsForSeed(seed, 'primary');
    expect(out.targetAspectRatio).toBe('4/5');
  });

  it('cropToAspect=true SANS aspectRatioHint → pas de crop (config invalide)', () => {
    const seed = makeSeed([
      {
        key: 'primary',
        label: 'P',
        required: true,
        acceptKinds: ['image'],
        cropToAspect: true,
      },
    ]);
    const out = optimizeOptionsForSeed(seed, 'primary');
    expect(out.targetAspectRatio).toBeUndefined();
  });

  it('aspectRatioHint sans cropToAspect → pas de crop (rendu fait le ratio)', () => {
    const seed = makeSeed([
      {
        key: 'primary',
        label: 'P',
        required: true,
        acceptKinds: ['image'],
        aspectRatioHint: '4/5',
      },
    ]);
    const out = optimizeOptionsForSeed(seed, 'primary');
    expect(out.targetAspectRatio).toBeUndefined();
  });

  it('slot inexistant → pas de crop (silencieux)', () => {
    const seed = makeSeed([
      { key: 'primary', label: 'P', required: true, acceptKinds: ['image'] },
    ]);
    const out = optimizeOptionsForSeed(seed, 'inexistant');
    expect(out.targetAspectRatio).toBeUndefined();
  });
});

describe('optimizeOptionsForSeed — flattenBackground (tokens)', () => {
  it('token `creme` → hex `#FBF8F1`', () => {
    const seed = makeSeed([
      {
        key: 'primary',
        label: 'P',
        required: true,
        acceptKinds: ['image'],
        backgroundFillDefault: 'creme',
      },
    ]);
    const out = optimizeOptionsForSeed(seed, 'primary');
    expect(out.flattenBackground).toBe('#FBF8F1');
  });

  it('token `champagne-soft` → hex `#E8D9BC`', () => {
    const seed = makeSeed([
      {
        key: 'primary',
        label: 'P',
        required: true,
        acceptKinds: ['image'],
        backgroundFillDefault: 'champagne-soft',
      },
    ]);
    const out = optimizeOptionsForSeed(seed, 'primary');
    expect(out.flattenBackground).toBe('#E8D9BC');
  });

  it('hex direct passe-through', () => {
    const seed = makeSeed([
      {
        key: 'primary',
        label: 'P',
        required: true,
        acceptKinds: ['image'],
        backgroundFillDefault: '#ABCDEF',
      },
    ]);
    const out = optimizeOptionsForSeed(seed, 'primary');
    expect(out.flattenBackground).toBe('#ABCDEF');
  });

  it('rgb() passe-through', () => {
    const seed = makeSeed([
      {
        key: 'primary',
        label: 'P',
        required: true,
        acceptKinds: ['image'],
        backgroundFillDefault: 'rgb(200, 100, 50)',
      },
    ]);
    const out = optimizeOptionsForSeed(seed, 'primary');
    expect(out.flattenBackground).toBe('rgb(200, 100, 50)');
  });

  it('token inconnu → flattenBackground absent (résolution null)', () => {
    const seed = makeSeed([
      {
        key: 'primary',
        label: 'P',
        required: true,
        acceptKinds: ['image'],
        backgroundFillDefault: 'token-fantaisiste',
      },
    ]);
    const out = optimizeOptionsForSeed(seed, 'primary');
    expect(out.flattenBackground).toBeUndefined();
  });

  it('pas de backgroundFillDefault → undefined', () => {
    const seed = makeSeed([
      { key: 'primary', label: 'P', required: true, acceptKinds: ['image'] },
    ]);
    const out = optimizeOptionsForSeed(seed, 'primary');
    expect(out.flattenBackground).toBeUndefined();
  });
});

describe('optimizeOptionsForSeed — combinaison réaliste journal-card', () => {
  it('slot journal complet (4/5 + crop + creme) → crop + flatten cohérents', () => {
    const seed = makeSeed(
      [
        {
          key: 'cover',
          label: 'Couverture',
          required: false,
          acceptKinds: ['image'],
          aspectRatioHint: '4/5',
          cropToAspect: true,
          objectFitDefault: 'cover',
          backgroundFillDefault: 'creme',
        },
      ],
      'with-thumbnail',
    );
    const out = optimizeOptionsForSeed(seed, 'cover');
    expect(out.breakpoints).toContain('xs');
    expect(out.targetAspectRatio).toBe('4/5');
    expect(out.flattenBackground).toBe('#FBF8F1');
  });
});
