/**
 * Badge santé du dashboard emailing (`/admin/emails`) — présentationnel pur.
 *
 * Extrait de `page.tsx` pour être rendu/testé en isolation (jsdom). Reçoit le
 * niveau global déjà calculé (worst-wins entre le rapport de base et les checks
 * infra) + le `HealthReport` et le fragment `InfraChecks` (nullable).
 *
 * Rendu : `<details>` déroulant. Couleur + pastille selon le niveau
 * (`ok` 🟢 emerald · `degraded` 🟡 amber · `incident` 🔴 rose). Le détail
 * déroulé liste chaque check (✓/✗) ; le pied concatène les anomalies en une
 * phrase de synthèse actionnable.
 */
import type { HealthReport, HealthLevel } from '@/lib/admin/emails/health';
import type { InfraChecks } from '@/app/api/admin/emails/health/checks';

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
  const details: string[] = [];
  if (!c.smtpConfigured.ok) details.push(`SMTP non configuré (${c.smtpConfigured.missing?.join(', ')})`);
  if (!c.db.ok) details.push(`DB indispo${c.db.error ? ` (${c.db.error})` : ''}`);
  if (!c.outboxStuck.ok) details.push(`${c.outboxStuck.stuckCount} stuck en 'sending' > 5 min`);
  if (!c.dlq24h.ok) details.push(`${c.dlq24h.count} DLQ sur 24h`);
  if (c.pendingNow > 50) details.push(`${c.pendingNow} pending en attente`);
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
        <li>DLQ 24h : {c.dlq24h.count}</li>
        <li>Pending : {c.pendingNow}</li>
        <li>Dernier livré : {c.lastDeliveredAt ? new Date(c.lastDeliveredAt).toLocaleString('fr-FR') : 'jamais'}</li>
        {infra ? (
          <>
            <li>
              Webhook (delivered 7j) :{' '}
              {infra.webhookSilent.ok
                ? `✓ ${infra.webhookSilent.deliveredEventsLast7d} reçus`
                : `✗ 0 reçu pour ${infra.webhookSilent.sentLast7d} envoyés`}
            </li>
            <li>
              File outbox (en retard &gt; 15 min) :{' '}
              {infra.cronOutboxLate.ok ? '✓ 0' : `✗ ${infra.cronOutboxLate.lateCount}`}
            </li>
            <li>
              Sending bloqué (&gt; 15 min) :{' '}
              {infra.sendingStuck.ok ? '✓ 0' : `✗ ${infra.sendingStuck.stuckCount}`}
            </li>
          </>
        ) : null}
      </ul>
      {details.length > 0 ? (
        <p className="mt-2 font-medium">{details.join(' · ')}</p>
      ) : null}
    </details>
  );
}
