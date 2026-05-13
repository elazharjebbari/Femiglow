import { and, eq, sql } from 'drizzle-orm';

import { db, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';

import { logLegalEvent } from '@/lib/legal/audit';
import { getLegalPageBySlug, listAllTemplateVars } from '@/lib/legal/repository';
import { LEGAL_PAGE_HISTORY_ID_PREFIX } from '@/lib/legal/types';
import { detectMissingVars } from '@/lib/legal/vars';

export type PublishOutcome =
  | { ok: true; version: number; publishedAt: Date }
  | { ok: false; code: 'not_found' }
  | { ok: false; code: 'missing_required_vars'; missing: string[] }
  | { ok: false; code: 'confirm_mismatch' };

export async function publishLegalPage(
  slug: string,
  confirmText: string,
  actorId: string | null,
): Promise<PublishOutcome> {
  if (confirmText !== 'PUBLIER') {
    return { ok: false, code: 'confirm_mismatch' };
  }

  const conn = db();
  if (!conn) throw new Error('publishLegalPage requires DATABASE_URL');

  const page = await getLegalPageBySlug(slug);
  if (!page) return { ok: false, code: 'not_found' };

  const dbVars = await listAllTemplateVars();
  const missing = detectMissingVars(page.bodyMd, dbVars);
  if (missing.length > 0) {
    return { ok: false, code: 'missing_required_vars', missing };
  }

  const nextVersion = page.version + 1;
  const historyId = createId(LEGAL_PAGE_HISTORY_ID_PREFIX);

  // Drizzle transaction support (postgres-js + neon-http both implement .transaction).
  await conn.transaction(async (tx) => {
    await tx.insert(schema.legalPagesHistory).values({
      id: historyId,
      pageId: page.id,
      slug: page.slug,
      version: nextVersion,
      title: page.title,
      description: page.description ?? null,
      bodyMd: page.bodyMd,
      metadataJson: {
        canonicalUrl: page.canonicalUrl,
        includeInSearch: page.includeInSearch,
        locale: page.locale,
      },
      statusAtSnapshot: 'published',
      publishedAt: new Date(),
      publishedBy: actorId,
    });

    await tx
      .update(schema.legalPages)
      .set({
        status: 'published',
        version: nextVersion,
        publishedAt: sql`now()`,
        publishedBy: actorId,
        updatedAt: sql`now()`,
        updatedBy: actorId,
      })
      .where(eq(schema.legalPages.id, page.id));
  });

  const publishedAt = new Date();

  await logLegalEvent('legal.page.published', actorId, page.id, {
    slug: page.slug,
    version: nextVersion,
    history_id: historyId,
  });

  return { ok: true, version: nextVersion, publishedAt };
}

export async function restoreLegalPageVersion(
  slug: string,
  version: number,
  actorId: string | null,
): Promise<{ ok: boolean; code?: 'not_found' | 'version_not_found' }> {
  const conn = db();
  if (!conn) throw new Error('restoreLegalPageVersion requires DATABASE_URL');

  const page = await getLegalPageBySlug(slug);
  if (!page) return { ok: false, code: 'not_found' };

  const rows = await conn
    .select()
    .from(schema.legalPagesHistory)
    .where(
      and(
        eq(schema.legalPagesHistory.pageId, page.id),
        eq(schema.legalPagesHistory.version, version),
      ),
    )
    .limit(1);
  const snapshot = rows[0];
  if (!snapshot) return { ok: false, code: 'version_not_found' };

  await conn
    .update(schema.legalPages)
    .set({
      title: snapshot.title,
      description: snapshot.description ?? null,
      bodyMd: snapshot.bodyMd,
      status: 'draft',
      updatedAt: sql`now()`,
      updatedBy: actorId,
    })
    .where(eq(schema.legalPages.id, page.id));

  await logLegalEvent('legal.page.restored', actorId, page.id, {
    slug: page.slug,
    from_version: version,
  });

  return { ok: true };
}
