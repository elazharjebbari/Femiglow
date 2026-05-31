/**
 * CHA-131..135 — Page Système : visualisation live du pipeline + cartes
 * provider health + knowledge map. Utilise un client component pour le
 * SSE.
 */
import { sql } from 'drizzle-orm';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { SystemDashboard } from '@/components/admin/chat/SystemDashboard';
import { SystemDocs } from '@/components/admin/chat/SystemDocs';
import { adminQueries } from '@/lib/chat/admin/queries';
import { requireChatDb } from '@/lib/chat/db/client';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

const CRON_FLASH: Record<string, string> = {
  'cron-kb-sync': 'Re-synchronisation des sources lancée.',
  'cron-intent-recompute': 'Recalcul des centroïdes intent lancé.',
  'cron-budget-watch': 'Surveillance des budgets providers lancée.',
};

export default async function ChatSystemPage({
  searchParams,
}: {
  searchParams: { ok?: string };
}) {
  const session = await requireAdmin('/admin/chat/system');
  const enabled = isChatEnabled();
  const flash = searchParams.ok ? CRON_FLASH[searchParams.ok] : null;

  if (!enabled) {
    return (
      <AdminShell adminEmail={session.email} active="chat">
        <ChatAdminNav active="system" />
        <p className="text-sm text-stone-500">Chat désactivé.</p>
      </AdminShell>
    );
  }

  const providers = await adminQueries.listProviders().catch(() => []);
  const db = requireChatDb();
  const stats = await db
    .execute<{ total_sources: number; total_chunks: number; stale: number }>(sql`
      SELECT
        (SELECT COUNT(*)::int FROM chat_knowledge_source WHERE enabled = true) AS total_sources,
        (SELECT COALESCE(SUM(chunk_count), 0)::int FROM chat_knowledge_source WHERE enabled = true) AS total_chunks,
        (SELECT COUNT(*)::int FROM chat_knowledge_source WHERE enabled = true
            AND (last_ingested_at IS NULL OR last_ingested_at < NOW() - INTERVAL '30 days')) AS stale
    `)
    .catch(() => ({ rows: [{ total_sources: 0, total_chunks: 0, stale: 0 }] }));
  const row =
    (stats as { rows?: Array<{ total_sources: number; total_chunks: number; stale: number }> })
      .rows?.[0] ?? { total_sources: 0, total_chunks: 0, stale: 0 };

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="system" />
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Système — visualisation live</h1>
        <p className="text-sm text-stone-600">
          Pipeline en temps réel, providers, base de connaissance.
        </p>
      </header>

      {flash ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {flash}
        </div>
      ) : null}

      <section className="mb-6 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-stone-800">
          Trigger manuel des crons chat
        </h2>
        <p className="mb-3 text-xs text-stone-500">
          Utile après un import (sources, exemples intent) pour ne pas attendre
          le schedule Vercel. Idempotent : un second run sans nouveau contenu
          est un no-op.
        </p>
        <div className="flex flex-wrap gap-2">
          <form method="post" action="/api/admin/chat/cron">
            <input type="hidden" name="job" value="kb-sync" />
            <button
              type="submit"
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-100"
            >
              Re-sync sources volatiles
            </button>
          </form>
          <form method="post" action="/api/admin/chat/cron">
            <input type="hidden" name="job" value="intent-recompute" />
            <button
              type="submit"
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-100"
            >
              Recalcule centroïdes intent
            </button>
          </form>
          <form method="post" action="/api/admin/chat/cron">
            <input type="hidden" name="job" value="budget-watch" />
            <button
              type="submit"
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-100"
            >
              Surveille budgets providers
            </button>
          </form>
        </div>
      </section>

      <div className="space-y-8">
        <SystemDashboard
          providers={providers.map((p) => ({
            id: p.id,
            label: p.label,
            kind: p.kind,
            enabled: p.enabled,
            consumedEur: Number(p.consumedMonthEur),
            quotaEur: p.quotaMonthlyEur != null ? Number(p.quotaMonthlyEur) : null,
            state: p.enabled ? 'ok' : 'down',
          }))}
          knowledge={{
            totalSources: row.total_sources,
            totalChunks: row.total_chunks,
            staleSources: row.stale,
          }}
        />

        {/* CHA-230 — Documentation in-app : pipeline, configuration, runbook. */}
        <SystemDocs />
      </div>
    </AdminShell>
  );
}
