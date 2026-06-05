/**
 * Preview engine — count + sample sans matérialiser (M5.3.4).
 *
 * Deux fonctions exposées :
 *   previewAudienceSize(rules, exclusions) → { size, durationMs }
 *   previewAudienceSample(rules, exclusions, limit) → { samples, size }
 *
 * Performance cible : <3s sur DB prod-like. Au-delà, le builder UI
 * propose à l'admin de simplifier les critères ou bascule en mode async
 * (snapshot job).
 */
import 'server-only';
import { sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { compileRulesToSql } from './rules-compiler';
import type { ExclusionFlags, RulesGroup } from './rules-types';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

const PREVIEW_TIMEOUT_MS = 5000;
const MAX_SAMPLE = 50;

export type PreviewSizeResult = {
  size: number;
  durationMs: number;
};

export type PreviewBreakdownResult = {
  /** Contacts ciblés par les rules SEULES (sans appliquer la suppression list). */
  matched: number;
  /** Contacts retirés par les exclusions = matched − deliverable. */
  excluded: number;
  /** Contacts réellement envoyables (rules + exclusions). */
  deliverable: number;
  durationMs: number;
};

const NO_EXCLUSIONS: ExclusionFlags = {
  hard_bounce: false,
  unsubscribe: false,
  manual_suppression: false,
  marketing_optout: false,
};

export type SampleRow = {
  email: string;
  name: string | null;
  createdAt: Date;
};

export type PreviewSampleResult = {
  samples: SampleRow[];
  /** Taille totale potentielle (peut différer de samples.length si limit). */
  size: number;
};

/**
 * Compte le nombre d'emails matchant les rules. Timeout = 5s.
 */
export async function previewAudienceSize(
  rules: RulesGroup,
  exclusions: ExclusionFlags,
): Promise<PreviewSizeResult> {
  const drizzle = requireDb();
  const start = Date.now();
  const compiled = compileRulesToSql(rules, exclusions);

  // SET LOCAL statement_timeout dans une transaction pour le bornage.
  const rows = (await drizzle.transaction(async (tx) => {
    // Postgres `SET LOCAL` n'accepte PAS de parameter binding (`$1`) — il
    // faut une valeur littérale. PREVIEW_TIMEOUT_MS est une constante int,
    // donc safe à interpoler via sql.raw.
    await tx.execute(sql.raw(`SET LOCAL statement_timeout = ${PREVIEW_TIMEOUT_MS}`));
    return tx
      .select({ n: sql<number>`count(*)::int` })
      .from(leads)
      .where(compiled.where);
  })) as Array<{ n: number }>;

  const size = rows[0]?.n ?? 0;
  return { size, durationMs: Date.now() - start };
}

/**
 * UX-AUD-011 — santé du ciblage : sépare la cible brute (rules seules) de la
 * cible envoyable (rules + exclusions). Deux comptages dans une transaction
 * bornée (statement_timeout). `excluded = matched − deliverable`.
 *
 * Permet à l'UI d'afficher « N ciblés − M exclus = K envoyables » et de
 * comprendre l'écart créé par la suppression list (hard_bounce/unsubscribe/…).
 */
export async function previewAudienceBreakdown(
  rules: RulesGroup,
  exclusions: ExclusionFlags,
): Promise<PreviewBreakdownResult> {
  const drizzle = requireDb();
  const start = Date.now();

  const matchedCompiled = compileRulesToSql(rules, NO_EXCLUSIONS);
  const deliverableCompiled = compileRulesToSql(rules, exclusions);

  const [matchedRows, deliverableRows] = (await drizzle.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL statement_timeout = ${PREVIEW_TIMEOUT_MS}`));
    return Promise.all([
      tx.select({ n: sql<number>`count(*)::int` }).from(leads).where(matchedCompiled.where),
      tx.select({ n: sql<number>`count(*)::int` }).from(leads).where(deliverableCompiled.where),
    ]);
  })) as [Array<{ n: number }>, Array<{ n: number }>];

  const matched = matchedRows[0]?.n ?? 0;
  const deliverable = deliverableRows[0]?.n ?? 0;
  return {
    matched,
    deliverable,
    excluded: Math.max(0, matched - deliverable),
    durationMs: Date.now() - start,
  };
}

/**
 * Échantillon d'emails matchant + count total. Limit 1-50.
 */
export async function previewAudienceSample(
  rules: RulesGroup,
  exclusions: ExclusionFlags,
  limit: number = 10,
): Promise<PreviewSampleResult> {
  const cappedLimit = Math.min(Math.max(1, limit), MAX_SAMPLE);
  const drizzle = requireDb();
  const compiled = compileRulesToSql(rules, exclusions);

  const [samples, sizeResult] = await Promise.all([
    drizzle
      .select({
        email: leads.email,
        name: leads.name,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(compiled.where)
      .limit(cappedLimit),
    drizzle
      .select({ n: sql<number>`count(*)::int` })
      .from(leads)
      .where(compiled.where),
  ]);

  return {
    samples: samples as SampleRow[],
    size: (sizeResult as Array<{ n: number }>)[0]?.n ?? 0,
  };
}
