/**
 * CHA-308 — Cron quotidien de re-synchronisation des sources RAG dont
 * la fraîcheur est `volatile` (ex. pages d'aide pricing/livraison qui
 * changent souvent).
 *
 * Pourquoi un cron
 * ────────────────
 * Une source ingérée le 2025-09 reste fige indéfiniment côté chunks +
 * embeddings. Si l'URL change (prix, conditions, dates), la cascade L4
 * RAG continue à servir l'ancienne version → réponses obsolètes →
 * perte de confiance utilisateur.
 *
 * Stratégie
 * ─────────
 *  - On filtre par `kind='url' AND freshness='volatile'` : seules les URLs
 *    peuvent être re-fetched (les md/pdf/docx n'ont pas de body en base,
 *    et les snippet/faq sont alimentés par l'admin).
 *  - On appelle `ragService.ingest` qui est idempotent via `raw_hash` :
 *    si le contenu n'a pas bougé, ingest renvoie `reused=true` (skip).
 *  - On limite à `maxSources=20` par run pour éviter de surcharger la
 *    fenêtre serverless (60s).
 *
 * Rapport renvoyé pour les logs/tests.
 */
import { logger } from '@/lib/logging/logger';

import { sourceRepo } from '../repos/knowledge';
import { ragService } from '../rag/service';

import type { ChatLanguage } from '../contracts';

export interface KbSyncReport {
  scanned: number;
  refreshed: number;
  unchanged: number;
  errors: number;
  errorDetails: Array<{ sourceId: string; label: string; reason: string }>;
}

export interface KbSyncOptions {
  maxSources?: number;
  freshness?: Array<'volatile' | 'seasonal'>;
}

export async function syncKnowledgeSources(
  opts: KbSyncOptions = {},
): Promise<KbSyncReport> {
  const sources = await sourceRepo.listForResync({
    kinds: ['url'],
    freshness: opts.freshness ?? ['volatile'],
  });
  const maxSources = opts.maxSources ?? 20;
  const queue = sources.slice(0, maxSources);

  const report: KbSyncReport = {
    scanned: queue.length,
    refreshed: 0,
    unchanged: 0,
    errors: 0,
    errorDetails: [],
  };

  for (const source of queue) {
    if (!source.locator) {
      report.errors += 1;
      report.errorDetails.push({
        sourceId: source.id,
        label: source.label,
        reason: 'no-locator',
      });
      continue;
    }
    try {
      const result = await ragService.ingest({
        kind: 'url',
        label: source.label,
        locator: source.locator,
        language: source.language as ChatLanguage,
        audience: source.audience,
        freshness: source.freshness,
        tags: source.tags,
        createdBy: 'cron:kb-sync',
      });
      if (result.reused) {
        report.unchanged += 1;
      } else {
        report.refreshed += 1;
      }
    } catch (err) {
      report.errors += 1;
      const reason = err instanceof Error ? err.message : 'unknown';
      report.errorDetails.push({
        sourceId: source.id,
        label: source.label,
        reason,
      });
      logger.warn('chat.cron.kb_sync.source_failed', {
        sourceId: source.id,
        reason,
      });
    }
  }

  return report;
}
