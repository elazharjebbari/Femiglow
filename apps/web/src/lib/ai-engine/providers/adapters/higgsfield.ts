import type {
  ProviderCallResult,
  ProviderConfig,
  TextGenParams,
  TextGenResult,
  ImageGenParams,
  ImageGenResult,
  EmbeddingParams,
  VideoGenParams,
  VideoGenResult,
} from '../types';
import { ProviderError, NotImplementedError } from '../types';
import { ProviderAdapter } from './base';

export class HiggsFieldAdapter extends ProviderAdapter {
  private static readonly BASE_URL = 'https://api.higgsfield.ai/v1';
  private static readonly POLL_INTERVAL_MS = 5_000;
  private static readonly POLL_TIMEOUT_MS = 300_000;
  private static readonly REQUEST_TIMEOUT_MS = 30_000;

  constructor(config: ProviderConfig) {
    super(config);
  }

  // ---------------------------------------------------------------------------
  // Image generation (synchronous)
  // ---------------------------------------------------------------------------

  async generateImage(
    params: ImageGenParams,
  ): Promise<ProviderCallResult<ImageGenResult>> {
    const start = Date.now();

    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(async () => {
        const apiKey = this.getApiKey();
        const baseUrl = this.getBaseUrl();

        const body: Record<string, unknown> = {
          model: params.model,
          prompt: params.prompt,
          num_images: params.count ?? 1,
          width: params.width ?? 1024,
          height: params.height ?? 1024,
        };

        if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
        if (params.quality) body.quality = params.quality;
        if (params.style) body.style = params.style;

        const response = await fetch(`${baseUrl}/images/generate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(HiggsFieldAdapter.REQUEST_TIMEOUT_MS),
        });

        if (!response.ok) {
          const errText = await response
            .text()
            .catch(() => `${response.status}`);
          throw this.mapHttpError(
            response.status,
            errText,
            params.model,
            'image generation',
          );
        }

        const json = (await response.json()) as {
          images: Array<{ url?: string; base64?: string }>;
        };

        const modelConfig = this.config.models.find(
          (m) => m.name === params.model,
        );
        const costCents =
          (modelConfig?.costPerUnit ?? 0) * (params.count ?? 1);
        this.lastCostCents = costCents;

        return {
          data: {
            images: (json.images ?? []).map((img) => ({
              url: img.url,
              base64: img.base64,
            })),
          },
          costCents,
          tokensUsed: { input: 0, output: 0 },
          latencyMs: Date.now() - start,
          provider: this.name,
          model: params.model,
        };
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Video generation (asynchronous polling)
  // ---------------------------------------------------------------------------

  override async generateVideo(
    params: VideoGenParams,
  ): Promise<ProviderCallResult<VideoGenResult>> {
    const start = Date.now();

    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(async () => {
        const apiKey = this.getApiKey();
        const baseUrl = this.getBaseUrl();

        // --- Step 1: Submit job ---
        const submitBody: Record<string, unknown> = {
          model: params.model,
          prompt: params.prompt,
          duration_seconds: params.durationSeconds ?? 5,
        };

        if (params.imageUrl) submitBody.image_url = params.imageUrl;

        const submitRes = await fetch(`${baseUrl}/videos/generate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submitBody),
          signal: AbortSignal.timeout(HiggsFieldAdapter.REQUEST_TIMEOUT_MS),
        });

        if (!submitRes.ok) {
          const errText = await submitRes
            .text()
            .catch(() => `${submitRes.status}`);
          throw this.mapHttpError(
            submitRes.status,
            errText,
            params.model,
            'video generation submit',
          );
        }

        const submitJson = (await submitRes.json()) as {
          job_id: string;
          status: string;
        };

        // --- Step 2: Poll for completion ---
        const videoUrl = await this.pollVideoStatus(
          baseUrl,
          apiKey,
          submitJson.job_id,
          params.model,
        );

        // --- Step 3: Return result ---
        const modelConfig = this.config.models.find(
          (m) => m.name === params.model,
        );
        const costCents = modelConfig?.costPerUnit ?? 0;
        this.lastCostCents = costCents;

        return {
          data: { videoUrl },
          costCents,
          tokensUsed: { input: 0, output: 0 },
          latencyMs: Date.now() - start,
          provider: this.name,
          model: params.model,
        };
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Not supported
  // ---------------------------------------------------------------------------

  async generateText(
    _params: TextGenParams,
  ): Promise<ProviderCallResult<TextGenResult>> {
    throw new NotImplementedError('generateText', this.name);
  }

  async generateEmbedding(
    _params: EmbeddingParams,
  ): Promise<ProviderCallResult<number[]>> {
    throw new NotImplementedError('generateEmbedding', this.name);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getBaseUrl(): string {
    return (
      this.config.baseUrl?.replace(/\/$/, '') ?? HiggsFieldAdapter.BASE_URL
    );
  }

  private async pollVideoStatus(
    baseUrl: string,
    apiKey: string,
    jobId: string,
    model: string,
  ): Promise<string> {
    const deadline = Date.now() + HiggsFieldAdapter.POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await this.sleep(HiggsFieldAdapter.POLL_INTERVAL_MS);

      const res = await fetch(`${baseUrl}/videos/status/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(HiggsFieldAdapter.REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        // Transient poll failures -- keep trying until deadline
        if (res.status >= 500) continue;
        const errText = await res.text().catch(() => `${res.status}`);
        throw this.mapHttpError(res.status, errText, model, 'video poll');
      }

      const json = (await res.json()) as {
        status: string;
        video_url?: string;
        error?: string;
      };

      switch (json.status) {
        case 'completed':
          if (!json.video_url) {
            throw new ProviderError(
              'Higgsfield video completed but no video_url in response',
              { provider: this.name, model, retryable: false },
            );
          }
          return json.video_url;

        case 'failed':
          throw new ProviderError(
            `Higgsfield video generation failed: ${json.error ?? 'unknown'}`,
            { provider: this.name, model, retryable: false },
          );

        case 'queued':
        case 'processing':
          // Continue polling
          break;

        default:
          // Unknown status -- keep polling
          break;
      }
    }

    throw new ProviderError(
      `Higgsfield video generation timed out after ${HiggsFieldAdapter.POLL_TIMEOUT_MS}ms for job ${jobId}`,
      { provider: this.name, model, retryable: true },
    );
  }

  private mapHttpError(
    status: number,
    body: string,
    model: string,
    operation: string,
  ): ProviderError {
    const retryable = this.isRetryableStatus(status);
    const truncatedBody = body.slice(0, 500);

    return new ProviderError(
      `Higgsfield ${operation} failed (HTTP ${status}): ${truncatedBody}`,
      {
        provider: this.name,
        model,
        retryable,
        statusCode: status,
      },
    );
  }

  private isRetryableStatus(status: number): boolean {
    if (status === 429) return true;
    if (status >= 500) return true;
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
