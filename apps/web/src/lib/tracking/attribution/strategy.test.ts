import { describe, expect, it } from 'vitest';
import { applyStrategy, simulateAllStrategies } from './strategy';
import type { AttributionSnapshot, ChannelTouch } from './types';

function touch(overrides: Partial<ChannelTouch> = {}): ChannelTouch {
  return {
    channel: 'direct',
    is_paid: false,
    detected_at: '2026-05-15T12:00:00Z',
    ...overrides,
  };
}

describe('applyStrategy — last_paid_touch (défaut)', () => {
  it('renvoie le 1er du paid_history', () => {
    const snap: AttributionSnapshot = {
      first_touch: touch({ channel: 'meta', is_paid: true, click_id_field: 'fbclid' }),
      last_touch: touch({ channel: 'direct' }),
      paid_history: [
        touch({ channel: 'google_ads', is_paid: true, click_id_field: 'gclid' }),
        touch({ channel: 'meta', is_paid: true, click_id_field: 'fbclid' }),
      ],
    };
    const r = applyStrategy(snap, 'last_paid_touch');
    expect(r.channel).toBe('google_ads');
    expect(r.is_paid).toBe(true);
    expect(r.reason).toContain('gclid');
  });
  it('snapshot sans paid_history → direct', () => {
    const snap: AttributionSnapshot = {
      first_touch: touch(),
      last_touch: touch(),
      paid_history: [],
    };
    const r = applyStrategy(snap, 'last_paid_touch');
    expect(r.channel).toBe('direct');
    expect(r.is_paid).toBe(false);
  });
});

describe('applyStrategy — first_paid_touch', () => {
  it('renvoie le dernier du paid_history (= le plus ancien)', () => {
    const snap: AttributionSnapshot = {
      first_touch: null,
      last_touch: null,
      paid_history: [
        touch({ channel: 'google_ads', is_paid: true, click_id_field: 'gclid' }), // récent
        touch({ channel: 'meta', is_paid: true, click_id_field: 'fbclid' }),       // ancien
      ],
    };
    const r = applyStrategy(snap, 'first_paid_touch');
    expect(r.channel).toBe('meta');
  });
});

describe('applyStrategy — last_touch', () => {
  it('renvoie last_touch tel quel (peut être direct)', () => {
    const snap: AttributionSnapshot = {
      first_touch: touch({ channel: 'meta', is_paid: true }),
      last_touch: touch({ channel: 'direct' }),
      paid_history: [touch({ channel: 'meta', is_paid: true })],
    };
    expect(applyStrategy(snap, 'last_touch').channel).toBe('direct');
  });
  it('absent → direct', () => {
    expect(
      applyStrategy({ first_touch: null, last_touch: null, paid_history: [] }, 'last_touch').channel,
    ).toBe('direct');
  });
});

describe('applyStrategy — first_touch', () => {
  it('renvoie first_touch', () => {
    const snap: AttributionSnapshot = {
      first_touch: touch({ channel: 'organic' }),
      last_touch: touch({ channel: 'direct' }),
      paid_history: [],
    };
    expect(applyStrategy(snap, 'first_touch').channel).toBe('organic');
  });
});

describe('applyStrategy — broadcast', () => {
  it('renvoie channel=broadcast quelle que soit la situation', () => {
    const snap: AttributionSnapshot = {
      first_touch: touch({ channel: 'meta', is_paid: true }),
      last_touch: touch({ channel: 'meta', is_paid: true }),
      paid_history: [touch({ channel: 'meta', is_paid: true })],
    };
    expect(applyStrategy(snap, 'broadcast').channel).toBe('broadcast');
  });
});

describe('simulateAllStrategies', () => {
  it('renvoie un résultat par stratégie', () => {
    const snap: AttributionSnapshot = {
      first_touch: touch({ channel: 'meta', is_paid: true }),
      last_touch: touch({ channel: 'direct' }),
      paid_history: [touch({ channel: 'google_ads', is_paid: true })],
    };
    const out = simulateAllStrategies(snap);
    expect(out.last_paid_touch.channel).toBe('google_ads');
    expect(out.first_paid_touch.channel).toBe('google_ads');
    expect(out.last_touch.channel).toBe('direct');
    expect(out.first_touch.channel).toBe('meta');
    expect(out.broadcast.channel).toBe('broadcast');
  });
});
