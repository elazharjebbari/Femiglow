/**
 * RTL — ComponentDetailPanel.
 *
 * Couvre :
 *  - rend le titre + nb de slots et le panneau « Détails techniques »
 *  - clic sur « Choisir un média » → MediaPickerDrawer s'ouvre
 *  - le drawer reçoit `acceptKinds` du slot
 *  - sélectionner une animation → POST animations
 *  - axe sans violation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import { ComponentDetailPanel } from './ComponentDetailPanel';
import type {
  ComponentAnimation,
  ComponentAnimationBindingWithAnimation,
  ComponentMediaBindingWithMedia,
  SiteComponent,
  SlotDefinition,
} from '@/lib/db/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const SLOT_PRIMARY: SlotDefinition = {
  key: 'primary',
  label: 'Visuel principal',
  required: true,
  acceptKinds: ['image'],
};

const COMPONENT: SiteComponent = {
  id: 'cmp_1',
  key: 'home-hero',
  name: 'Hero Accueil',
  description: 'Hero principal',
  category: 'hero',
  pageGroup: 'home',
  filePath: 'src/components/sections/Hero.tsx',
  slots: [SLOT_PRIMARY],
  fields: [],
  defaultSvgFallback: '/svg/hero.svg',
  defaultLoadingStrategy: 'eager',
  defaultFetchPriority: 'high',
  supportsAnimation: true,
  metadata: {},
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const ANIMATION_FADE: ComponentAnimation = {
  id: 'anm_fade',
  key: 'fade-in',
  name: 'Fade-in',
  kind: 'framer-motion',
  description: '',
  config: {},
  respectsReducedMotion: true,
  previewSnippet: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const ANIMATION_REVEAL: ComponentAnimation = {
  ...ANIMATION_FADE,
  id: 'anm_reveal',
  key: 'reveal-up',
  name: 'Reveal-up',
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/admin/media')) {
        return {
          ok: true,
          json: async () => ({ rows: [], total: 0, nextCursor: null }),
        };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ComponentDetailPanel', () => {
  it('rend la section slots et les détails techniques', () => {
    render(
      <ComponentDetailPanel
        component={COMPONENT}
        bindings={[]}
        animations={[]}
        allAnimations={[ANIMATION_FADE]}
      />,
    );
    expect(screen.getByRole('heading', { name: /slots média \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /détails techniques/i })).toBeInTheDocument();
    expect(screen.getByText('home')).toBeInTheDocument(); // pageGroup
  });

  it('clic sur « Choisir un média » → MediaPickerDrawer s\u2019ouvre', async () => {
    render(
      <ComponentDetailPanel
        component={COMPONENT}
        bindings={[]}
        animations={[]}
        allAnimations={[ANIMATION_FADE]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /choisir un média/i }));
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /assigner un média à « visuel principal »/i }),
      ).toBeInTheDocument();
    });
  });

  it('sélectionner une animation → POST /animations', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    const bindings: ComponentAnimationBindingWithAnimation[] = [
      {
        id: 'anb_1',
        componentId: 'cmp_1',
        animationId: 'anm_fade',
        isDefault: true,
        params: {},
        createdAt: new Date(0),
        animation: ANIMATION_FADE,
      },
    ];
    render(
      <ComponentDetailPanel
        component={COMPONENT}
        bindings={[]}
        animations={bindings}
        allAnimations={[ANIMATION_FADE, ANIMATION_REVEAL]}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /reveal-up/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/admin/components/home-hero/animations');
    expect(JSON.parse(init.body as string)).toMatchObject({
      animationKey: 'reveal-up',
      isDefault: true,
    });
  });

  it('respecte axe', async () => {
    const { container } = render(
      <ComponentDetailPanel
        component={COMPONENT}
        bindings={[] as ComponentMediaBindingWithMedia[]}
        animations={[]}
        allAnimations={[ANIMATION_FADE]}
      />,
    );
    await expectNoAxeViolations(container);
  });

  describe('Multi-sélection + opérations groupées', () => {
    const SLOT_A = { ...SLOT_PRIMARY, key: 'a', label: 'Slot A' };
    const SLOT_B = { ...SLOT_PRIMARY, key: 'b', label: 'Slot B' };
    const COMPONENT_TWO_SLOTS: SiteComponent = {
      ...COMPONENT,
      slots: [SLOT_A, SLOT_B],
    };
    const BINDING_A: ComponentMediaBindingWithMedia = {
      id: 'bnd_a',
      componentId: COMPONENT.id,
      slot: 'a',
      mediaId: 'me_a',
      loadingStrategy: 'viewport',
      fetchPriority: 'auto',
      priority: false,
      placeholderStrategy: 'svg',
      customAlt: null,
      displayOrder: 0,
      isActive: false,
      notes: null,
      objectFit: 'cover',
      objectPosition: 'center',
      focalX: null,
      focalY: null,
      backgroundFill: null,
      createdBy: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      media: null,
    };
    const BINDING_B: ComponentMediaBindingWithMedia = {
      ...BINDING_A,
      id: 'bnd_b',
      slot: 'b',
      mediaId: 'me_b',
    };

    it('checkbox « Tout sélectionner » sélectionne tous les bindings', () => {
      render(
        <ComponentDetailPanel
          component={COMPONENT_TWO_SLOTS}
          bindings={[BINDING_A, BINDING_B]}
          animations={[]}
          allAnimations={[ANIMATION_FADE]}
        />,
      );
      const all = screen.getByTestId('select-all') as HTMLInputElement;
      expect(all.checked).toBe(false);
      fireEvent.click(all);
      expect(screen.getByTestId('bulk-count')).toHaveTextContent(/2 sélectionnés/);
      expect(screen.getByTestId('select-all-voyant')).toHaveTextContent(/Tout est sélectionné/);
    });

    it('clic activer en bulk → POST /bindings/bulk avec action=activate + ids', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, count: 2 }),
      }));
      vi.stubGlobal('fetch', fetchMock);
      render(
        <ComponentDetailPanel
          component={COMPONENT_TWO_SLOTS}
          bindings={[BINDING_A, BINDING_B]}
          animations={[]}
          allAnimations={[ANIMATION_FADE]}
        />,
      );
      fireEvent.click(screen.getByTestId('select-all'));
      // Plusieurs boutons « Activer » existent (un par slot inactif + bulk).
      // On cible le bouton bulk via la région a11y « Actions groupées ».
      const bulkRegion = screen.getByRole('region', { name: /actions groupées/i });
      fireEvent.click(within(bulkRegion).getByRole('button', { name: /^activer$/i }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('/api/admin/components/bindings/bulk');
      const body = JSON.parse(init.body as string);
      expect(body.action).toBe('activate');
      expect(body.ids).toEqual(expect.arrayContaining(['bnd_a', 'bnd_b']));
    });

    it('désélection individuelle décrémente le compteur', () => {
      render(
        <ComponentDetailPanel
          component={COMPONENT_TWO_SLOTS}
          bindings={[BINDING_A, BINDING_B]}
          animations={[]}
          allAnimations={[ANIMATION_FADE]}
        />,
      );
      fireEvent.click(screen.getByTestId('select-all'));
      // décocher A
      fireEvent.click(screen.getByTestId('slot-select-a'));
      expect(screen.getByTestId('bulk-count')).toHaveTextContent(/1 sélectionné/);
      // voyant indéterminé
      const all = screen.getByTestId('select-all') as HTMLInputElement;
      expect(all.indeterminate).toBe(true);
    });
  });
});
