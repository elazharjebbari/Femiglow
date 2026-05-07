/**
 * CHA-028 — Fabrique de providers.
 *
 * Reçoit une config (clé déchiffrée) et retourne l'instance
 * `ChatProvider` correspondante. Les providers OpenAI-compatible
 * (qwen, deepseek, zhipu) réutilisent l'adapter OpenAI avec un
 * `apiBase` différent.
 */
import { createAnthropicAdapter } from './anthropic';
import { createGeminiAdapter } from './gemini';
import { createMistralAdapter } from './mistral';
import { createOllamaAdapter } from './ollama';
import { createOpenAIAdapter } from './openai';
import type { ChatProvider, ChatProviderConfig } from './types';

const OPENAI_COMPAT_BASE_URLS: Record<string, string> = {
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  deepseek: 'https://api.deepseek.com/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  'azure-openai': '', // Azure renseigne `apiBase` explicitement
};

export function instantiateProvider(config: ChatProviderConfig): ChatProvider {
  switch (config.kind) {
    case 'openai':
      return createOpenAIAdapter(config, { kind: 'openai' });
    case 'gemini':
      return createGeminiAdapter(config);
    case 'anthropic':
      return createAnthropicAdapter(config);
    case 'mistral':
      return createMistralAdapter(config);
    case 'qwen':
    case 'deepseek':
    case 'zhipu':
      return createOpenAIAdapter(
        { ...config, apiBase: config.apiBase ?? OPENAI_COMPAT_BASE_URLS[config.kind] },
        { kind: config.kind, defaultApiBase: OPENAI_COMPAT_BASE_URLS[config.kind] },
      );
    case 'azure-openai':
      // Azure : on requiert que `apiBase` soit fourni explicitement
      // (https://<resource>.openai.azure.com/openai/deployments/<deployment>).
      return createOpenAIAdapter(config, { kind: 'azure-openai' });
    case 'ollama':
      return createOllamaAdapter(config);
    default: {
      const _exhaustive: never = config.kind;
      throw new Error(`Unknown provider kind: ${_exhaustive as string}`);
    }
  }
}
