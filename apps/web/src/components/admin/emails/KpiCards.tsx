/**
 * Cartes KPI du dashboard emailing (`/admin/emails`) — présentationnel pur.
 *
 * Extrait de `page.tsx` pour être rendu/testé en isolation (jsdom). Reçoit le
 * `OutboxKpi` déjà calculé par `getOutboxKpi()` (lecture DB côté RSC) et se
 * contente de l'AFFICHER avec le bon formatage fr-FR et la bonne sémantique
 * couleur.
 *
 * Corrige l'écart d'audit F-001 : quand des emails partent (`sent > 0`) mais
 * qu'aucune livraison n'est confirmée (`delivered = 0`), la carte « Livrés »
 * passe en alerte (ton rose) ET une bannière explicite « delivery silencieux »
 * apparaît — au lieu d'un « 0 » neutre qui masquait le webhook Stalwart mort.
 */
import Link from 'next/link';
import type { OutboxKpi } from '@/lib/admin/emails/queries';
import {
  deliveredTone,
  dlqTone,
  failedTone,
  fmt,
  isDeliverySilent,
  pct,
  pendingTone,
  type KpiTone,
} from '@/app/admin/emails/kpi-format';

/**
 * Deep-links cockpit par population (UX-DASH-001). Le cockpit transactionnel
 * `deserializeFilters` lit `?status=…` (liste séparée par des virgules) →
 * chaque carte KPI renvoie l'opérateur vers la liste filtrée correspondante,
 * en ≤ 2 clics (« problème visible → action »).
 */
const COCKPIT = '/admin/emails/transactional';
const HREF_SENT = `${COCKPIT}?status=sent,delivered`;
const HREF_FAILED = `${COCKPIT}?status=failed,bounced_soft,bounced_permanent`;
const HREF_DLQ = `${COCKPIT}?status=dlq`;
const HREF_PENDING = `${COCKPIT}?status=pending`;
/** Page de debug events filtrée sur les events email (delivered entrants). */
const HREF_EVENTS_EMAIL = '/admin/emails/events?source=email';

export function KpiCards({ kpi }: { kpi: OutboxKpi }) {
  const deliverySilent = isDeliverySilent(kpi.sentLast7d, kpi.deliveredLast7d);
  return (
    <>
      {deliverySilent ? (
        <div
          role="alert"
          data-testid="delivery-silent-banner"
          className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700"
        >
          <strong className="font-semibold">Livraison silencieuse</strong> :{' '}
          {fmt(kpi.sentLast7d)} email(s) envoyé(s) sur 7 j mais aucune livraison
          confirmée — le webhook Stalwart est probablement muet.{' '}
          <Link
            href={HREF_EVENTS_EMAIL}
            className="font-medium underline underline-offset-2"
          >
            Vérifier les events delivered →
          </Link>
        </div>
      ) : null}

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          testId="kpi-card-sent"
          label="Envoyés (7j)"
          value={fmt(kpi.sentLast7d)}
          sub={`sur ${fmt(kpi.totalLast7d)} tentatives`}
          href={HREF_SENT}
          ariaLabel={`Voir les ${fmt(kpi.sentLast7d)} envoyés (7 jours)`}
        />
        <Kpi
          testId="kpi-card-delivered"
          label="Livrés"
          value={fmt(kpi.deliveredLast7d)}
          sub={
            deliverySilent
              ? 'delivery silencieux ? webhook ?'
              : pct(kpi.deliveredLast7d, kpi.sentLast7d) + ' des envoyés'
          }
          tone={deliveredTone(kpi)}
          href={HREF_SENT}
          ariaLabel={`Voir les ${fmt(kpi.deliveredLast7d)} livrés (7 jours)`}
        />
        <Kpi
          testId="kpi-card-failed"
          label="Échecs"
          value={fmt(kpi.failedLast7d)}
          sub={pct(kpi.failedLast7d, kpi.totalLast7d)}
          tone={failedTone(kpi.failedLast7d)}
          href={HREF_FAILED}
          ariaLabel={`Voir les ${fmt(kpi.failedLast7d)} échecs`}
        />
        <Kpi
          testId="kpi-card-dlq"
          label="DLQ"
          value={fmt(kpi.dlqLast7d)}
          sub="abandonnés (max attempts)"
          tone={dlqTone(kpi.dlqLast7d)}
          href={HREF_DLQ}
          ariaLabel={`Voir les ${fmt(kpi.dlqLast7d)} messages en DLQ`}
        />
        <Kpi
          testId="kpi-card-pending"
          label="En attente"
          value={fmt(kpi.pendingNow)}
          sub="pickup cron 60s"
          tone={pendingTone(kpi.pendingNow)}
          href={HREF_PENDING}
          ariaLabel={`Voir les ${fmt(kpi.pendingNow)} messages en attente`}
        />
        <Kpi
          testId="kpi-card-total"
          label="Total tentatives"
          value={fmt(kpi.totalLast7d)}
          sub="7 derniers jours"
        />
      </section>
    </>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone = 'neutral',
  testId,
  href,
  ariaLabel,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
  testId?: string;
  /** Cible de drill-down (UX-DASH-001). Si absent, la carte est inerte (Total). */
  href?: string;
  /** Libellé accessible chiffré du lien (ex. « Voir les 42 échecs »). */
  ariaLabel?: string;
}) {
  const toneClass =
    tone === 'amber'
      ? 'text-amber-700'
      : tone === 'rose'
        ? 'text-rose-700'
        : tone === 'emerald'
          ? 'text-emerald-700'
          : 'text-stone-900';
  const card = (
    <div className="rounded-lg border border-stone-200 bg-white p-3" data-testid={testId}>
      <p className="text-xs uppercase tracking-wider text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-stone-500">{sub}</p> : null}
    </div>
  );
  if (!href) return card;
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="block rounded-lg transition hover:ring-2 hover:ring-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500"
    >
      {card}
    </Link>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
    sending: { label: 'Envoi…', cls: 'bg-amber-50 text-amber-700' },
    sent: { label: 'Envoyé', cls: 'bg-emerald-50 text-emerald-700' },
    delivered: { label: 'Livré', cls: 'bg-emerald-100 text-emerald-800' },
    opened: { label: 'Ouvert', cls: 'bg-blue-50 text-blue-700' },
    clicked: { label: 'Cliqué', cls: 'bg-blue-100 text-blue-800' },
    failed: { label: 'Échec', cls: 'bg-rose-50 text-rose-700' },
    bounced_soft: { label: 'Bounce soft', cls: 'bg-amber-50 text-amber-700' },
    bounced_permanent: { label: 'Bounce perm.', cls: 'bg-rose-100 text-rose-800' },
    suppressed: { label: 'Supprimé', cls: 'bg-stone-100 text-stone-700' },
    dlq: { label: 'DLQ', cls: 'bg-rose-200 text-rose-900' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-stone-100 text-stone-700' };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}
      role="status"
    >
      ⏺ {s.label}
    </span>
  );
}
