import { z } from 'zod';

export const ProviderCapability = z.enum([
  'text',
  'image',
  'video',
  'tts',
  'stt',
  'embedding',
  'music',
  'moderation',
  'vision',
]);
export type ProviderCapability = z.infer<typeof ProviderCapability>;

export const ProviderHealth = z.enum(['healthy', 'degraded', 'unhealthy']);
export type ProviderHealth = z.infer<typeof ProviderHealth>;

export const ProviderType = z.enum([
  'openai',
  'anthropic',
  'google',
  'ollama',
  'elevenlabs',
  'runway',
  'stability',
]);
export type ProviderType = z.infer<typeof ProviderType>;

export const ModelConfig = z.object({
  name: z.string(),
  capability: ProviderCapability,
  costPer1MInput: z.number().optional(),
  costPer1MOutput: z.number().optional(),
  costPerUnit: z.number().optional(),
  maxTokens: z.number().optional(),
  supportsStructuredOutput: z.boolean().optional(),
  supportsVision: z.boolean().optional(),
});
export type ModelConfig = z.infer<typeof ModelConfig>;

export const CircuitBreakerConfig = z.object({
  failureThreshold: z.number().int().positive().default(5),
  resetTimeoutMs: z.number().int().positive().default(60_000),
  halfOpenMaxCalls: z.number().int().positive().default(1),
});
export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfig>;

export const ProviderConfig = z.object({
  id: z.string(),
  type: ProviderType,
  name: z.string(),
  apiKeyEnvVar: z.string(),
  baseUrl: z.string().url().optional(),
  capabilities: z.array(ProviderCapability),
  models: z.array(ModelConfig),
  rateLimitRpm: z.number().int().positive(),
  dailyBudgetCents: z.number().nonnegative(),
  circuitBreaker: CircuitBreakerConfig.default({}),
  priority: z.number().int(),
  isFallback: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  healthStatus: ProviderHealth.default('healthy'),
});
export type ProviderConfig = z.infer<typeof ProviderConfig>;

export interface ProviderCallResult<T> {
  data: T;
  costCents: number;
  tokensUsed: { input: number; output: number };
  latencyMs: number;
  provider: string;
  model: string;
}

export class ProviderError extends Error {
  public readonly provider: string;
  public readonly model: string;
  public readonly retryable: boolean;
  public readonly statusCode: number | undefined;

  constructor(
    message: string,
    opts: {
      provider: string;
      model: string;
      retryable?: boolean;
      statusCode?: number;
      cause?: unknown;
    },
  ) {
    super(message, { cause: opts.cause });
    this.name = 'ProviderError';
    this.provider = opts.provider;
    this.model = opts.model;
    this.retryable = opts.retryable ?? false;
    this.statusCode = opts.statusCode;
  }
}

export class NoProviderAvailableError extends Error {
  constructor(
    public readonly capability: ProviderCapability,
    public readonly node: string,
  ) {
    super(
      `No provider available for capability "${capability}" in node "${node}"`,
    );
    this.name = 'NoProviderAvailableError';
  }
}

export class NotImplementedError extends Error {
  constructor(method: string, provider: string) {
    super(`${method} is not implemented by provider "${provider}"`);
    this.name = 'NotImplementedError';
  }
}

export interface TextGenParams {
  model: string;
  systemPrompt?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  structuredOutput?: z.ZodType;
  stop?: string[];
}

export interface TextGenResult {
  text: string;
  structured?: unknown;
  finishReason: string;
}

export interface ImageGenParams {
  model: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  count?: number;
  quality?: 'standard' | 'hd';
  style?: string;
}

export interface ImageGenResult {
  images: Array<{ url?: string; base64?: string }>;
}

export interface EmbeddingParams {
  model: string;
  input: string;
}

export interface VideoGenParams {
  model: string;
  prompt: string;
  imageUrl?: string;
  durationSeconds?: number;
}

export interface VideoGenResult {
  videoUrl: string;
}

export interface TtsParams {
  model: string;
  text: string;
  voice?: string;
  speed?: number;
}

export interface TtsResult {
  audioBase64: string;
  format: string;
}

export interface MusicGenParams {
  model: string;
  prompt: string;
  durationSeconds?: number;
}

export interface MusicGenResult {
  audioUrl: string;
}
