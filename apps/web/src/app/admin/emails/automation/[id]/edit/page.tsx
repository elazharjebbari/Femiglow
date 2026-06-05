/**
 * /admin/emails/automation/[id]/edit — Edit existing automation.
 */
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { db as getDb } from '@/lib/db/client';
import { emailAutomation } from '@/lib/db/schema-emails';
import { AUTOMATION_EVENT_CATALOG } from '@/lib/mail/automation/step-types-v2';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';
import { EditAutomationPageClient } from './EditAutomationPageClient';

export const dynamic = 'force-dynamic';

async function load(id: string) {
  const drizzle = getDb();
  if (!drizzle) return null;
  const [row] = await drizzle
    .select()
    .from(emailAutomation)
    .where(eq(emailAutomation.id, id))
    .limit(1);
  return row ?? null;
}

export default async function EditAutomationPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin(`/admin/emails/automation/${params.id}/edit`);
  const row = await load(params.id);
  if (!row) notFound();

  const initial = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    triggerType: row.triggerType as 'event' | 'schedule' | 'subscription' | 'webhook',
    triggerConfig: (row.triggerConfig ?? {}) as Record<string, unknown>,
    // Charge correctement les conditions persistées (typage RulesGroup|null) —
    // l'ancien `as null` écrasait toute condition existante au rechargement.
    triggerConditions: (row.triggerConditions ?? null) as RulesGroup | null,
    steps: (row.steps ?? []) as never,
    frequency: {
      cooldownSeconds: row.cooldownSeconds,
      quietHoursEnabled: row.quietHoursEnabled,
      quietHoursStart: row.quietHoursStart,
      quietHoursEnd: row.quietHoursEnd,
      quietHoursTz: row.quietHoursTz,
      dailyCap: row.dailyCap,
    },
    active: row.active,
  };

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6">
        <Link href="/admin/emails/automation" className="text-sm text-stone-500 underline">
          ← Automations
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-stone-800">{row.name}</h1>
        <p className="text-xs text-stone-500 font-mono">{row.slug}</p>
      </header>
      <EditAutomationPageClient
        initial={initial}
        eventsCatalog={AUTOMATION_EVENT_CATALOG as unknown as Array<{
          name: string;
          category: string;
          description: string;
        }>}
      />
    </AdminShell>
  );
}
