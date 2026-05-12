/**
 * Seeder chat-theme — réutilise `runChatThemeSeed()` du script CLI. Crée
 * le preset de theme par défaut (tokens, layout, motion, salutations
 * /, /kit) si aucun preset isDefault=true n'existe.
 */
import { runChatThemeSeed } from '../../../../scripts/seed-chat';
import type { SeederContext, SeederResult } from '../types';

export async function chatThemeSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  ctx.onProgress?.('Vérification theme default', 0.2);
  const report = await runChatThemeSeed();
  ctx.onProgress?.(report.message, 1.0);
  return {
    stats: {
      created: report.created ? 1 : 0,
      id: report.id ?? 'n/a',
    },
    summary: report.message,
  };
}
