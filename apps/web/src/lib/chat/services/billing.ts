/**
 * CHA-038 — Service `billing`.
 *
 * Centralise :
 * - les fonctions de tarification (déléguées à `providers/pricing.ts`)
 * - le suivi du budget global mensuel (`CHAT_TOTAL_BUDGET_EUR_MONTHLY`)
 * - une fonction `assertBudget()` qui throw si le total cumulé sur le
 *   mois dépasse le budget configuré.
 *
 * cf. docs/chat-assistant/10-providers-models.md §6
 */
import { sql } from 'drizzle-orm';

import { env } from '@/lib/env';

import { requireChatDb } from '../db/client';
import { chatProviderConfig } from '../db/schema';
import {
  estimateCostEur,
  estimateEmbedCostEur,
} from '../providers/pricing';

export class ChatBudgetExceededError extends Error {
  readonly code = 'budget-exceeded';
  constructor(public readonly totalEur: number, public readonly limitEur: number) {
    super(`Chat monthly budget exceeded: ${totalEur.toFixed(4)}€ / ${limitEur}€`);
  }
}

export const billing = {
  estimateCostEur,
  estimateEmbedCostEur,

  /**
   * Somme des coûts consommés sur le mois courant pour TOUS les
   * providers. Source de vérité = `chat_provider_config.consumed_month_eur`.
   */
  async monthlyTotalEur(): Promise<number> {
    const db = requireChatDb();
    const rows = await db
      .select({
        total: sql<string>`coalesce(sum(${chatProviderConfig.consumedMonthEur}), 0)`,
      })
      .from(chatProviderConfig);
    return Number.parseFloat(rows[0]?.total ?? '0') || 0;
  },

  /**
   * Vérifie qu'on n'a pas explosé le budget total. Ne bloque QUE si
   * `CHAT_TOTAL_BUDGET_EUR_MONTHLY > 0`.
   */
  async assertBudget(): Promise<void> {
    const limit = env.CHAT_TOTAL_BUDGET_EUR_MONTHLY ?? 0;
    if (!limit || limit <= 0) return;
    const total = await this.monthlyTotalEur();
    if (total >= limit) {
      throw new ChatBudgetExceededError(total, limit);
    }
  },

  /**
   * Réinitialise tous les compteurs `consumed_month_eur` à 0 et
   * `consumed_reset_at` à NOW(). Appelé par cron mensuel.
   */
  async resetMonthlyCounters(): Promise<void> {
    const db = requireChatDb();
    await db.execute(sql`
      UPDATE chat_provider_config
         SET consumed_month_eur = 0,
             consumed_reset_at  = NOW(),
             updated_at         = NOW()
    `);
  },
};
