import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContentDraft, ContentPost } from '@/lib/content-studio/types';
import { SocialPublishingPanel } from './SocialPublishingPanel';

const post: ContentPost = {
  id: 'cp_1',
  draftId: 'cd_1',
  status: 'approved',
  scheduledAt: null,
  publishedAt: null,
  utm: {},
  approvedBy: 'adm_1',
  cancelledBy: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date('2026-05-19T10:00:00Z'),
  updatedAt: new Date('2026-05-19T10:00:00Z'),
};

const draft: ContentDraft = {
  id: 'cd_1',
  briefId: 'cb_1',
  platform: 'instagram',
  format: 'post',
  variantLabel: 'A',
  caption: 'Routine FemiGlow du soir',
  hook: null,
  cta: null,
  altText: 'Routine skincare',
  hashtags: ['routine'],
  rejectionReason: null,
  parentDraftId: null,
  status: 'approved',
  scoreTotal: 92,
  editedBy: 'adm_1',
  createdAt: new Date('2026-05-19T10:00:00Z'),
  updatedAt: new Date('2026-05-19T10:00:00Z'),
};

const account = {
  id: 'sa_ig',
  provider: 'dry_run',
  platform: 'instagram',
  remoteId: 'dry_run_instagram',
  name: 'Instagram dry-run',
  status: 'active',
  capabilities: [],
};

const publishability = {
  postId: post.id,
  account,
  publishable: true,
  content: {
    sourcePostId: post.id,
    platform: 'instagram',
    format: 'post',
    caption: draft.caption,
    media: [{ id: 'me_1', url: 'https://cdn.test/image.webp', mimeType: 'image/webp', width: 1024, height: 1024, alt: 'Routine' }],
    tags: ['routine'],
    metadata: { dryRun: true },
  },
  warnings: [] as string[],
  errors: [] as string[],
};

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function installFetch(overrides: Partial<{ publishable: typeof publishability }> = {}) {
  const currentPublishability = overrides.publishable ?? publishability;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/admin/social/accounts/sync')) {
      return jsonResponse({ accounts: [account] });
    }
    if (url.includes('/api/admin/content-studio/publish-jobs/cancel_me/cancel')) {
      return jsonResponse({ job: { id: 'cancel_me', status: 'cancelled' } });
    }
    if (url.includes('/api/admin/content-studio/publish-jobs?')) {
      return jsonResponse({ jobs: [] });
    }
    if (url.includes('/publishability')) {
      return jsonResponse({ publishability: currentPublishability });
    }
    if (url.includes('/publish-now')) {
      return jsonResponse({ job: { id: 'spj_1', status: 'published', publishedAt: '2026-05-19T11:00:00.000Z' }, result: { ok: true, status: 'published' } }, 201);
    }
    if (url.includes('/schedule')) {
      const body = JSON.parse(String(init?.body ?? '{}')) as { scheduledAt?: string };
      return jsonResponse({ job: { id: 'spj_2', status: 'queued', scheduledAt: body.scheduledAt ?? '2026-05-19T12:00:00.000Z' } }, 201);
    }
    return jsonResponse({});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPanel(props: Partial<React.ComponentProps<typeof SocialPublishingPanel>> = {}) {
  return render(
    <SocialPublishingPanel
      post={post}
      draft={draft}
      disabled={false}
      onPostStatusChange={vi.fn()}
      setMessage={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('confirm', vi.fn(() => true));
});

describe('SocialPublishingPanel', () => {
  it('charge les comptes dry-run et affiche publishability', async () => {
    installFetch();
    renderPanel();

    expect(await screen.findByText(/Instagram dry-run/i)).toBeInTheDocument();
    expect(await screen.findByText(/publiable/i)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/cdn.test\/image.webp/i)).toBeInTheDocument();
  });

  it('publie maintenant après confirmation et remonte le statut publié', async () => {
    installFetch();
    const onPostStatusChange = vi.fn();
    const setMessage = vi.fn();
    renderPanel({ onPostStatusChange, setMessage });

    const button = await screen.findByRole('button', { name: /Publier maintenant/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(onPostStatusChange).toHaveBeenCalledWith('cp_1', {
        status: 'published',
        publishedAt: '2026-05-19T11:00:00.000Z',
      });
    });
    expect(setMessage).toHaveBeenCalledWith('Publication dry-run effectuée.');
  });

  it('programme un job futur et remonte le statut scheduled', async () => {
    installFetch();
    const onPostStatusChange = vi.fn();
    renderPanel({ onPostStatusChange });

    const button = await screen.findByRole('button', { name: /Programmer/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(onPostStatusChange).toHaveBeenCalledWith('cp_1', expect.objectContaining({ status: 'scheduled' }));
    });
  });

  it('désactive la publication quand publishability est bloquée', async () => {
    installFetch({
      publishable: {
        ...publishability,
        publishable: false,
        errors: ['Un média HTTPS public est requis pour cette plateforme.'],
      },
    });
    renderPanel();

    expect(await screen.findByText(/Un média HTTPS public/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publier maintenant/i })).toBeDisabled();
  });
});
