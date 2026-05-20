import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, server } from '@/test/msw/server';
import { GeoPromoSlideHeader } from './GeoPromoSlideHeader';

let mockedPathname = '/kit';

vi.mock('next/navigation', () => ({
  usePathname: () => mockedPathname,
}));

const emit = vi.fn();
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit }),
}));

const payload = {
  enabled: true,
  dateLabel: '18 mai 2026',
  dateShort: '18 mai',
  cityLabel: 'Casablanca',
  message: 'Offre du 18 mai - Casablanca',
  tags: [
    { key: 'discount', label: '-25%', icon: 'BadgePercent' },
    { key: 'free_shipping', label: 'Livraison gratuite', icon: 'Truck' },
    { key: 'cod', label: 'Paiement a la livraison', icon: 'HandCoins' },
    { key: 'inspect_before_pay', label: 'Verifiez avant de payer', icon: 'ShieldCheck' },
    { key: 'morocco_delivery', label: 'Partout au Maroc', icon: 'MapPinned' },
  ],
  discountPct: 25,
  ctaLabel: 'Commander',
  ctaHref: '/kit#commander-femiglow',
  ariaLabel: 'Offre FemiGlow du jour',
  theme: 'ink',
  density: 'compact',
  motion: 'none',
  dismissible: true,
  dismissMode: 'session',
  campaignKey: 'geo_promo_kit_default',
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  window.sessionStorage.clear();
  emit.mockClear();
});
afterAll(() => server.close());

beforeEach(() => {
  mockedPathname = '/kit';
  server.use(http.get('/api/promo/location', () => HttpResponse.json(payload)));
});

describe('GeoPromoSlideHeader', () => {
  it('renders only on /kit with short message, tags and CTA', async () => {
    render(<GeoPromoSlideHeader />);
    expect(await screen.findByText('Offre du 18 mai - Casablanca')).toBeInTheDocument();
    expect(screen.getByText('-25%')).toBeInTheDocument();
    expect(screen.getByText('Livraison gratuite')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Commander' })).toHaveAttribute(
      'href',
      '/kit#commander-femiglow',
    );
  });

  it('does not render outside /kit', async () => {
    mockedPathname = '/journal';
    render(<GeoPromoSlideHeader />);
    await waitFor(() => {
      expect(screen.queryByTestId('geo-promo-slide-header')).not.toBeInTheDocument();
    });
  });

  it('does not render disabled API responses', async () => {
    server.use(http.get('/api/promo/location', () => HttpResponse.json({ enabled: false })));
    render(<GeoPromoSlideHeader />);
    await waitFor(() => {
      expect(screen.queryByTestId('geo-promo-slide-header')).not.toBeInTheDocument();
    });
  });

  it('persists dismissal in session storage', async () => {
    const user = userEvent.setup();
    render(<GeoPromoSlideHeader />);
    expect(await screen.findByText('Offre du 18 mai - Casablanca')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Fermer l'offre" }));
    expect(screen.queryByTestId('geo-promo-slide-header')).not.toBeInTheDocument();
    expect(
      window.sessionStorage.getItem('femiglow:geo-promo-slide-header:geo_promo_kit_default:session'),
    ).toBe('1');
  });
});
