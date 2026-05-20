import { afterEach, describe, expect, it } from 'vitest';
import { clearDedupCache, dedupCacheSize, isDuplicateEventId } from './dedup';

afterEach(() => clearDedupCache());

describe('dedup — basiques', () => {
  it('marque un event_id comme nouveau au premier appel', () => {
    expect(isDuplicateEventId('e1')).toBe(false);
    expect(dedupCacheSize()).toBe(1);
  });

  it('détecte le doublon au second appel', () => {
    expect(isDuplicateEventId('e2')).toBe(false);
    expect(isDuplicateEventId('e2')).toBe(true);
  });

  it('expire après TTL et accepte à nouveau', () => {
    expect(isDuplicateEventId('e3', 0)).toBe(false);
    expect(isDuplicateEventId('e3', 70_000)).toBe(false);
  });
});

describe('dedup — avancés', () => {
  it('ne confond pas des event_ids différents', () => {
    expect(isDuplicateEventId('evA')).toBe(false);
    expect(isDuplicateEventId('evB')).toBe(false);
    expect(isDuplicateEventId('evA')).toBe(true); // doublon
    expect(isDuplicateEventId('evB')).toBe(true); // doublon
    expect(isDuplicateEventId('evC')).toBe(false); // nouveau
  });

  it('un event_id expiré est traité comme nouveau même si l\'entrée existe encore', () => {
    expect(isDuplicateEventId('exp1', 0)).toBe(false);
    // Toujours dans la fenêtre TTL (60s)
    expect(isDuplicateEventId('exp1', 30_000)).toBe(true);
    // TTL dépassé
    expect(isDuplicateEventId('exp1', 61_000)).toBe(false);
  });

  it('l\'entrée est remplise après expiration et redevient doublon', () => {
    expect(isDuplicateEventId('renew1', 0)).toBe(false);
    expect(isDuplicateEventId('renew1', 61_000)).toBe(false); // expiré, renouvelé
    expect(isDuplicateEventId('renew1', 62_000)).toBe(true); // dans la nouvelle fenêtre
  });

  it('les event_ids vides ou spéciaux ne causent pas de collision', () => {
    expect(isDuplicateEventId('')).toBe(false);
    expect(isDuplicateEventId('')).toBe(true);
    expect(isDuplicateEventId(' ')).toBe(false); // différent de ''
    expect(isDuplicateEventId('évent-uniqüe')).toBe(false);
    expect(isDuplicateEventId('évent-uniqüe')).toBe(true);
  });

  it('supporte des centaines d\'event_ids sans erreur', () => {
    for (let i = 0; i < 500; i++) {
      expect(isDuplicateEventId(`batch-${i}`)).toBe(false);
    }
    expect(dedupCacheSize()).toBe(500);
    // Vérifier que les doublons sont détectés
    for (let i = 0; i < 500; i++) {
      expect(isDuplicateEventId(`batch-${i}`)).toBe(true);
    }
  });

  it('éviction quand le cache dépasse MAX_ENTRIES', () => {
    // Remplir 50_001 entrées pour forcer l'éviction
    for (let i = 0; i < 50_001; i++) {
      isDuplicateEventId(`overflow-${i}`);
    }
    // Le premier event inséré doit avoir été évicté
    expect(isDuplicateEventId('overflow-0')).toBe(false);
  });

  it('simule un flux de production : page_view puis purchase avec même event_id = doublon', () => {
    const eventId = 'evt_2026-05-17_abc123';
    expect(isDuplicateEventId(eventId)).toBe(false); // premier envoi
    expect(isDuplicateEventId(eventId)).toBe(true);  // rejeu accidentel
  });

  it('deux events différents (page_view vs purchase) ne sont pas doublons', () => {
    expect(isDuplicateEventId('page_view_home_123')).toBe(false);
    expect(isDuplicateEventId('purchase_order_456')).toBe(false);
    // Pas de doublon entre différents event_ids
    expect(isDuplicateEventId('page_view_home_123')).toBe(true);
    expect(isDuplicateEventId('purchase_order_456')).toBe(true);
  });

  it('clearDedupCache vide le cache complètement', () => {
    for (let i = 0; i < 10; i++) {
      isDuplicateEventId(`clear-${i}`);
    }
    expect(dedupCacheSize()).toBe(10);
    clearDedupCache();
    expect(dedupCacheSize()).toBe(0);
    // Après clear, les mêmes IDs sont considérés nouveaux
    expect(isDuplicateEventId('clear-0')).toBe(false);
  });
});