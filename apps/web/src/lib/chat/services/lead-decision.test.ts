/**
 * CHA-207 — Tests pour `shouldOfferLeadForm`.
 *
 * Couvre les 7 règles de priorité, les early-returns (disabled, alreadyOffered,
 * too-early), et les patterns out-of-knowledge multilingues.
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §4.1
 */
import { describe, expect, it } from 'vitest';

import type { ChatMessageRow } from '../db/schema';
import { shouldOfferLeadForm } from './lead-decision';
import type { ChatIntent } from './intent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;
function userMsg(content: string): Pick<ChatMessageRow, 'id' | 'role' | 'content' | 'createdAt'> {
  return {
    id: `u_${++counter}`,
    role: 'user',
    content,
    createdAt: new Date(),
  };
}
function assistantMsg(
  content: string,
): Pick<ChatMessageRow, 'id' | 'role' | 'content' | 'createdAt'> {
  return {
    id: `a_${++counter}`,
    role: 'assistant',
    content,
    createdAt: new Date(),
  };
}

const baseInput = {
  enabled: true,
  alreadyOffered: false,
  assistantReply: 'Voilà !',
  // Heure ouvrée Maroc : mardi 10 h
  now: new Date('2026-05-12T09:00:00Z'),
};

// ---------------------------------------------------------------------------
// Early-returns
// ---------------------------------------------------------------------------

describe('shouldOfferLeadForm — gates', () => {
  it("ne propose rien si `enabled === false`", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      enabled: false,
      history: [userMsg('hello'), userMsg('hello again')],
      currentIntent: 'callback-request' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(false);
  });

  it("ne propose rien si déjà offert", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      alreadyOffered: true,
      history: [userMsg('hello'), userMsg('hello')],
      currentIntent: 'callback-request' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(false);
  });

  it("ne propose rien si moins de 2 messages user (sauf callback-request)", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [userMsg('hello')],
      currentIntent: 'b2b' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(false);
    expect(result.debug?.reason).toBe('too-early');
  });
});

// ---------------------------------------------------------------------------
// Règle 0 — Numéro de téléphone détecté dans le message visiteur (CHA-225)
// ---------------------------------------------------------------------------

describe("règle 0 — inline-contact (CHA-225)", () => {
  it("propose dès le 1er tour si un numéro est détecté dans le dernier message", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [userMsg('hamid +212751592310')],
      currentIntent: 'misc' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('inline-contact');
    expect(result.copyKey).toBe('inline-contact');
  });

  it("propose même si l'intent est commercial — ne pas perdre le lead", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [
        userMsg('Bonjour'),
        userMsg("c'est combien le kit ?"),
        userMsg('hamid 0651592310'),
      ],
      currentIntent: 'pricing' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('inline-contact');
  });

  it("ne propose pas si le message ne contient pas de numéro plausible", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [userMsg('Bonjour'), userMsg('hello there')],
      currentIntent: 'misc' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Règle 1 — Demande explicite
// ---------------------------------------------------------------------------

describe("règle 1 — explicit-request", () => {
  it("propose dès le 1er message si l'intent est `callback-request`", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [userMsg('Je veux parler à quelqu’un')],
      currentIntent: 'callback-request' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('explicit-request');
    expect(result.copyKey).toBe('explicit-request');
  });
});

// ---------------------------------------------------------------------------
// Règle 1bis — Intent d'achat explicite (CHA-225)
// ---------------------------------------------------------------------------

describe("règle 1bis — purchase-intent (CHA-225)", () => {
  it("propose dès le 1er tour si l'intent est `purchase-intent`", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [userMsg('Je veux commander le kit')],
      currentIntent: 'purchase-intent' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('purchase-intent');
    expect(result.copyKey).toBe('purchase-intent');
  });
});

// ---------------------------------------------------------------------------
// Règle 2 — B2B
// ---------------------------------------------------------------------------

describe("règle 2 — b2b", () => {
  it("propose si intent b2b après 2 messages", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [
        userMsg('Bonjour'),
        userMsg('Je suis institut, vous faites des prix pro ?'),
      ],
      currentIntent: 'b2b' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('b2b');
    expect(result.copyKey).toBe('b2b');
  });
});

// ---------------------------------------------------------------------------
// Règle 3 — Frustration
// ---------------------------------------------------------------------------

describe("règle 3 — frustration", () => {
  it("propose si intent frustration après 2 messages", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [userMsg('test'), userMsg('ça suffit, c’est nul')],
      currentIntent: 'frustration' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('frustration');
    expect(result.copyKey).toBe('manual');
  });
});

// ---------------------------------------------------------------------------
// Règle 4 — Out-of-knowledge
// ---------------------------------------------------------------------------

describe("règle 4 — out-of-knowledge", () => {
  it("propose si l'IA dit ne pas savoir (FR)", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [userMsg('Q1'), userMsg('Q2')],
      currentIntent: 'misc' as ChatIntent,
      assistantReply: "Désolé, je n'ai pas cette information sous la main.",
    });
    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('out-of-knowledge');
    expect(result.copyKey).toBe('out-of-knowledge');
  });

  it("propose si l'IA dit ne pas savoir (AR)", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [userMsg('Q1'), userMsg('Q2')],
      currentIntent: 'misc' as ChatIntent,
      assistantReply: 'عذرا، لا أعرف الإجابة.',
    });
    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('out-of-knowledge');
  });

  it("propose si l'IA dit ne pas savoir (Darija)", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [userMsg('Q1'), userMsg('Q2')],
      currentIntent: 'misc' as ChatIntent,
      assistantReply: 'ma 3andich had l-ma3lumat daba.',
    });
    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('out-of-knowledge');
  });
});

// ---------------------------------------------------------------------------
// Règle 5 — Objection répétée
// ---------------------------------------------------------------------------

describe("règle 5 — objection-repeat", () => {
  it("propose si même objection prix répétée 2× sans progrès", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [
        userMsg("c'est trop cher"),
        assistantMsg('Je comprends.'),
        userMsg("vraiment trop cher pour un soin"),
      ],
      currentIntent: 'objection-price' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('objection-repeat');
    expect(result.copyKey).toBe('objection');
  });

  it("ne propose pas si l'objection prix n'apparaît qu'une fois", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [userMsg('Bonjour'), userMsg("c'est trop cher")],
      currentIntent: 'objection-price' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Règle 6 — Long sans progrès
// ---------------------------------------------------------------------------

describe("règle 6 — long-no-progress", () => {
  it("propose après ≥ 5 user messages sur intent stagnant", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [
        userMsg('hi'),
        userMsg('ok'),
        userMsg('hum'),
        userMsg('je vois'),
        userMsg('vraiment ?'),
      ],
      currentIntent: 'misc' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('long-no-progress');
    expect(result.copyKey).toBe('manual');
  });

  it("ne propose pas si l'utilisateur a un intent commercial (pricing)", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [
        userMsg('hi'),
        userMsg('ok'),
        userMsg('hum'),
        userMsg('je vois'),
        userMsg('le prix ?'),
      ],
      currentIntent: 'pricing' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Règle 7 — After-hours
// ---------------------------------------------------------------------------

describe("règle 7 — after-hours", () => {
  it("propose si hors horaires Maroc (samedi 22 h) avec ≥ 3 messages", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      // Samedi 22 h Maroc = 21 h UTC en CET
      now: new Date('2026-05-09T21:00:00Z'),
      history: [
        userMsg('hi'),
        userMsg('je voudrais le kit'),
        userMsg('vous êtes là ?'),
      ],
      currentIntent: 'support' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('after-hours');
    expect(result.copyKey).toBe('after-hours');
  });

  it("ne propose pas en horaires ouvrés (mardi 10 h Maroc)", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      // Mardi 10 h Maroc = 09 h UTC
      now: new Date('2026-05-12T09:00:00Z'),
      history: [
        userMsg('hi'),
        userMsg('je voudrais le kit'),
        userMsg('vous êtes là ?'),
      ],
      currentIntent: 'support' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(false);
  });

  it("ne propose pas en after-hours si seulement 2 messages user", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      now: new Date('2026-05-09T21:00:00Z'),
      history: [userMsg('hi'), userMsg('vous êtes là ?')],
      currentIntent: 'support' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Règle 8 — Engagement (CHAT-064)
// ---------------------------------------------------------------------------

describe("règle 8 — engagement (CHAT-064)", () => {
  it("propose après 6 messages user même sur intent non stagnant (ingredient)", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [
        userMsg('hi'),
        userMsg('quel format ?'),
        userMsg('ingrédients ?'),
        userMsg('vegan ?'),
        userMsg('et la durée ?'),
        userMsg('et le pack famille ?'),
      ],
      currentIntent: 'ingredient' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('long-no-progress');
    expect(result.copyKey).toBe('manual');
    expect(result.debug?.trigger).toBe('engagement');
  });

  it("ne propose pas à 5 user messages sur intent non stagnant", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [
        userMsg('hi'),
        userMsg('quel format ?'),
        userMsg('ingrédients ?'),
        userMsg('vegan ?'),
        userMsg('et la durée ?'),
      ],
      currentIntent: 'ingredient' as ChatIntent,
    });
    expect(result.shouldOffer).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cas par défaut (aucune règle ne matche)
// ---------------------------------------------------------------------------

describe("default — pas d'offre", () => {
  it("ne propose rien sur intent commercial actif", () => {
    const result = shouldOfferLeadForm({
      ...baseInput,
      history: [userMsg('Bonjour'), userMsg('Combien coûte le kit ?')],
      currentIntent: 'pricing' as ChatIntent,
      assistantReply: 'Le kit complet est à 290 MAD.',
    });
    expect(result.shouldOffer).toBe(false);
  });
});
