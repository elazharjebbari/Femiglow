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
});
