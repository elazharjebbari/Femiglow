/**
 * CRUD queries pour email_template_custom + versioning (M5.7.4).
 */
import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import {
  emailAutomation,
  emailTemplateCustom,
  emailTemplateCustomVersion,
  type EmailTemplateCustomRow,
  type EmailTemplateCustomVersionRow,
} from '@/lib/db/schema-emails';
import { nextDuplicateSlug, duplicateName } from './duplicate-slug';

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

/**
 * TOUS les slugs de la table — y compris les soft-deleted. Le slug est unique
 * en base indépendamment de `deletedAt` ; la dédup à la duplication doit donc
 * tenir compte des slugs supprimés (sinon violation de contrainte à l'INSERT).
 */
export async function listAllSlugs(): Promise<string[]> {
  const drizzle = requireDb();
  const rows = await drizzle.select({ slug: emailTemplateCustom.slug }).from(emailTemplateCustom);
  return rows.map((r) => r.slug);
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

/**
 * Duplique un template (contenu courant) sous un slug dérivé libre + nom
 * « (copie) ». Réutilise `createTemplate` → seed aussi une v1 « Initial version »
 * (la copie repart d'un historique propre, indépendant de la source). Renvoie
 * `null` si la source est introuvable (404 côté route).
 */
export async function duplicateTemplate(
  sourceId: string,
  createdBy: string,
): Promise<EmailTemplateCustomRow | null> {
  const source = await getTemplateById(sourceId);
  if (!source) return null;
  const slug = nextDuplicateSlug(source.slug, await listAllSlugs());
  return createTemplate(
    {
      slug,
      name: duplicateName(source.name),
      description: source.description ?? undefined,
      subjectTmpl: source.subjectTmpl,
      preheaderTmpl: source.preheaderTmpl ?? undefined,
      htmlSource: source.htmlSource,
      customVars: (source.customVars as Record<string, unknown>) ?? {},
    },
    createdBy,
  );
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

/**
 * Recense les automations dont au moins une étape `send` référence le template
 * `slug` donné. Les `steps` sont du JSONB (array de steps, certaines `branch`
 * imbriquant d'autres steps). On scanne récursivement.
 *
 * Garde-fou anti-référence orpheline : supprimer un template encore câblé dans
 * une automation casserait l'étape `send` au RUNTIME (template introuvable →
 * envoi en échec silencieux). La route DELETE refuse alors la suppression.
 *
 * Renvoie la liste des automations bloquantes (slug + name + active).
 */
export type AutomationRef = { id: string; slug: string; name: string; active: boolean };

export async function findAutomationsUsingTemplate(slug: string): Promise<AutomationRef[]> {
  const drizzle = requireDb();
  const rows = await drizzle
    .select({
      id: emailAutomation.id,
      slug: emailAutomation.slug,
      name: emailAutomation.name,
      active: emailAutomation.active,
      steps: emailAutomation.steps,
    })
    .from(emailAutomation);

  const refs: AutomationRef[] = [];
  for (const row of rows) {
    if (stepsReferenceTemplate(row.steps, slug)) {
      refs.push({ id: row.id, slug: row.slug, name: row.name, active: row.active });
    }
  }
  return refs;
}

/** Vrai si un step `send` (éventuellement imbriqué dans une `branch`) cible `slug`. */
function stepsReferenceTemplate(steps: unknown, slug: string): boolean {
  if (!Array.isArray(steps)) return false;
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue;
    const s = step as Record<string, unknown>;
    if (s.kind === 'send' && s.template === slug) return true;
    // Branch : ifTrue / ifFalse sont des tableaux de steps.
    if (s.kind === 'branch') {
      if (stepsReferenceTemplate(s.ifTrue, slug)) return true;
      if (stepsReferenceTemplate(s.ifFalse, slug)) return true;
    }
  }
  return false;
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
