# 10 — Providers & modèles

> *Adapter pattern, OpenAI / Gemini / Anthropic / Mistral / Qwen / DeepSeek / Ollama, fallback*

---

## 1. Pourquoi *model-agnostic*

| Raison                                | Conséquence                                                        |
| ------------------------------------- | ------------------------------------------------------------------ |
| Évolution rapide des modèles          | Pouvoir changer en < 1 jour sans toucher au code applicatif        |
| Conformité / souveraineté             | Pouvoir router vers un provider local (Ollama) si besoin           |
| Réduction des coûts                   | A/B sur modèles équivalents en qualité, choisir le moins cher       |
| Résilience                            | Fallback automatique entre providers en cas d'incident              |
| Spécialisation par tâche              | Chat sur OpenAI, embeddings sur Gemini, modération sur OpenAI       |
| Marchés                               | Pour la darija, certains modèles régionaux peuvent surpasser GPT    |

## 2. Contrat `ChatProvider`

```ts
// lib/chat/providers/types.ts
import type { Runnable } from '@langchain/core/runnables';

export interface ChatProvider {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly chatModel?: string;
  readonly embeddingModel?: string;

  /** appel non-streamé (utile tests, sandbox) */
  chat(input: ChatInput, opts?: ChatOpts): Promise<ChatOutput>;

  /** appel streamé — itérable AsyncIterable<token> */
  streamChat(input: ChatInput, opts?: ChatOpts): AsyncIterable<ChatStreamEvent>;

  /** runnable LangChain équivalent (pour composition) */
  runnable: Runnable<ChatInput, string>;

  /** embeddings d'un batch de textes */
  embed(texts: string[]): Promise<number[][]>;

  /** modération du texte d'entrée */
  moderate?(text: string): Promise<ModerationResult>;

  /** ping santé */
  ping(): Promise<{ ok: boolean; latencyMs: number }>;
}

export type ChatInput = {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  language: 'fr' | 'ar' | 'ar-MA';
};

export type ChatOpts = {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stop?: string[];
  signal?: AbortSignal;
  trace?: { sessionId: string; messageId: string };
};

export type ChatStreamEvent =
  | { type: 'token'; data: string }
  | { type: 'tool_call'; data: { name: string; args: unknown } }
  | { type: 'meta'; data: { tokensIn?: number; tokensOut?: number; finishReason?: string } };
```

## 3. Sélection automatique des modèles

Quand un `ChatProvider` est instancié, son `kind` détermine le SDK
utilisé. La fabrique :

```ts
// lib/chat/providers/factory.ts
import { OpenAIChatProvider } from './openai';
import { GeminiChatProvider } from './gemini';
import { AnthropicChatProvider } from './anthropic';
import { MistralChatProvider } from './mistral';
import { QwenChatProvider } from './qwen';
import { DeepseekChatProvider } from './deepseek';
import { OllamaChatProvider } from './ollama';
import { ZhipuChatProvider } from './zhipu';
import { AzureOpenAIChatProvider } from './azure-openai';

export function instantiateProvider(cfg: ChatProviderConfig): ChatProvider {
  switch (cfg.kind) {
    case 'openai':       return new OpenAIChatProvider(cfg);
    case 'azure-openai': return new AzureOpenAIChatProvider(cfg);
    case 'gemini':       return new GeminiChatProvider(cfg);
    case 'anthropic':    return new AnthropicChatProvider(cfg);
    case 'mistral':      return new MistralChatProvider(cfg);
    case 'qwen':         return new QwenChatProvider(cfg);
    case 'deepseek':     return new DeepseekChatProvider(cfg);
    case 'zhipu':        return new ZhipuChatProvider(cfg);
    case 'ollama':       return new OllamaChatProvider(cfg);
  }
}
```

## 4. Implémentation type — OpenAI

```ts
// lib/chat/providers/openai.ts
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

export class OpenAIChatProvider implements ChatProvider {
  readonly id: string;
  readonly kind = 'openai' as const;
  readonly chatModel?: string;
  readonly embeddingModel?: string;
  private chatLLM: ChatOpenAI;
  private embedder: OpenAIEmbeddings;

  constructor(cfg: ChatProviderConfig) {
    this.id = cfg.id;
    this.chatModel = cfg.chatModel ?? 'gpt-4o-mini';
    this.embeddingModel = cfg.embeddingModel ?? 'text-embedding-3-small';
    const apiKey = decryptKey(cfg.apiKeyEncrypted, cfg.apiKeyIv);

    this.chatLLM = new ChatOpenAI({
      model: this.chatModel,
      apiKey,
      configuration: cfg.apiBase ? { baseURL: cfg.apiBase } : undefined,
      temperature: cfg.parameters?.temperature ?? 0.4,
      topP: cfg.parameters?.topP,
      maxTokens: cfg.parameters?.maxTokens ?? 600,
      timeout: cfg.parameters?.timeoutMs ?? 8000,
      streaming: true,
    });

    this.embedder = new OpenAIEmbeddings({ model: this.embeddingModel, apiKey });
  }

  get runnable() {
    return this.chatLLM;
  }

  async chat(input, opts) {
    const res = await this.chatLLM.invoke(input.messages, opts);
    return { content: res.content as string };
  }

  async *streamChat(input, opts) {
    const stream = await this.chatLLM.stream(input.messages, opts);
    let tokensIn: number | undefined;
    let tokensOut = 0;
    for await (const ch of stream) {
      const text = ch.content as string;
      if (text) {
        yield { type: 'token', data: text };
        tokensOut += approxTokens(text);
      }
    }
    yield { type: 'meta', data: { tokensIn, tokensOut, finishReason: 'stop' } };
  }

  async embed(texts) {
    return this.embedder.embedDocuments(texts);
  }

  async moderate(text) {
    // usage SDK direct via fetch — endpoint /v1/moderations
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
    });
    const json = await res.json();
    return { flagged: json.results[0].flagged, categories: Object.entries(json.results[0].categories).filter(([,v]) => v).map(([k]) => k) };
  }

  async ping() {
    const t0 = performance.now();
    await this.chatLLM.invoke([{ role: 'user', content: 'pong' }], { maxTokens: 5 });
    return { ok: true, latencyMs: Math.round(performance.now() - t0) };
  }
}
```

> Le SDK officiel OpenAI v5 est aussi compatible LangChain via
> `@langchain/openai`. On reste sur la lib LangChain pour la
> cohérence streaming.

## 5. Provider Gemini

```ts
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

export class GeminiChatProvider implements ChatProvider {
  // ...
  constructor(cfg: ChatProviderConfig) {
    this.chatLLM = new ChatGoogleGenerativeAI({
      model: cfg.chatModel ?? 'gemini-1.5-flash',
      apiKey: decryptKey(cfg.apiKeyEncrypted, cfg.apiKeyIv),
      temperature: cfg.parameters?.temperature ?? 0.4,
      maxOutputTokens: cfg.parameters?.maxTokens ?? 600,
      streaming: true,
    });
    this.embedder = new GoogleGenerativeAIEmbeddings({
      apiKey: decryptKey(cfg.apiKeyEncrypted, cfg.apiKeyIv),
      model: cfg.embeddingModel ?? 'text-embedding-004',
    });
  }
  // ...
}
```

Notes :
- Gemini 1.5 supporte un contexte long (1M tokens), utile pour
  RAG large.
- `gemini-1.5-flash` est très bon marché.

## 6. Provider Anthropic

```ts
import { ChatAnthropic } from '@langchain/anthropic';

export class AnthropicChatProvider implements ChatProvider {
  constructor(cfg) {
    this.chatLLM = new ChatAnthropic({
      model: cfg.chatModel ?? 'claude-haiku-4-5-20251001',
      apiKey: decryptKey(cfg.apiKeyEncrypted, cfg.apiKeyIv),
      temperature: cfg.parameters?.temperature ?? 0.4,
      maxTokens: cfg.parameters?.maxTokens ?? 600,
      streaming: true,
    });
    // Anthropic ne fournit pas d'embedding natif — fallback obligatoire
  }
  async embed(): Promise<never> { throw new Error('Anthropic does not provide embeddings'); }
}
```

> Anthropic est une bonne option chat secondaire (excellent FR,
> bonne darija, prudent par défaut). Pas d'embeddings → le rôle
> `embedding` doit cibler un autre provider.

## 7. Provider Qwen / DeepSeek / Zhipu (modèles chinois)

Tous compatibles OpenAI-API via leurs endpoints respectifs. On
réutilise un adapter OpenAI-compatible :

```ts
// lib/chat/providers/openai-compatible.ts
export class OpenAICompatibleChatProvider implements ChatProvider {
  constructor(cfg, defaults: { chatModel: string; embeddingModel?: string; apiBase: string }) {
    this.chatLLM = new ChatOpenAI({
      model: cfg.chatModel ?? defaults.chatModel,
      apiKey: decryptKey(cfg.apiKeyEncrypted, cfg.apiKeyIv),
      configuration: { baseURL: cfg.apiBase ?? defaults.apiBase },
      // ...
    });
  }
}

export class QwenChatProvider extends OpenAICompatibleChatProvider {
  constructor(cfg) {
    super(cfg, {
      chatModel: 'qwen2.5-7b-instruct',
      embeddingModel: 'text-embedding-v3',
      apiBase: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    });
  }
}

export class DeepseekChatProvider extends OpenAICompatibleChatProvider {
  constructor(cfg) {
    super(cfg, {
      chatModel: 'deepseek-chat',
      apiBase: 'https://api.deepseek.com/v1',
    });
  }
}

export class ZhipuChatProvider extends OpenAICompatibleChatProvider {
  constructor(cfg) {
    super(cfg, {
      chatModel: 'glm-4-flash',
      apiBase: 'https://open.bigmodel.cn/api/paas/v4',
    });
  }
}
```

Politique de transit : ces providers acheminent leurs requêtes
hors UE / hors Maroc. **Drapeau `egress_allowed = false` par défaut**
pour éviter d'envoyer des PII non redactées sans décision admin
explicite.

## 8. Provider Ollama (local)

Pour développement local + scénario souveraineté.

```ts
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';

export class OllamaChatProvider implements ChatProvider {
  constructor(cfg) {
    this.chatLLM = new ChatOllama({
      baseUrl: cfg.apiBase ?? 'http://localhost:11434',
      model: cfg.chatModel ?? 'llama3.1:8b',
      temperature: cfg.parameters?.temperature ?? 0.4,
    });
    this.embedder = new OllamaEmbeddings({
      baseUrl: cfg.apiBase ?? 'http://localhost:11434',
      model: cfg.embeddingModel ?? 'nomic-embed-text',
    });
  }
}
```

Idéal en local (`pnpm dev`) pour itérer sans coût.

## 9. Provider Mistral

```ts
import { ChatMistralAI, MistralAIEmbeddings } from '@langchain/mistralai';

export class MistralChatProvider implements ChatProvider {
  constructor(cfg) {
    this.chatLLM = new ChatMistralAI({
      model: cfg.chatModel ?? 'mistral-small-latest',
      apiKey: decryptKey(cfg.apiKeyEncrypted, cfg.apiKeyIv),
      temperature: cfg.parameters?.temperature ?? 0.4,
      maxTokens: cfg.parameters?.maxTokens ?? 600,
    });
    this.embedder = new MistralAIEmbeddings({
      model: cfg.embeddingModel ?? 'mistral-embed',
      apiKey: decryptKey(cfg.apiKeyEncrypted, cfg.apiKeyIv),
    });
  }
}
```

## 10. Provider Azure OpenAI

```ts
export class AzureOpenAIChatProvider implements ChatProvider {
  constructor(cfg) {
    this.chatLLM = new ChatOpenAI({
      model: cfg.chatModel,                    // ici le nom du déploiement Azure
      apiKey: decryptKey(cfg.apiKeyEncrypted, cfg.apiKeyIv),
      configuration: {
        baseURL: cfg.apiBase, // https://<resource>.openai.azure.com/openai/deployments
        defaultQuery: { 'api-version': '2024-08-01-preview' },
        defaultHeaders: { 'api-key': decryptKey(cfg.apiKeyEncrypted, cfg.apiKeyIv) },
      },
    });
  }
}
```

## 11. Politique de fallback

```ts
// lib/chat/router.ts
export const providerRouter = {
  async choose({ role, session }) {
    const cfgs = await providerRepo.activeByRole(role);
    for (const cfg of cfgs.sort((a, b) => a.priority - b.priority)) {
      if (circuitBreaker.isOpen(cfg.id)) continue;
      if (await quota.exceeded(cfg.id)) continue;
      if (session?.experiment) {
        const variant = chooseVariant(session, cfg);
        if (!variant.matches) continue;
      }
      const provider = registry.get(cfg.id) ?? registry.set(cfg.id, instantiateProvider(cfg));
      return provider;
    }
    return offlineProvider;
  },
};
```

### 11.1 Circuit-breaker

```ts
// lib/chat/circuit.ts
const errors = new Map<string, number[]>();
const openUntil = new Map<string, number>();

export const circuitBreaker = {
  recordError(id) {
    const arr = errors.get(id) ?? [];
    arr.push(Date.now());
    errors.set(id, arr.filter(t => Date.now() - t < 60_000));
    if (arr.length >= 3) openUntil.set(id, Date.now() + 5 * 60_000);
  },
  recordSuccess(id) {
    errors.delete(id);
    openUntil.delete(id);
  },
  isOpen(id) {
    return (openUntil.get(id) ?? 0) > Date.now();
  },
};
```

### 11.2 Quota

```ts
export const quota = {
  async exceeded(providerId) {
    const cfg = await providerRepo.get(providerId);
    if (!cfg.quotaMonthlyEur) return false;
    return Number(cfg.consumedMonthEur) >= Number(cfg.quotaMonthlyEur);
  },
};
```

## 12. Coût et facturation

Chaque message persiste son **coût exact** estimé :

```ts
// lib/chat/billing.ts
export const billing = {
  estimate(provider, tokensIn, tokensOut): number {
    const tariff = TARIFFS[provider.kind][provider.chatModel];
    return tokensIn * tariff.in / 1000 + tokensOut * tariff.out / 1000;
  },
  async charge(providerId, eur) {
    await db.update(chatProviderConfig)
      .set({ consumedMonthEur: sql`consumed_month_eur + ${eur}` })
      .where(eq(chatProviderConfig.id, providerId));
  },
};
```

Une table de tarifs `lib/chat/tariffs.ts` est tenue à jour
manuellement par l'admin (ou Phase 2 par scrape automatique).

## 13. Sécurité

- Les clés sont **chiffrées AES-256-GCM** dans la base avec une
  clé maître stockée en variable d'environnement
  `CHAT_PROVIDER_KEY` (32 bytes base64).
- La clé maître peut être tournée : `pnpm tsx scripts/chat-rotate-keys.ts`.
- En GET admin, la clé est masquée (`••••••••` + 4 derniers
  caractères). L'écriture demande la clé complète.
- Aucune clé en log, aucune clé en erreur, aucune clé en réponse.
- Le `egress_allowed = false` empêche tout appel sortant tant que
  l'admin n'a pas validé.

## 14. Tests providers

Cf. doc 12. Trois étages :

- **Unit** : adapter parse correctement les paramètres, sérialise
  bien les messages.
- **Integration MSW** : réponses mockées par provider (succès,
  4xx, 5xx, timeout, stream interrompu) — un fichier d'handlers
  par provider.
- **Contract test** (optionnel, gated) : appel réel sur sandbox /
  clé de test, exécuté manuellement.

## 15. Ajout d'un provider — runbook

Pour ajouter un nouveau provider :

1. Créer `lib/chat/providers/<name>.ts` qui implémente `ChatProvider`.
2. Ajouter le `kind` à l'enum Drizzle (migration).
3. Étendre la fabrique `factory.ts`.
4. Ajouter la tarif dans `tariffs.ts`.
5. Ajouter handlers MSW dans `test/msw/providers/<name>.ts`.
6. Ajouter une story Storybook montrant le panneau provider
   admin pour ce kind.
7. Ajouter au runbook (cf. doc 16).

Cible : **< 1 jour** par provider.

## 16. Lecture suivante

- [03 — Backend](03-backend.md) pour l'invocation depuis l'orchestrateur.
- [09 — RAG](09-knowledge-base-rag.md) pour les embeddings.
- [16 — Runbook](16-runbook.md) pour la procédure d'ajout pas-à-pas.
