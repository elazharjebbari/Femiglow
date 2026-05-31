import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { trackRitualEvent } from './tracking-events';

interface TestWindow extends Window {
  dataLayer?: Array<Record<string, unknown>>;
}

beforeEach(() => {
  (globalThis as unknown as TestWindow).dataLayer = [];
});

afterEach(() => {
  delete (globalThis as unknown as { dataLayer?: unknown }).dataLayer;
});

describe('trackRitualEvent', () => {
  it('push un événement dans window.dataLayer', () => {
    trackRitualEvent('ritual_wall_open', { entry_point: 'kit_link' });
    const dl = (globalThis as unknown as TestWindow).dataLayer;
    expect(dl).toHaveLength(1);
    expect(dl?.[0]).toEqual({
      event: 'ritual_wall_open',
      ritual: { entry_point: 'kit_link' },
    });
  });

  it('payload par défaut = objet vide', () => {
    trackRitualEvent('ritual_module_view');
    const dl = (globalThis as unknown as TestWindow).dataLayer;
    expect(dl?.[0]).toEqual({ event: 'ritual_module_view', ritual: {} });
  });

  it('ne casse pas si dataLayer absent', () => {
    delete (globalThis as unknown as { dataLayer?: unknown }).dataLayer;
    expect(() => trackRitualEvent('ritual_wall_close')).not.toThrow();
  });
});
