/**
 * Seeder chat-faq — réutilise `runChatFaqSeed()` du script CLI. Lit
 * `docs/dossier-chat-v2/02-data/faq-entries-seed.csv`, embedde les
 * `question_canonical` via le provider OpenAI configuré, puis UPSERT
 * par (key, language).
 *
 * Idempotent : re-run = re-calcul des embeddings + UPDATE des rows.
 * Si aucun provider `embedding` n'est enabled, le seeder loggue un
 * warning et retourne `skipped` (à l'admin de configurer la clé).
 */
import { runChatFaqSeed } from '../../../../scripts/seed-chat-faq';
import type { SeederContext, SeederResult } from '../types';

export async function chatFaqSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  ctx.onProgress?.('Lecture du CSV FAQ', 0.1);
  const report = await runChatFaqSeed();
  ctx.onProgress?.(
    `parsed=${report.parsed} inserted=${report.inserted} updated=${report.updated}`,
    1.0,
  );
  const summary =
    report.skipped > 0 && report.inserted === 0 && report.updated === 0
      ? `${report.skipped} sautées (provider embedding absent)`
      : `${report.inserted} créées · ${report.updated} mises à jour` +
        (report.embeddingModel ? ` · model=${report.embeddingModel}` : '');
  return {
    stats: {
      parsed: report.parsed,
      inserted: report.inserted,
      updated: report.updated,
      skipped: report.skipped,
      embeddingModel: report.embeddingModel ?? 'n/a',
    },
    summary,
  };
}
