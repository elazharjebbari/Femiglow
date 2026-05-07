# 03 — Backend

> *Routes API publiques + admin, services LangChain, streaming SSE, queues, audit*

---

## 1. Carte des routes

### 1.1 Publiques (cookie session)

| Méthode | Route                              | Rôle                                                      | Streaming |
| ------- | ---------------------------------- | --------------------------------------------------------- | --------- |
| GET     | `/api/chat/session`                | Récupère ou crée la session du visiteur                   | non       |
| POST    | `/api/chat/session/refresh`        | Met à jour `page`, `language`, `consent`                  | non       |
| POST    | `/api/chat/message`                | Envoi message + réception streamée                        | **SSE**   |
| POST    | `/api/chat/feedback`               | Pouce vert/rouge sur un message                           | non       |
| POST    | `/api/chat/lead/email`             | Capture optionnelle d'email pour reprise                  | non       |
| POST    | `/api/chat/event`                  | Émission d'événements widget (open, close, suggestion…)   | non       |
| GET     | `/api/chat/theme`                  | Snapshot du preset actif (cache 60 s)                     | non       |

### 1.2 Admin (`iron-session` + rôle `chat-admin`)

| Méthode    | Route                                                   | Rôle                                              |
| ---------- | ------------------------------------------------------- | ------------------------------------------------- |
| GET / POST | `/api/admin/chat/instructions`                          | Liste / créer (nouvelle version)                  |
| POST       | `/api/admin/chat/instructions/:id/activate`             | Active une version (désactive l'ancienne)         |
| GET / POST | `/api/admin/chat/sources`                               | Liste / créer source                              |
| PATCH      | `/api/admin/chat/sources/:id`                           | Update (déclenche reindex si contenu change)      |
| DELETE     | `/api/admin/chat/sources/:id`                           | Désactive (puis purge async)                      |
| POST       | `/api/admin/chat/sources/:id/reindex`                   | Reindex manuel                                    |
| GET / POST | `/api/admin/chat/providers`                             | CRUD provider config                              |
| POST       | `/api/admin/chat/providers/:id/test`                    | Test ping + complétion fictive                    |
| GET / POST | `/api/admin/chat/themes`                                | CRUD presets                                      |
| GET        | `/api/admin/chat/conversations`                         | Liste paginée + filtres + recherche               |
| GET        | `/api/admin/chat/conversations/:id`                     | Lecture intégrale d'une conversation              |
| POST       | `/api/admin/chat/conversations/:id/forget`              | Droit à l'oubli                                   |
| GET        | `/api/admin/chat/kpis`                                  | Snapshot KPI par fenêtre                          |
| GET        | `/api/admin/chat/visualisation/stream`                  | Flux temps réel des étapes pipeline (SSE)         |
| POST       | `/api/admin/chat/maintenance/purge`                     | Tâche de purge (cron Vercel)                      |
| POST       | `/api/admin/chat/maintenance/reindex`                   | Reindex global (cron mensuel)                     |
| GET        | `/api/admin/chat/audit`                                 | Audit log                                         |

## 2. Contrats Zod (extraits)

```ts
// lib/chat/contracts.ts

export const chatSessionSnapshot = z.object({
  sessionId: z.string(),
  language: z.enum(['fr', 'ar', 'ar-MA']),
  status: z.enum(['open', 'idle', 'archived', 'purged']),
  greeting: z.string(),
  suggestions: z.array(z.string()).max(3),
  messages: z.array(chatMessageDto).max(200),
  themeVariantId: z.string(),
  variantOpaqueId: z.string(), // identifiant masqué pour A/B
});

export const chatMessageInput = z.object({
  sessionId: z.string(),
  text: z.string().min(1).max(2000),
  lang: z.enum(['fr', 'ar', 'ar-MA']).optional(),
  context: z
    .object({
      page: z.string().max(120).optional(),
      currentCart: z.array(z.object({ sku: z.string(), qty: z.number() })).optional(),
    })
    .optional(),
});

export const chatFeedbackInput = z.object({
  messageId: z.string(),
  value: z.union([z.literal(1), z.literal(-1)]),
  note: z.string().max(500).optional(),
});

export const adminInstructionInput = z.object({
  scope: z.string().default('default'),
  body: z.string().min(50).max(20_000),
  bodyAr: z.string().optional(),
  bodyArMa: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const adminProviderInput = z.object({
  kind: z.enum(['openai', 'gemini', 'anthropic', 'mistral', 'qwen', 'deepseek', 'zhipu', 'ollama', 'azure-openai']),
  label: z.string().min(2).max(80),
  role: z.enum(['chat', 'embedding', 'moderation', 'rerank']),
  priority: z.number().int().min(1).max(1000),
  enabled: z.boolean(),
  apiKey: z.string().optional(),    // jamais retourné en GET
  apiBase: z.string().url().optional(),
  chatModel: z.string().optional(),
  embeddingModel: z.string().optional(),
  parameters: z.object({
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    maxTokens: z.number().int().min(16).max(8192).optional(),
    timeoutMs: z.number().int().min(1000).max(60000).optional(),
  }).optional(),
  quotaMonthlyEur: z.number().min(0).optional(),
  egressAllowed: z.boolean().default(false),
});
```

## 3. Services

### 3.1 `lib/chat/session.ts`

```ts
export const sessionService = {
  async getOrCreate(req: Request, hint?: string) { ... },
  async update(id: string, partial: Partial<ChatSession>) { ... },
  async snapshot(id: string): Promise<ChatSessionSnapshot> { ... },
  async attributeConversion(id: string, orderId: string) { ... },
  async forget(id: string) { ... },
};
```

Le cookie de session est `iron-session` réutilisable, signé,
rotatif (clé maître + clé précédente pendant 7 j). Le `visitorId`
est un hash stable basé sur cookie persistant `fg_v` (10 ans).

### 3.2 `lib/chat/orchestrator.ts`

Orchestrateur LangChain, point d'entrée de la génération.

```ts
import { RunnableSequence, RunnableMap } from '@langchain/core/runnables';

export async function streamReply(input: {
  session: ChatSession;
  text: string;
  language: Language;
}): AsyncIterable<StreamEvent> {
  const instruction = await instructionRepo.active(input.session.scope);
  const memory     = await memoryService.recent(input.session.id, 12);
  const ragHits    = await ragService.retrieve({ text: input.text, language: input.language, k: 6 });
  const provider   = await providerRouter.choose({ role: 'chat', session: input.session });

  const chain = buildChain({
    instruction,
    memory,
    ragHits,
    providerAdapter: provider.adapter,
  });

  for await (const ev of chain.streamEvents({ question: input.text, language: input.language })) {
    yield translateLangChainEvent(ev);
  }
}
```

### 3.3 `lib/chat/router.ts`

```ts
export const providerRouter = {
  async choose(opts: { role: ProviderRole; session?: ChatSession }) {
    const candidates = await providerRepo.activeByRole(opts.role); // tri priorité
    for (const c of candidates) {
      if (circuitBreaker.isOpen(c.id)) continue;
      if (await quota.exceeded(c.id)) continue;
      return wrapAdapter(c);
    }
    throw new ProviderUnavailableError();
  },
};
```

Le circuit-breaker est en mémoire process avec persistance optionnelle
Redis (Upstash) si Vercel scale-out détectable. À défaut, chaque
instance gère son propre breaker — pénalisation acceptable en V1.

### 3.4 `lib/chat/stream.ts` — helper SSE

```ts
export function streamSSE(
  factory: (write: (e: { event: string; data: unknown }) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (e) => controller.enqueue(encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`));
      try {
        await factory(write);
      } catch (err) {
        write({ event: 'error', data: { code: errorToCode(err) } });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
```

### 3.5 `lib/chat/moderation.ts`

```ts
export const moderation = {
  async input(text: string): Promise<void> {
    const provider = await providerRouter.choose({ role: 'moderation' });
    const flagged = await provider.adapter.moderate(text);
    if (flagged) throw new ModerationError('input', flagged.categories);
  },
  async outputDelta(delta: string, ctx: ModerationContext): Promise<string | null> {
    if (containsPii(delta)) return redactPii(delta);
    if (containsForbiddenLexicon(delta)) return null; // bloque le delta
    return delta;
  },
  async outputFinal(text: string): Promise<{ ok: boolean; rewritten?: string }> {
    if (containsForbiddenLexicon(text)) {
      return { ok: false, rewritten: rewriteToCharter(text) };
    }
    return { ok: true };
  },
};
```

### 3.6 `lib/chat/rag.ts`

Voir [09](09-knowledge-base-rag.md) pour les détails. Interface :

```ts
export const ragService = {
  async retrieve(opts: { text: string; language: Language; k?: number }): Promise<RagHit[]>,
  async ingest(sourceId: string): Promise<{ chunks: number; embeddings: number }>,
  async reindexAll(): Promise<{ sources: number; chunks: number }>,
};
```

### 3.7 `lib/chat/sanitize.ts` & `lib/chat/lang.ts`

```ts
export function detectLanguage(text: string): Language {
  const arabicChars = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latinChars  = (text.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  if (arabicChars > latinChars * 2) {
    return looksDarija(text) ? 'ar-MA' : 'ar';
  }
  if (looksDarijaLatin(text)) return 'ar-MA'; // « salam, kifash kandir... »
  return 'fr';
}
```

`looksDarija` repose sur un dictionnaire de mots-clés
(cf. annexes/glossaire-editorial.md).

## 4. Streaming end-to-end (séquence)

```
Client         /api/chat/message        Orchestrator     Provider
  │                  │                       │              │
  │  POST            │                       │              │
  │ ────────────────►│                       │              │
  │                  │  parse + auth         │              │
  │                  │  rate-limit           │              │
  │                  │  detect lang          │              │
  │                  │  sanitize             │              │
  │                  │  moderate IN          │              │
  │ ◄── (start SSE)  │                       │              │
  │                  │  open stream          │              │
  │                  │ ────────────────────► │              │
  │                  │                       │ retrieveRAG  │
  │                  │                       │ build prompt │
  │                  │                       │ stream ───► │
  │                  │ ◄── token             │              │
  │ ◄── token        │                       │              │
  │ ◄── token        │                       │              │
  │ ◄── meta         │                       │              │
  │ ◄── done         │                       │              │
  │                  │  persist + events     │              │
```

## 5. Persistance d'un message

Pas de double écriture côté serveur. Pattern :

```ts
const { id: messageId } = await messageRepo.insertUserMessage({ session, text, language });
const { id: agentId }   = await messageRepo.insertAssistantPending({ session, parent: messageId });

for await (const tok of orchestrator) {
  bufferedAgentText += tok;
  await streamWriter.token(tok);
}

await messageRepo.finalizeAssistant(agentId, {
  content: bufferedAgentText,
  ragHits,
  tokensIn, tokensOut, latencyMs, firstTokenMs,
  providerId: provider.id, modelName: provider.chatModel,
  cost,
});

await events.emit('message_sent_agent', { sessionId, messageId: agentId });
```

## 6. Audit log admin

Toutes les routes `/api/admin/chat/*` passent par un middleware
`withAudit`:

```ts
withAudit('chat.instruction.activate', async (ctx) => { ... })
```

Le middleware persiste `actor`, `action`, `entityId`, `diff`,
`ip`, `userAgent`, `requestId` dans la table existante
`admin_audit_log` (cf. `docs/admin-config/`).

## 7. Rate-limit

```ts
const limits = {
  ip:       { max: 60, windowMs: 60_000 },
  session:  { max: 30, windowMs: 60_000 },
  visitor:  { max: 200, windowMs: 60 * 60_000 },
};
```

Sur dépassement, réponse 429 avec en-tête `Retry-After` et message
public conforme à la charte (« la maison reçoit beaucoup de
sollicitations en ce moment, reviens dans une minute »).

## 8. Erreurs et codes

```ts
type ChatErrorCode =
  | 'invalid_input'
  | 'session_not_found'
  | 'rate_limited'
  | 'moderation_blocked_input'
  | 'moderation_blocked_output'
  | 'provider_unavailable'
  | 'quota_exceeded'
  | 'timeout'
  | 'internal';
```

Le client mappe ces codes en messages charte (cf. doc 04, 05).

## 9. Cron Vercel

```jsonc
// vercel.json (extrait à ajouter)
{
  "crons": [
    { "path": "/api/admin/chat/maintenance/purge",   "schedule": "5 3 * * *"   },
    { "path": "/api/admin/chat/maintenance/refresh-kpi", "schedule": "*/5 * * * *" },
    { "path": "/api/admin/chat/maintenance/reindex", "schedule": "30 2 1 * *"  }
  ]
}
```

## 10. Observabilité (résumé)

Voir [14](14-observabilite-perf.md). Chaque message produit :

- 1 trace OpenTelemetry (spans : `parse`, `moderate-in`,
  `retrieve`, `compose`, `provider`, `moderate-out`, `persist`),
- 1 ligne JSON dans le logger avec `sessionId`, `messageId`,
  `providerId`, `model`, `latencyMs`, `tokensIn`, `tokensOut`,
  `cost`, `ragHits.length`,
- N événements datalayer côté client (cf. `docs/tracking/`).

## 11. Checklist sécurité de la couche API

- [ ] Toutes les routes valident les payloads avec Zod en première instruction.
- [ ] Aucune route admin ne tolère un token public (`assertChatAdmin(req)` en haut).
- [ ] CSP nonce propagé jusqu'au composant chat (pas de styles inline non-noncés).
- [ ] Aucune clé provider ne sort jamais d'un service serveur (`apiKeyEncrypted` ne quitte pas la couche infra).
- [ ] Les SSE ferment proprement sur `req.signal.aborted`.
- [ ] Les timeouts providers sont stricts (`AbortController` + `timeoutMs`).
- [ ] `egress_allowed = false` empêche tout envoi de PII non redacted.
- [ ] Rate-limit appliqué *avant* tout appel provider.

## 12. Lecture suivante

- [04 — Frontend](04-frontend.md) pour la consommation de ces routes.
- [10 — Providers & modèles](10-providers-models.md) pour la
  contractualisation des adapters.
- [13 — Sécurité](13-securite-rgpd-moderation.md).
