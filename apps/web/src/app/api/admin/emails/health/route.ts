/**
 * GET /api/admin/emails/health
 *
 * Admin-only health probe for the emailing stack. Returns JSON with
 * structured checks + an overall level (ok/degraded/incident).
 *
 * Cf. lib/admin/emails/health.ts and 10-observability-debugging.md §5.2.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { checkEmailingHealth } from '@/lib/admin/emails/health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  await requireAdmin('/api/admin/emails/health');
  const report = await checkEmailingHealth();
  return NextResponse.json(report);
}
