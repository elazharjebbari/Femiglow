/**
 * Seeder chat-providers — réutilise `runChatProvidersSeed()` du script CLI.
 * Crée les providers configurés via .env (CHAT_OPENAI_API_KEY,
 * CHAT_GEMINI_API_KEY, CHAT_ANTHROPIC_API_KEY, CHAT_MISTRAL_API_KEY,
 * CHAT_OLLAMA_BASE_URL) si aucun provider n'existe en base.
 *
 * Note : nécessite `CHAT_PROVIDER_KEY` dans l'environnement pour chiffrer
 * les clés API avant insertion.
 */
import { runChatProvidersSeed } from '../../../../scripts/seed-chat';
import type { SeederContext, SeederResult } from '../types';

export async function chatProvidersSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  ctx.onProgress?.('Lecture .env providers', 0.2);
  const report = await runChatProvidersSeed();
  ctx.onProgress?.(report.message, 1.0);
  return {
    stats: {
      created: report.created,
      skipped: report.skipped ? 1 : 0,
    },
    summary: report.message,
  };
}
