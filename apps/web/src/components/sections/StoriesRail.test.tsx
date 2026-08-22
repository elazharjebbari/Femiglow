import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { StoriesRail } from './StoriesRail';
import type { StoriesStrings, Story } from '@/lib/stories/types';

const STRINGS: StoriesStrings = {
  sectionLabel: 'Stories',
  heading: 'Découvrez',
  openAria: 'Ouvrir : {title}',
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
  segmentProgress: 'Segment {index}/{total}',
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
// + stub media (les bulles montent une couverture <video> quand inView).
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, value: 1000 });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 300 });
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});

afterEach(cleanup);

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
});
