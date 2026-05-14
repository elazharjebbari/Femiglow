/**
 * Seeder chat-intents — réutilise `runChatIntentsSeed()` du script CLI.
 * Lit `docs/dossier-chat-v2/02-data/intent-dataset-sample.csv`, embedde
 * les exemples puis calcule un centroid moyen L2-normalisé par intent.
 *
 * Idempotent : pré-nettoie les exemples `added_by='seed'` avant insertion,
 * UPSERT les centroids par (intent, language='all').
 *
 * Si aucun provider `embedding` n'est enabled, log warning + skip.
 */
import { runChatIntentsSeed } from '../../../../scripts/seed-chat-intents';
import type { SeederContext, SeederResult } from '../types';

export async function chatIntentsSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  ctx.onProgress?.('Lecture du dataset intents', 0.1);
  const report = await runChatIntentsSeed({ actorId: ctx.actorId ?? 'seed' });
  ctx.onProgress?.(
    `examples: ${report.insertedExamples} · centroids: ${
      report.centroidsInserted + report.centroidsUpdated
    }`,
    1.0,
  );
  const summary =
    report.insertedExamples === 0
      ? `${report.parsedExamples} sautés (provider embedding absent)`
      : `${report.insertedExamples} exemples · ${report.centroidsInserted} centroids créés · ` +
        `${report.centroidsUpdated} mis à jour` +
        (report.embeddingModel ? ` · model=${report.embeddingModel}` : '');
  return {
    stats: {
      parsedExamples: report.parsedExamples,
      deletedExamples: report.deletedExamples,
      insertedExamples: report.insertedExamples,
      centroidsInserted: report.centroidsInserted,
      centroidsUpdated: report.centroidsUpdated,
      embeddingModel: report.embeddingModel ?? 'n/a',
    },
    summary,
  };
}
