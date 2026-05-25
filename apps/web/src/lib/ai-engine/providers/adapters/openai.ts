import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type {
  ProviderCallResult,
  ProviderConfig,
  TextGenParams,
  TextGenResult,
  ImageGenParams,
  ImageGenResult,
  EmbeddingParams,
  TtsParams,
  TtsResult,
} from '../types';
import { ProviderError } from '../types';
import { ProviderAdapter } from './base';

export class OpenAIAdapter extends ProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async generateText(
    params: TextGenParams,
  ): Promise<ProviderCallResult<TextGenResult>> {
    const start = Date.now();

    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(async () => {
        const llm = new ChatOpenAI({
          model: params.model,
          temperature: params.temperature ?? 0.7,
          maxTokens: params.maxTokens,
          openAIApiKey: this.getApiKey(),
          stop: params.stop,
        });

        const messages = this.buildMessages(params);

        let text: string;
        let structured: unknown | undefined;
        let inputTokens = 0;
        let outputTokens = 0;

        if (params.structuredOutput) {
          const structuredLlm = llm.withStructuredOutput(
            params.structuredOutput,
          );
          const result = await structuredLlm.invoke(messages);
          structured = result;
          text = JSON.stringify(result);
        } else {
          const result = await llm.invoke(messages);
          text = typeof result.content === 'string' ? result.content : '';
          inputTokens =
            (result.usage_metadata?.input_tokens as number | undefined) ?? 0;
          outputTokens =
            (result.usage_metadata?.output_tokens as number | undefined) ?? 0;
        }

        if (inputTokens === 0) {
          inputTokens = this.estimateTokens(
            params.messages.map((m) => m.content).join(' '),
          );
        }
        if (outputTokens === 0) {
          outputTokens = this.estimateTokens(text);
        }

        const costCents = this.computeCostCents(
          params.model,
          inputTokens,
          outputTokens,
        );
        this.lastCostCents = costCents;

        return {
          data: { text, structured, finishReason: 'stop' },
          costCents,
          tokensUsed: { input: inputTokens, output: outputTokens },
          latencyMs: Date.now() - start,
          provider: this.name,
          model: params.model,
        };
      }),
    );
  }

  async generateImage(
    params: ImageGenParams,
  ): Promise<ProviderCallResult<ImageGenResult>> {
    const start = Date.now();

    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(async () => {
        const apiKey = this.getApiKey();
        const body: Record<string, unknown> = {
          model: params.model,
          prompt: params.prompt,
          n: params.count ?? 1,
          size: `${params.width ?? 1024}x${params.height ?? 1024}`,
        };

        if (params.quality) body.quality = params.quality;
        if (params.style) body.style = params.style;

        const response = await fetch(
          'https://api.openai.com/v1/images/generations',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          },
        );

        if (!response.ok) {
          const err = await response.text();
          throw new ProviderError(`OpenAI image generation failed: ${err}`, {
            provider: this.name,
            model: params.model,
            retryable: response.status >= 500,
            statusCode: response.status,
          });
        }

        const json = (await response.json()) as {
          data: Array<{ url?: string; b64_json?: string }>;
        };

        const modelConfig = this.config.models.find(
          (m) => m.name === params.model,
        );
        const costCents =
          (modelConfig?.costPerUnit ?? 0) * (params.count ?? 1);
        this.lastCostCents = costCents;

        return {
          data: {
            images: json.data.map((d) => ({
              url: d.url,
              base64: d.b64_json,
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

  async generateEmbedding(
    params: EmbeddingParams,
  ): Promise<ProviderCallResult<number[]>> {
    const start = Date.now();

    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(async () => {
        const embeddings = new OpenAIEmbeddings({
          model: params.model,
          openAIApiKey: this.getApiKey(),
        });

        const vector = await embeddings.embedQuery(params.input);
        const inputTokens = this.estimateTokens(params.input);
        const costCents = this.computeCostCents(params.model, inputTokens, 0);
        this.lastCostCents = costCents;

        return {
          data: vector,
          costCents,
          tokensUsed: { input: inputTokens, output: 0 },
          latencyMs: Date.now() - start,
          provider: this.name,
          model: params.model,
        };
      }),
    );
  }

  override async textToSpeech(
    params: TtsParams,
  ): Promise<ProviderCallResult<TtsResult>> {
    const start = Date.now();

    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(async () => {
        const apiKey = this.getApiKey();

        const response = await fetch(
          'https://api.openai.com/v1/audio/speech',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: params.model,
              input: params.text,
              voice: params.voice ?? 'alloy',
              speed: params.speed ?? 1.0,
              response_format: 'mp3',
            }),
          },
        );

        if (!response.ok) {
          const err = await response.text();
          throw new ProviderError(`OpenAI TTS failed: ${err}`, {
            provider: this.name,
            model: params.model,
            retryable: response.status >= 500,
            statusCode: response.status,
          });
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

        const modelConfig = this.config.models.find(
          (m) => m.name === params.model,
        );
        const charCount = params.text.length;
        const costCents =
          ((modelConfig?.costPerUnit ?? 0) / 1_000_000) * charCount;
        this.lastCostCents = costCents;

        return {
          data: { audioBase64, format: 'mp3' },
          costCents,
          tokensUsed: { input: 0, output: 0 },
          latencyMs: Date.now() - start,
          provider: this.name,
          model: params.model,
        };
      }),
    );
  }

  private buildMessages(params: TextGenParams) {
    const messages: Array<HumanMessage | SystemMessage | AIMessage> = [];

    if (params.systemPrompt) {
      messages.push(new SystemMessage(params.systemPrompt));
    }

    for (const msg of params.messages) {
      switch (msg.role) {
        case 'system':
          messages.push(new SystemMessage(msg.content));
          break;
        case 'assistant':
          messages.push(new AIMessage(msg.content));
          break;
        case 'user':
          messages.push(new HumanMessage(msg.content));
          break;
      }
    }

    return messages;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
