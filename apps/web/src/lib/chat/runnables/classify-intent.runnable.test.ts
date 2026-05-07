/**
 * CHA-230 Phase 2 — Tests du runnable `classify-intent`.
 *
 * Couvre les 4 chemins du pipeline :
 *  - Étape 1 : Regex shortcut (score ≥ 3) → pas d'appel LLM.
 *  - Étape 2 : LLM tool-call valide du 1er coup → method 'llm'.
 *  - Étape 3 : LLM tool-call invalide → retry → valide → method 'llm-fixed'.
 *  - Étape 4 : LLM tool-call totalement KO → fallback regex (jamais de throw).
 *
 * Plus quelques garde-fous :
 *  - Le runnable ne throw JAMAIS.
 *  - Le `tool_choice` envoyé à OpenAI force bien `classify_intent`.
 *  - `regexScore` est correctement reporté (et `null` si score 0).
 *
 * cf. docs/chat-assistant/20-langchain-robustness-plan.md §2.4
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { server } from '@/test/msw/server';
import {
  captureToolCallBodies,
  openaiNoToolCallHandler,
  openaiServerErrorHandler,
  openaiToolCallHandler,
} from '@/test/msw/openai-handlers';

import { classifyIntent } from '../services/intent';
import { classifyIntentRunnable } from './classify-intent.runnable';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const llmConfig = { apiKey: 'sk-test', model: 'gpt-4o-mini' };

describe('classifyIntentRunnable — étape 1 (regex shortcut)', () => {
  it("court-circuite l'appel LLM si au moins un strong pattern matche (score >= 2)", async () => {
    // "je veux commander" matche STRONG `je\s+(veux|...)\s+(commander|...)`
    // → score 2 → shortcut, pas d'appel LLM.
    const text = 'je veux commander';
    const regex = classifyIntent(text);
    expect(regex.score).toBeGreaterThanOrEqual(2);

    // Pas de handler MSW → tout appel HTTP throw ("onUnhandledRequest: 'error'").
    // Si le runnable appelait le LLM par erreur, le test crasherait.
    const result = await classifyIntentRunnable({ text, regex, llmConfig });
    expect(result.method).toBe('regex');
    expect(result.intent).toBe('purchase-intent');
    expect(result.regexScore).toBe(regex.score);
  });

  it("court-circuite aussi pour negotiation (mot-clé fort 'rabais' isolé)", async () => {
    const text = 'rabais';
    const regex = classifyIntent(text);
    expect(regex.score).toBeGreaterThanOrEqual(2);
    const result = await classifyIntentRunnable({ text, regex, llmConfig });
    expect(result.method).toBe('regex');
    expect(result.intent).toBe('negotiation');
  });

  it("appelle le LLM si seulement un weak pattern matche (score 1)", async () => {
    server.use(
      openaiToolCallHandler([
        {
          intent: 'pricing',
          confidence: 'high',
          reason: 'price keyword',
        },
      ]),
    );
    // « combien » seul → matche pricing patterns weak (1) → < 2 → LLM appelé.
    const text = 'combien';
    const regex = classifyIntent(text);
    expect(regex.score).toBe(1);
    const result = await classifyIntentRunnable({ text, regex, llmConfig });
    expect(result.method).toBe('llm');
    expect(result.intent).toBe('pricing');
  });
});

describe('classifyIntentRunnable — étape 2 (LLM tool-call nominal)', () => {
  it("appelle le LLM si regex.score < 3 et utilise sa réponse (method='llm')", async () => {
    server.use(
      openaiToolCallHandler([
        {
          intent: 'pricing',
          confidence: 'high',
          reason: 'Direct price question',
        },
      ]),
    );
    // "Quel prix ?" → regex matche `pricing` patterns (score 1) → < 3,
    // donc LLM est appelé.
    const text = 'Quel prix ?';
    const regex = classifyIntent(text);
    expect(regex.score).toBeLessThan(3);

    const result = await classifyIntentRunnable({ text, regex, llmConfig });
    expect(result.method).toBe('llm');
    expect(result.intent).toBe('pricing');
    expect(result.confidence).toBe('high');
    expect(result.reason).toBe('Direct price question');
    expect(result.regexScore).toBe(regex.score);
  });

  it("envoie le tool_choice forcé sur classify_intent dans le body", async () => {
    const capture = captureToolCallBodies({
      firstArgs: {
        intent: 'misc',
        confidence: 'low',
        reason: 'no signal',
      },
      // pas de retry attendu
      secondArgs: {
        intent: 'misc',
        confidence: 'low',
        reason: 'no signal',
      },
    });
    server.use(capture.handler);

    await classifyIntentRunnable({
      text: 'xyz',
      regex: classifyIntent('xyz'),
      llmConfig,
    });

    expect(capture.getCallCount()).toBe(1);
    const body = capture.getBodies()[0] as {
      model: string;
      tool_choice: { type: string; function: { name: string } };
      tools: Array<{ function: { name: string } }>;
      temperature: number;
    };
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.tool_choice).toEqual({
      type: 'function',
      function: { name: 'classify_intent' },
    });
    expect(body.tools[0]?.function.name).toBe('classify_intent');
    expect(body.temperature).toBe(0);
  });
});

describe("classifyIntentRunnable — étape 3 (OutputFixingParser retry)", () => {
  it("retente avec l'erreur en prompt si la 1re sortie est invalide → method='llm-fixed'", async () => {
    const capture = captureToolCallBodies({
      // 1er essai : intent inconnu (échoue Zod enum) + reason ok
      firstArgs: {
        intent: 'not-a-real-intent',
        confidence: 'high',
        reason: 'something',
      },
      // 2e essai : valide
      secondArgs: {
        intent: 'wholesaler',
        confidence: 'medium',
        reason: 'mentions volume',
      },
    });
    server.use(capture.handler);

    // Texte volontairement neutre pour le regex (score 0 → bypass shortcut
    // et appel LLM forcé). Le scénario testé ici concerne le retry, pas
    // la précision du classifieur regex.
    const text = 'je sais pas';
    const result = await classifyIntentRunnable({
      text,
      regex: classifyIntent(text),
      llmConfig,
    });

    expect(capture.getCallCount()).toBe(2);
    expect(result.method).toBe('llm-fixed');
    expect(result.intent).toBe('wholesaler');
    expect(result.confidence).toBe('medium');
    expect(result.reason).toBe('mentions volume');

    // Le 2e body doit contenir des messages supplémentaires (assistant
    // + user explicatif) → preuve que le fixer-prompt est bien injecté.
    const secondBody = capture.getBodies()[1] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(secondBody.messages.length).toBeGreaterThanOrEqual(4);
    const lastUser = secondBody.messages[secondBody.messages.length - 1];
    expect(lastUser?.role).toBe('user');
    expect(lastUser?.content).toMatch(/schema validation|Validation error/i);
  });

  it("rejette aussi un reason > 120 chars et retente", async () => {
    const capture = captureToolCallBodies({
      firstArgs: {
        intent: 'pricing',
        confidence: 'high',
        reason: 'x'.repeat(200), // > 120 → Zod rejette
      },
      secondArgs: {
        intent: 'pricing',
        confidence: 'high',
        reason: 'short reason',
      },
    });
    server.use(capture.handler);

    const result = await classifyIntentRunnable({
      text: 'prix',
      regex: classifyIntent('prix'),
      llmConfig,
    });

    expect(capture.getCallCount()).toBe(2);
    expect(result.method).toBe('llm-fixed');
    expect(result.reason).toBe('short reason');
  });
});

describe('classifyIntentRunnable — étape 4 (regex fallback)', () => {
  it('retombe sur le regex si le retry échoue aussi (jamais de throw)', async () => {
    server.use(
      openaiToolCallHandler([
        // 1er invalide
        { intent: 'unknown', confidence: 'low', reason: 'bad' },
        // 2e encore invalide
        { intent: 'still-bad', confidence: 'low', reason: 'bad' },
      ]),
    );

    const text = 'commander';
    const regex = classifyIntent(text);
    const result = await classifyIntentRunnable({ text, regex, llmConfig });

    expect(result.method).toBe('regex');
    expect(result.intent).toBe(regex.intent);
    expect(result.regexScore).toBe(regex.score);
  });

  it('retombe sur le regex si le LLM renvoie un 5xx', async () => {
    server.use(openaiServerErrorHandler);
    const text = 'message ambigu sans signal fort';
    const regex = classifyIntent(text);
    const result = await classifyIntentRunnable({ text, regex, llmConfig });

    expect(result.method).toBe('regex');
    expect(result.intent).toBe(regex.intent);
    // Confidence label dérivée du score regex (probablement 'low' pour misc).
    expect(['low', 'medium', 'high']).toContain(result.confidence);
  });

  it("retombe sur le regex si la réponse n'a aucun tool_calls", async () => {
    server.use(openaiNoToolCallHandler);
    const text = 'autre cas ambigu';
    const regex = classifyIntent(text);
    const result = await classifyIntentRunnable({ text, regex, llmConfig });

    expect(result.method).toBe('regex');
    expect(result.intent).toBe(regex.intent);
  });

  it("retombe directement sur le regex sans appel LLM si llmConfig est null", async () => {
    // Pas de handler → si on appelait l'API ça throw. Le test passe
    // uniquement parce qu'aucun fetch n'est émis.
    const text = 'test';
    const regex = classifyIntent(text);
    const result = await classifyIntentRunnable({
      text,
      regex,
      llmConfig: null,
    });
    expect(result.method).toBe('regex');
    expect(result.intent).toBe(regex.intent);
  });

  it('retombe directement sur le regex si le signal est déjà aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const text = 'test';
    const regex = classifyIntent(text);
    const result = await classifyIntentRunnable({
      text,
      regex,
      llmConfig,
      signal: ctrl.signal,
    });
    expect(result.method).toBe('regex');
  });
});

describe('classifyIntentRunnable — invariants', () => {
  it('regexScore est null quand le score regex est 0', async () => {
    server.use(
      openaiToolCallHandler([
        { intent: 'misc', confidence: 'low', reason: 'no signal' },
      ]),
    );
    // Texte sans aucun mot-clé → score 0.
    const text = 'xyz';
    const regex = classifyIntent(text);
    expect(regex.score).toBe(0);
    const result = await classifyIntentRunnable({ text, regex, llmConfig });
    expect(result.regexScore).toBeNull();
  });

  it('toutes les sorties sont conformes au type ClassifiedIntent', async () => {
    server.use(
      openaiToolCallHandler([
        {
          intent: 'greeting',
          confidence: 'high',
          reason: 'simple greet',
        },
      ]),
    );
    const text = 'Salam';
    const regex = classifyIntent(text);
    const result = await classifyIntentRunnable({ text, regex, llmConfig });
    // Structural check — typescript le ferait à la compilation, on
    // re-vérifie au runtime parce que ce contrat est utilisé pour
    // persister chat_message.intent_*.
    expect(result).toMatchObject({
      intent: expect.any(String),
      confidence: expect.stringMatching(/^(low|medium|high)$/),
      method: expect.stringMatching(/^(regex|llm|llm-fixed|golden|manual)$/),
    });
  });
});
