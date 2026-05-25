import { ChatAnthropic } from '@langchain/anthropic';
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
import { NotImplementedError } from '../types';
import { ProviderAdapter } from './base';

export class AnthropicAdapter extends ProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async generateText(
    params: TextGenParams,
  ): Promise<ProviderCallResult<TextGenResult>> {
    const start = Date.now();

    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(async () => {
        const llm = new ChatAnthropic({
          model: params.model,
          temperature: params.temperature ?? 0.7,
          maxTokens: params.maxTokens ?? 4096,
          anthropicApiKey: this.getApiKey(),
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

  async generateTextWithVision(
    params: TextGenParams & { imageUrls: string[] },
  ): Promise<ProviderCallResult<TextGenResult>> {
    const start = Date.now();

    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(async () => {
        const llm = new ChatAnthropic({
          model: params.model,
          temperature: params.temperature ?? 0.7,
          maxTokens: params.maxTokens ?? 4096,
          anthropicApiKey: this.getApiKey(),
        });

        const content: Array<
          | { type: 'text'; text: string }
          | { type: 'image_url'; image_url: { url: string } }
        > = [];

        for (const url of params.imageUrls) {
          content.push({ type: 'image_url', image_url: { url } });
        }

        const lastUserMsg = [...params.messages].reverse().find((m) => m.role === 'user');
        if (lastUserMsg) {
          content.push({ type: 'text', text: lastUserMsg.content });
        }

        const messages: Array<HumanMessage | SystemMessage> = [];
        if (params.systemPrompt) {
          messages.push(new SystemMessage(params.systemPrompt));
        }
        messages.push(new HumanMessage({ content }));

        const result = await llm.invoke(messages);
        const text =
          typeof result.content === 'string' ? result.content : '';
        const inputTokens =
          (result.usage_metadata?.input_tokens as number | undefined) ?? 0;
        const outputTokens =
          (result.usage_metadata?.output_tokens as number | undefined) ?? 0;

        const costCents = this.computeCostCents(
          params.model,
          inputTokens,
          outputTokens,
        );
        this.lastCostCents = costCents;

        return {
          data: { text, finishReason: 'stop' },
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
    _params: ImageGenParams,
  ): Promise<ProviderCallResult<ImageGenResult>> {
    throw new NotImplementedError('generateImage', this.name);
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
