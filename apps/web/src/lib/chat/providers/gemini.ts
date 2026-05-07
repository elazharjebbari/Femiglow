/**
 * CHA-022 — Adapter Google Gemini.
 *
 * STUB : voir openai.ts pour référence si on veut un client fetch direct,
 * ou installer `@langchain/google-genai` et restaurer l'implémentation.
 */
import { ProviderError, type ChatProvider, type ChatProviderConfig } from './types';

export function createGeminiAdapter(config: ChatProviderConfig): ChatProvider {
  throw new ProviderError(
    'unknown',
    "Gemini provider non disponible : '@langchain/google-genai' n'est pas installé.",
    { providerId: config.id },
  );
}
