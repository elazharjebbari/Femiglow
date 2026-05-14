/**
 * GET /api/admin/emails/automation/events-catalog
 *
 * Returns the list of known events for `wait_for_event` step + branch
 * triggers (read from step-types-v2 AUTOMATION_EVENT_CATALOG).
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AUTOMATION_EVENT_CATALOG } from '@/lib/mail/automation/step-types-v2';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  await requireAdmin('/admin/emails/automation');
  return NextResponse.json({ events: AUTOMATION_EVENT_CATALOG });
}
