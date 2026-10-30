/**
 * Kit CRO v2 §2 — tous les points d'entrée « Commander » passent par
 * `openCommander` : en mode panneau ils l'ouvrent (sans défiler), en mode
 * défilement ils délèguent à `arriveAtCommander`. Le mode part dans le
 * tracking (`kit_cta_mode`), à côté des paramètres historiques.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { http, HttpResponse, server } from '@/test/msw/server';

const { arriveAtCommander, emit } = vi.hoisted(() => ({
  arriveAtCommander: vi.fn(),
  emit: vi.fn(),
}));
vi.mock('@/lib/checkout/wizard-arrival', () => ({ arriveAtCommander }));
vi.mock('@/lib/tracking/use-tracking', () => ({ useTracking: () => ({ emit, consent: {} }) }));
vi.mock('@/lib/media/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
vi.mock('next/navigation', () => ({ usePathname: () => '/kit' }));

import { CommanderAnchorButton } from '@/components/commerce/CommanderAnchorButton';
import { PostCtaLink } from '@/components/commerce/PostCtaLink';
import { VideoPostCta } from '@/components/kit/VideoPostCta';
import { StepsPostCtaLink } from '@/components/sections/StepsPostCtaLink';
import { StoryViewer } from '@/components/sections/StoryViewer';
import { GeoPromoSlideHeader } from '@/components/promo/GeoPromoSlideHeader';
import type { StoriesStrings, Story } from '@/lib/stories/types';

import { useCommanderLauncherStore } from './commander-launcher';

function setSheetMode() {
  useCommanderLauncherStore.setState({
    mode: 'sheet',
    isSheetOpen: false,
    sheetHosts: 1,
    lastSource: null,
  });
}

function addCommanderAnchor(withShell = false) {
  const target = document.createElement('section');
  target.id = 'commander-femiglow';
  target.scrollIntoView = vi.fn();
  if (withShell) {
    const shell = document.createElement('div');
    shell.setAttribute('data-testid', 'wizard-shell');
    target.appendChild(shell);
  }
  document.body.appendChild(target);
  return target;
}

const sheet = () => useCommanderLauncherStore.getState();
const params = (name: string) =>
  emit.mock.calls.find((c) => c[0] === name)?.[1] as Record<string, unknown>;

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});
afterAll(() => server.close());

beforeEach(() => {
  emit.mockClear();
  arriveAtCommander.mockClear();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  window.sessionStorage.clear();
  document.body.innerHTML = '';
  useCommanderLauncherStore.setState({
    mode: 'scroll',
    isSheetOpen: false,
    sheetHosts: 0,
    lastSource: null,
  });
});

describe('CommanderAnchorButton (hero, sticky, bloc pack)', () => {
  it('panneau : ouvre, ne défile pas, add_to_cart + pack_cta_click portent kit_cta_mode', () => {
    setSheetMode();
    addCommanderAnchor();
    render(
      <CommanderAnchorButton
        productId="kit"
        productName="Kit"
        priceCents={19900}
        source="pack_section"
      >
        Commander le pack
      </CommanderAnchorButton>,
    );
    fireEvent.click(screen.getByTestId('kit-commander-anchor-button'));
    expect(sheet().isSheetOpen).toBe(true);
    expect(sheet().lastSource).toBe('pack_section');
    expect(arriveAtCommander).not.toHaveBeenCalled();
    expect(params('add_to_cart')).toMatchObject({ kit_cta_mode: 'sheet', value: 199 });
    expect(params('pack_cta_click')).toMatchObject({
      kit_cta_mode: 'sheet',
      source: 'pack_section',
    });
  });

  it('défilement : arriveAtCommander et kit_cta_mode=scroll', () => {
    addCommanderAnchor();
    render(
      <CommanderAnchorButton productId="kit" productName="Kit" priceCents={19900} source="sticky">
        Commander
      </CommanderAnchorButton>,
    );
    fireEvent.click(screen.getByTestId('kit-commander-anchor-button'));
    expect(arriveAtCommander).toHaveBeenCalledWith('commander-femiglow', {});
    expect(sheet().isSheetOpen).toBe(false);
    expect(params('add_to_cart')).toMatchObject({ kit_cta_mode: 'scroll' });
  });
});

describe('Liens éditoriaux (#commander-femiglow)', () => {
  it.each([
    [
      'PostCtaLink',
      () => <PostCtaLink subProductId="1-paste" />,
      'composition-post-cta-1-paste',
      'composition_post_cta_click',
      'composition_post_cta:1-paste',
    ],
    [
      'VideoPostCta',
      () => <VideoPostCta videoId="rituel" />,
      'video-post-cta',
      'video_cta_click',
      'video_post_cta:rituel',
    ],
    [
      'StepsPostCtaLink',
      () => <StepsPostCtaLink label="Démarrer" anchorId="commander-femiglow" />,
      'steps-post-cta',
      'pack_steps_cta_click',
      'steps_post_cta',
    ],
  ] as const)('%s : panneau ouvert, pas de scrollIntoView', (_name, ui, testId, event, source) => {
    setSheetMode();
    const target = addCommanderAnchor();
    render(ui());
    const link = screen.getByTestId(testId);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(link, click);
    expect(click.defaultPrevented).toBe(true);
    expect(sheet().isSheetOpen).toBe(true);
    expect(sheet().lastSource).toBe(source);
    expect(target.scrollIntoView).not.toHaveBeenCalled();
    expect(params(event)).toMatchObject({ kit_cta_mode: 'sheet' });
  });

  it.each([
    ['PostCtaLink', () => <PostCtaLink subProductId="1-paste" />, 'composition-post-cta-1-paste'],
    ['VideoPostCta', () => <VideoPostCta videoId="rituel" />, 'video-post-cta'],
    [
      'StepsPostCtaLink',
      () => <StepsPostCtaLink label="Démarrer" anchorId="commander-femiglow" />,
      'steps-post-cta',
    ],
  ] as const)('%s : en défilement, délègue à arriveAtCommander', (_name, ui, testId) => {
    addCommanderAnchor();
    render(ui());
    fireEvent.click(screen.getByTestId(testId));
    expect(arriveAtCommander).toHaveBeenCalledWith('commander-femiglow', {});
  });

  it('autre ancre : défilement natif inchangé, pas de kit_cta_mode', () => {
    setSheetMode();
    const other = document.createElement('div');
    other.id = 'autre';
    other.scrollIntoView = vi.fn();
    document.body.appendChild(other);
    render(<PostCtaLink subProductId="x" href="#autre" />);
    fireEvent.click(screen.getByTestId('composition-post-cta-x'));
    expect(other.scrollIntoView).toHaveBeenCalled();
    expect(sheet().isSheetOpen).toBe(false);
    expect(params('composition_post_cta_click')).not.toHaveProperty('kit_cta_mode');
  });
});

describe('StoryViewer — CTA', () => {
  const STRINGS: StoriesStrings = {
    sectionLabel: 'Stories',
    openAria: 'Ouvrir : %title%',
    countLabel: '{count} vidéos',
    scrollHint: 'Glisser',
    scrollMore: 'Voir plus',
    prevSegment: 'Précédent',
    nextSegment: 'Suivant',
    close: 'Fermer',
    mute: 'Muet',
    unmute: 'Son',
    pause: 'Pause',
    play: 'Lecture',
    segmentProgress: 'Segment %index%/%total%',
    defaultCta: 'Commander',
  };
  const STORIES: Story[] = [
    {
      id: 'sty_a',
      slug: 'story-a',
      title: 'Story A',
      bubblePoster: '/stories/a.jpg',
      segments: [
        {
          id: 'seg_a1',
          sources: [{ url: '/stories/a1.mp4', mime: 'video/mp4' }],
          poster: '/stories/a1.jpg',
          durationMs: 5000,
          cta: { label: 'Commander le pack', target: '#commander-femiglow' },
        },
      ],
    },
  ];

  it('panneau : ferme la story puis ouvre le panneau', () => {
    setSheetMode();
    const target = addCommanderAnchor();
    const onClose = vi.fn();
    render(
      <StoryViewer
        stories={STORIES}
        strings={STRINGS}
        initialIndex={0}
        onClose={onClose}
        onStorySeen={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('story-cta'));
    expect(onClose).toHaveBeenCalled();
    expect(sheet().isSheetOpen).toBe(true);
    expect(sheet().lastSource).toBe('story:sty_a');
    expect(target.scrollIntoView).not.toHaveBeenCalled();
    expect(params('story_cta_click')).toMatchObject({ story_id: 'sty_a', kit_cta_mode: 'sheet' });
  });

  it('défilement : arriveAtCommander', () => {
    addCommanderAnchor();
    render(
      <StoryViewer
        stories={STORIES}
        strings={STRINGS}
        initialIndex={0}
        onClose={vi.fn()}
        onStorySeen={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('story-cta'));
    expect(arriveAtCommander).toHaveBeenCalledWith('commander-femiglow', {});
  });
});

describe('GeoPromoSlideHeader — CTA', () => {
  const payload = {
    enabled: true,
    dateLabel: '18 mai 2026',
    dateShort: '18 mai',
    cityLabel: 'Casablanca',
    message: 'Offre du 18 mai - Casablanca',
    tags: [],
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

  beforeEach(() => {
    server.use(http.get('/api/promo/location', () => HttpResponse.json(payload)));
  });

  it('panneau : ouvre même avant l’hydratation du wizard (section seule)', async () => {
    setSheetMode();
    addCommanderAnchor(false);
    render(<GeoPromoSlideHeader />);
    const link = await screen.findByRole('link', { name: 'Commander' });
    fireEvent.click(link, { button: 0 });
    expect(sheet().isSheetOpen).toBe(true);
    expect(sheet().lastSource).toBe('geo_promo_header');
    expect(params('geo_promo_header_click')).toMatchObject({
      campaign_key: 'geo_promo_kit_default',
      kit_cta_mode: 'sheet',
    });
  });

  it('défilement : arriveAtCommander quand le wizard est là', async () => {
    addCommanderAnchor(true);
    render(<GeoPromoSlideHeader />);
    fireEvent.click(await screen.findByRole('link', { name: 'Commander' }), { button: 0 });
    expect(arriveAtCommander).toHaveBeenCalledWith('commander-femiglow', {});
    expect(params('geo_promo_header_click')).toMatchObject({ kit_cta_mode: 'scroll' });
  });

  it('défilement sans wizard hydraté : navigation native (pas d’interception)', async () => {
    addCommanderAnchor(false);
    render(<GeoPromoSlideHeader />);
    const link = await screen.findByRole('link', { name: 'Commander' });
    // Relevé après le handler React, puis annulation (jsdom ne navigue pas).
    let preventedByComponent: boolean | undefined;
    const probe = (e: Event) => {
      preventedByComponent = e.defaultPrevented;
      e.preventDefault();
    };
    document.addEventListener('click', probe);
    fireEvent.click(link, { button: 0 });
    document.removeEventListener('click', probe);
    expect(preventedByComponent).toBe(false);
    expect(arriveAtCommander).not.toHaveBeenCalled();
  });
});
