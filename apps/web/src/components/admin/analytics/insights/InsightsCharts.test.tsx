import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  KpiCard,
  EventsTimeSeries,
  ActivityHeatmap,
  FunnelSankey,
  SectionsBarChart,
  TopEventsTable,
  PagesTable,
  ComponentsTable,
} from './InsightsCharts';

describe('KpiCard', () => {
  it('rend label + value', () => {
    render(<KpiCard label="Total events" value="12 437" />);
    expect(screen.getByText('Total events')).toBeInTheDocument();
    expect(screen.getByText('12 437')).toBeInTheDocument();
  });

  it('variation positive en sauge profond', () => {
    const { container } = render(<KpiCard label="X" value="100" variation={0.14} />);
    expect(container.querySelector('.text-emerald-700')).toBeInTheDocument();
  });

  it('variation négative en pétale rouge', () => {
    const { container } = render(<KpiCard label="X" value="100" variation={-0.05} />);
    expect(container.querySelector('.text-red-700')).toBeInTheDocument();
  });

  it('invertVariation : +bounce = rouge', () => {
    const { container } = render(
      <KpiCard label="Bounce" value="40 %" variation={0.1} invertVariation />,
    );
    expect(container.querySelector('.text-red-700')).toBeInTheDocument();
  });

  it('variation null masquée', () => {
    render(<KpiCard label="X" value="100" />);
    expect(screen.queryByText(/%$/)).toBeNull();
  });
});

describe('EventsTimeSeries', () => {
  it('rend une <svg> avec aria-label', () => {
    render(<EventsTimeSeries data={[{ date: '2026-05-01', events: 100, sessions: 40, conversions: 2 }]} />);
    expect(screen.getByLabelText(/Évolution/i)).toBeInTheDocument();
  });

  it('rend empty state si vide', () => {
    render(<EventsTimeSeries data={[]} />);
    expect(screen.getByText(/Aucune donnée/i)).toBeInTheDocument();
  });
});

describe('ActivityHeatmap', () => {
  it('rend 168 cellules (7×24)', () => {
    const cells = [];
    for (let dow = 0; dow < 7; dow++) {
      for (let h = 0; h < 24; h++) cells.push({ hour: h, dayOfWeek: dow, count: dow + h });
    }
    const { container } = render(<ActivityHeatmap cells={cells} />);
    expect(container.querySelectorAll('rect').length).toBe(168);
  });

  it('vide → empty state', () => {
    render(<ActivityHeatmap cells={[]} />);
    expect(screen.getByText(/Aucune donnée/i)).toBeInTheDocument();
  });
});

describe('FunnelSankey', () => {
  it('rend un rectangle par étape', () => {
    const { container } = render(
      <FunnelSankey
        stages={[
          { name: 'view_item', count: 100, conversionFromPrev: null },
          { name: 'add_to_cart', count: 40, conversionFromPrev: 0.4 },
          { name: 'purchase', count: 5, conversionFromPrev: 0.125 },
        ]}
      />,
    );
    expect(container.querySelectorAll('rect').length).toBe(3);
  });

  it('vide → empty state', () => {
    render(<FunnelSankey stages={[]} />);
    expect(screen.getByText(/Aucune donnée/i)).toBeInTheDocument();
  });
});

describe('SectionsBarChart', () => {
  it('rend une ligne par section (max 12)', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      sectionId: `s${i}`,
      pageRoute: '/',
      views: 10,
      avgDwellSeconds: 100 - i * 10,
      uniqueSessions: 5,
    }));
    render(<SectionsBarChart rows={rows} />);
    expect(screen.getByTestId('sections-bars').children.length).toBe(5);
  });
});

describe('TopEventsTable', () => {
  it('rend en-têtes + lignes', () => {
    render(
      <TopEventsTable
        rows={[
          {
            eventName: 'page_view',
            eventCategory: 'navigation',
            count: 100,
            share: 0.5,
            conversionCount: 0,
            isConversion: false,
          },
        ]}
      />,
    );
    expect(screen.getByText('Event')).toBeInTheDocument();
    expect(screen.getByText('page_view')).toBeInTheDocument();
  });
});

describe('PagesTable', () => {
  it("ouvre drill-down sur clic", () => {
    const calls: string[] = [];
    render(
      <PagesTable
        rows={[
          {
            pageRoute: '/kit',
            pageViews: 100,
            sessions: 60,
            visitors: 50,
            scroll75: 30,
            conversions: 5,
            bounceCount: 10,
            bounceRate: 0.16,
            avgTimeSeconds: 120,
          },
        ]}
        onRowClick={(r) => calls.push(r.pageRoute)}
      />,
    );
    const row = screen.getByText('/kit').closest('tr');
    row?.click();
    expect(calls).toEqual(['/kit']);
  });
});

describe('ComponentsTable', () => {
  it('affiche components + nom + page', () => {
    render(
      <ComponentsTable
        rows={[
          {
            componentId: 'cta-1',
            componentName: 'CTA Recevoir',
            pageRoute: '/kit',
            total: 1800,
            topEvent: 'add_to_cart',
            conversionCount: 12,
          },
        ]}
      />,
    );
    expect(screen.getByText('cta-1')).toBeInTheDocument();
    expect(screen.getByText('CTA Recevoir')).toBeInTheDocument();
    expect(screen.getByText('add_to_cart')).toBeInTheDocument();
  });
});
