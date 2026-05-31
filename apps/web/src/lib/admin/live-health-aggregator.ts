/**
 * Agrégateur santé live cross-système.
 *
 * Référence : `docs/live-systems-fix-2026-05/03-plan-action-phases.md` § R4
 *
 * Centralise les KPIs des 3 systèmes live (chat, publishing, tracking)
 * pour alimenter la page admin `/admin/live-health`.
 *
 * Tous les helpers retournent des structures sérialisables → consommables
 * par un Server Component sans transformations supplémentaires.
 */
import 'server-only';
import { redis } from '@/lib/redis/client';
import {
  getPublishingHealthStats,
  type PublishingHealthStats,
} from '@/lib/social-publishing/health-queries';
import {
  getRecentStreamingHealth,
  type StreamingHealthSummary,
} from '@/lib/chat/services/streaming-health';
import { getBufferSize, type CapiProvider } from '@/lib/tracking/server/capi-buffer';

export interface LiveHealthSnapshot {
  /** Timestamp ISO du snapshot. */
  asOf: string;
  /** Santé chat (streaming). */
  chat: {
    last60min: StreamingHealthSummary[];
    overallDropRatePct: number;
    totalStreamsLast60min: number;
    breakers: BreakerStatusByProvider[];
  };
  /** Santé publishing. */
  publishing: PublishingHealthStats;
  /** Santé tracking. */
  tracking: {
    bufferSizesByProvider: Array<{ provider: CapiProvider; size: number }>;
    totalBufferedEvents: number;
  };
  /** Alertes globales calculées (rouge si seuils dépassés). */
  alerts: HealthAlert[];
}

export interface BreakerStatusByProvider {
  providerId: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

export interface HealthAlert {
  level: 'critical' | 'warning' | 'info';
  system: 'chat' | 'publishing' | 'tracking';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Snapshot complet cross-système.
 *
 * Performance : ~3 round-trips Redis + 1 query DB. Acceptable pour
 * dashboard avec polling 30s. À optimiser via pipeline Redis si besoin.
 */
export async function getLiveHealthSnapshot(): Promise<LiveHealthSnapshot> {
  const [chatHealth, publishingHealth, trackingHealth] = await Promise.all([
    getChatHealth(),
    getPublishingHealthStats(24),
    getTrackingHealth(),
  ]);

  const alerts = computeAlerts({
    chat: chatHealth,
    publishing: publishingHealth,
    tracking: trackingHealth,
  });

  return {
    asOf: new Date().toISOString(),
    chat: chatHealth,
    publishing: publishingHealth,
    tracking: trackingHealth,
    alerts,
  };
}

async function getChatHealth(): Promise<LiveHealthSnapshot['chat']> {
  const last60min = await getRecentStreamingHealth(60);
  const totalStreams = last60min.reduce((acc, s) => acc + s.totalStreams, 0);
  const totalDrops = last60min.reduce((acc, s) => acc + s.drops, 0);
  const overallDropRatePct =
    totalStreams > 0 ? Math.round((totalDrops / totalStreams) * 100) : 0;

  // Liste les providers connus + leur état breaker
  // (en prod, ces IDs viennent de providerRepo.listByRole — pour l'instant
  // on liste les conventional)
  const knownProviderIds = ['openai-primary', 'anthropic-fallback'];
  const breakers: BreakerStatusByProvider[] = [];
  for (const id of knownProviderIds) {
    const failures = await redis.get(`cb:chat:provider:${id}:failures`);
    const openedAt = await redis.get(`cb:chat:provider:${id}:opened_at`);
    let state: BreakerStatusByProvider['state'] = 'CLOSED';
    if (openedAt) {
      const opened = parseInt(openedAt, 10);
      const elapsed = Date.now() - opened;
      state = elapsed > 30000 ? 'HALF_OPEN' : 'OPEN';
    }
    breakers.push({ providerId: id, state });
  }

  return {
    last60min,
    overallDropRatePct,
    totalStreamsLast60min: totalStreams,
    breakers,
  };
}

async function getTrackingHealth(): Promise<LiveHealthSnapshot['tracking']> {
  const providers: CapiProvider[] = ['meta', 'tiktok', 'snap', 'pinterest'];
  const sizes = await Promise.all(
    providers.map(async (p) => ({
      provider: p,
      size: await getBufferSize(p),
    })),
  );
  return {
    bufferSizesByProvider: sizes,
    totalBufferedEvents: sizes.reduce((acc, s) => acc + s.size, 0),
  };
}

/**
 * Calcule les alertes basées sur les seuils du runbook.
 *
 * Seuils (cf. docs/live-systems-fix-2026-05/05-runbook-rollout.md) :
 *  - critical : chat drop rate > 10%, publishing dead letters > 0,
 *    tracking buffer total > 1000
 *  - warning : chat drop rate > 5%, publishing success rate < 90%,
 *    buffer total > 500
 */
function computeAlerts(input: {
  chat: LiveHealthSnapshot['chat'];
  publishing: LiveHealthSnapshot['publishing'];
  tracking: LiveHealthSnapshot['tracking'];
}): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  // Chat
  if (input.chat.overallDropRatePct > 10) {
    alerts.push({
      level: 'critical',
      system: 'chat',
      message: `Drop rate chat élevé : ${input.chat.overallDropRatePct}%`,
      details: { dropRate: input.chat.overallDropRatePct },
    });
  } else if (input.chat.overallDropRatePct > 5) {
    alerts.push({
      level: 'warning',
      system: 'chat',
      message: `Drop rate chat anormal : ${input.chat.overallDropRatePct}%`,
    });
  }

  const openBreakers = input.chat.breakers.filter((b) => b.state === 'OPEN');
  if (openBreakers.length > 0) {
    alerts.push({
      level: 'critical',
      system: 'chat',
      message: `${openBreakers.length} provider(s) breaker OPEN`,
      details: { breakers: openBreakers },
    });
  }

  // Publishing
  if (input.publishing.deadLetters > 0) {
    alerts.push({
      level: 'critical',
      system: 'publishing',
      message: `${input.publishing.deadLetters} dead letter(s) publishing (24h)`,
      details: { count: input.publishing.deadLetters },
    });
  }
  if (input.publishing.successRatePct < 90 && input.publishing.totalJobs > 5) {
    alerts.push({
      level: 'warning',
      system: 'publishing',
      message: `Success rate publishing bas : ${input.publishing.successRatePct}%`,
    });
  }

  // Tracking
  if (input.tracking.totalBufferedEvents > 1000) {
    alerts.push({
      level: 'critical',
      system: 'tracking',
      message: `Buffer CAPI très chargé : ${input.tracking.totalBufferedEvents} events en attente`,
      details: { byProvider: input.tracking.bufferSizesByProvider },
    });
  } else if (input.tracking.totalBufferedEvents > 500) {
    alerts.push({
      level: 'warning',
      system: 'tracking',
      message: `Buffer CAPI grossit : ${input.tracking.totalBufferedEvents} events`,
    });
  }

  return alerts;
}
