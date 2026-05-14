/**
 * CHAT-047 — Cron horaire de surveillance des budgets providers.
 *
 * Pourquoi
 * ────────
 * Le compteur `consumed_month_eur` est incrémenté à chaque appel d'un
 * provider via `providerRepo.incrementConsumed`. `billing.assertBudget`
 * vérifie le total global mais ne désactive pas les providers
 * individuellement quand l'un dépasse son `quota_monthly_eur`.
 *
 * Résultat sans budget-watch : un provider isolé continue de consommer
 * jusqu'à ce qu'on l'arrête manuellement → dépassement de quota silencieux,
 * surprise en fin de mois côté facturation externe.
 *
 * Stratégie
 * ─────────
 *  - Liste tous les providers (incluant désactivés pour log complet).
 *  - Pour chaque provider activé qui a un `quotaMonthlyEur` défini :
 *      - ratio = consumed / quota
 *      - ratio >= disableThreshold (1.0 par défaut)  → désactive + warn
 *      - ratio >= warnThreshold (0.8 par défaut)     → warn seulement
 *  - Idempotent : ré-exécuter sans nouvelle consommation → même résultat
 *    (les providers déjà désactivés sont skipped).
 *
 * Le rapport est utilisé par le cron + le trigger admin pour le retour UI.
 */
import { logger } from '@/lib/logging/logger';

import { providerRepo } from '../repos/provider';
import { sendChatAlert } from './slack-notify';

export interface BudgetWatchAlert {
  providerId: string;
  label: string;
  consumedEur: number;
  quotaEur: number;
  ratio: number;
  action: 'warned' | 'disabled';
}

export interface BudgetWatchReport {
  scanned: number;
  warned: number;
  disabled: number;
  alerts: BudgetWatchAlert[];
}

export interface BudgetWatchOptions {
  warnThreshold?: number;
  disableThreshold?: number;
  dryRun?: boolean;
}

export async function watchProviderBudgets(
  opts: BudgetWatchOptions = {},
): Promise<BudgetWatchReport> {
  const warnThreshold = opts.warnThreshold ?? 0.8;
  const disableThreshold = opts.disableThreshold ?? 1.0;
  const dryRun = opts.dryRun ?? false;

  const providers = await providerRepo.listAll();
  const report: BudgetWatchReport = {
    scanned: 0,
    warned: 0,
    disabled: 0,
    alerts: [],
  };

  for (const provider of providers) {
    if (!provider.enabled) continue;
    if (provider.quotaMonthlyEur == null) continue;

    const quota = Number.parseFloat(provider.quotaMonthlyEur);
    const consumed = Number.parseFloat(provider.consumedMonthEur);
    if (!Number.isFinite(quota) || quota <= 0) continue;
    if (!Number.isFinite(consumed) || consumed < 0) continue;

    report.scanned += 1;
    const ratio = consumed / quota;

    if (ratio >= disableThreshold) {
      report.disabled += 1;
      report.alerts.push({
        providerId: provider.id,
        label: provider.label,
        consumedEur: consumed,
        quotaEur: quota,
        ratio,
        action: 'disabled',
      });
      logger.warn('chat.cron.budget_watch.provider_disabled', {
        providerId: provider.id,
        label: provider.label,
        consumed,
        quota,
        ratio,
      });
      if (!dryRun) {
        await providerRepo.update(provider.id, { enabled: false });
        await sendChatAlert({
          title: `Chat provider désactivé — ${provider.label}`,
          detail: `Le provider "${provider.label}" a dépassé son quota mensuel et a été désactivé automatiquement par budget-watch.`,
          severity: 'critical',
          fields: [
            { label: 'Provider', value: provider.label },
            { label: 'Consommé', value: `${consumed.toFixed(2)} €` },
            { label: 'Quota', value: `${quota.toFixed(2)} €` },
            { label: 'Ratio', value: `${(ratio * 100).toFixed(1)} %` },
          ],
        });
      }
    } else if (ratio >= warnThreshold) {
      report.warned += 1;
      report.alerts.push({
        providerId: provider.id,
        label: provider.label,
        consumedEur: consumed,
        quotaEur: quota,
        ratio,
        action: 'warned',
      });
      logger.warn('chat.cron.budget_watch.provider_near_quota', {
        providerId: provider.id,
        label: provider.label,
        consumed,
        quota,
        ratio,
      });
    }
  }

  return report;
}
