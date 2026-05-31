/**
 * Seeders pour les 4 sections `app_config` : nav, flags, rbac, branding.
 * Stratégie : UPSERT du payload `defaults TS` → crée une nouvelle version.
 */
import { revalidateTag } from 'next/cache';
import { getDefault } from '@/lib/admin-config/defaults';
import { sectionSchemas } from '@/lib/admin-config/schemas';
import { APP_CONFIG_TAG, sectionTag } from '@/lib/admin-config/resolve';
import { getAppConfigRow, upsertAppConfig } from '@/lib/db/queries/app-config';
import type { Section } from '@/lib/admin-config/types';
import type { SeederContext, SeederResult } from '../types';

async function reseedSection(
  section: Section,
  ctx: SeederContext,
): Promise<SeederResult> {
  ctx.onProgress?.('Lecture defaults TS', 0.1);
  const payload = getDefault(section);

  // Validation paranoïaque — au cas où defaults TS aurait drifté du schéma.
  ctx.onProgress?.('Validation schéma', 0.3);
  const parsed = sectionSchemas[section].safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `Defaults ${section} invalides vs schéma : ${parsed.error.message}`,
    );
  }

  ctx.onProgress?.('Lecture version courante', 0.4);
  const current = await getAppConfigRow(section);
  const expectedVersion = current?.version ?? 0;

  ctx.onProgress?.('Upsert app_config', 0.7);
  const result = await upsertAppConfig(
    {
      section,
      payload: parsed.data,
      expectedVersion,
      actorId: ctx.actorId,
    },
    { note: `Re-seed via Seeders Runner` },
  );

  if (!result.ok) {
    throw new Error(
      `Version conflict (current=${result.currentVersion}) — réessaie.`,
    );
  }

  ctx.onProgress?.('Invalidation cache', 0.95);
  // revalidateTag requires Next.js static generation store — tolérer son absence
  // (e.g. CLI tsx sans Next runtime). Cf. docs/reset-feature/10-error-taxonomy.md.
  try {
    revalidateTag(APP_CONFIG_TAG);
    revalidateTag(sectionTag(section));
  } catch (err) {
    if (
      err instanceof Error &&
      /static generation store missing|Invariant/i.test(err.message)
    ) {
      // CLI context — ignore silently. UI/API context surfacera l'erreur.
    } else {
      throw err;
    }
  }

  return {
    stats: {
      version: result.row.version,
      previousVersion: expectedVersion,
    },
    summary: `${section} v${result.row.version} créée`,
  };
}

export const navigationSeeder = (ctx: SeederContext) => reseedSection('nav', ctx);
export const flagsSeeder = (ctx: SeederContext) => reseedSection('flags', ctx);
export const rbacSeeder = (ctx: SeederContext) => reseedSection('rbac', ctx);
export const brandingSeeder = (ctx: SeederContext) =>
  reseedSection('branding', ctx);
