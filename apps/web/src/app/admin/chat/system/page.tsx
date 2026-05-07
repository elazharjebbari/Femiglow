/**
 * CHA-131..135 — Page Système : visualisation live du pipeline + cartes
 * provider health + knowledge map. Utilise un client component pour le
 * SSE.
 */
import { sql } from 'drizzle-orm';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { SystemDashboard } from '@/components/admin/chat/SystemDashboard';
import { adminQueries } from '@/lib/chat/admin/queries';
import { requireChatDb } from '@/lib/chat/db/client';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function ChatSystemPage() {
  const session = await requireAdmin('/admin/chat/system');
  const enabled = isChatEnabled();

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
    </AdminShell>
  );
}
