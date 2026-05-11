import { describe, expect, it } from 'vitest';
import {
  countActiveFilters,
  EMPTY_FILTERS,
  parseAdminFilters,
  serializeAdminFilters,
} from './admin-filters';

describe('parseAdminFilters', () => {
  it('retourne EMPTY_FILTERS si rien', () => {
    const f = parseAdminFilters(new URLSearchParams());
    expect(f).toEqual(EMPTY_FILTERS);
  });

  it('parse flags csv', () => {
    const f = parseAdminFilters(new URLSearchParams('flags=face_detected,emoji_detected'));
    expect(f.flags).toEqual(['face_detected', 'emoji_detected']);
  });

  it('ignore les flags inconnus', () => {
    const f = parseAdminFilters(new URLSearchParams('flags=face_detected,bogus'));
    expect(f.flags).toEqual(['face_detected']);
  });

  it('parse sources csv', () => {
    const f = parseAdminFilters(new URLSearchParams('source=web,email_j45'));
    expect(f.sources).toEqual(['web', 'email_j45']);
  });

  it('parse dates ISO valides', () => {
    const f = parseAdminFilters(new URLSearchParams('from=2026-04-01&to=2026-05-01'));
    expect(f.dateFrom).toBe('2026-04-01');
    expect(f.dateTo).toBe('2026-05-01');
  });

  it('ignore dates invalides', () => {
    const f = parseAdminFilters(new URLSearchParams('from=hier&to=2026/04/01'));
    expect(f.dateFrom).toBeNull();
    expect(f.dateTo).toBeNull();
  });

  it('parse author', () => {
    const f = parseAdminFilters(new URLSearchParams('author=Amal'));
    expect(f.authorQuery).toBe('Amal');
  });

  it('parse verified', () => {
    expect(parseAdminFilters(new URLSearchParams('verified=true')).verified).toBe(true);
    expect(parseAdminFilters(new URLSearchParams('verified=false')).verified).toBe(false);
    expect(parseAdminFilters(new URLSearchParams('verified=tous')).verified).toBeNull();
  });

  it('supporte objet Record<string,string>', () => {
    const f = parseAdminFilters({ flags: 'face_detected', author: 'Souad' });
    expect(f.flags).toEqual(['face_detected']);
    expect(f.authorQuery).toBe('Souad');
  });
});

describe('serializeAdminFilters', () => {
  it('roundtrip', () => {
    const original = {
      ...EMPTY_FILTERS,
      flags: ['face_detected' as const, 'emoji_detected' as const],
      sources: ['email_j45' as const],
      dateFrom: '2026-04-01',
      dateTo: '2026-05-01',
      authorQuery: 'Amal',
      verified: true,
    };
    const params = serializeAdminFilters(original);
    const back = parseAdminFilters(params);
    expect(back).toEqual(original);
  });

  it('omet les vides', () => {
    const params = serializeAdminFilters(EMPTY_FILTERS);
    expect(params.toString()).toBe('');
  });
});

describe('countActiveFilters', () => {
  it('compte chaque champ non-vide', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(
      countActiveFilters({
        ...EMPTY_FILTERS,
        flags: ['face_detected'],
        authorQuery: 'Amal',
        verified: true,
      }),
    ).toBe(3);
  });
});
