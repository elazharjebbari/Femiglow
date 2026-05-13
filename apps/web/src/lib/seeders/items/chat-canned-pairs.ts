/**
 * Seeder chat-canned-pairs — réutilise `runChatCannedPairsSeed()` du script
 * CLI. Lit `docs/dossier-chat-v2/02-data/canned-pairs-seed.csv` et fait
 * UPSERT par `key` + versioning immutable via `chat_canned_pair_version`.
 *
 * Idempotent : ne crée une nouvelle version que si `body_hash` change.
 */
import { runChatCannedPairsSeed } from '../../../../scripts/seed-chat-canned-pairs';
import type { SeederContext, SeederResult } from '../types';

export async function chatCannedPairsSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  ctx.onProgress?.('Lecture du CSV canned-pairs', 0.1);
  const report = await runChatCannedPairsSeed({ actorId: ctx.actorId ?? 'seed' });
  ctx.onProgress?.(
    `parsed=${report.parsed} inserted=${report.inserted} updated=${report.updated}`,
    1.0,
  );
  return {
    stats: {
      parsed: report.parsed,
      inserted: report.inserted,
      updated: report.updated,
      versioned: report.versioned,
      skipped: report.skipped,
    },
    summary:
      `${report.inserted} créées · ${report.updated} mises à jour · ` +
      `${report.versioned} versions · ${report.skipped} inchangées`,
  };
}
