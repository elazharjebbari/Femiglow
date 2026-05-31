/**
 * Factory `chatProviderFactory` — entité `chat_provider_config`.
 *
 * Référence schema : `apps/web/src/lib/chat/db/schema.ts:94`
 *
 * Traits par provider :
 *  - `openai()`, `anthropic()`, `gemini()`, `mistral()`, `ollama()`,
 *    `qwen()`, `deepseek()`, `zhipu()`, `azureOpenai()`
 *
 * Traits d'état :
 *  - `enabled()`, `disabled()`, `quotaExceeded()`
 */
import { defineFactory, testId } from './base';

export type ProviderKind =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'mistral'
  | 'qwen'
  | 'deepseek'
  | 'zhipu'
  | 'ollama'
  | 'azure-openai';

export interface ChatProviderConfigLike {
  id: string;
  kind: ProviderKind;
  role: 'chat' | 'embedding' | 'moderation';
  model: string;
  priority: number;
  enabled: boolean;
  apiKeyEncrypted: string;
  apiKeyAlias: string | null;
  endpointOverride: string | null;
  parameters: Record<string, unknown>;
  quotaMonthlyEur: number;
  quotaUsedEur: number;
  quotaResetAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const baseChatProviderFactory = defineFactory<ChatProviderConfigLike>(() => {
  const now = new Date();
  return {
    id: testId('cp'),
    kind: 'openai',
    role: 'chat',
    model: 'gpt-4o-mini',
    priority: 1,
    enabled: true,
    apiKeyEncrypted: 'enc::test-key::iv::tag',
    apiKeyAlias: null,
    endpointOverride: null,
    parameters: { temperature: 0.7, maxTokens: 220 },
    quotaMonthlyEur: 100,
    quotaUsedEur: 0,
    quotaResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    createdAt: now,
    updatedAt: now,
  };
});

function withKind(kind: ProviderKind, model: string) {
  return (overrides: Partial<ChatProviderConfigLike> = {}) =>
    baseChatProviderFactory.build({ kind, model, ...overrides });
}

export const chatProviderFactory = {
  ...baseChatProviderFactory,
  openai: withKind('openai', 'gpt-4o-mini'),
  anthropic: withKind('anthropic', 'claude-haiku-4-5'),
  gemini: withKind('gemini', 'gemini-2.0-flash'),
  mistral: withKind('mistral', 'mistral-small-latest'),
  qwen: withKind('qwen', 'qwen-turbo'),
  deepseek: withKind('deepseek', 'deepseek-chat'),
  zhipu: withKind('zhipu', 'glm-4'),
  ollama: withKind('ollama', 'llama3.1:8b'),
  azureOpenai: withKind('azure-openai', 'gpt-4o-mini'),

  enabled: (overrides: Partial<ChatProviderConfigLike> = {}) =>
    baseChatProviderFactory.build({ enabled: true, ...overrides }),
  disabled: (overrides: Partial<ChatProviderConfigLike> = {}) =>
    baseChatProviderFactory.build({ enabled: false, ...overrides }),
  quotaExceeded: (overrides: Partial<ChatProviderConfigLike> = {}) =>
    baseChatProviderFactory.build({
      quotaUsedEur: 100,
      quotaMonthlyEur: 100,
      ...overrides,
    }),
};
