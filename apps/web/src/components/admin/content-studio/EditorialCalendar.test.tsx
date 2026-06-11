import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorialCalendar } from './EditorialCalendar';
import type { ContentDraft, ContentPost, ContentPostizDelivery } from '@/lib/content-studio/types';

const draft: ContentDraft = {
  id: 'draft_1',
  briefId: 'brief_1',
  platform: 'instagram',
  format: 'post',
  variantLabel: 'Sobre',
  caption: 'Test caption',
  hook: 'Hook test',
  cta: 'En savoir plus',
  altText: 'Alt text',
  hashtags: ['#test'],
  rejectionReason: null,
  parentDraftId: null,
  status: 'approved',
  scoreTotal: 96,
  editedBy: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const post: ContentPost = {
  id: 'post_1',
  draftId: 'draft_1',
  status: 'approved',
  scheduledAt: new Date('2026-02-01T10:00:00Z'),
  publishedAt: null,
  utm: {},
  approvedBy: null,
  cancelledBy: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const delivery: ContentPostizDelivery = {
  id: 'delivery_1',
  postId: 'post_1',
  integrationId: 'int_1',
  postizPostId: null,
  status: 'sent',
  request: {},
  response: {},
  attemptCount: 1,
  lastError: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('EditorialCalendar', () => {
  // Le calendrier ouvre par défaut la SEMAINE courante ; la fixture `post` est
  // planifiée le 2026-02-01. On fige « aujourd'hui » sur ce jour (Date seulement,
  // pour ne pas perturber React) → la semaine affichée contient le post, et le
  // test est déterministe quel que soit le jour d'exécution.
  // beforeEach (PAS beforeAll) : le filet global de vitest.setup
  // (ACT-BE-001) fait vi.useRealTimers() après CHAQUE test — un beforeAll
  // ne protégerait que le premier test du fichier.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-01T12:00:00Z'));
  });

  it('affiche le calendrier avec les contrôles de vue', () => {
    render(<EditorialCalendar posts={[]} drafts={[]} deliveries={[]} />);
    expect(screen.getByText('Semaine')).toBeInTheDocument();
    expect(screen.getByText('Mois')).toBeInTheDocument();
  });

  it('affiche les posts dans la grille calendrier', () => {
    render(<EditorialCalendar posts={[post]} drafts={[draft]} deliveries={[delivery]} />);
    expect(screen.getByText('Hook test')).toBeInTheDocument();
  });

  it('affiche les métriques Approuvés, Planifiés, Postiz', () => {
    render(<EditorialCalendar posts={[post]} drafts={[draft]} deliveries={[delivery]} />);
    expect(screen.getByText('Approuvés')).toBeInTheDocument();
    expect(screen.getByText('Planifiés')).toBeInTheDocument();
    expect(screen.getByText('Postiz')).toBeInTheDocument();
  });

  it('affiche les en-têtes de jours de la semaine', () => {
    render(<EditorialCalendar posts={[]} drafts={[]} deliveries={[]} />);
    expect(screen.getByText('Lun')).toBeInTheDocument();
    expect(screen.getByText('Dim')).toBeInTheDocument();
  });
});