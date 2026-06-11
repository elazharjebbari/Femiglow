/**
 * CHA-230 Phase 2 — Runnable de classification d'intent.
 *
 * Pipeline 4 étapes (toujours dans cet ordre) :
 *   1. **Regex shortcut** (`regex.score >= REGEX_SHORTCUT_THRESHOLD`) :
 *      le classifieur regex pondéré a déjà un signal très fort
 *      (≥ 1 strong + 1 weak, ou ≥ 2 strong). On évite l'appel LLM
 *      pour économiser ~250 ms et ~50 tokens. Précision empirique
 *      du regex à ce seuil : > 95 %.
 *
 *   2. **LLM tool-call** : OpenAI `chat.completions` avec `tools`
 *      forcé sur `classify_intent(intent, confidence, reason)`. La
 *      réponse est validée par Zod (`intentClassificationSchema`)
 *      qui garantit l'enum d'intent et le cap de 120 chars sur
 *      `reason`. Pas de streaming — single request/response.
 *
 *   3. **OutputFixingParser-pattern** (1 retry max) : si la sortie
 *      LLM ne passe pas Zod, on retente avec l'erreur en prompt.
 *      Équivalent main-rolled du `OutputFixingParser` LangChain —
 *      on évite la dépendance pour rester fetch-native cohérent
 *      avec `providers/openai.ts` & `providers/anthropic.ts`.
 *
 *   4. **Regex fallback** : si tout échoue (timeout, 5xx, retry
 *      Zod KO, no-tool-call, abort signal), on retombe sur le
 *      résultat regex initial. Garantie : ce runnable ne throw
 *      JAMAIS — il dégrade gracieusement vers le regex.
 *
 * Garanties :
 *  - JAMAIS throw — toujours retourne un `ClassifiedIntent`.
 *  - Le `method` indique exactement le chemin pris (utile pour
 *    le quality dashboard CHA-230 Phase 3).
 *  - `regexScore` est toujours conservé (`null` uniquement si
 *    `regex.score === 0`).
 *  - Idempotent et stateless — pas de cache interne.
 *
 * cf. docs/chat-assistant/20-langchain-robustness-plan.md §2.3
 */
import {
  intentClassificationSchema,
  type ClassifiedIntent,
  type IntentClassification as ZodIntentClassification,
} from '../schemas/intent';
import type { IntentClassification as RegexIntentClassification } from '../services/intent';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/**
 * Score regex à partir duquel on court-circuite l'appel LLM.
 *
 * À 2, on a au moins UN match `strong` (formulation exclusive à un
 * intent — cf. `services/intent.ts` lignes 116-122 / 249-269). Les
 * patterns `strong` sont conçus pour être quasi-déterministes (ex.
 * « rabais », « bghit nshri », « grande quantité »), donc sauter le
 * LLM n'introduit pas de risque significatif. À 1 (un seul `weak`),
 * on est sur un mot-clé ambigu (ex. « prix » seul) et on délègue
 * l'arbitrage au LLM.
 *
 * Effet pratique : ~70-80 % des messages sont classés sans appel LLM,
 * ce qui maintient la latence p50 actuelle (~250-400 ms regex+rag)
 * inchangée pour les cas clairs, et n'ajoute la latence LLM (+250 ms)
 * que pour les cas effectivement ambigus.
 */
const REGEX_SHORTCUT_THRESHOLD = 2;

const TOOL_CALL_DEFAULT_MODEL = 'gpt-4o-mini';
const TOOL_CALL_DEFAULT_API_BASE = 'https://api.openai.com/v1';
const TOOL_CALL_TIMEOUT_MS = 8_000;
/** Cap conservatif : la sortie tool-call est ~25 tokens en moyenne. */
const TOOL_CALL_MAX_TOKENS = 100;
const TOOL_CALL_TEMPERATURE = 0; // classification → déterministe.

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

export interface ClassifyIntentLlmConfig {
  apiKey: string;
  /** Default `https://api.openai.com/v1`. Permet pointer vers un proxy. */
  apiBase?: string;
  /** Default `gpt-4o-mini`. */
  model?: string;
}

export interface ClassifyIntentInput {
  /** Texte utilisateur brut (pré-normalisé côté caller, e.g. trim). */
  text: string;
  /**
   * Sortie du classifieur regex local (cf. `services/intent.ts#classifyIntent`).
   * Sert à la fois au shortcut et au fallback.
   */
  regex: RegexIntentClassification;
  /**
   * Config LLM. Si `null` → on saute directement au regex fallback (utile
   * quand le flag `CHAT_LLM_INTENT_ENABLED=false` ou en absence de clé).
   */
  llmConfig: ClassifyIntentLlmConfig | null;
  /** Abort externe (timeout amont). */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

/**
 * Runnable principal — voir docstring du module pour le pipeline complet.
 *
 * @example
 *   const regex = classifyIntent("commander");
 *   const result = await classifyIntentRunnable({
 *     text: "commander",
 *     regex,
 *     llmConfig: { apiKey: env.CHAT_OPENAI_API_KEY },
 *   });
 *   // → { intent: 'purchase-intent', method: 'regex', regexScore: 2, ... }
 *   //   (regex score 2 < 3 → tente LLM ; mais 'commander' seul est un
 *   //    cas si bien couvert par regex que le LLM confirme → method: 'llm')
 */
export async function classifyIntentRunnable(
  input: ClassifyIntentInput,
): Promise<ClassifiedIntent> {
  const { text, regex, llmConfig, signal } = input;

  // --- 1. Regex shortcut --------------------------------------------------
  if (regex.score >= REGEX_SHORTCUT_THRESHOLD) {
    return regexResult(regex, 'regex');
  }

  // --- 2. LLM tool-call (skip if no config or already aborted) ------------
  if (!llmConfig || signal?.aborted) {
    return regexResult(regex, 'regex');
  }

  try {
    const llmOutput = await runIntentToolCall({
      text,
      llmConfig,
      signal,
    });
    return {
      intent: llmOutput.parsed.intent,
      confidence: llmOutput.parsed.confidence,
      method: llmOutput.fixed ? 'llm-fixed' : 'llm',
      regexScore: regex.score > 0 ? regex.score : null,
      reason: llmOutput.parsed.reason,
    };
  } catch {
    // --- 4. Regex fallback (silent — le runnable ne throw JAMAIS) --------
    return regexResult(regex, 'regex');
  }
}

// ---------------------------------------------------------------------------
// Helpers privés
// ---------------------------------------------------------------------------

/**
 * Mappe un score regex (0..N) vers une confidence label. Aligné avec
 * `orchestrator.ts#scoreToConfidence` — DRY-er ici plutôt que d'importer
 * pour éviter une dep cyclique runnable → orchestrator.
 */
function scoreToConfidence(score: number): 'low' | 'medium' | 'high' {
  if (score >= 3) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function regexResult(
  regex: RegexIntentClassification,
  method: 'regex',
): ClassifiedIntent {
  return {
    intent: regex.intent,
    confidence: scoreToConfidence(regex.score),
    method,
    regexScore: regex.score > 0 ? regex.score : null,
    reason: null,
  };
}

// ---------------------------------------------------------------------------
// Tool-call OpenAI (étapes 2 & 3)
// ---------------------------------------------------------------------------

interface ToolCallResult {
  parsed: ZodIntentClassification;
  /** `true` si le retry OutputFixingParser-style a été nécessaire. */
  fixed: boolean;
}

/**
 * Appelle l'API OpenAI Chat Completions avec `tools` forcé. Si la sortie
 * ne passe pas Zod, retente UNE fois en injectant l'erreur en prompt.
 * Throw si le 2e essai échoue ou si on a une vraie erreur HTTP — le
 * caller doit attraper et faire fallback regex.
 */
async function runIntentToolCall(args: {
  text: string;
  llmConfig: ClassifyIntentLlmConfig;
  signal?: AbortSignal;
}): Promise<ToolCallResult> {
  const { text, llmConfig, signal } = args;
  const messages: OpenAIChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: text },
  ];

  // 1er essai
  const first = await callOpenAIToolCall({ llmConfig, messages, signal });
  const firstParsed = intentClassificationSchema.safeParse(first.toolArgs);
  if (firstParsed.success) {
    return { parsed: firstParsed.data, fixed: false };
  }

  // 2e essai (OutputFixingParser-style) : on rappelle l'API en montrant
  // l'erreur Zod et la sortie invalide précédente. Le LLM corrige.
  const fixerMessages: OpenAIChatMessage[] = [
    ...messages,
    {
      role: 'assistant',
      content: `Tool call attempted with arguments: ${JSON.stringify(
        first.toolArgs,
      )}`,
    },
    {
      role: 'user',
      content: [
        'Your previous tool call was rejected because the arguments failed schema validation.',
        `Validation error: ${firstParsed.error.message}`,
        'Please re-emit the `classify_intent` tool call with corrected arguments that strictly conform to the schema.',
      ].join('\n'),
    },
  ];

  const second = await callOpenAIToolCall({
    llmConfig,
    messages: fixerMessages,
    signal,
  });
  const secondParsed = intentClassificationSchema.safeParse(second.toolArgs);
  if (secondParsed.success) {
    return { parsed: secondParsed.data, fixed: true };
  }

  // Encore raté → on fait throw, le caller fera fallback regex.
  throw new Error(
    `intent tool-call retry failed validation: ${secondParsed.error.message}`,
  );
}

// ---------------------------------------------------------------------------
// Couche fetch — minimaliste, pas de SSE (single-shot, pas de stream)
// ---------------------------------------------------------------------------

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

interface OpenAIToolCallChoice {
  toolArgs: unknown;
}

async function callOpenAIToolCall(args: {
  llmConfig: ClassifyIntentLlmConfig;
  messages: OpenAIChatMessage[];
  signal?: AbortSignal;
}): Promise<OpenAIToolCallChoice> {
  const { llmConfig, messages, signal } = args;
  const apiBase = (llmConfig.apiBase ?? TOOL_CALL_DEFAULT_API_BASE).replace(
    /\/$/,
    '',
  );
  const model = llmConfig.model ?? TOOL_CALL_DEFAULT_MODEL;

  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new Error('tool-call timeout')),
    TOOL_CALL_TIMEOUT_MS,
  );
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason);
    else
      signal.addEventListener('abort', () => ctrl.abort(signal.reason), {
        once: true,
      });
  }

  try {
    const res = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${llmConfig.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: TOOL_CALL_TEMPERATURE,
        max_tokens: TOOL_CALL_MAX_TOKENS,
        // Force le tool-call : le modèle DOIT appeler `classify_intent`.
        tools: [CLASSIFY_INTENT_TOOL],
        tool_choice: {
          type: 'function',
          function: { name: 'classify_intent' },
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`tool-call HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = (await res.json()) as OpenAIChatCompletionResponse;
    const choice = data.choices?.[0];
    const call = choice?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      throw new Error('tool-call response had no tool_calls');
    }
    let toolArgs: unknown;
    try {
      toolArgs = JSON.parse(call.function.arguments);
    } catch (e) {
      throw new Error(
        `tool-call arguments not parseable JSON: ${(e as Error).message}`,
      );
    }
    return { toolArgs };
  } finally {
    clearTimeout(timer);
  }
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      tool_calls?: Array<{
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
}

// ---------------------------------------------------------------------------
// Tool definition (JSON Schema dérivé manuellement de
// `intentClassificationSchema` — DRY-able plus tard via zod-to-json-schema
// si on en ajoute la dep, mais pour 3 propriétés c'est plus simple à la main).
// ---------------------------------------------------------------------------

const CLASSIFY_INTENT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'classify_intent',
    description:
      'Classify the visitor message into a single best-fit intent class. Always call this tool exactly once.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['intent', 'confidence', 'reason'],
      properties: {
        intent: {
          type: 'string',
          enum: [
            'greeting',
            'pricing',
            'shipping',
            'routine',
            'ingredient',
            'order-status',
            'support',
            'objection-price',
            'objection-doubt',
            'social-proof',
            'comparison',
            'b2b',
            'callback-request',
            'frustration',
            'after-hours',
            'purchase-intent',
            'negotiation',
            'wholesaler',
            'misc',
          ],
          description: 'Single best-fit intent class for this message.',
        },
        confidence: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description:
            "Subjective confidence: 'high' (clearly fits), 'medium' (likely), 'low' (ambiguous).",
        },
        reason: {
          type: 'string',
          maxLength: 120,
          description:
            'Brief justification, max 120 chars. e.g. "Explicit purchase verb in imperative form".',
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// System prompt — listé tel quel pour faciliter les revues éditoriales
// par les non-devs (curator UI Phase 3 lira ce fichier).
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = [
  'You are an intent classifier for FemiGlow, a Moroccan e-commerce skincare brand serving customers in French (FR), Arabic-script (AR) and Moroccan Darija (FR-script).',
  '',
  'For each visitor message, choose ONE intent from this list:',
  '',
  '- greeting: simple salutation (bonjour, salam, hi).',
  '- pricing: factual price/tariff question.',
  '- shipping: delivery/lead-time/tracking question.',
  '- routine: how-to-apply, posology, ritual.',
  '- ingredient: composition / ingredient question.',
  "- order-status: TRACKING an already-placed order (NOT a new purchase).",
  '- support: defective product, refund, return.',
  "- objection-price: signal of price concern WITHOUT active negotiation (e.g. 'c'est cher').",
  "- objection-doubt: doubt about efficacy, asking for proof.",
  '- social-proof: asking for reviews, before/after, testimonials.',
  '- comparison: comparing with a competitor or another brand.',
  '- b2b: professional context (institut, salon) WITHOUT explicit volume.',
  '- callback-request: explicit request to be contacted by a human.',
  '- frustration: negative emotion, impatience, "I already asked".',
  '- after-hours: out-of-hours message.',
  "- purchase-intent: EXPLICIT will to buy (commander, acheter, je prends, bghit nshri).",
  "- negotiation: ACTIVE bargaining attempt (rabais, réduction, geste commercial, tnzli).",
  '- wholesaler: bulk/volume request (grande quantité, grossiste, distributeur, b jomla).',
  '- misc: none of the above.',
  '',
  'Decision rules:',
  '- "purchase-intent" must win over "order-status" when both could apply.',
  '- "negotiation" must win over "objection-price" when the user actively asks for a discount.',
  '- "wholesaler" must win over "b2b" when volume is mentioned.',
  '',
  'Always respond by calling the `classify_intent` tool exactly once. Pick the SINGLE best fit; never reply in plain text.',
].join('\n');
