import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AppShell } from '@/components/admin/content-studio-v2/shell/AppShell';
import { CreateWorkspace } from '@/components/admin/content-studio-v2/create/CreateWorkspace';
import { isMediaStudioEnabled } from '@/lib/content-studio/auth';
import {
  getDraft,
  listDrafts,
  listPosts,
  listPrimaryAssetsForDrafts,
} from '@/lib/content-studio/repository';
import { findMediaById, thumbsByMediaId } from '@/lib/db/queries/media';
import type { StudioV2MediaItem } from '@/lib/content-studio-v2/media/types';
import type { Media } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

/**
 * Deep-link d'édition : /admin/content-studio-v2/create/[draftId].
 *
 * Cible des cartes Library et du « Ouvrir en édition complète » du Planning —
 * ces liens pointaient vers une route inexistante (404 systématique, audit
 * 2026-06-10 §02). Charge côté serveur le draft, ses variantes sœurs (même
 * brief), leurs posts et les médias liés, puis hydrate le CreateWorkspace.
 */
export default async function CreateDraftPage({
  params,
}: {
  params: { draftId: string };
}) {
  const session = await requireAdmin(`/admin/content-studio-v2/create/${params.draftId}`);
  const initials = session.email.split('@')[0]?.slice(0, 2) ?? 'EJ';

  const draft = await getDraft(params.draftId);
  if (!draft) notFound();

  // Variantes du même brief (le comparateur en a besoin) + posts associés.
  const allDrafts = await listDrafts({ limit: 500 });
  const siblings = allDrafts.filter((d) => d.briefId === draft.briefId);
  const siblingIds = new Set(siblings.map((d) => d.id));
  const posts = (await listPosts({ limit: 500 })).filter((p) => siblingIds.has(p.draftId));

  // Médias liés (binding primaire de chaque variante).
  const bindings = await listPrimaryAssetsForDrafts([...siblingIds]);
  const mediaIds = Array.from(new Set(bindings.map((b) => b.mediaId)));
  const mediaResults = await Promise.all(mediaIds.map((id) => findMediaById(id)));
  const thumbByMediaId = await thumbsByMediaId(mediaIds);
  const mediaItems: StudioV2MediaItem[] = mediaResults
    .filter((m): m is Media => m !== null && m.deletedAt === null)
    .map((m) => ({
      id: m.id,
      kind: m.kind === 'video' ? 'video' : 'image',
      // Le row Media ne porte pas l'origine IA/upload (tag client à la
      // génération) — on classe tout l'historique dans « importés ».
      compartment: 'imported',
      alt: m.alt,
      slug: m.slug,
      thumbnailUrl: thumbByMediaId.get(m.id) ?? null,
      previewUrl: m.originalUrl ?? thumbByMediaId.get(m.id) ?? '',
      originalUrl: m.originalUrl ?? '',
      durationSec:
        m.kind === 'video' && typeof m.originalDurationMs === 'number'
          ? m.originalDurationMs / 1000
          : null,
      width: m.originalWidth ?? null,
      height: m.originalHeight ?? null,
      createdAt: m.createdAt.toISOString(),
    }));

  // L'asset lié au draft ouvert devient la sélection initiale de l'aperçu.
  const boundMediaId = bindings.find((b) => b.draftId === draft.id)?.mediaId ?? null;

  return (
    <AppShell userEmail={session.email} userInitials={initials}>
      <CreateWorkspace
        initialDrafts={siblings}
        initialPosts={posts}
        initialMediaItems={mediaItems}
        initialDraftId={draft.id}
        initialSelectedMediaId={boundMediaId}
        mediaStudioEnabled={isMediaStudioEnabled()}
      />
    </AppShell>
  );
}
