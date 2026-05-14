/**
 * GET /api/admin/emails/templates/autocomplete
 *
 * Liste fusionnée des templates :
 *  - templates système (TEMPLATE_REGISTRY in code)
 *  - templates HTML custom (email_template_custom, non supprimés)
 *
 * Retourne `{templates: [{slug, name, source}]}` triés par source puis nom.
 */
import { NextResponse } from 'next/server';
import { desc, isNull } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { db as getDb } from '@/lib/db/client';
import { emailTemplateCustom } from '@/lib/db/schema-emails';
import { TEMPLATE_REGISTRY } from '@/lib/mail/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  await requireAdmin('/api/admin/emails/templates/autocomplete');

  const systemTemplates = Object.values(TEMPLATE_REGISTRY).map((t) => ({
    slug: t.slug,
    name: (t as { subjectKey?: string }).subjectKey ?? t.slug,
    source: 'system' as const,
  }));

  const drizzle = getDb();
  let customTemplates: Array<{ slug: string; name: string; source: 'custom' }> = [];
  if (drizzle) {
    const rows = await drizzle
      .select({ slug: emailTemplateCustom.slug, name: emailTemplateCustom.name })
      .from(emailTemplateCustom)
      .where(isNull(emailTemplateCustom.deletedAt))
      .orderBy(desc(emailTemplateCustom.updatedAt))
      .limit(200);
    customTemplates = rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      source: 'custom' as const,
    }));
  }

  const templates = [...systemTemplates, ...customTemplates];
  return NextResponse.json({ templates });
}
