/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ATTR_COOKIE_NAME,
  mergeTouch,
  readAttributionCookie,
  writeAttributionCookie,
} from './cookie';
import type { AttributionSnapshot, ChannelTouch } from './types';

function touch(overrides: Partial<ChannelTouch> = {}): ChannelTouch {
  return {
    channel: 'direct',
    is_paid: false,
    detected_at: '2026-05-15T12:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  // Nettoie le cookie entre tests
  document.cookie = `${ATTR_COOKIE_NAME}=; Max-Age=0; Path=/`;
});

afterEach(() => {
  document.cookie = `${ATTR_COOKIE_NAME}=; Max-Age=0; Path=/`;
});

describe('cookie read/write', () => {
  it('write then read produit le même snapshot', () => {
    const snap: AttributionSnapshot = {
      first_touch: touch({ channel: 'meta', is_paid: true, click_id: 'fb1' }),
      last_touch: touch({ channel: 'direct' }),
      paid_history: [touch({ channel: 'meta', is_paid: true, click_id: 'fb1' })],
    };
    writeAttributionCookie(snap);
    const r = readAttributionCookie();
    expect(r.first_touch?.channel).toBe('meta');
    expect(r.last_touch?.channel).toBe('direct');
    expect(r.paid_history).toHaveLength(1);
  });

  it('read sans cookie → snapshot vide', () => {
    const r = readAttributionCookie();
    expect(r.first_touch).toBeNull();
    expect(r.last_touch).toBeNull();
    expect(r.paid_history).toEqual([]);
  });

  it('read avec cookie corrompu → snapshot vide (pas de crash)', () => {
    document.cookie = `${ATTR_COOKIE_NAME}=not-json; Path=/`;
    const r = readAttributionCookie();
    expect(r.first_touch).toBeNull();
  });
});

describe('mergeTouch', () => {
  it('1er touch → first_touch = last_touch = input, paid_history vide si non payant', () => {
    const empty: AttributionSnapshot = { first_touch: null, last_touch: null, paid_history: [] };
    const t = touch({ channel: 'direct' });
    const merged = mergeTouch(empty, t);
    expect(merged.first_touch).toEqual(t);
    expect(merged.last_touch).toEqual(t);
    expect(merged.paid_history).toEqual([]);
  });

  it('1er touch payant → ajouté à paid_history', () => {
    const empty: AttributionSnapshot = { first_touch: null, last_touch: null, paid_history: [] };
    const t = touch({ channel: 'meta', is_paid: true, click_id: 'fb1', click_id_field: 'fbclid' });
    const merged = mergeTouch(empty, t);
    expect(merged.paid_history).toHaveLength(1);
    expect(merged.paid_history[0]?.channel).toBe('meta');
  });

  it('first_touch est préservé sur les touches suivantes', () => {
    const first = touch({ channel: 'meta', is_paid: true });
    const second = touch({ channel: 'google_ads', is_paid: true });
    const snap = mergeTouch({ first_touch: first, last_touch: first, paid_history: [first] }, second);
    expect(snap.first_touch).toEqual(first); // immuable
    expect(snap.last_touch).toEqual(second); // remplacé
    expect(snap.paid_history[0]).toEqual(second); // prepend
    expect(snap.paid_history[1]).toEqual(first);
  });

  it('dédup paid_history par click_id', () => {
    const t1 = touch({ channel: 'meta', is_paid: true, click_id: 'fb1' });
    const t2 = touch({ channel: 'meta', is_paid: true, click_id: 'fb1' }); // même click_id
    const snap = mergeTouch({ first_touch: t1, last_touch: t1, paid_history: [t1] }, t2);
    expect(snap.paid_history).toHaveLength(1); // pas de doublon
  });

  it('paid_history LRU 20 — pop le plus ancien quand >20', () => {
    let snap: AttributionSnapshot = { first_touch: null, last_touch: null, paid_history: [] };
    for (let i = 0; i < 25; i += 1) {
      snap = mergeTouch(
        snap,
        touch({ channel: 'meta', is_paid: true, click_id: `fb${i}` }),
      );
    }
    expect(snap.paid_history).toHaveLength(20);
    // Le plus récent (fb24) est en première position
    expect(snap.paid_history[0]?.click_id).toBe('fb24');
  });

  it('touch non-payant n\'altère pas paid_history', () => {
    const paid = touch({ channel: 'meta', is_paid: true, click_id: 'fb1' });
    const direct = touch({ channel: 'direct', is_paid: false });
    const snap = mergeTouch({ first_touch: paid, last_touch: paid, paid_history: [paid] }, direct);
    expect(snap.paid_history).toEqual([paid]); // inchangé
    expect(snap.last_touch).toEqual(direct);
  });
});
