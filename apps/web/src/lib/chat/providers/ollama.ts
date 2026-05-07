/**
 * CHA-026 — Adapter Ollama (local / preview).
 *
 * STUB : installer `@langchain/ollama` ou écrire un client fetch direct
 * vers `${apiBase}/api/chat`.
 */
import { ProviderError, type ChatProvider, type ChatProviderConfig } from './types';

export function createOllamaAdapter(config: ChatProviderConfig): ChatProvider {
  throw new ProviderError(
    'unknown',
    "Ollama provider non disponible : '@langchain/ollama' n'est pas installé.",
    { providerId: config.id },
  );
}
