/**
 * Tests d'accessibilité automatisés (jest-axe) sur les composants Insights critiques.
 *
 * Cible WCAG 2.2 AA. Toute violation détectée bloque le test.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';

import {
  ActivityHeatmap,
  ComponentsTable,
  EventsTimeSeries,
  FunnelSankey,
  KpiCard,
  PagesTable,
  SectionsBarChart,
  TopEventsTable,
} from './InsightsCharts';
import { InsightsDrawer } from './InsightsDrawer';

const AXE_OPTIONS = {
  rules: {
    'definition-list': { enabled: false },
    'landmark-one-main': { enabled: false },
    region: { enabled: false },
    'page-has-heading-one': { enabled: false },
  },
} as const;

describe('Insights a11y — KpiCard', () => {
  it('positive', async () => {
    const { container } = render(<KpiCard label="Events" value="12 437" variation={0.14} />);
    const r = await axe(container, AXE_OPTIONS);
    expect(r.violations).toEqual([]);
  });

  it('null variation', async () => {
    const { container } = render(<KpiCard label="X" value="0" />);
    const r = await axe(container, AXE_OPTIONS);
    expect(r.violations).toEqual([]);
  });
});

describe('Insights a11y — EventsTimeSeries', () => {
  it('avec données', async () => {
    const { container } = render(
      <EventsTimeSeries
        data={[
          { date: '2026-05-01', events: 100, sessions: 40, conversions: 2 },
          { date: '2026-05-02', events: 120, sessions: 50, conversions: 3 },
        ]}
      />,
    );
    const r = await axe(container, AXE_OPTIONS);
    expect(r.violations).toEqual([]);
  });

  it('vide', async () => {
    const { container } = render(<EventsTimeSeries data={[]} />);
    const r = await axe(container, AXE_OPTIONS);
    expect(r.violations).toEqual([]);
  });
});

describe('Insights a11y — ActivityHeatmap', () => {
  it('168 cells', async () => {
    const cells = [];
    for (let dow = 0; dow < 7; dow++) {
      for (let h = 0; h < 24; h++) cells.push({ hour: h, dayOfWeek: dow, count: dow + h });
    }
    const { container } = render(<ActivityHeatmap cells={cells} />);
    const r = await axe(container, AXE_OPTIONS);
    expect(r.violations).toEqual([]);
  });
});

describe('Insights a11y — Tables', () => {
  it('TopEventsTable avec données', async () => {
    const { container } = render(
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
    const r = await axe(container, AXE_OPTIONS);
    expect(r.violations).toEqual([]);
  });

  it('PagesTable cliquable', async () => {
    const { container } = render(
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
        onRowClick={() => {}}
      />,
    );
    const r = await axe(container, AXE_OPTIONS);
    expect(r.violations).toEqual([]);
  });

  it('ComponentsTable avec données', async () => {
    const { container } = render(
      <ComponentsTable
        rows={[
          {
            componentId: 'cta-1',
            componentName: 'CTA',
            pageRoute: '/kit',
            total: 100,
            topEvent: 'add_to_cart',
            conversionCount: 5,
          },
        ]}
      />,
    );
    const r = await axe(container, AXE_OPTIONS);
    expect(r.violations).toEqual([]);
  });
});

describe('Insights a11y — FunnelSankey', () => {
  it('5 étapes', async () => {
    const { container } = render(
      <FunnelSankey
        stages={[
          { name: 'view_item', count: 100, conversionFromPrev: null },
          { name: 'add_to_cart', count: 40, conversionFromPrev: 0.4 },
          { name: 'begin_checkout', count: 20, conversionFromPrev: 0.5 },
          { name: 'add_payment_info', count: 15, conversionFromPrev: 0.75 },
          { name: 'purchase', count: 12, conversionFromPrev: 0.8 },
        ]}
      />,
    );
    const r = await axe(container, AXE_OPTIONS);
    expect(r.violations).toEqual([]);
  });
});

describe('Insights a11y — SectionsBarChart', () => {
  it('plusieurs sections', async () => {
    const { container } = render(
      <SectionsBarChart
        rows={Array.from({ length: 5 }, (_, i) => ({
          sectionId: `s${i}`,
          pageRoute: '/',
          views: 10,
          avgDwellSeconds: 100 - i * 10,
          uniqueSessions: 5,
        }))}
      />,
    );
    const r = await axe(container, AXE_OPTIONS);
    expect(r.violations).toEqual([]);
  });
});

describe('Insights a11y — InsightsDrawer', () => {
  it('drawer ouvert', async () => {
    const { container } = render(
      <InsightsDrawer
        open
        onClose={() => {}}
        kicker="Page"
        title="/kit"
        subtitle="3 410 visites"
      >
        <p>Contenu du drawer</p>
      </InsightsDrawer>,
    );
    const r = await axe(container, AXE_OPTIONS);
    expect(r.violations).toEqual([]);
  });
});
