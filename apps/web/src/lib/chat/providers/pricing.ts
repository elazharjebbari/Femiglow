/**
 * Tarification approximative des modèles utilisés (EUR / 1k tokens).
 *
 * À tenir à jour depuis docs/chat-assistant/10-providers-models.md.
 * Si un modèle est absent, on retourne `null` → coût non-calculable.
 */

interface ModelPrice {
  inputEur: number;
  outputEur: number;
  embedEur?: number;
}

const TABLE: Record<string, ModelPrice> = {
  // OpenAI (USD → EUR ≈ 0.92)
  'gpt-4o': { inputEur: 0.0023, outputEur: 0.0092 },
  'gpt-4o-mini': { inputEur: 0.00014, outputEur: 0.00055 },
  'gpt-4.1-mini': { inputEur: 0.00037, outputEur: 0.00147 },
  'text-embedding-3-small': { inputEur: 0, outputEur: 0, embedEur: 0.0000184 },
  'text-embedding-3-large': { inputEur: 0, outputEur: 0, embedEur: 0.00012 },
  // Gemini
  'gemini-1.5-flash': { inputEur: 0.00007, outputEur: 0.00027 },
  'gemini-1.5-pro': { inputEur: 0.00115, outputEur: 0.00459 },
  // Anthropic
  'claude-3-5-sonnet-20241022': { inputEur: 0.00276, outputEur: 0.01378 },
  'claude-3-5-haiku-20241022': { inputEur: 0.00073, outputEur: 0.00367 },
  // Mistral
  'mistral-small-latest': { inputEur: 0.00018, outputEur: 0.00055 },
  'mistral-large-latest': { inputEur: 0.00184, outputEur: 0.00551 },
  // OpenAI-compatible (Qwen, DeepSeek, Zhipu) — ordres de grandeur
  'qwen2.5-72b-instruct': { inputEur: 0.00037, outputEur: 0.00111 },
  'deepseek-chat': { inputEur: 0.00012, outputEur: 0.00026 },
  'glm-4-air': { inputEur: 0.00008, outputEur: 0.00008 },
};

export function estimateCostEur(
  modelName: string,
  tokensIn: number,
  tokensOut: number,
): number | null {
  const p = TABLE[modelName];
  if (!p) return null;
  return (tokensIn / 1000) * p.inputEur + (tokensOut / 1000) * p.outputEur;
}

export function estimateEmbedCostEur(modelName: string, tokensIn: number): number | null {
  const p = TABLE[modelName];
  if (!p?.embedEur) return null;
  return (tokensIn / 1000) * p.embedEur;
}
