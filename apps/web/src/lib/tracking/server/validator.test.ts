import { afterEach, describe, expect, it } from 'vitest';
import { clearValidatorCache, getValidator, knownEvents } from './validator';

afterEach(() => clearValidatorCache());

describe('validator', () => {
  it('renvoie un schéma pour un event connu', () => {
    const schema = getValidator('purchase');
    expect(schema).not.toBeNull();
    const result = schema!.safeParse({ transaction_id: 'tx_1', currency: 'MAD', value: 99 });
    expect(result.success).toBe(true);
  });

  it('renvoie null pour un event inconnu', () => {
    expect(getValidator('definitely_not_an_event')).toBeNull();
  });

  it('cache les schémas (instances identiques)', () => {
    const a = getValidator('page_view');
    const b = getValidator('page_view');
    expect(a).toBe(b);
  });

  it('knownEvents() liste les 36 événements', () => {
    expect(knownEvents().length).toBeGreaterThanOrEqual(36);
  });

  // Régression live preview cha-230 — les emit côté client envoient
  // ces champs et ils étaient rejetés par .strict() (warn
  // `tracking.ingest.invalid_params`).
  it('chat_lead_form_offered accepte message_id, reason et copy_key', () => {
    const schema = getValidator('chat_lead_form_offered');
    expect(schema).not.toBeNull();
    const result = schema!.safeParse({
      session_id: 'sess_abc',
      message_id: 'msg_42',
      reason: 'intent_offer',
      copy_key: 'cta_offer_kit',
    });
    expect(result.success).toBe(true);
  });

  it('chat_lead_form_view accepte reason', () => {
    const schema = getValidator('chat_lead_form_view');
    expect(schema).not.toBeNull();
    const result = schema!.safeParse({
      session_id: 'sess_abc',
      reason: 'auto_offer_after_3_messages',
    });
    expect(result.success).toBe(true);
  });

  it('view_promotion accepte creative_name', () => {
    const schema = getValidator('view_promotion');
    expect(schema).not.toBeNull();
    const result = schema!.safeParse({
      promotion_id: 'promo_kit',
      promotion_name: 'Kit FemiGlow — Été 25',
      creative_slot: 'hero',
      creative_name: 'hero_kit_v2',
    });
    expect(result.success).toBe(true);
  });
});
