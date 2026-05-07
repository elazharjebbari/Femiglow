/**
 * Tests unitaires — `resolvePresentation`.
 *
 * Vérifie la cascade : binding ▸ media.overrides ▸ slot ▸ défaut codé.
 *
 * Cas couverts :
 *  - binding seul vs binding + overrides + slot (précédence) ;
 *  - binding "neutre" (cover/center) → on tombe sur la cascade (régression
 *    critique : un seed pose toujours `cover` sur le binding, donc si on ne
 *    redescendait pas, slot/overrides seraient masqués) ;
 *  - focal point : binding > overrides (pas de notion "neutre" ici) ;
 *  - backgroundFill : binding > overrides > slot > undefined ;
 *  - aspectRatioHint : remonte directement depuis le slot.
 */
import { describe, it, expect } from 'vitest';
import { resolvePresentation } from './presentation-cascade';
import type {
  ComponentMediaBinding,
  MediaOverrides,
  SlotDefinition,
} from '@/lib/db/types';

type BindingShape = Pick<
  ComponentMediaBinding,
  'objectFit' | 'objectPosition' | 'focalX' | 'focalY' | 'backgroundFill'
>;

type SlotShape = Pick<
  SlotDefinition,
  | 'objectFitDefault'
  | 'objectPositionDefault'
  | 'backgroundFillDefault'
  | 'aspectRatioHint'
>;

function makeBinding(over: Partial<BindingShape> = {}): BindingShape {
  // Valeurs par défaut posées au seed/upsert : `cover` / `center` sont
  // les valeurs *neutres* qui doivent laisser passer la cascade.
  return {
    objectFit: 'cover',
    objectPosition: 'center',
    focalX: null,
    focalY: null,
    backgroundFill: null,
    ...over,
  };
}

function makeSlot(over: Partial<SlotShape> = {}): SlotShape {
  return { ...over };
}

describe('resolvePresentation — cascade objectFit', () => {
  it('aucun input → défaut codé `cover`', () => {
    const r = resolvePresentation({ binding: null, overrides: null, slot: null });
    expect(r.objectFit).toBe('cover');
    expect(r.objectPosition).toBe('center');
    expect(r.focalX).toBeNull();
    expect(r.focalY).toBeNull();
    expect(r.backgroundFill).toBeUndefined();
    expect(r.slotAspectRatio).toBeUndefined();
  });

  it('slot.objectFitDefault l’emporte sur le défaut codé', () => {
    const r = resolvePresentation({
      binding: null,
      overrides: null,
      slot: makeSlot({ objectFitDefault: 'contain' }),
    });
    expect(r.objectFit).toBe('contain');
  });

  it('overrides.objectFit l’emporte sur slot.objectFitDefault', () => {
    const r = resolvePresentation({
      binding: null,
      overrides: { objectFit: 'fill' },
      slot: makeSlot({ objectFitDefault: 'contain' }),
    });
    expect(r.objectFit).toBe('fill');
  });

  it('binding.objectFit non-neutre l’emporte sur tout le reste', () => {
    const r = resolvePresentation({
      binding: makeBinding({ objectFit: 'contain' }),
      overrides: { objectFit: 'fill' },
      slot: makeSlot({ objectFitDefault: 'cover' }),
    });
    expect(r.objectFit).toBe('contain');
  });

  it('binding.objectFit = `cover` (neutre) → cascade redescend', () => {
    // Ce cas est CRITIQUE : tous les bindings posés au seed portent
    // `cover` par défaut. Si on n'isolait pas la valeur neutre, slot et
    // overrides ne pourraient jamais s'imposer.
    const r = resolvePresentation({
      binding: makeBinding({ objectFit: 'cover' }),
      overrides: { objectFit: 'contain' },
      slot: makeSlot({ objectFitDefault: 'fill' }),
    });
    expect(r.objectFit).toBe('contain');
  });

  it('binding.objectFit `cover` + overrides absent → tombe sur slot', () => {
    const r = resolvePresentation({
      binding: makeBinding({ objectFit: 'cover' }),
      overrides: null,
      slot: makeSlot({ objectFitDefault: 'contain' }),
    });
    expect(r.objectFit).toBe('contain');
  });
});

describe('resolvePresentation — cascade objectPosition', () => {
  it('binding.objectPosition non-neutre l’emporte', () => {
    const r = resolvePresentation({
      binding: makeBinding({ objectPosition: 'top' }),
      overrides: { objectPosition: 'bottom' },
      slot: makeSlot({ objectPositionDefault: 'center' }),
    });
    expect(r.objectPosition).toBe('top');
  });

  it('binding.objectPosition = `center` (neutre) → cascade redescend', () => {
    const r = resolvePresentation({
      binding: makeBinding({ objectPosition: 'center' }),
      overrides: { objectPosition: 'top' },
      slot: null,
    });
    expect(r.objectPosition).toBe('top');
  });

  it('aucun input → `center`', () => {
    const r = resolvePresentation({ binding: null, overrides: null, slot: null });
    expect(r.objectPosition).toBe('center');
  });
});

describe('resolvePresentation — focal point', () => {
  it('binding.focalX/Y l’emporte sur overrides', () => {
    const r = resolvePresentation({
      binding: makeBinding({ focalX: 80, focalY: 20 }),
      overrides: { focalX: 30, focalY: 70 } as MediaOverrides,
      slot: null,
    });
    expect(r.focalX).toBe(80);
    expect(r.focalY).toBe(20);
  });

  it('overrides utilisé si binding nul', () => {
    const r = resolvePresentation({
      binding: makeBinding(),
      overrides: { focalX: 30, focalY: 70 } as MediaOverrides,
      slot: null,
    });
    expect(r.focalX).toBe(30);
    expect(r.focalY).toBe(70);
  });

  it('null par défaut', () => {
    const r = resolvePresentation({ binding: null, overrides: null, slot: null });
    expect(r.focalX).toBeNull();
    expect(r.focalY).toBeNull();
  });

  it('focalX=0 (zéro légitime) n’est pas masqué par la cascade', () => {
    const r = resolvePresentation({
      binding: makeBinding({ focalX: 0, focalY: 0 }),
      overrides: { focalX: 50, focalY: 50 } as MediaOverrides,
      slot: null,
    });
    // 0 ?? rien → 0. Le ?? gère bien la nullité (0 est pris en compte).
    expect(r.focalX).toBe(0);
    expect(r.focalY).toBe(0);
  });
});

describe('resolvePresentation — backgroundFill', () => {
  it('binding > overrides > slot.default > undefined', () => {
    expect(
      resolvePresentation({
        binding: makeBinding({ backgroundFill: 'creme' }),
        overrides: { backgroundFill: 'sauge-soft' },
        slot: makeSlot({ backgroundFillDefault: 'champagne-soft' }),
      }).backgroundFill,
    ).toBe('creme');

    expect(
      resolvePresentation({
        binding: makeBinding(),
        overrides: { backgroundFill: 'sauge-soft' },
        slot: makeSlot({ backgroundFillDefault: 'champagne-soft' }),
      }).backgroundFill,
    ).toBe('sauge-soft');

    expect(
      resolvePresentation({
        binding: makeBinding(),
        overrides: null,
        slot: makeSlot({ backgroundFillDefault: 'champagne-soft' }),
      }).backgroundFill,
    ).toBe('champagne-soft');

    expect(
      resolvePresentation({ binding: null, overrides: null, slot: null })
        .backgroundFill,
    ).toBeUndefined();
  });
});

describe('resolvePresentation — slotAspectRatio', () => {
  it('remonte directement depuis le slot', () => {
    const r = resolvePresentation({
      binding: null,
      overrides: null,
      slot: makeSlot({ aspectRatioHint: '4/5' }),
    });
    expect(r.slotAspectRatio).toBe('4/5');
  });

  it('undefined si pas de slot', () => {
    const r = resolvePresentation({ binding: null, overrides: null, slot: null });
    expect(r.slotAspectRatio).toBeUndefined();
  });
});
