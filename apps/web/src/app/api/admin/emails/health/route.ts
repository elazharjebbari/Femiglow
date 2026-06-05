/**
 * GET /api/admin/emails/health
 *
 * Admin-only health probe for the emailing stack. Returns JSON with
 * structured checks + an overall level (ok/degraded/incident).
 *
 * Cf. lib/admin/emails/health.ts et 10-observability-debugging.md §5.2.
 *
 * — Chantier 1.2 — Le rapport de base (`checkEmailingHealth`) ne voit que
 *   l'intérieur de l'outbox et restait VERT alors que (a) le webhook Stalwart est
 *   mort (emails `sent` mais aucun event `delivered`) et que (b) les crons outbox
 *   n'ont pas de timer (lignes éligibles/sending figées). On compose ici, de
 *   façon ADDITIVE, 3 checks infra supplémentaires : le rapport conserve tous ses
 *   champs existants (l'UI les lit explicitement) et gagne `checks.webhookSilent`,
 *   `checks.cronOutboxLate`, `checks.sendingStuck`. Le `level` global devient le
 *   pire des deux rapports.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { checkEmailingHealth, type HealthLevel } from '@/lib/admin/emails/health';
import { db as getDb } from '@/lib/db/client';
import { checkEmailingInfraHealth, type InfraChecks } from './checks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function worst(a: HealthLevel, b: HealthLevel): HealthLevel {
  if (a === 'incident' || b === 'incident') return 'incident';
  if (a === 'degraded' || b === 'degraded') return 'degraded';
  return 'ok';
}

export async function GET() {
  await requireAdmin('/api/admin/emails/health');

  const base = await checkEmailingHealth();

  // Checks infra additionnels — seulement si la DB est joignable (sinon le
  // rapport de base a déjà marqué l'incident DB et on ne peut rien interroger).
  const drizzle = getDb();
  let infraChecks: InfraChecks | null = null;
  let level = base.level;

  if (drizzle && base.checks.db.ok) {
    try {
      const infra = await checkEmailingInfraHealth(drizzle);
      infraChecks = infra.checks;
      level = worst(level, infra.level);
    } catch {
      // Une erreur des requêtes infra ne doit pas faire planter le endpoint :
      // on dégrade prudemment et on laisse `infraChecks` à null (l'UI ignore).
      level = worst(level, 'degraded');
    }
  }

  const report = {
    ...base,
    level,
    checks: {
      ...base.checks,
      ...(infraChecks ?? {}),
    },
  };

  return NextResponse.json(report);
}
