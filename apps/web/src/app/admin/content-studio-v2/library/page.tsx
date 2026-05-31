import { requireAdmin } from '@/lib/auth/require-admin';
import { AppShell } from '@/components/admin/content-studio-v2/shell/AppShell';
import { LibraryClient } from '@/components/admin/content-studio-v2/library/LibraryClient';
import {
  listDrafts,
  listPosts,
  listPrimaryAssetsForDrafts,
  getBrief,
  getIdea,
} from '@/lib/content-studio/repository';
import { findMediaById, thumbsByMediaId } from '@/lib/db/queries/media';
import { buildLibraryItems } from '@/lib/content-studio-v2/library/aggregator';
import type {
  ContentBrief,
  ContentIdea,
} from '@/lib/content-studio/types';
import type { Media } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

/**
 * Phase 4 — Library. Charge tous les drafts + posts, leurs bindings média,
 * les briefs/ideas (pour le pillar), puis aggrège en `LibraryItem[]`
 * sérialisable et passe le tout au client component.
 */
export default async function LibraryPage() {
  const session = await requireAdmin('/admin/content-studio-v2/library');
  const initials = session.email.split('@')[0]?.slice(0, 2) ?? 'EJ';

  // 1) Drafts + posts (limit large : 500 = OK admin, perf reste correcte).
  const [drafts, posts] = await Promise.all([
    listDrafts({ limit: 500 }),
    listPosts({ limit: 500 }),
  ]);

  // 2) Bindings primaires de tous ces drafts.
  const draftIds = drafts.map((d) => d.id);
  const bindings = await listPrimaryAssetsForDrafts(draftIds);

  // 3) Media objects + thumb URLs pour les bindings.
  const mediaIds = Array.from(new Set(bindings.map((b) => b.mediaId)));
  const mediaResults = await Promise.all(mediaIds.map((id) => findMediaById(id)));
  const mediaById = new Map<string, Media>();
  for (const m of mediaResults) {
    if (m) mediaById.set(m.id, m);
  }
  const thumbUrlByMediaId = await thumbsByMediaId(mediaIds);

  // 4) Briefs + ideas pour récupérer le pillar (lookup unique par draft).
  const briefIds = Array.from(new Set(drafts.map((d) => d.briefId)));
  const briefResults = await Promise.all(briefIds.map((id) => getBrief(id)));
  const briefs: ContentBrief[] = briefResults.filter((b): b is ContentBrief => b !== null);
  const ideaIds = Array.from(new Set(briefs.map((b) => b.ideaId)));
  const ideaResults = await Promise.all(ideaIds.map((id) => getIdea(id)));
  const ideas: ContentIdea[] = ideaResults.filter((i): i is ContentIdea => i !== null);

  // 5) Build the flat list — sérialisable (les Dates deviennent des ISO
  //    strings dans `buildLibraryItems`).
  const items = buildLibraryItems({
    drafts,
    posts,
    briefs,
    ideas,
    bindings,
    mediaById,
    thumbUrlByMediaId,
  });

  return (
    <AppShell userEmail={session.email} userInitials={initials}>
      <LibraryClient initialItems={items} />
    </AppShell>
  );
}
