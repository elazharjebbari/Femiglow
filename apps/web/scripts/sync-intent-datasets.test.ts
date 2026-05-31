/**
 * CHA-231 — Test smoke pour `sync-intent-datasets.ts`.
 *
 * On vérifie :
 *   1. Le mapping d'intents convertit correctement les classes HF aux
 *      `ChatIntent` de notre taxonomie (subset commerce only).
 *   2. Les `DatasetSpec` sont bien typés et chacun a un mapping non-vide.
 *
 * On ne teste PAS l'appel réseau réel — il est gardé sous le flag
 * `--offline` du script (cf. `intent-public.json` qui contient
 * `skipped: true` quand offline).
 */
import { describe, expect, it } from 'vitest';

import { DATASETS } from './sync-intent-datasets';

describe('sync-intent-datasets — DATASETS specs', () => {
  it('expose au moins MASSIVE-FR, MASSIVE-AR et Bitext-EN', () => {
    const names = DATASETS.map((d) => d.name);
    expect(names).toContain('massive-fr');
    expect(names).toContain('massive-ar');
    expect(names).toContain('bitext-cs-en');
  });

  it('chaque spec a un mapping qui retourne un ChatIntent valide ou null', () => {
    const valid = new Set([
      'shipping',
      'pricing',
      'purchase-intent',
      'order-status',
      'support',
      'callback-request',
      'frustration',
      'social-proof',
      'greeting',
      'misc',
    ]);
    for (const spec of DATASETS) {
      // On échantillonne 3 raw intents probables.
      const samples = ['transport_query', 'place_order', 'general_greet', 'unknown_intent_xyz'];
      for (const raw of samples) {
        const r = spec.intentMap(raw, 'sample text');
        if (r !== null) {
          expect(valid.has(r), `${spec.name} → ${raw} → ${r}`).toBe(true);
        }
      }
    }
  });

  it('Bitext mappe place_order → purchase-intent', () => {
    const bitext = DATASETS.find((d) => d.name === 'bitext-cs-en');
    expect(bitext?.intentMap('place_order', 'I want to place an order')).toBe('purchase-intent');
  });

  it('MASSIVE-FR mappe transport_query → shipping', () => {
    const fr = DATASETS.find((d) => d.name === 'massive-fr');
    expect(fr?.intentMap('transport_query', 'quand mon colis arrive')).toBe('shipping');
  });

  it('rejette les intents non commerciaux (general_quirky, recommendation_*)', () => {
    const fr = DATASETS.find((d) => d.name === 'massive-fr');
    expect(fr?.intentMap('general_quirky', 'random text')).toBeNull();
    expect(fr?.intentMap('recommendation_movies', 'random text')).toBeNull();
  });
});
