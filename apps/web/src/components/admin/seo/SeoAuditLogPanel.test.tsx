/**
 * Tests `SeoAuditLogPanel`.
 *
 * Couvre :
 *  - État vide (aucun event initial).
 *  - Rendu d'événements avec heure, actor, action, target.
 *  - Filtre action : appel API avec query string correcte.
 *  - Filtre actor : appel API avec actorId.
 *  - « Charger plus » consomme nextCursor et concatène les events.
 *  - Toggle d'un event affiche meta JSON formaté.
 *  - Erreur réseau affichée.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { AuditEvent } from '@/lib/db/types';

import { SeoAuditLogPanel } from './SeoAuditLogPanel';

const originalFetch = global.fetch;

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

function mkEvent(over: Partial<AuditEvent> & { id: string }): AuditEvent {
  return {
    id: over.id,
    action: over.action ?? 'seo.publish',
    actorId: over.actorId ?? 'adm_1',
    resourceType: over.resourceType ?? 'seo_overrides',
    resourceId: over.resourceId ?? 'ov_1',
    meta: over.meta ?? {},
    createdAt: over.createdAt ?? new Date('2026-05-19T10:30:00Z'),
  };
}

describe('SeoAuditLogPanel — rendu de base', () => {
  it('affiche un message d\'empty si aucun event', () => {
    render(<SeoAuditLogPanel initialEvents={[]} initialNextCursor={null} />);
    expect(screen.getByTestId('seo-audit-empty')).toBeTruthy();
  });

  it('rend chaque événement avec heure/actor/action/target', () => {
    const e1 = mkEvent({
      id: 'ae_1',
      action: 'seo.publish',
      actorId: 'adm_yasmine',
      resourceType: 'seo_overrides',
      resourceId: 'ov_42',
      createdAt: new Date('2026-05-19T14:25:00Z'),
    });
    render(<SeoAuditLogPanel initialEvents={[e1]} initialNextCursor={null} />);
    expect(screen.queryByTestId('seo-audit-empty')).toBeNull();
    // Cibler la row précise : le testid identifie l'event, l'action y figure.
    const row = screen.getByTestId('seo-audit-event-ae_1');
    expect(row.textContent).toContain('seo.publish');
    expect(row.textContent).toContain('adm_yasmine');
    expect(row.textContent).toContain('seo_overrides:ov_42');
  });

  it('expand → affiche meta JSON formaté', () => {
    const e = mkEvent({
      id: 'ae_x',
      meta: { reason: 'reset', previous: { siteName: 'Old' } },
    });
    render(<SeoAuditLogPanel initialEvents={[e]} initialNextCursor={null} />);
    fireEvent.click(screen.getByTestId('seo-audit-event-ae_x'));
    expect(screen.getByText(/"reason": "reset"/)).toBeTruthy();
  });
});

describe('SeoAuditLogPanel — pagination', () => {
  it('bouton « Charger plus » visible si nextCursor', () => {
    render(<SeoAuditLogPanel initialEvents={[mkEvent({ id: 'ae_1' })]} initialNextCursor="ae_1" />);
    expect(screen.getByTestId('seo-audit-load-more')).toBeTruthy();
  });

  it('bouton absent si pas de nextCursor', () => {
    render(<SeoAuditLogPanel initialEvents={[mkEvent({ id: 'ae_1' })]} initialNextCursor={null} />);
    expect(screen.queryByTestId('seo-audit-load-more')).toBeNull();
  });

  it('« Charger plus » fetch avec le cursor et concatène', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          events: [
            {
              id: 'ae_2',
              action: 'seo.update',
              actorId: 'adm_1',
              resourceType: 'seo_overrides',
              resourceId: 'ov_1',
              meta: {},
              createdAt: '2026-05-19T10:00:00Z',
            },
          ],
          nextCursor: null,
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock as never;

    render(
      <SeoAuditLogPanel
        initialEvents={[mkEvent({ id: 'ae_1', createdAt: new Date('2026-05-19T11:00:00Z') })]}
        initialNextCursor="ae_1"
      />,
    );
    fireEvent.click(screen.getByTestId('seo-audit-load-more'));
    await waitFor(() => {
      expect(screen.getByText('seo.update')).toBeTruthy();
    });
    // Le cursor a été passé dans l'URL.
    const callUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain('cursor=ae_1');
  });
});

describe('SeoAuditLogPanel — filtres', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ events: [], nextCursor: null }), { status: 200 }),
    ) as never;
  });

  it('appliquer un filtre action met cette action dans la query', async () => {
    render(<SeoAuditLogPanel initialEvents={[]} initialNextCursor={null} />);
    fireEvent.change(screen.getByTestId('seo-audit-filter-action'), {
      target: { value: 'seo.publish' },
    });
    fireEvent.click(screen.getByTestId('seo-audit-filter-apply'));
    await waitFor(() => {
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    });
    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(callUrl).toContain('action=seo.publish');
  });

  it('appliquer un filtre actor met cet actorId dans la query', async () => {
    render(<SeoAuditLogPanel initialEvents={[]} initialNextCursor={null} />);
    fireEvent.change(screen.getByTestId('seo-audit-filter-actor'), {
      target: { value: 'adm_yasmine' },
    });
    fireEvent.click(screen.getByTestId('seo-audit-filter-apply'));
    await waitFor(() => {
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    });
    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(callUrl).toContain('actorId=adm_yasmine');
  });
});

describe('SeoAuditLogPanel — erreur réseau', () => {
  it('affiche le message d\'erreur si fetch rejette', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as never;

    render(
      <SeoAuditLogPanel
        initialEvents={[mkEvent({ id: 'ae_1' })]}
        initialNextCursor="ae_1"
      />,
    );
    fireEvent.click(screen.getByTestId('seo-audit-load-more'));
    await waitFor(() => {
      expect(screen.getByText('network down')).toBeTruthy();
    });
  });
});
