import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { StoriesStrings, Story } from '@/lib/stories/types';

const emitMock = vi.fn();
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({
    emit: emitMock,
    consent: { ad_storage: 'denied', analytics_storage: 'denied' },
  }),
}));
vi.mock('@/lib/media/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));

import { StoryViewer } from './StoryViewer';

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

const CTA = { label: 'Commander le pack', target: '#commander-femiglow' };
const src = (u: string) => [{ url: u, mime: 'video/mp4' as const }];

// Story A : 2 segments (avec CTA). Story B : 1 segment SANS cta (teste le repli).
const STORIES: Story[] = [
  {
    id: 'sty_a',
    slug: 'story-a',
    title: 'Story A',
    bubblePoster: '/stories/a.jpg',
    segments: [
      { id: 'seg_a1', sources: src('/stories/a1.mp4'), poster: '/stories/a1.jpg', durationMs: 5000, cta: CTA },
      { id: 'seg_a2', sources: src('/stories/a2.mp4'), poster: '/stories/a2.jpg', durationMs: 5000, cta: CTA },
    ],
  },
  {
    id: 'sty_b',
    slug: 'story-b',
    title: 'Story B',
    bubblePoster: '/stories/b.jpg',
    segments: [
      { id: 'seg_b1', sources: src('/stories/b1.mp4'), poster: '/stories/b1.jpg', durationMs: 5000 },
    ],
  },
];

const names = () => emitMock.mock.calls.map((c) => c[0] as string);
const call = (name: string) => emitMock.mock.calls.find((c) => c[0] === name);

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});
beforeEach(() => emitMock.mockClear());
afterEach(cleanup);

describe('StoryViewer', () => {
  it('monte le dialog et émet story_open + story_view avec story_id', () => {
    render(<StoryViewer stories={STORIES} strings={STRINGS} initialIndex={0} onClose={vi.fn()} onStorySeen={vi.fn()} />);
    expect(screen.getByTestId('story-viewer')).toBeTruthy();
    expect(names()).toContain('story_open');
    expect(names()).toContain('story_view');
    expect(call('story_open')?.[1]).toMatchObject({ story_id: 'sty_a' });
  });

  it('marque la story vue à l’ouverture', () => {
    const onStorySeen = vi.fn();
    render(<StoryViewer stories={STORIES} strings={STRINGS} initialIndex={0} onClose={vi.fn()} onStorySeen={onStorySeen} />);
    expect(onStorySeen).toHaveBeenCalledWith('sty_a');
  });

  it('avance de segment (story_next) puis émet story_complete UNE fois en fin de story', () => {
    render(<StoryViewer stories={STORIES} strings={STRINGS} initialIndex={0} onClose={vi.fn()} onStorySeen={vi.fn()} />);
    // 2 contrôles « Suivant » (zone tap invisible + flèche visible) → on prend le 1er.
    fireEvent.click(screen.getAllByLabelText('Suivant')[0]!); // seg_a1 → seg_a2
    expect(names()).toContain('story_next');
    fireEvent.click(screen.getAllByLabelText('Suivant')[0]!); // seg_a2 (dernier) → story_complete + story B
    const completes = names().filter((n) => n === 'story_complete');
    expect(completes).toHaveLength(1);
    expect(call('story_complete')?.[1]).toMatchObject({ story_id: 'sty_a' });
  });

  it('ferme via le bouton et émet story_close', () => {
    const onClose = vi.fn();
    render(<StoryViewer stories={STORIES} strings={STRINGS} initialIndex={0} onClose={onClose} onStorySeen={vi.fn()} />);
    fireEvent.click(screen.getByTestId('story-close'));
    expect(onClose).toHaveBeenCalled();
    expect(names()).toContain('story_close');
  });

  it('CTA de repli (segment sans cta) reste actif : émet story_cta_click + ferme', () => {
    const onClose = vi.fn();
    render(<StoryViewer stories={STORIES} strings={STRINGS} initialIndex={1} onClose={onClose} onStorySeen={vi.fn()} />);
    const cta = screen.getByTestId('story-cta');
    expect(cta.textContent).toBe('Commander'); // défaut
    fireEvent.click(cta);
    expect(names()).toContain('story_cta_click');
    expect(call('story_cta_click')?.[1]).toMatchObject({
      story_id: 'sty_b',
      cta_target: '#commander-femiglow',
    });
    expect(onClose).toHaveBeenCalled();
  });
});
