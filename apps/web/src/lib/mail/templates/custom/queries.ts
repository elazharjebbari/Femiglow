/**
 * CRUD queries pour email_template_custom + versioning (M5.7.4).
 */
import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import {
  emailTemplateCustom,
  emailTemplateCustomVersion,
  type EmailTemplateCustomRow,
  type EmailTemplateCustomVersionRow,
} from '@/lib/db/schema-emails';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export type CreateTemplateInput = {
  slug: string;
  name: string;
  description?: string;
  subjectTmpl: string;
  preheaderTmpl?: string;
  htmlSource: string;
  customVars?: Record<string, unknown>;
};

export type SaveVersionInput = {
  subjectTmpl: string;
  preheaderTmpl?: string;
  htmlSource: string;
  customVars?: Record<string, unknown>;
  commitMessage?: string;
};

export async function listTemplates(): Promise<EmailTemplateCustomRow[]> {
  const drizzle = requireDb();
  return drizzle
    .select()
    .from(emailTemplateCustom)
    .where(isNull(emailTemplateCustom.deletedAt))
    .orderBy(desc(emailTemplateCustom.createdAt));
}

export async function getTemplateBySlug(slug: string): Promise<EmailTemplateCustomRow | null> {
  const drizzle = requireDb();
  const rows = await drizzle
    .select()
    .from(emailTemplateCustom)
    .where(and(eq(emailTemplateCustom.slug, slug), isNull(emailTemplateCustom.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTemplateById(id: string): Promise<EmailTemplateCustomRow | null> {
  const drizzle = requireDb();
  const rows = await drizzle
    .select()
    .from(emailTemplateCustom)
    .where(and(eq(emailTemplateCustom.id, id), isNull(emailTemplateCustom.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createTemplate(
  input: CreateTemplateInput,
  createdBy: string,
): Promise<EmailTemplateCustomRow> {
  const drizzle = requireDb();
  const [row] = await drizzle
    .insert(emailTemplateCustom)
    .values({
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      subjectTmpl: input.subjectTmpl,
      preheaderTmpl: input.preheaderTmpl ?? null,
      htmlSource: input.htmlSource,
      customVars: input.customVars ?? {},
      createdBy,
    })
    .returning();
  if (!row) throw new Error('createTemplate: INSERT returned no row');

  // Initial version (v1)
  await drizzle.insert(emailTemplateCustomVersion).values({
    templateId: row.id,
    versionNumber: 1,
    subjectTmpl: input.subjectTmpl,
    preheaderTmpl: input.preheaderTmpl ?? null,
    htmlSource: input.htmlSource,
    customVars: input.customVars ?? {},
    commitMessage: 'Initial version',
    createdBy,
  });

  return row;
}

export async function saveTemplateVersion(
  templateId: string,
  input: SaveVersionInput,
  createdBy: string,
): Promise<EmailTemplateCustomVersionRow> {
  const drizzle = requireDb();

  // Find next version_number
  const lastRows = await drizzle
    .select({ n: emailTemplateCustomVersion.versionNumber })
    .from(emailTemplateCustomVersion)
    .where(eq(emailTemplateCustomVersion.templateId, templateId))
    .orderBy(desc(emailTemplateCustomVersion.versionNumber))
    .limit(1);
  const nextNumber = (lastRows[0]?.n ?? 0) + 1;

  // Insert version
  const [version] = await drizzle
    .insert(emailTemplateCustomVersion)
    .values({
      templateId,
      versionNumber: nextNumber,
      subjectTmpl: input.subjectTmpl,
      preheaderTmpl: input.preheaderTmpl ?? null,
      htmlSource: input.htmlSource,
      customVars: input.customVars ?? {},
      commitMessage: input.commitMessage ?? null,
      createdBy,
    })
    .returning();
  if (!version) throw new Error('saveTemplateVersion: INSERT failed');

  // Mirror onto template parent + set activeVersionId
  await drizzle
    .update(emailTemplateCustom)
    .set({
      subjectTmpl: input.subjectTmpl,
      preheaderTmpl: input.preheaderTmpl ?? null,
      htmlSource: input.htmlSource,
      customVars: input.customVars ?? {},
      activeVersionId: version.id,
      updatedAt: new Date(),
    })
    .where(eq(emailTemplateCustom.id, templateId));

  return version;
}

export async function listVersions(templateId: string): Promise<EmailTemplateCustomVersionRow[]> {
  const drizzle = requireDb();
  return drizzle
    .select()
    .from(emailTemplateCustomVersion)
    .where(eq(emailTemplateCustomVersion.templateId, templateId))
    .orderBy(desc(emailTemplateCustomVersion.versionNumber));
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const drizzle = requireDb();
  const [row] = await drizzle
    .update(emailTemplateCustom)
    .set({ deletedAt: new Date() })
    .where(and(eq(emailTemplateCustom.id, id), isNull(emailTemplateCustom.deletedAt)))
    .returning();
  return !!row;
}
