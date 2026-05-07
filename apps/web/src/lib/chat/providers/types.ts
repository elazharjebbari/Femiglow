/**
 * CHA-020 — Interface `ChatProvider`.
 *
 * Tous les adapters (OpenAI, Gemini, Anthropic, Mistral, Qwen,
 * DeepSeek, Zhipu, Ollama, Azure OpenAI) implémentent cette
 * interface. L'orchestrator ne connaît jamais le provider concret.
 *
 * Conventions :
 * - Streaming via `AsyncIterable<ChatStreamChunk>` (compatible LangChain).
 * - Coût retourné en EUR (`number`), `null` quand inconnu.
 * - Erreurs typées via `ProviderError` pour permettre le fallback.
 *
 * cf. docs/chat-assistant/10-providers-models.md
 */
import type { ChatLanguage, ChatProviderKind } from '../contracts';

// ---------------------------------------------------------------------------
// Messages (format provider-agnostic)
// ---------------------------------------------------------------------------

export interface ChatProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** ID utilisateur opaque (anonymisé) — pour traceability provider. */
  name?: string;
}

// ---------------------------------------------------------------------------
// Inputs & outputs
// ---------------------------------------------------------------------------

export interface ChatStreamRequest {
  messages: ChatProviderMessage[];
  language: ChatLanguage;
  /** Override modèle (sinon `provider.config.chatModel`). */
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  /** Signal d'annulation côté serveur (AbortController.signal). */
  signal?: AbortSignal;
}

export interface ChatStreamChunk {
  /** Token / morceau de texte (peut être vide pour signal control). */
  delta: string;
  /** Set quand connu (généralement seulement sur le dernier chunk). */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';
}

export interface ChatStreamResult {
  /** Texte concaténé après stream. */
  text: string;
  tokensIn: number | null;
  tokensOut: number | null;
  /** Coût en EUR ; `null` si non calculable (Ollama local par ex.). */
  costEur: number | null;
  modelName: string;
}

export interface EmbeddingRequest {
  inputs: string[];
  model?: string;
  signal?: AbortSignal;
}

export interface EmbeddingResult {
  vectors: number[][];
  dim: number;
  tokensIn: number | null;
  costEur: number | null;
  modelName: string;
}

export interface ModerationRequest {
  text: string;
  signal?: AbortSignal;
}

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
  scores?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface ChatProvider {
  readonly id: string;
  readonly kind: ChatProviderKind;
  readonly label: string;

  /** Streaming chat completion. */
  streamChat(req: ChatStreamRequest): Promise<{
    stream: AsyncIterable<ChatStreamChunk>;
    /** Résolu après que `stream` est entièrement consommé. */
    final: () => Promise<ChatStreamResult>;
  }>;

  /** Optionnel : embeddings (rôle `embedding`). */
  embed?(req: EmbeddingRequest): Promise<EmbeddingResult>;

  /** Optionnel : modération (rôle `moderation`). */
  moderate?(req: ModerationRequest): Promise<ModerationResult>;

  /** Ping/health — pour l'admin. Throw `ProviderError` si KO. */
  ping(): Promise<{ ok: boolean; latencyMs: number; modelName?: string }>;
}

// ---------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------

export type ProviderErrorCode =
  | 'auth'
  | 'rate-limit'
  | 'quota-exceeded'
  | 'timeout'
  | 'context-too-large'
  | 'content-filter'
  | 'network'
  | 'invalid-response'
  | 'unknown';

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly providerId: string;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(
    code: ProviderErrorCode,
    message: string,
    opts: { providerId: string; retryable?: boolean; status?: number } = {
      providerId: 'unknown',
    },
  ) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.providerId = opts.providerId;
    this.retryable = opts.retryable ?? (code !== 'auth' && code !== 'content-filter');
    this.status = opts.status;
  }
}

// ---------------------------------------------------------------------------
// Config (clé déchiffrée hydratée)
// ---------------------------------------------------------------------------

export interface ChatProviderConfig {
  id: string;
  kind: ChatProviderKind;
  label: string;
  apiKey?: string;
  apiBase?: string;
  chatModel?: string;
  embeddingModel?: string;
  moderationModel?: string;
  parameters?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    timeoutMs?: number;
  };
  headers?: Record<string, string>;
}
