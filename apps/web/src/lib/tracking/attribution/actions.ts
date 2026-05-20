'use server';

/**
 * Server actions admin pour piloter la stratégie d'attribution.
 *
 * Gates auth admin via `requireAdmin`. Validation Zod côté serveur,
 * audit logé via le mécanisme `tracking_settings.updatedBy`.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import {
  getAttributionStrategy,
  setAttributionStrategy,
} from './server';
import {
  ATTRIBUTION_STRATEGIES,
  type AttributionStrategy,
} from './types';

const strategyInputSchema = z.enum(ATTRIBUTION_STRATEGIES);

export async function getAttributionStrategyAction(): Promise<AttributionStrategy> {
  await requireAdmin('/admin/tracking/attribution');
  return getAttributionStrategy();
}

export async function setAttributionStrategyAction(input: {
  strategy: AttributionStrategy;
}): Promise<{ ok: true; strategy: AttributionStrategy }> {
  const session = await requireAdmin('/admin/tracking/attribution');
  const parsed = strategyInputSchema.parse(input.strategy);
  const previous = await getAttributionStrategy();
  await setAttributionStrategy(parsed, { actorId: session.adminId });
  await logAuditEvent({
    action: 'tracking.attribution.strategy_changed',
    actorId: session.adminId,
    meta: { previous, next: parsed },
  });
  revalidatePath('/admin/tracking/attribution');
  return { ok: true, strategy: parsed };
}
