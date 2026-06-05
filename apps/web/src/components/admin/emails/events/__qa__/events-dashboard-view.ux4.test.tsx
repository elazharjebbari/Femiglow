/**
 * VAGUE 4 — UX-DASH-007/008/009 : page Events pilotable.
 *
 * Couche : composant présentationnel `<EventsDashboardView … />` (RTL, jsdom),
 * extrait de `events/page.tsx`. Données forgées.
 *
 * Oracles imposés :
 *  - UX4-DASHBOARD-004 : barre de filtres expose le bouton « import » ;
 *    chaque ligne « Top events » est un lien vers ?source=<s>.
 *  - UX4-DASHBOARD-005 : aucune chaîne anglaise visible
 *    (absence de « Total last 24h » / « Count » / « Properties »).
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { EventsDashboardView } from '@/components/admin/emails/events/EventsDashboardView';
import type {
  EventCountByName,
  RecentEvent,
} from '@/lib/user-events/queries';

const counts: EventCountByName[] = [
  { eventName: 'cart_abandoned', source: 'email', count: 340 },
  { eventName: 'page_view', source: 'web', count: 120 },
  { eventName: 'order_imported', source: 'import', count: 5 },
];

const recent: RecentEvent[] = [
  {
    id: 1,
    email: 'client@exemple.test',
    eventName: 'cart_abandoned',
    ts: new Date('2026-06-05T08:30:00Z'),
    source: 'email',
    sessionId: 'sess_1',
    leadId: null,
    properties: { cartId: 'c_1' },
  },
];

describe('UX4-DASHBOARD-004 — filtres source & drill-down Top events', () => {
  it('UX4-DASHBOARD-004a : la barre de filtres expose le bouton « import »', () => {
    render(<EventsDashboardView counts={counts} recent={recent} total={465} />);
    const filterNav = screen.getByRole('navigation', { name: /filtrer par source/i });
    const importLink = within(filterNav).getByRole('link', { name: 'import' });
    expect(importLink).toHaveAttribute('href', '/admin/emails/events?source=import');
  });

  it('UX4-DASHBOARD-004b : les 5 sources (web/email/server/admin/import) sont filtrables', () => {
    render(<EventsDashboardView counts={counts} recent={recent} total={465} />);
    const filterNav = screen.getByRole('navigation', { name: /filtrer par source/i });
    for (const s of ['web', 'email', 'server', 'admin', 'import']) {
      expect(within(filterNav).getByRole('link', { name: s })).toHaveAttribute(
        'href',
        `/admin/emails/events?source=${s}`,
      );
    }
  });

  it('UX4-DASHBOARD-004c : chaque ligne « Top events » est un lien vers ?source=<s>', () => {
    render(<EventsDashboardView counts={counts} recent={recent} total={465} />);
    // La ligne cart_abandoned/email pointe vers le flux filtré source=email.
    const cartLink = screen.getByRole('link', { name: /cart_abandoned/i });
    expect(cartLink).toHaveAttribute('href', '/admin/emails/events?source=email');
    // La ligne import → source=import.
    const importedLink = screen.getByRole('link', { name: /order_imported/i });
    expect(importedLink).toHaveAttribute('href', '/admin/emails/events?source=import');
  });

  it('UX4-DASHBOARD-004d : le compteur total est un lien vers le flux non filtré', () => {
    render(<EventsDashboardView counts={counts} recent={recent} total={465} />);
    const totalLink = screen.getByRole('link', { name: /total des events sur 24 h/i });
    expect(totalLink).toHaveAttribute('href', '/admin/emails/events');
    expect(totalLink).toHaveTextContent('465');
  });

  it('UX4-DASHBOARD-004e : la source filtrée courante est marquée aria-current', () => {
    render(
      <EventsDashboardView counts={counts} recent={recent} total={465} sourceFilter="email" />,
    );
    const filterNav = screen.getByRole('navigation', { name: /filtrer par source/i });
    const emailLink = within(filterNav).getByRole('link', { name: 'email' });
    expect(emailLink).toHaveAttribute('aria-current', 'true');
    // « Tous » n'est PAS courant quand un filtre est actif.
    expect(within(filterNav).getByRole('link', { name: /tous/i })).not.toHaveAttribute(
      'aria-current',
    );
  });
});

describe('UX4-DASHBOARD-005 — i18n FR (aucune chaîne anglaise résiduelle)', () => {
  it('UX4-DASHBOARD-005a : aucun « Total last 24h » / « Count » / « Properties » / « Top events (last 24h) »', () => {
    const { container } = render(
      <EventsDashboardView counts={counts} recent={recent} total={465} />,
    );
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Total last 24h/i);
    expect(text).not.toMatch(/Top events \(last 24h\)/i);
    expect(text).not.toMatch(/\bCount\b/);
    expect(text).not.toMatch(/\bProperties\b/);
  });

  it('UX4-DASHBOARD-005b : les libellés FR canoniques sont présents', () => {
    render(<EventsDashboardView counts={counts} recent={recent} total={465} />);
    expect(screen.getByText('Total 24h')).toBeInTheDocument();
    expect(screen.getByText('Top events (24h)')).toBeInTheDocument();
    // En-têtes de colonnes FR.
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Propriétés' })).toBeInTheDocument();
  });

  it('UX4-DASHBOARD-005c : états vides FR (counts & recent vides)', () => {
    render(<EventsDashboardView counts={[]} recent={[]} total={0} />);
    expect(
      screen.getByText(/Aucun event sur les 24 dernières heures\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Aucun event ne correspond aux filtres\./)).toBeInTheDocument();
  });
});
