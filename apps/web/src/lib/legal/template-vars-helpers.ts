/**
 * LEGAL-V2 — Helpers pour la gestion des template vars.
 *
 * Cf. docs/pages-legales-fix-2026-05/02-backend/helpers.md
 */
import { eq, sql } from 'drizzle-orm';

import { db, schema } from '@/lib/db/client';
import { logger } from '@/lib/logging/logger';

import { listAllTemplateVars, listLegalPages } from './repository';
import { detectVarsInTemplate, isPresetVar } from './vars';

/**
 * Retourne les vars utilisées dans les body_md mais non définies en DB
 * et non-preset. Utile pour suggérer à l'admin de créer ces vars.
 */
export async function getUnusedTemplateVars(): Promise<string[]> {
  const pages = await listLegalPages({});
  const dbVars = await listAllTemplateVars();
  const dbKeys = new Set(dbVars.map((v) => v.key));

  const usedSet = new Set<string>();
  for (const page of pages) {
    for (const key of detectVarsInTemplate(page.bodyMd)) {
      if (!isPresetVar(key) && !dbKeys.has(key)) {
        usedSet.add(key);
      }
    }
  }
  return Array.from(usedSet).sort();
}

/**
 * Retourne les vars définies en DB mais jamais utilisées dans aucun body_md.
 * Candidates pour archivage / suppression.
 */
export async function getOrphanTemplateVars(): Promise<string[]> {
  const pages = await listLegalPages({});
  const dbVars = await listAllTemplateVars();

  const usedSet = new Set<string>();
  for (const page of pages) {
    for (const key of detectVarsInTemplate(page.bodyMd)) {
      usedSet.add(key);
    }
  }
  return dbVars
    .filter((v) => !usedSet.has(v.key))
    .map((v) => v.key)
    .sort();
}

/**
 * Input pour créer une nouvelle template var.
 */
export interface CreateTemplateVarInput {
  key: string;
  label: string;
  description?: string;
  value?: string;
  isRequired?: boolean;
  sensitive?: boolean;
}

export type CreateTemplateVarOutcome =
  | { ok: true; row: typeof schema.legalTemplateVars.$inferSelect }
  | { ok: false; code: 'invalid_key' | 'conflict_key_exists' };

/**
 * Crée une nouvelle variable template (admin).
 */
export async function createTemplateVar(
  input: CreateTemplateVarInput,
  actorId: string | null,
): Promise<CreateTemplateVarOutcome> {
  if (!/^[A-Z][A-Z0-9_]*$/.test(input.key) || input.key.length < 2 || input.key.length > 40) {
    return { ok: false, code: 'invalid_key' };
  }
  const conn = db();
  if (!conn) throw new Error('createTemplateVar requires DATABASE_URL');

  const existing = await conn
    .select()
    .from(schema.legalTemplateVars)
    .where(eq(schema.legalTemplateVars.key, input.key))
    .limit(1);
  if (existing[0]) {
    return { ok: false, code: 'conflict_key_exists' };
  }

  const rows = await conn
    .insert(schema.legalTemplateVars)
    .values({
      key: input.key,
      label: input.label,
      description: input.description ?? null,
      value: input.value ?? '',
      isRequired: input.isRequired ?? false,
      sensitive: input.sensitive ?? false,
      updatedBy: actorId,
    })
    .returning();

  const row = rows[0]!;
  logger.info('legal.vars.create', {
    key: input.key,
    isRequired: row.isRequired,
    sensitive: row.sensitive,
    by: actorId,
  });
  return { ok: true, row };
}
