/**
 * CHA-023 — Adapter Anthropic Claude.
 *
 * STUB : tant que `@langchain/anthropic` n'est pas installé, ce provider
 * lève `ProviderError` au moment de l'instanciation. Le factory continue
 * de compiler. Pour réactiver : `pnpm add @langchain/anthropic` puis
 * restaurer l'implémentation depuis git history (ou écrire un client
 * fetch direct comme `openai.ts`).
 */
import { ProviderError, type ChatProvider, type ChatProviderConfig } from './types';

export function createAnthropicAdapter(config: ChatProviderConfig): ChatProvider {
  throw new ProviderError(
    'unknown',
    "Anthropic provider non disponible : '@langchain/anthropic' n'est pas installé.",
    { providerId: config.id },
  );
}
