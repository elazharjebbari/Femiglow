/**
 * CHA-024 — Adapter Mistral.
 *
 * STUB : installer `@langchain/mistralai` ou écrire un client fetch direct.
 */
import { ProviderError, type ChatProvider, type ChatProviderConfig } from './types';

export function createMistralAdapter(config: ChatProviderConfig): ChatProvider {
  throw new ProviderError(
    'unknown',
    "Mistral provider non disponible : '@langchain/mistralai' n'est pas installé.",
    { providerId: config.id },
  );
}
