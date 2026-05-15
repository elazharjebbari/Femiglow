/**
 * Application d'une stratégie d'attribution sur un snapshot.
 * Pure function. Cf. docs/tracking-attribution/04-data-and-engine.md.
 */
import {
  type AttributedChannel,
  type AttributionSnapshot,
  type AttributionStrategy,
  type ChannelTouch,
} from './types';

export function applyStrategy(
  snapshot: AttributionSnapshot,
  strategy: AttributionStrategy,
): AttributedChannel {
  switch (strategy) {
    case 'last_paid_touch': {
      const t = snapshot.paid_history[0];
      if (t) return fromTouch(t, `last_paid_touch:${t.click_id_field ?? 'utm'}`);
      return defaultDirect('no_paid_touch_in_history');
    }
    case 'first_paid_touch': {
      const t = snapshot.paid_history[snapshot.paid_history.length - 1];
      if (t) return fromTouch(t, `first_paid_touch:${t.click_id_field ?? 'utm'}`);
      return defaultDirect('no_paid_touch_in_history');
    }
    case 'last_touch':
      if (snapshot.last_touch) {
        return fromTouch(snapshot.last_touch, 'last_touch');
      }
      return defaultDirect('no_touch_recorded');
    case 'first_touch':
      if (snapshot.first_touch) {
        return fromTouch(snapshot.first_touch, 'first_touch');
      }
      return defaultDirect('no_touch_recorded');
    case 'broadcast':
      return {
        channel: 'broadcast',
        is_paid: false,
        reason: 'broadcast_strategy',
      };
  }
}

function fromTouch(t: ChannelTouch, reason: string): AttributedChannel {
  return {
    channel: t.channel,
    is_paid: t.is_paid,
    reason,
    click_id: t.click_id,
    click_id_field: t.click_id_field,
    utm: t.utm,
  };
}

function defaultDirect(reason: string): AttributedChannel {
  return { channel: 'direct', is_paid: false, reason };
}

/**
 * Simule l'application de TOUTES les stratégies. Pratique pour le
 * debugger UI : "voici comment chaque stratégie résoudrait ce snapshot".
 */
export function simulateAllStrategies(
  snapshot: AttributionSnapshot,
): Record<AttributionStrategy, AttributedChannel> {
  return {
    last_paid_touch: applyStrategy(snapshot, 'last_paid_touch'),
    first_paid_touch: applyStrategy(snapshot, 'first_paid_touch'),
    last_touch: applyStrategy(snapshot, 'last_touch'),
    first_touch: applyStrategy(snapshot, 'first_touch'),
    broadcast: applyStrategy(snapshot, 'broadcast'),
  };
}
