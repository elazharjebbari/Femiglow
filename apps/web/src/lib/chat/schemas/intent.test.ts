/**
 * CHA-230 Phase 2 — Tests des schémas Zod intent.
 *
 * Vérifie :
 *  - parse round-trip valide,
 *  - rejet des intents inconnus,
 *  - rejet des `confidence` invalides,
 *  - cap sur la longueur de `reason`,
 *  - alignement entre `intentEnumSchema` (Zod) et `ChatIntent` (TS) : si
 *    on ajoute un intent dans `services/intent.ts`, on ne peut pas oublier
 *    de l'ajouter ici sans casser un test.
 */
import { describe, expect, it } from 'vitest';

import {
  intentClassificationSchema,
  intentConfidenceSchema,
  intentEnumSchema,
  intentMethodSchema,
} from './intent';

describe('intentClassificationSchema', () => {
  it('parse une classification valide', () => {
    const r = intentClassificationSchema.safeParse({
      intent: 'purchase-intent',
      confidence: 'high',
      reason: 'Explicit purchase verb',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.intent).toBe('purchase-intent');
      expect(r.data.confidence).toBe('high');
    }
  });

  it('rejette un intent inconnu', () => {
    const r = intentClassificationSchema.safeParse({
      intent: 'not-a-real-intent',
      confidence: 'low',
      reason: 'whatever',
    });
    expect(r.success).toBe(false);
  });

  it('rejette une confidence invalide', () => {
    const r = intentClassificationSchema.safeParse({
      intent: 'pricing',
      confidence: 'maybe',
      reason: 'whatever',
    });
    expect(r.success).toBe(false);
  });

  it('rejette un reason trop long (> 120 chars)', () => {
    const r = intentClassificationSchema.safeParse({
      intent: 'pricing',
      confidence: 'low',
      reason: 'x'.repeat(121),
    });
    expect(r.success).toBe(false);
  });

  it('accepte un reason de 120 chars exactement', () => {
    const r = intentClassificationSchema.safeParse({
      intent: 'pricing',
      confidence: 'low',
      reason: 'x'.repeat(120),
    });
    expect(r.success).toBe(true);
  });
});

describe('alignement Zod ↔ TS — non-régression', () => {
  it('intentEnumSchema couvre exactement les 19 intents attendus', () => {
    // Si quelqu'un ajoute un intent dans `services/intent.ts` sans le
    // refléter ici, ce test cassera. Liste à jour avec CHA-230 Phase 1.
    const expected = [
      'greeting',
      'pricing',
      'shipping',
      'routine',
      'ingredient',
      'order-status',
      'support',
      'objection-price',
      'objection-doubt',
      'social-proof',
      'comparison',
      'b2b',
      'callback-request',
      'frustration',
      'after-hours',
      'purchase-intent',
      'negotiation',
      'wholesaler',
      'misc',
    ];
    expect(intentEnumSchema.options).toEqual(expected);
  });

  it('intentConfidenceSchema → 3 niveaux', () => {
    expect(intentConfidenceSchema.options).toEqual(['low', 'medium', 'high']);
  });

  it('intentMethodSchema couvre les 5 méthodes attendues', () => {
    expect(intentMethodSchema.options).toEqual([
      'regex',
      'llm',
      'llm-fixed',
      'golden',
      'manual',
    ]);
  });
});
