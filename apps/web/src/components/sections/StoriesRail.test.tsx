import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { pickPreviewIndex, StoriesRail } from './StoriesRail';
import type { StoriesStrings, Story } from '@/lib/stories/types';

const STRINGS: StoriesStrings = {
  sectionLabel: 'Stories',
  heading: 'Découvrez',
  openAria: 'Ouvrir : %title%',
  countLabel: '{count} vidéos',
  scrollHint: 'Faites glisser',
  scrollMore: 'Voir plus de stories',
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

function makeStory(i: number): Story {
  return {
    id: `sty_${i}`,
    slug: `story-${i}`,
    title: `Story ${i}`,
    bubblePoster: `/stories/${i}.jpg`,
    segments: [
      { id: `seg_${i}`, sources: [{ url: `/stories/${i}.mp4`, mime: 'video/mp4' }], poster: `/stories/${i}.jpg`, durationMs: 5000 },
    ],
  };
}

const STORIES = [1, 2, 3].map(makeStory);

// jsdom ne calcule pas le layout (scrollWidth/clientWidth = 0). On simule un
// rail débordant → l'affordance de scroll (indice + fade + flèche) s'affiche.
// + stub media (la bulle élue monte un aperçu <video> après load + idle).
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, value: 1000 });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 300 });
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});

type IdleWindow = {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};
const idleWindow = window as unknown as IdleWindow;
const originalConnection = (navigator as unknown as { connection?: unknown }).connection;
const originalMatchMedia = window.matchMedia;
const originalIntersectionObserver = window.IntersectionObserver;

/** IO de test : toute bulle observée est immédiatement « visible ». */
class VisibleIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element): void {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
let idleCallbacks: Array<() => void> = [];

function setReadyState(state: DocumentReadyState): void {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => state });
}

function setConnection(value: unknown): void {
  Object.defineProperty(navigator, 'connection', { configurable: true, value });
}

/** Simule `window.load` puis le passage au repos du navigateur. */
function finishLoadAndIdle(): void {
  act(() => {
    window.dispatchEvent(new Event('load'));
  });
  act(() => {
    const pending = idleCallbacks;
    idleCallbacks = [];
    pending.forEach((cb) => cb());
  });
}

beforeEach(() => {
  // Page encore en chargement : l'aperçu doit attendre `load` + idle.
  setReadyState('loading');
  idleCallbacks = [];
  idleWindow.requestIdleCallback = vi.fn((cb: () => void) => {
    idleCallbacks.push(cb);
    return idleCallbacks.length;
  });
  idleWindow.cancelIdleCallback = vi.fn();
  setConnection({ effectiveType: '4g', saveData: false });
  window.IntersectionObserver =
    VisibleIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  cleanup();
  delete (document as unknown as { readyState?: unknown }).readyState;
  setConnection(originalConnection);
  window.matchMedia = originalMatchMedia;
  window.IntersectionObserver = originalIntersectionObserver;
});

describe('StoriesRail', () => {
  it('rend une bulle par story avec le bon aria-label', () => {
    render(<StoriesRail stories={STORIES} strings={STRINGS} seenIds={new Set()} onOpen={vi.fn()} />);
    expect(screen.getByTestId('story-bubble-story-1')).toBeTruthy();
    expect(screen.getByLabelText('Ouvrir : Story 2')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('se masque (rend null) si aucune story', () => {
    const { container } = render(
      <StoriesRail stories={[]} strings={STRINGS} seenIds={new Set()} onOpen={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('appelle onOpen avec l’index de la bulle cliquée', () => {
    const onOpen = vi.fn();
    render(<StoriesRail stories={STORIES} strings={STRINGS} seenIds={new Set()} onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId('story-bubble-story-3'));
    expect(onOpen).toHaveBeenCalledWith(2);
  });

  it('affiche l’indice de défilement (affordance) et le bouton flèche a un label dédié', () => {
    render(<StoriesRail stories={STORIES} strings={STRINGS} seenIds={new Set()} onOpen={vi.fn()} />);
    expect(screen.getByText('Faites glisser')).toBeTruthy();
    // le bouton flèche réutilise scrollMore (pas nextSegment).
    expect(screen.getByLabelText('Voir plus de stories')).toBeTruthy();
  });

  it('distingue visuellement une story vue (anneau gris) d’une non-vue (dégradé)', () => {
    render(
      <StoriesRail stories={STORIES} strings={STRINGS} seenIds={new Set(['sty_1'])} onOpen={vi.fn()} />,
    );
    const seenRing = screen.getByTestId('story-bubble-story-1').querySelector('span');
    const unseenRing = screen.getByTestId('story-bubble-story-2').querySelector('span');
    expect(seenRing?.className).toContain('bg-encre/20');
    expect(unseenRing?.className).toContain('bg-gradient-to-tr');
  });

  it('aucune <video> ni source vidéo au rendu initial (posters + pastille play)', () => {
    const { container } = render(
      <StoriesRail stories={STORIES} strings={STRINGS} seenIds={new Set()} onOpen={vi.fn()} />,
    );
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('source')).toBeNull();
    expect(container.innerHTML).not.toContain('.mp4');
    expect(screen.getByTestId('story-bubble-play-story-1')).toBeTruthy();
    expect(screen.getByTestId('story-bubble-play-story-3')).toBeTruthy();
  });

  it('aperçu uniquement après load + idle, sur UNE seule bulle (1re non vue)', () => {
    const { container } = render(
      <StoriesRail stories={STORIES} strings={STRINGS} seenIds={new Set(['sty_1'])} onOpen={vi.fn()} />,
    );
    act(() => {
      window.dispatchEvent(new Event('load'));
    });
    // `load` seul ne suffit pas : on attend le repos du navigateur.
    expect(container.querySelector('video')).toBeNull();
    finishLoadAndIdle();
    const videos = container.querySelectorAll('video');
    expect(videos).toHaveLength(1);
    expect(screen.getByTestId('story-bubble-preview-story-2')).toBeTruthy();
    const video = videos[0]!;
    expect(video.getAttribute('preload')).toBe('none');
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(video.querySelector('source')?.getAttribute('src')).toBe('/stories/2.mp4');
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
    // pastille play conservée tant que la vidéo n'a pas réellement démarré.
    expect(screen.getByTestId('story-bubble-play-story-2')).toBeTruthy();
    fireEvent.playing(video);
    expect(screen.queryByTestId('story-bubble-play-story-2')).toBeNull();
    expect(screen.getByTestId('story-bubble-play-story-3')).toBeTruthy();
  });

  it('saveData → jamais d’aperçu', () => {
    setConnection({ effectiveType: '4g', saveData: true });
    const { container } = render(
      <StoriesRail stories={STORIES} strings={STRINGS} seenIds={new Set()} onOpen={vi.fn()} />,
    );
    finishLoadAndIdle();
    expect(container.querySelector('video')).toBeNull();
  });

  it('réseau 3g → jamais d’aperçu', () => {
    setConnection({ effectiveType: '3g', saveData: false });
    const { container } = render(
      <StoriesRail stories={STORIES} strings={STRINGS} seenIds={new Set()} onOpen={vi.fn()} />,
    );
    finishLoadAndIdle();
    expect(container.querySelector('video')).toBeNull();
  });

  it('prefers-reduced-motion → jamais d’aperçu', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    const { container } = render(
      <StoriesRail stories={STORIES} strings={STRINGS} seenIds={new Set()} onOpen={vi.fn()} />,
    );
    finishLoadAndIdle();
    expect(container.querySelector('video')).toBeNull();
  });

  it('toutes les stories vues → aucun aperçu', () => {
    const { container } = render(
      <StoriesRail
        stories={STORIES}
        strings={STRINGS}
        seenIds={new Set(['sty_1', 'sty_2', 'sty_3'])}
        onOpen={vi.fn()}
      />,
    );
    finishLoadAndIdle();
    expect(container.querySelector('video')).toBeNull();
  });
});

describe('pickPreviewIndex', () => {
  it('retourne la 1re bulle visible, non vue, avec une vidéo', () => {
    expect(pickPreviewIndex(STORIES, new Set([1, 2]), new Set())).toBe(1);
    expect(pickPreviewIndex(STORIES, new Set([0, 1, 2]), new Set(['sty_1']))).toBe(1);
  });

  it('ignore les bulles hors écran et celles sans source', () => {
    const noVideo: Story = { ...makeStory(9), segments: [] };
    expect(pickPreviewIndex([noVideo, ...STORIES], new Set([0]), new Set())).toBe(-1);
    expect(pickPreviewIndex(STORIES, new Set(), new Set())).toBe(-1);
  });
});
