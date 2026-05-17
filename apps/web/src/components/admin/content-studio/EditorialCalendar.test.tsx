import { describe, it, expect } from 'vitest';
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
  it('affiche le message vide quand il n’y a pas de posts', () => {
    render(<EditorialCalendar posts={[]} drafts={[]} deliveries={[]} />);
    expect(screen.getByText(/Aucun post approuvé/i)).toBeInTheDocument();
  });

  it('affiche les posts avec leur statut et livraison', () => {
    render(<EditorialCalendar posts={[post]} drafts={[draft]} deliveries={[delivery]} />);
    expect(screen.getByText('Hook test')).toBeInTheDocument();
    expect(screen.getByText(/instagram/i)).toBeInTheDocument();
  });

  it('affiche les métriques Approuvés, Datés, Postiz', () => {
    render(<EditorialCalendar posts={[post]} drafts={[draft]} deliveries={[delivery]} />);
    expect(screen.getByText('Approuvés')).toBeInTheDocument();
    expect(screen.getByText('Datés')).toBeInTheDocument();
    expect(screen.getByText('Postiz')).toBeInTheDocument();
  });
});