/**
 * Kit CRO v2 — le bandeau promo géolocalisé est piloté par une décision
 * SERVEUR (`promoBannerEnabled`), pas par le pathname : sous la réécriture
 * `/kit` → `/fr/kit`, le pathname vaut `/kit` alors que la page rendue est
 * l'arbre localisé, qui n'a jamais affiché le bandeau en production.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse, server } from '@/test/msw/server';

import { GeoPromoSlideHeaderSlot } from './GeoPromoSlideHeaderSlot';

// Le pathname vaut `/kit` dans les deux arbres (réécriture) : c'est le cas
// qui provoquait la régression.
vi.mock('next/navigation', () => ({
  usePathname: () => '/kit',
}));

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: vi.fn() }),
}));

const fetchSpy = vi.fn();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  fetchSpy.mockClear();
});
afterAll(() => server.close());

function mockPayload(): void {
  server.use(
    http.get('/api/promo/location', () => {
      fetchSpy();
      return HttpResponse.json({
        enabled: true,
        message: 'Offre du jour - Rabat',
        tags: [],
        ctaLabel: 'Commander',
        ctaHref: '/kit#commander-femiglow',
        theme: 'ink',
        density: 'compact',
        motion: 'none',
        dismissible: true,
        dismissMode: 'session',
        campaignKey: 'geo_promo_kit_default',
      });
    }),
  );
}

describe('GeoPromoSlideHeaderSlot', () => {
  it('arbre localisé (enabled=false) : aucun bandeau, aucun appel réseau, même sur /kit', async () => {
    mockPayload();
    const { container } = render(<GeoPromoSlideHeaderSlot enabled={false} />);
    // Laisse passer un tour de boucle : aucun effet ne doit se déclencher.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.innerHTML).toBe('');
    expect(screen.queryByTestId('geo-promo-slide-header')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('arbre legacy (enabled=true) : le bandeau s’affiche sur /kit', async () => {
    mockPayload();
    render(<GeoPromoSlideHeaderSlot enabled />);
    expect(await screen.findByTestId('geo-promo-slide-header')).toBeInTheDocument();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  });
});
