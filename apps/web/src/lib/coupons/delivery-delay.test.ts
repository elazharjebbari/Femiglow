/** LOY-G2 — délai d'activation selon la durée max de livraison ville. */
import { describe, expect, it } from 'vitest';
import {
  ACTIVATION_BUFFER_DAYS,
  DEFAULT_MAX_DELIVERY_DAYS,
  computeActivatesAt,
  maxDeliveryDays,
} from './delivery-delay';

describe('LOY-G2 maxDeliveryDays', () => {
  it('U001 « 24h » → 1 jour', () => expect(maxDeliveryDays('24h')).toBe(1));
  it('U002 « 24-48h » → 2 jours (borne haute)', () => expect(maxDeliveryDays('24-48h')).toBe(2));
  it('U003 « 48 à 72 h » → 3 jours', () => expect(maxDeliveryDays('48 à 72 h')).toBe(3));
  it('U004 « 72h » → 3 jours', () => expect(maxDeliveryDays('72h')).toBe(3));
  it('U005 « 2 jours » → 2', () => expect(maxDeliveryDays('2 jours')).toBe(2));
  it('U006 « 3-5 jours » → 5', () => expect(maxDeliveryDays('3-5 jours')).toBe(5));
  it('U007 vide/null → défaut', () => {
    expect(maxDeliveryDays('')).toBe(DEFAULT_MAX_DELIVERY_DAYS);
    expect(maxDeliveryDays(null)).toBe(DEFAULT_MAX_DELIVERY_DAYS);
    expect(maxDeliveryDays('bientôt')).toBe(DEFAULT_MAX_DELIVERY_DAYS);
  });
});

describe('LOY-G2 computeActivatesAt', () => {
  it('U010 activation = commande + jours livraison + buffer', () => {
    const order = new Date('2026-06-01T10:00:00Z');
    const a = computeActivatesAt(order, '24-48h'); // 2j + buffer
    const expected = new Date(order);
    expected.setDate(expected.getDate() + 2 + ACTIVATION_BUFFER_DAYS);
    expect(a.toISOString()).toBe(expected.toISOString());
  });
});
