/**
 * CHAT-063 — Tests `lead-prefill` helper.
 *
 * On simule `window.localStorage` via vitest happy-dom (déjà configuré).
 * Valide :
 *   - load() retourne null si rien stocké
 *   - save() puis load() restitue les valeurs intactes
 *   - TTL : on rejette une entrée > 90 jours et on la purge
 *   - save() ignore les payloads invalides (champ vide, country inconnue)
 *   - load() est défensif face à un JSON corrompu
 *   - clear() supprime l'entrée
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearLeadPrefill, loadLeadPrefill, saveLeadPrefill } from './lead-prefill';

const KEY = 'fg.chat.lead-prefill.v1';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('lead-prefill', () => {
  it('load renvoie null quand rien stocké', () => {
    expect(loadLeadPrefill()).toBeNull();
  });

  it('save puis load restitue les valeurs', () => {
    saveLeadPrefill({ firstName: 'Salma', phone: '+212600000000', country: 'MA' });
    const out = loadLeadPrefill();
    expect(out?.firstName).toBe('Salma');
    expect(out?.phone).toBe('+212600000000');
    expect(out?.country).toBe('MA');
    expect(typeof out?.savedAt).toBe('number');
  });

  it('save trim les espaces périphériques', () => {
    saveLeadPrefill({ firstName: '  Yasmine ', phone: ' 0612345678 ', country: 'MA' });
    expect(loadLeadPrefill()?.firstName).toBe('Yasmine');
    expect(loadLeadPrefill()?.phone).toBe('0612345678');
  });

  it('save ignore les payloads incomplets', () => {
    saveLeadPrefill({ firstName: '', phone: '+212600000000', country: 'MA' });
    expect(loadLeadPrefill()).toBeNull();
    saveLeadPrefill({ firstName: 'Salma', phone: '   ', country: 'MA' });
    expect(loadLeadPrefill()).toBeNull();
  });

  it('save ignore une country inconnue', () => {
    saveLeadPrefill({
      firstName: 'Salma',
      phone: '+212600000000',
      // @ts-expect-error — valeur volontairement invalide pour le test
      country: 'XX',
    });
    expect(loadLeadPrefill()).toBeNull();
  });

  it('TTL : rejette une entrée plus vieille que 90j et la purge', () => {
    const t0 = Date.now();
    saveLeadPrefill(
      { firstName: 'Salma', phone: '+212600000000', country: 'MA' },
      t0,
    );
    expect(loadLeadPrefill(t0)).not.toBeNull();
    const t1 = t0 + 91 * 24 * 60 * 60 * 1000;
    expect(loadLeadPrefill(t1)).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('load survit à un JSON corrompu', () => {
    window.localStorage.setItem(KEY, '{not-json');
    expect(loadLeadPrefill()).toBeNull();
  });

  it('load rejette un payload incomplet', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ firstName: 'Salma' }));
    expect(loadLeadPrefill()).toBeNull();
  });

  it('clear supprime l’entrée', () => {
    saveLeadPrefill({ firstName: 'Salma', phone: '+212600000000', country: 'MA' });
    expect(loadLeadPrefill()).not.toBeNull();
    clearLeadPrefill();
    expect(loadLeadPrefill()).toBeNull();
  });
});
