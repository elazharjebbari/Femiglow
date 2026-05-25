import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type {
  ProviderCallResult,
  ProviderConfig,
  TextGenParams,
  TextGenResult,
  ImageGenParams,
  ImageGenResult,
  EmbeddingParams,
} from '../types';
import { ProviderError, NotImplementedError } from '../types';
import { ProviderAdapter } from './base';

export class GoogleAdapter extends ProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async generateText(
    params: TextGenParams,
  ): Promise<ProviderCallResult<TextGenResult>> {
    const start = Date.now();

    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(async () => {
        const llm = new ChatGoogleGenerativeAI({
          model: params.model,
          temperature: params.temperature ?? 0.7,
          maxOutputTokens: params.maxTokens,
          apiKey: this.getApiKey(),
          stopSequences: params.stop,
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

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${params.model}:predict?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instances: [{ prompt: params.prompt }],
              parameters: {
                sampleCount: params.count ?? 1,
                aspectRatio:
                  params.width && params.height
                    ? `${params.width}:${params.height}`
                    : undefined,
              },
            }),
          },
        );

        if (!response.ok) {
          const err = await response.text();
          throw new ProviderError(
            `Google Imagen generation failed: ${err}`,
            {
              provider: this.name,
              model: params.model,
              retryable: response.status >= 500,
              statusCode: response.status,
            },
          );
        }

        const json = (await response.json()) as {
          predictions: Array<{ bytesBase64Encoded: string }>;
        };

        const modelConfig = this.config.models.find(
          (m) => m.name === params.model,
        );
        const costCents =
          (modelConfig?.costPerUnit ?? 0) * (params.count ?? 1);
        this.lastCostCents = costCents;

        return {
          data: {
            images: json.predictions.map((p) => ({
              base64: p.bytesBase64Encoded,
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
    _params: EmbeddingParams,
  ): Promise<ProviderCallResult<number[]>> {
    throw new NotImplementedError('generateEmbedding', this.name);
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
