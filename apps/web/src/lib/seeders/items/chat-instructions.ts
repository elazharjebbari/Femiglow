/**
 * Seeder chat-instructions — réutilise `runChatInstructionsSeed()` du script
 * CLI. Crée l'instruction par défaut FR + AR + AR-MA (scope=default) si
 * absente. Idempotent : ne crée pas de doublon si déjà active.
 */
import { runChatInstructionsSeed } from '../../../../scripts/seed-chat';
import type { SeederContext, SeederResult } from '../types';

export async function chatInstructionsSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  ctx.onProgress?.('Vérification instruction active', 0.2);
  const report = await runChatInstructionsSeed();
  ctx.onProgress?.(report.message, 1.0);
  return {
    stats: {
      created: report.created ? 1 : 0,
      id: report.id ?? 'n/a',
    },
    summary: report.message,
  };
}
