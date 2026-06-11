/**
 * /admin/emails/audiences/[id] — Détail d'une audience (M5.3.9 + vague 4 UX).
 *
 * - Critères rendus en français lisible (UX-AUD-014, plus de JSON brut).
 * - Count live de l'audience (preview-size côté serveur, UX-AUD-005).
 * - Exclusions lisibles ; édition via la page [id]/edit.
 * - Snapshots : drill-down membres, retry errored, auto-refresh running
 *   (UX-AUD-006/007/012, dans SnapshotsPanel).
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  getAudienceById,
  listSnapshotsForAudience,
} from '@/lib/mail/audiences/queries';
import { previewAudienceSize } from '@/lib/mail/audiences/preview';
import {
  ExclusionFlagsSchema,
  RulesGroupSchema,
  type ExclusionFlags,
  type RulesGroup,
} from '@/lib/mail/audiences/rules-types';
import { rulesGroupToLines } from '@/components/admin/emails/audiences/rule-defaults';
import { AudienceDetailActions } from '@/components/admin/emails/audiences/AudienceDetailActions';
import {
  SnapshotsPanel,
  type SnapshotRow,
} from '@/components/admin/emails/audiences/SnapshotsPanel';

export const dynamic = 'force-dynamic';

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const EXCLUSION_LABELS: Record<string, string> = {
  hard_bounce: 'Rebonds durs (hard bounce)',
  unsubscribe: 'Désinscrits',
  manual_suppression: 'Suppressions manuelles (admin)',
  marketing_optout: 'Refus de consentement marketing',
};

export default async function AudienceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin(`/admin/emails/audiences/${params.id}`);
  const audience = await getAudienceById(params.id);
  if (!audience) notFound();

  const snapshots = await listSnapshotsForAudience(params.id, 20);

  // Shapes sûres (jsonb → typé). Fallback non bloquant si drift historique.
  const parsedRules = RulesGroupSchema.safeParse(audience.rules);
  const rules: RulesGroup = parsedRules.success
    ? parsedRules.data
    : { kind: 'all', conditions: [] };
  const parsedExclusions = ExclusionFlagsSchema.safeParse(audience.exclusionFlags);
  const exclusionFlags: ExclusionFlags = parsedExclusions.success
    ? parsedExclusions.data
    : { hard_bounce: true, unsubscribe: true, manual_suppression: true, marketing_optout: false };

  // UX-AUD-005 — count live (best-effort, ne bloque jamais la page).
  let liveCount: number | null = null;
  if (rules.conditions.length > 0) {
    try {
      const { size } = await previewAudienceSize(rules, exclusionFlags);
      liveCount = size;
    } catch {
      liveCount = null;
    }
  }

  const ruleLines = rulesGroupToLines(rules);

  const snapshotRows: SnapshotRow[] = snapshots.map((s) => ({
    id: s.id,
    status: s.status,
    size: s.size,
    createdAt: s.createdAt ? s.createdAt.toISOString() : null,
    purgeableAfter: s.purgeableAfter ? s.purgeableAfter.toISOString() : null,
    erroredReason: s.erroredReason ?? null,
  }));

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <Link
            href="/admin/emails/audiences"
            className="text-sm text-stone-500 underline-offset-2 hover:underline"
          >
            ← Audiences
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
            🎯 {audience.name}
          </h1>
          <p className="mt-1 font-mono text-xs text-stone-500">{audience.slug}</p>
          {liveCount !== null && (
            <p className="mt-2 text-sm text-stone-700" data-testid="live-count">
              <strong className="tabular-nums">{liveCount.toLocaleString('fr-FR')}</strong> contact
              {liveCount !== 1 ? 's' : ''} actuellement envoyable{liveCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <AudienceDetailActions
          audienceId={audience.id}
          rules={rules}
          exclusionFlags={exclusionFlags}
        />
      </header>

      {audience.description && (
        <p className="mb-6 text-sm text-stone-700">{audience.description}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Critères — rendu FR lisible (UX-AUD-014) */}
        <section className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-stone-700">Critères</h2>
          {ruleLines.length <= 1 && rules.conditions.length === 0 ? (
            <p className="text-sm italic text-stone-400">Aucun critère.</p>
          ) : (
            <ul className="space-y-1 text-sm" data-testid="rules-readable">
              {ruleLines.map((line, i) => (
                <li
                  key={i}
                  style={{ paddingLeft: `${line.depth * 1}rem` }}
                  className={line.combinator ? 'font-medium text-stone-500' : 'text-stone-800'}
                >
                  {line.combinator ? `▸ ${line.text}` : `• ${line.text}`}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Exclusions */}
        <section className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-stone-700">Exclusions automatiques</h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(exclusionFlags as Record<string, boolean>).map(([key, val]) => (
              <li key={key} className="flex items-center gap-2">
                <span className={val ? 'text-emerald-700' : 'text-stone-400'}>
                  {val ? '✓' : '○'}
                </span>
                <span className={val ? 'text-stone-800' : 'text-stone-400'}>
                  {EXCLUSION_LABELS[key] ?? key}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={`/admin/emails/audiences/${audience.id}/edit`}
            className="mt-3 inline-block text-xs text-sage-700 underline-offset-2 hover:underline"
          >
            Modifier les critères et exclusions →
          </Link>
        </section>
      </div>

      {/* Snapshots (drill-down, retry, auto-refresh) */}
      <SnapshotsPanel audienceId={audience.id} snapshots={snapshotRows} />

      <footer className="mt-8 text-xs text-stone-400">
        Créée par {audience.createdBy} le {formatDate(audience.createdAt)} · Mode{' '}
        {audience.evaluationMode}
      </footer>
    </AdminShell>
  );
}
