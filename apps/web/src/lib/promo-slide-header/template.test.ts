import { describe, expect, it } from 'vitest';
import { formatPromoDates, renderPromoTemplate } from './template';

describe('promo slide header template', () => {
  it('formats full and short Casablanca dates', () => {
    const dates = formatPromoDates(new Date('2026-05-18T12:00:00.000Z'));
    expect(dates.date).toBe('18 mai 2026');
    expect(dates.dateShort).toBe('18 mai');
  });

  it('renders the short city message', () => {
    expect(
      renderPromoTemplate('Offre du {dateShort} - {city}', 'Offre du {dateShort} - Maroc', {
        date: '18 mai 2026',
        dateShort: '18 mai',
        city: 'Casablanca',
        region: 'Casablanca-Settat',
        country: 'MA',
      }),
    ).toBe('Offre du 18 mai - Casablanca');
  });

  it('uses fallback when city is missing', () => {
    expect(
      renderPromoTemplate('Offre du {dateShort} - {city}', 'Offre du {dateShort} - Maroc', {
        date: '18 mai 2026',
        dateShort: '18 mai',
        city: null,
        region: null,
        country: 'MA',
      }),
    ).toBe('Offre du 18 mai - Maroc');
  });

  it('falls back on unknown template variables', () => {
    expect(
      renderPromoTemplate('Offre {bad} - {city}', 'Offre {bad}', {
        date: '18 mai 2026',
        dateShort: '18 mai',
        city: 'Rabat',
        region: null,
        country: 'MA',
      }),
    ).toBe('Offre du 18 mai - Rabat');
  });
});
