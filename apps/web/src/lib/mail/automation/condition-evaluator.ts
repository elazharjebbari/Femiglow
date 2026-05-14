/**
 * Condition evaluator pour branch steps (M5.5.3).
 *
 * Évalue un RulesGroup contre un email donné. Utilise le rules-compiler
 * M5.3 + un wrapper SELECT 1 FROM leads WHERE ... AND email = ? — si
 * la ligne existe, condition vraie.
 *
 * Performance : 1 query par évaluation. Pour 100 branches dans une
 * automation à 1000 runs/jour → 100k queries/jour. Acceptable
 * (queries simples, indexées sur email).
 */
import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { compileRulesToSql } from '@/lib/mail/audiences/rules-compiler';
import type { ExclusionFlags, RulesGroup } from '@/lib/mail/audiences/rules-types';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

const NEUTRAL_EXCLUSIONS: ExclusionFlags = {
  hard_bounce: false,
  unsubscribe: false,
  manual_suppression: false,
  marketing_optout: false,
};

/**
 * Évalue si le user identifié par `email` satisfait `condition`.
 * @returns true si match, false sinon (y compris si lead absent).
 */
export async function evaluateConditionAgainstUser(
  condition: RulesGroup,
  email: string,
): Promise<boolean> {
  const drizzle = requireDb();
  const normalized = email.trim().toLowerCase();

  // Compile sans exclusions (on évalue la rule pure, pas un filtre audience)
  const compiled = compileRulesToSql(condition, NEUTRAL_EXCLUSIONS);

  const rows = await drizzle
    .select({ one: sql<number>`1` })
    .from(leads)
    .where(and(eq(leads.email, normalized), compiled.where))
    .limit(1);

  return rows.length > 0;
}
