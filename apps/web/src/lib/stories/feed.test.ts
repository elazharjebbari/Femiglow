import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/client', () => ({ db: () => null, schema: {} }));

import { getStoriesFeed, pickI18n } from './feed';

describe('pickI18n', () => {
  it('prend la locale demandée quand elle existe', () => {
    expect(pickI18n({ fr: 'Bonjour', ar: 'مرحبا', en: 'Hi' }, 'ar')).toBe('مرحبا');
  });

  it('retombe sur le défaut (fr) puis sur la 1ʳᵉ valeur non vide', () => {
    expect(pickI18n({ fr: 'Bonjour', en: 'Hi' }, 'ar')).toBe('Bonjour');
    expect(pickI18n({ en: 'Hi' }, 'ar')).toBe('Hi');
  });

  it('renvoie undefined pour une map vide / invalide', () => {
    expect(pickI18n({}, 'fr')).toBeUndefined();
    expect(pickI18n(null, 'fr')).toBeUndefined();
  });
});

describe('getStoriesFeed', () => {
  it('renvoie un feed vide en mode mémoire (db() = null)', async () => {
    await expect(getStoriesFeed('fr')).resolves.toEqual({ stories: [] });
  });
});
