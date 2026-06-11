/**
 * Badge santé du dashboard emailing (`/admin/emails`) — présentationnel pur.
 *
 * Extrait de `page.tsx` pour être rendu/testé en isolation (jsdom). Reçoit le
 * niveau global déjà calculé (worst-wins entre le rapport de base et les checks
 * infra) + le `HealthReport` et le fragment `InfraChecks` (nullable).
 *
 * Rendu : `<details>` déroulant. Couleur + pastille selon le niveau
 * (`ok` 🟢 emerald · `degraded` 🟡 amber · `incident` 🔴 rose). Le détail
 * déroulé liste chaque check (✓/✗) ; chaque check ✗ devient une LIGNE D'ACTION
 * (lien deep-link vers la population concernée — UX-DASH-002) ; le pied
 * concatène les anomalies en une phrase de synthèse actionnable.
 *
 * UX-DASH-011 : les checks `deliveredFreshness` et `cronHeartbeat` (qui
 * INFLUENCENT le niveau global) sont désormais rendus dans le <ul> avec ✓/✗ et
 * leur âge formaté — la cause d'un badge rouge n'est plus invisible.
 */
import Link from 'next/link';
import type { HealthReport, HealthLevel } from '@/lib/admin/emails/health';
import type { InfraChecks } from '@/app/api/admin/emails/health/checks';

/** Deep-links cockpit par population (cohérents avec les cartes KPI). */
const COCKPIT = '/admin/emails/transactional';
const HREF_DLQ = `${COCKPIT}?status=dlq`;
const HREF_SENDING = `${COCKPIT}?status=sending`;
const HREF_QUEUE_LATE = `${COCKPIT}?status=pending,failed`;
const HREF_EVENTS_EMAIL = '/admin/emails/events?source=email';

/** Formate un âge en ms vers « 2 h 05 », « 12 min », « 40 s » (fr, compact). */
function fmtAge(ageMs: number | null): string {
  if (ageMs === null) return 'jamais';
  const totalMin = Math.floor(ageMs / 60_000);
  if (totalMin < 1) return `${Math.max(0, Math.floor(ageMs / 1000))} s`;
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} h ${m.toString().padStart(2, '0')}`;
}

/** Une ligne de check : libellé + statut, rendue en lien d'action si en panne. */
function CheckLine({
  ok,
  children,
  href,
  actionLabel,
}: {
  ok: boolean;
  children: React.ReactNode;
  /** Cible deep-link quand le check est ✗ (population à corriger). */
  href?: string;
  /** Libellé de l'action (ex. « Voir »). */
  actionLabel?: string;
}) {
  return (
    <li>
      {children}
      {!ok && href ? (
        <>
          {' '}
          <Link href={href} className="font-medium underline underline-offset-2">
            {actionLabel ?? 'Voir'} →
          </Link>
        </>
      ) : null}
    </li>
  );
}

export function HealthBadge({
  level,
  report,
  infra,
}: {
  level: HealthLevel;
  report: HealthReport;
  infra: InfraChecks | null;
}) {
  const cls =
    level === 'ok'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : level === 'degraded'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';
  const dot = level === 'ok' ? '🟢' : level === 'degraded' ? '🟡' : '🔴';
  const label = level === 'ok' ? 'Système OK' : level === 'degraded' ? 'Dégradé' : 'Incident';
  const c = report.checks;
  const fresh = c.deliveredFreshness;
  const cron = c.cronHeartbeat;
  const details: string[] = [];
  if (!c.smtpConfigured.ok) details.push(`SMTP non configuré (${c.smtpConfigured.missing?.join(', ')})`);
  if (!c.db.ok) details.push(`DB indispo${c.db.error ? ` (${c.db.error})` : ''}`);
  if (!c.outboxStuck.ok) details.push(`${c.outboxStuck.stuckCount} stuck en 'sending' > 5 min`);
  if (!c.dlq24h.ok) details.push(`${c.dlq24h.count} DLQ sur 24h`);
  if (c.pendingNow > 50) details.push(`${c.pendingNow} pending en attente`);
  if (fresh && !fresh.ok)
    details.push(
      fresh.ageMs === null
        ? 'aucune livraison confirmée malgré des envois récents'
        : `dernier delivered il y a ${fmtAge(fresh.ageMs)}`,
    );
  if (cron && !cron.ok) details.push('cron de drain muet (heartbeat périmé)');
  // Pannes infra (chantier 1.2) — pipeline webhook / crons.
  if (infra && !infra.webhookSilent.ok)
    details.push(
      `webhook muet : ${infra.webhookSilent.sentLast7d} envoyés / 0 livré confirmé (7j)`,
    );
  if (infra && !infra.cronOutboxLate.ok)
    details.push(`${infra.cronOutboxLate.lateCount} en file > 15 min (cron outbox à l'arrêt ?)`);
  if (infra && !infra.sendingStuck.ok)
    details.push(`${infra.sendingStuck.stuckCount} bloqués en 'sending' > 15 min (reaper muet ?)`);
  return (
    <details className={`rounded-md border px-3 py-1.5 text-xs ${cls}`}>
      <summary className="cursor-pointer font-medium select-none">
        {dot} {label}
      </summary>
      <ul className="mt-2 space-y-1">
        <li>SMTP : {c.smtpConfigured.ok ? '✓ configuré' : '✗ ' + (c.smtpConfigured.missing?.join(', ') ?? '')}</li>
        <li>DB : {c.db.ok ? '✓ ok' : '✗ ' + (c.db.error ?? 'erreur')}</li>
        <li>Outbox stuck : {c.outboxStuck.stuckCount}</li>
        <CheckLine ok={c.dlq24h.ok} href={HREF_DLQ} actionLabel="Voir la DLQ">
          DLQ 24h : {c.dlq24h.count}
        </CheckLine>
        <li>Pending : {c.pendingNow}</li>
        <li>Dernier livré : {c.lastDeliveredAt ? new Date(c.lastDeliveredAt).toLocaleString('fr-FR') : 'jamais'}</li>
        {fresh ? (
          <li>
            Fraîcheur livraison :{' '}
            {fresh.ok ? `✓ ${fresh.ageMs === null ? 'aucun envoi récent' : `il y a ${fmtAge(fresh.ageMs)}`}` : `✗ ${fresh.ageMs === null ? 'aucun delivered malgré des envois' : `il y a ${fmtAge(fresh.ageMs)}`}`}
          </li>
        ) : null}
        {cron ? (
          <li>
            Cron de drain (heartbeat) :{' '}
            {cron.ok ? `✓ ${cron.ageMs === null ? 'inactif' : `tick il y a ${fmtAge(cron.ageMs)}`}` : `✗ ${cron.lastTickAt === null ? 'aucun tick' : `dernier tick il y a ${fmtAge(cron.ageMs)}`}`}
          </li>
        ) : null}
        {infra ? (
          <>
            <CheckLine
              ok={infra.webhookSilent.ok}
              href={HREF_EVENTS_EMAIL}
              actionLabel="Vérifier les events"
            >
              Webhook (delivered 7j) :{' '}
              {infra.webhookSilent.ok
                ? `✓ ${infra.webhookSilent.deliveredEventsLast7d} reçus`
                : `✗ 0 reçu pour ${infra.webhookSilent.sentLast7d} envoyés`}
            </CheckLine>
            <CheckLine ok={infra.cronOutboxLate.ok} href={HREF_QUEUE_LATE} actionLabel="Voir la file">
              File outbox (en retard &gt; 15 min) :{' '}
              {infra.cronOutboxLate.ok ? '✓ 0' : `✗ ${infra.cronOutboxLate.lateCount}`}
            </CheckLine>
            <CheckLine ok={infra.sendingStuck.ok} href={HREF_SENDING} actionLabel="Voir les bloqués">
              Sending bloqué (&gt; 15 min) :{' '}
              {infra.sendingStuck.ok ? '✓ 0' : `✗ ${infra.sendingStuck.stuckCount}`}
            </CheckLine>
          </>
        ) : null}
      </ul>
      {details.length > 0 ? (
        <p className="mt-2 font-medium">{details.join(' · ')}</p>
      ) : null}
    </details>
  );
}
