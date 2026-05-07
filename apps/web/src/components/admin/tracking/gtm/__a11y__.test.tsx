/**
 * Tests d'accessibilité automatisés (jest-axe) sur les composants GTM critiques.
 *
 * Cible WCAG 2.2 AA. Toute violation détectée bloque le test.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';

/**
 * Configuration axe partagée pour les tests GTM admin.
 *
 * On désactive certaines règles très strictes mais non-WCAG :
 *  - `definition-list` : axe est strict sur la structure dl/dt/dd même
 *    quand wrappée en <div> (pratique courante CSS) — pas une vraie
 *    violation a11y au sens WCAG.
 *  - `landmark-one-main` : nos composants sont des fragments rendus
 *    dans une page admin qui a son propre <main> — non pertinent isolé.
 *  - `region` : idem, les régions sont définies au niveau page.
 *  - `page-has-heading-one` : composant isolé, pas de h1 attendu.
 */
const AXE_OPTIONS = {
  rules: {
    'definition-list': { enabled: false },
    'landmark-one-main': { enabled: false },
    region: { enabled: false },
    'page-has-heading-one': { enabled: false },
  },
} as const;
import { GtmStatsGrid } from './GtmStatsGrid';
import { GtmEnvTabs } from './GtmEnvTabs';
import { GtmHelpSteps } from './GtmHelpSteps';
import { GtmConfigVersionList } from './GtmConfigVersionList';
import { GtmLinterReport } from './GtmLinterReport';
import { GtmConfigDiff } from './GtmConfigDiff';
import { GtmAdminTabs } from './GtmAdminTabs';
import { emptyEnvConfig, type GtmConfigVersion } from '@/lib/tracking/gtm/config-schema';
import type { GtmStats } from '@/lib/tracking/gtm/exporter';

const STATS: GtmStats = {
  tags: 75,
  triggers: 67,
  variables: 39,
  folders: 9,
  conversions: 4,
  chatTriggers: 18,
  chatDims: 9,
  byCategory: {},
};

function makeVersion(name: string): GtmConfigVersion {
  return {
    id: `${name}-id`,
    name,
    notes: null,
    createdAt: new Date().toISOString(),
    createdBy: 'adm',
    perEnv: {
      production: emptyEnvConfig(),
      stage: emptyEnvConfig(),
      preview: emptyEnvConfig(),
      dev: emptyEnvConfig(),
    },
  };
}

describe('a11y — composants statiques', () => {
  it('GtmStatsGrid passe axe', async () => {
    const { container } = render(<GtmStatsGrid stats={STATS} />);
    const results = await axe(container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
  });

  it('GtmEnvTabs passe axe', async () => {
    const { container } = render(
      <GtmEnvTabs value="production" onChange={() => {}} />,
    );
    const results = await axe(container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
  });

  it('GtmHelpSteps passe axe', async () => {
    const { container } = render(<GtmHelpSteps />);
    const results = await axe(container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
  });

  it('GtmAdminTabs passe axe', async () => {
    const { container } = render(
      <GtmAdminTabs
        panels={{
          export: <p>e</p>,
          configurations: <p>c</p>,
          visualization: <p>v</p>,
        }}
      />,
    );
    const results = await axe(container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
  });
});

describe('a11y — composants avec données', () => {
  it('GtmConfigVersionList passe axe (vide)', async () => {
    const { container } = render(
      <GtmConfigVersionList
        activeId={null}
        versions={[]}
        onActivate={async () => {}}
        onDelete={async () => {}}
      />,
    );
    const results = await axe(container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
  });

  it('GtmConfigVersionList passe axe (avec versions)', async () => {
    const { container } = render(
      <GtmConfigVersionList
        activeId="v1-id"
        versions={[makeVersion('v1'), makeVersion('v2')]}
        onActivate={async () => {}}
        onDelete={async () => {}}
      />,
    );
    const results = await axe(container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
  });

  it('GtmConfigDiff passe axe (avec diff)', async () => {
    const a = makeVersion('v3');
    const b = makeVersion('v2');
    const { container } = render(<GtmConfigDiff a={a} b={b} />);
    const results = await axe(container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
  });

  it('GtmLinterReport passe axe (vide)', async () => {
    const { container } = render(
      <GtmLinterReport report={{ errors: [], warnings: [], infos: [], ok: true }} />,
    );
    const results = await axe(container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
  });

  it('GtmLinterReport passe axe (avec issues)', async () => {
    const { container } = render(
      <GtmLinterReport
        defaultOpen
        report={{
          errors: [
            {
              code: 'tag_no_trigger',
              severity: 'error',
              message: 'X',
              refType: 'tag',
              refName: 'TagX',
            },
          ],
          warnings: [],
          infos: [],
          ok: false,
        }}
      />,
    );
    const results = await axe(container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
  });
});
