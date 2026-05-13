import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getCurrentDriftState } from '@/lib/db/queries/tracking/gtm-poka-yoke';
import type { DriftReason } from '@/lib/tracking/gtm/sentinel-schemas';

/**
 * GET /api/admin/tracking/gtm/drift-banner
 * Endpoint lightweight pour le banner global. Cache mémoire 60s pour limiter
 * la charge DB sur les page admin avec banner SSR.
 *
 * cf. docs/gtm-poka-yoke/30-backend/01-api-spec.md
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 60_000;
type Cached = { at: number; payload: unknown };
const cache: { value: Cached | null } = { value: null };

export async function GET(): Promise<Response> {
  await requireAdmin('/admin/tracking/gtm');

  if (cache.value && Date.now() - cache.value.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.value.payload, { headers: { 'cache-control': 'no-store' } });
  }

  const state = await getCurrentDriftState();
  const payload = state
    ? {
        status: state.status,
        since: state.since.toISOString(),
        topReason: humanizeReason(state.reasons[0]),
        linkTo: '/admin/tracking/gtm/sync-status',
      }
    : { status: 'ok', since: new Date().toISOString(), topReason: null, linkTo: '/admin/tracking/gtm/sync-status' };

  cache.value = { at: Date.now(), payload };
  return NextResponse.json(payload, { headers: { 'cache-control': 'no-store' } });
}

function humanizeReason(reason: DriftReason | undefined): { code: string; humanMessage: string } | null {
  if (!reason) return null;
  switch (reason.code) {
    case 'mapping_version_drift':
      return {
        code: reason.code,
        humanMessage: `GTM exécute le mapping ${reason.got} alors que ${reason.expected} est actif côté admin.`,
      };
    case 'config_version_drift':
      return {
        code: reason.code,
        humanMessage: `GTM exécute la config ${reason.got} alors que ${reason.expected} est attendue.`,
      };
    case 'container_id_mismatch':
      return {
        code: reason.code,
        humanMessage: `Container ID en désaccord (${reason.got} ≠ ${reason.expected}). Workspace cible incorrect ?`,
      };
    case 'bundle_mismatch':
      return {
        code: reason.code,
        humanMessage: `BundleId GTM (${reason.got}) ≠ admin (${reason.expected}). Cache GTM ou import partiel.`,
      };
    case 'silence_excess':
      return {
        code: reason.code,
        humanMessage: `Aucun ping GTM reçu depuis ≥ ${reason.thresholdHours}h. Container publié ?`,
      };
    case 'manifest_flag_mismatch':
      return {
        code: reason.code,
        humanMessage: `Couche C : ${reason.details}. Un des 2 fichiers n'a probablement pas été importé.`,
      };
  }
}
