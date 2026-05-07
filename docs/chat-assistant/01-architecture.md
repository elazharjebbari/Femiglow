# 01 — Architecture

> *Vue d'ensemble, flux temps réel, agent LangChain, RAG, model router, séquences*

---

## 1. Vue d'ensemble

```
┌──────────────────────────── Navigateur ────────────────────────────┐
│                                                                    │
│  Page (RSC) ──────────► <ChatProvider> ◄────── Hooks               │
│                              │                                     │
│                              ▼                                     │
│                       <ChatWidget>                                 │
│                       ├─ <Launcher>          (bouton flottant)     │
│                       ├─ <Panel>             (panneau ouvert)      │
│                       ├─ <MessageList>       (bulles + skeleton)   │
│                       ├─ <Composer>          (input + suggestions) │
│                       ├─ <Visualizer> [admin] (flux interne)       │
│                       └─ store Zustand (state, optimistic, queue)  │
│                              │                                     │
│              SSE  ◄──────────┘    POST /api/chat/message           │
│              GET  /api/chat/session                                │
│              POST /api/chat/feedback                               │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────── Serveur (Next.js Edge / Node) ─────────────────────┐
│                                                                                │
│  Route handlers (app/api/chat/*) ──► Services (lib/chat/*) ──► LangChain.js    │
│                                                                                │
│  Pipeline d'un message :                                                       │
│   1. AuthN / Session             (lib/chat/session.ts)                         │
│   2. Rate-limit                  (lib/chat/rate-limit.ts)                      │
│   3. Detect language             (lib/chat/lang.ts)                            │
│   4. Sanitize + PII redact       (lib/chat/sanitize.ts)                        │
│   5. Moderate input              (lib/chat/moderation.ts → provider)           │
│   6. Build memory                (lib/chat/memory.ts → derniers messages)      │
│   7. RAG retrieve + rerank       (lib/chat/rag.ts → vector store)              │
│   8. Compose prompt              (lib/chat/prompt.ts → templates)              │
│   9. Route model                 (lib/chat/router.ts → provider primaire)      │
│  10. Stream completion (SSE)     (lib/chat/stream.ts)                          │
│  11. Moderate output             (filtre lexique + PII out)                    │
│  12. Persist + emit events       (Drizzle + tracking dataLayer)                │
│  13. Cost accounting             (lib/chat/billing.ts)                         │
└────────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────── Couche données ──────────────────────────────────────────┐
│                                                                              │
│   Postgres (Neon)                  Vector store (pgvector)   Object store    │
│   ├─ chat_session                  ├─ chat_knowledge_chunk   ├─ Vercel Blob  │
│   ├─ chat_message                  ├─ chat_knowledge_embed.  └─ uploads      │
│   ├─ chat_provider_config (chiff.) └─ HNSW index                             │
│   ├─ chat_instruction_version                                                │
│   ├─ chat_theme_preset                                                       │
│   ├─ chat_conversation_event                                                 │
│   ├─ chat_feedback                                                           │
│   └─ chat_rate_limit_bucket                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────── Providers (sortants) ────────────────────────────────────┐
│ OpenAI · Google Gemini · Anthropic · Mistral · Qwen / DeepSeek · Ollama      │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 2. Découpage en couches

| Couche                | Responsabilités                                                                                  | Modules                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Présentation**      | Widget, animations, accessibilité, RTL, gestion focus, persistance locale                         | `components/chat/*`, `hooks/use-chat-*`, `lib/chat/store.client.ts`                                      |
| **Application**       | Orchestration des cas d'usage, contrats Zod publics                                              | `app/api/chat/*/route.ts`, `lib/chat/contracts.ts`                                                       |
| **Domaine**           | Règles métier (charte, langue, conversion, modération), agnostique du provider                    | `lib/chat/domain/*`                                                                                      |
| **Adapter providers** | Adapters LangChain.js + raw SDK, isolation totale du domaine                                     | `lib/chat/providers/<openai\|gemini\|anthropic\|qwen\|deepseek\|ollama>.ts`                                          |
| **Infrastructure**    | Persistance Drizzle, vector store, file storage, secrets, logs                                    | `lib/chat/repo/*`, `lib/chat/vector/*`, `lib/chat/secrets.ts`, `lib/chat/logger.ts`                       |
| **Cross-cutting**     | Auth admin, audit, observabilité, tracking, i18n                                                  | `lib/admin/*`, `lib/observability/*`, `lib/i18n/*`                                                       |

## 3. Frontend — flux d'un message

```
Utilisateur tape ──► Composer (debounce 80 ms)
                           │
                           ▼
                  ChatStore.send(text)
                  ├─ optimistic insert (status: 'sending')
                  ├─ POST /api/chat/message  (stream: true, body: { sessionId, text, lang? })
                  ├─ ouvrir EventSource
                  │     ├─ event: 'token'        ──► append au message agent (status: 'streaming')
                  │     ├─ event: 'tool'         ──► afficher pastille « consulte la maison »
                  │     ├─ event: 'meta'         ──► sources citées, durée, provider
                  │     ├─ event: 'done'         ──► status: 'sent'
                  │     └─ event: 'error'        ──► status: 'error', retry button
                  └─ humaniser : différer first-token affiché de Δ(longueur prompt)
                                  voyant « écrit… » avant first-token
```

Le store Zustand expose :

```ts
type ChatStore = {
  sessionId: string | null;
  status: 'idle' | 'opening' | 'open' | 'sending' | 'error';
  language: 'fr' | 'ar' | 'ar-MA';
  messages: ChatMessage[];
  suggestions: string[];
  unread: number;
  open: () => void;
  close: () => void;
  send: (text: string) => Promise<void>;
  retry: (messageId: string) => Promise<void>;
  feedback: (messageId: string, value: 1 | -1, note?: string) => Promise<void>;
  hydrateFromServer: (s: ChatSessionSnapshot) => void;
};
```

## 4. Backend — pipeline détaillé

### 4.1 Entrée

```ts
// app/api/chat/message/route.ts (extrait simplifié, cf. doc 03)
export async function POST(req: NextRequest) {
  const { sessionId, text, lang } = chatMessageInput.parse(await req.json());
  const session = await sessionRepo.getOrCreate(req, sessionId);
  await rateLimit.check(session.id, req.ip);

  const language = lang ?? detectLanguage(text);
  const sanitized = sanitize(text);
  await moderation.input(sanitized);

  return streamResponse(async (write) => {
    const memory = await memoryRepo.recent(session.id, 12);
    const ragHits = await rag.retrieve({ text: sanitized, language, k: 6 });
    const prompt = composePrompt({ instruction, memory, ragHits, language, page: session.page });
    const router = await providerRouter.choose(session.experiment);

    const stream = await router.chat(prompt, { temperature: 0.4, maxTokens: 600 });
    for await (const chunk of stream) {
      const safe = await moderation.outputDelta(chunk);
      if (safe) write({ event: 'token', data: safe });
    }
    await persistMessage(session.id, { user: sanitized, agent: full, ragHits, router });
    write({ event: 'done', data: { messageId, durationMs, sources: ragHits.map(h => h.id) } });
  });
}
```

### 4.2 LangChain.js comme orchestrateur

LangChain est utilisé **comme couche de composition**, pas comme
boîte noire. Le squelette est le suivant :

```ts
// lib/chat/orchestrator.ts
import { RunnableSequence, RunnableMap } from '@langchain/core/runnables';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

export function buildChain({ providerAdapter, retriever, instructionVersion }) {
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', instructionVersion.body],
    ['system', '{contexte_rag}'],
    ['system', '{contexte_page}'],
    ['placeholder', '{historique}'],
    ['human', '{question}'],
  ]);

  return RunnableSequence.from([
    RunnableMap.from({
      contexte_rag: async ({ question, language }) =>
        formatChunks(await retriever.invoke({ question, language })),
      contexte_page: ({ page }) => formatPageContext(page),
      historique: ({ historique }) => historique,
      question: ({ question }) => question,
    }),
    prompt,
    providerAdapter.runnable, // streaming-capable
    new StringOutputParser(),
  ]);
}
```

L'enrichissement futur (tools, agents, function-calling RAG,
mémoire vectorielle de l'utilisateur connecté, planification multi-tour)
se branche sur cette même `RunnableSequence` sans invasion du
reste du code.

### 4.3 Router de modèles

```
                 ┌────────────────────────────────────────┐
                 │  ProviderRouter.choose(experiment?)    │
                 └────────────────┬───────────────────────┘
                                  │
       ┌──────────────────────────┼─────────────────────────┐
       │                          │                         │
   primaire actif?           A/B en cours?            quota OK ?
       │ oui                      │ oui                     │
       ▼                          ▼                         ▼
   provider P1            P_A vs P_B (50/50)        si non → P2 (fallback)
       │                                                    │
       └─── circuit-breaker ouvert ?  oui ──► P2 ──► P3 ──► offline
```

Le routeur est implémenté dans `lib/chat/router.ts`. Il consulte
`chat_provider_config` (priorité, statut, quota mensuel utilisé)
et applique :

1. Sélection nominale (primaire) ;
2. Override A/B test si l'admin a configuré une expérience ;
3. Détection circuit ouvert (3 erreurs 5xx en 60 s = ouvert 5 min) ;
4. Bascule fallback en cascade ;
5. Mode dégradé (réponse pré-écrite « la maison réfléchit, je
   reviens vers toi rapidement ») si tout est tombé.

### 4.4 RAG — flux

Détaillé dans [09-knowledge-base-rag.md](09-knowledge-base-rag.md) :

```
Source (URL/MD/PDF/FAQ) ─► Loader ─► Splitter (sémantique + size)
                                    ▼
                              Chunk + métadonnées (langue, page, fraîcheur)
                                    ▼
                              Embedder (provider de l'admin)
                                    ▼
                              pgvector (HNSW, dimension provider)
```

À la requête :

```
question ─► embed(question, language)
              │
              ▼
        recherche top-k=6 (cosine)
              │
              ▼
    re-ranker léger (cross-encoder ou heuristique mots-clés + fraîcheur)
              │
              ▼
        contexte borné (≤ 1500 tokens) injecté dans le prompt
```

## 5. Diagrammes de séquence

### 5.1 Visiteur ouvre le chat pour la première fois

```
Visiteur     Widget         /api/chat/session     DB
   │            │                  │              │
   │  click ──► │                  │              │
   │            │  GET ─────────► (no cookie)     │
   │            │                  │  insert ──►  │ chat_session
   │            │ ◄──── snapshot   │              │
   │ ◄── salutation contextuelle (animation 240 ms, voyant écrit, puis texte)
```

### 5.2 Visiteur envoie un message (streaming)

```
Visiteur   Widget    /api/chat/message       Router    Provider
   │          │              │                  │          │
   │ tape ──► │              │                  │          │
   │          │ POST stream│                  │          │
   │          │              │  modération ──►  │          │
   │          │              │  RAG retrieve    │          │
   │          │              │  compose ──►    choose ──► │
   │          │              │                  │   stream │
   │          │ ◄─── SSE token                              │
   │          │ ◄─── SSE token                              │
   │          │ ◄─── SSE token                              │
   │          │ ◄─── SSE done {sources, latencyMs, model}   │
   │          │  persist ─► DB                              │
```

### 5.3 Conversion attribuée au chat

```
Visiteur ──► chat ──► commande (≤ 30 j)
                 │           │
                 ▼           ▼
            session_id  attributed_chat_session_id
                 └────► trigger purchase event
                 └────► chat_conversation_event { type: 'conversion' }
```

## 6. Choix techniques engageants

| Choix                                  | Décision                                                      | Justification                                                                       |
| -------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Transport temps réel                   | **Server-Sent Events** (`text/event-stream`)                  | Compatible Vercel serverless, pas de WebSocket à gérer, retries natifs              |
| Orchestration                          | **LangChain.js** (`@langchain/core` + `@langchain/community`) | Composition `Runnable`, écosystème adapters, future-ready agents/tools              |
| Vector store                           | **pgvector** sur Neon Postgres existant                       | Pas de surface d'attaque supplémentaire, indices HNSW corrects pour < 100k chunks   |
| Mémoire conversation                   | **Sliding window 12 messages** + résumé périodique            | Simple, prévisible en coût, suffisant pour V1                                       |
| Détection langue                       | **Heuristique pondérée** (caractères, lexique darija) + LLM   | Latence locale 0 ms, fallback LLM si ambigu                                         |
| Streaming serveur → client             | **ReadableStream** + helper SSE custom                        | Pas d'usage de la lib `eventsource` côté serveur, payload contrôlé                  |
| Modération                             | **OpenAI Moderation** par défaut, fallback heuristique        | Précis, gratuit. Heuristique si quota / autre provider                              |
| Embeddings                             | **Provider de l'admin** (default `text-embedding-3-small`)    | Cohérent avec router. Reindex automatique si embedder change                        |
| Chiffrement secrets                    | **AES-256-GCM via clé KMS Vercel Env**                        | Reversible côté serveur seulement                                                   |
| Cookie session                         | **iron-session existant** (rotatif, signé)                    | Réutilise infra admin, pas de nouvelle dépendance                                   |
| Style                                  | **Tailwind + tokens CSS** existants                           | Aucun drift visuel, presets versionnés                                              |
| Animations                             | **framer-motion** existant + `prefers-reduced-motion`         | Sans recompilation, comportement à plat respecté                                    |
| Tests                                  | **Vitest (unit) + MSW (integration providers) + Playwright**  | Cohérent avec le reste du repo                                                      |
| Persistance locale widget              | **`localStorage` + `sessionStorage`**                          | Pas de IndexedDB pour V1 ; payload < 200 ko                                         |

## 7. Cycle de vie d'une session

```
[start] ──► open widget ──► message_1 ──► message_2 ──► ... ──► idle (5 min) ──► close
                                                                             ──► résumé ── stockage
                                                                             ──► purge ressources mémoire
                                                                             ──► garde DB 30 j puis archive
```

États serveur d'une `chat_session` : `open`, `idle`, `archived`,
`purged` (RGPD).

## 8. Multi-tenant et environnements

| Environnement | Provider primaire   | Quota / mois | Modération    | Logs verbosité |
| ------------- | ------------------- | ------------ | ------------- | -------------- |
| Local (dev)   | Ollama (llama3.1)   | illimité     | heuristique   | debug          |
| Preview       | OpenAI mini         | 5 €          | OpenAI mod.   | info           |
| Production    | OpenAI 4o-mini      | 200 €        | OpenAI mod.   | warn           |

Tous les paramètres sont overridables via `chat_provider_config`.

## 9. Évolutions prévues

- **Tools / function-calling** (Phase 2) : `getOrderStatus`,
  `recommendRitual`, `subscribeJournal`, `bookConsultation`.
- **Mémoire vectorielle visiteur connectée** (Phase 2) : pour
  initiées identifiées (compte client), corrélation cross-session.
- **Voix** (Phase 3) : Whisper côté in, ElevenLabs / OpenAI tts
  côté out.
- **Agent multi-tour** (Phase 3) : planification d'achats croisés.
- **Hand-off humain** (Phase 3) : si charge support couvre 24/7.

## 10. Contrats inter-modules

| Module amont          | Module aval               | Contrat                                                                                     |
| --------------------- | ------------------------- | ------------------------------------------------------------------------------------------- |
| `tracking`            | `chat`                    | Le chat émet `chat_open`, `chat_message_sent`, `chat_conversion_attributed` au datalayer    |
| `admin-config`        | `chat`                    | Hot-reload des configs via `revalidateTag('chat-config')`                                   |
| `media`               | `chat` (Phase 2)          | URL signées de blob pour pièces jointes                                                     |
| `seo-cms`             | `chat` (knowledge)        | Source de vérité pages publiques, indexable par RAG ingestion                               |
| `products-cms`        | `chat` (knowledge)        | Source de vérité fiches produits / kits                                                     |

## 11. Lecture suivante

- [02 — Couche data](02-data.md) pour les schémas Drizzle.
- [03 — Backend](03-backend.md) pour les routes API et services.
- [10 — Providers & modèles](10-providers-models.md) pour
  l'adapter pattern.
