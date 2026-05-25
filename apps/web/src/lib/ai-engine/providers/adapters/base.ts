import type {
  ProviderCallResult,
  ProviderCapability,
  ProviderConfig,
  TextGenParams,
  TextGenResult,
  ImageGenParams,
  ImageGenResult,
  EmbeddingParams,
  VideoGenParams,
  VideoGenResult,
  TtsParams,
  TtsResult,
  MusicGenParams,
  MusicGenResult,
} from '../types';
import { NotImplementedError } from '../types';
import { CircuitBreaker } from '../circuit-breaker';
import { RetryPolicy } from '../retry';

export abstract class ProviderAdapter {
  public readonly config: ProviderConfig;
  protected readonly circuitBreaker: CircuitBreaker;
  protected readonly retryPolicy: RetryPolicy;
  private _lastCostCents = 0;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    this.retryPolicy = new RetryPolicy();
  }

  get name(): string {
    return this.config.name;
  }

  get capabilities(): ProviderCapability[] {
    return this.config.capabilities;
  }

  get lastCostCents(): number {
    return this._lastCostCents;
  }

  protected set lastCostCents(value: number) {
    this._lastCostCents = value;
  }

  abstract generateText(
    params: TextGenParams,
  ): Promise<ProviderCallResult<TextGenResult>>;

  abstract generateImage(
    params: ImageGenParams,
  ): Promise<ProviderCallResult<ImageGenResult>>;

  abstract generateEmbedding(
    params: EmbeddingParams,
  ): Promise<ProviderCallResult<number[]>>;

  generateVideo(
    _params: VideoGenParams,
  ): Promise<ProviderCallResult<VideoGenResult>> {
    throw new NotImplementedError('generateVideo', this.name);
  }

  textToSpeech(
    _params: TtsParams,
  ): Promise<ProviderCallResult<TtsResult>> {
    throw new NotImplementedError('textToSpeech', this.name);
  }

  generateMusic(
    _params: MusicGenParams,
  ): Promise<ProviderCallResult<MusicGenResult>> {
    throw new NotImplementedError('generateMusic', this.name);
  }

  protected computeCostCents(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const modelConfig = this.config.models.find((m) => m.name === model);
    if (!modelConfig) return 0;

    const inputCost =
      ((modelConfig.costPer1MInput ?? 0) / 1_000_000) * inputTokens;
    const outputCost =
      ((modelConfig.costPer1MOutput ?? 0) / 1_000_000) * outputTokens;

    return inputCost + outputCost;
  }

  protected getApiKey(): string {
    const key = process.env[this.config.apiKeyEnvVar];
    if (!key) {
      throw new Error(
        `Missing API key: environment variable ${this.config.apiKeyEnvVar} is not set`,
      );
    }
    return key;
  }
}
