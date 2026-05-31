# F08 — SSE streaming reception

## 1. Description fonctionnelle

### 1.1 Cible
Réception en temps réel des chunks de réponse assistant via Server-Sent Events depuis
`POST /api/chat/message`. Affichage progressif avec humanize jitter (30–50 ms) pour
illusion de frappe.

### 1.2 Comportement attendu (happy path)
1. Visiteur tape un message + clique "Envoyer"
2. Client ouvre une fetch streaming vers `POST /api/chat/message` (body JSON)
3. Réponse : `Content-Type: text/event-stream`
4. Le client lit `ReadableStream` chunk-par-chunk via `TextDecoderStream`
5. Pour chaque chunk SSE :
   - parsé : `event: chunk\ndata: {"text":"..."}` ou `event: end\ndata: {...}`
   - appliqué le store Zustand (`appendChunkToLastMessage`)
6. À l'event `end` : message marqué `complete`, isSending=false
7. À l'event `error` : toast erreur + isSending=false
8. À `lead-form-offer` : insertion d'une `LeadFormBubble` dans la liste

### 1.3 Comportements alternatifs / edge cases

| Cas | Comportement |
|-----|--------------|
| Connection drop mid-stream | Message marqué `partial`, bouton retry |
| Visitor ferme la tab | `AbortController.abort()` → /api/chat/message reçoit signal, persiste partial |
| Réception lente (> 10 s sans chunk) | Heartbeat affiché ("L'assistant réfléchit…") |
| Event SSE malformé | Skip + log warning (pas de crash) |
| Type chunk inconnu | Skip + log warning |
| Réponse non-SSE (HTML err page) | Fallback : afficher toast + bouton retry |
| Multiple `start` consécutifs | Premier respecté, autres ignorés |
| Empty event (heartbeat) | Ignoré silencieusement |

### 1.4 Interfaces / contrats

**Schéma SSE attendu** (Zod `ChatStreamEvent`) :
```typescript
type ChatStreamEvent =
  | { event: 'start';   data: { messageId: string; latency: number } }
  | { event: 'chunk';   data: { text: string } }
  | { event: 'source';  data: { id: string; url?: string; score: number; label: string } }
  | { event: 'end';     data: { messageId: string; usage: { tokensIn: number; tokensOut: number; cost: number } } }
  | { event: 'error';   data: { code: string; message: string } }
  | { event: 'lead-form-offer'; data: { reason: string; copyVariant: string } };
```

**Composants** :
- `useChatSend` hook — gère le fetch streaming + AbortController
- `sse-reader.ts` — parse les events SSE depuis ReadableStream
- `chat-store.ts` — applique les mutations atomiques
- `humanize.client.ts` — applique jitter (pas en mode test)

### 1.5 Dépendances
- API route `POST /api/chat/message`
- Zustand store
- AbortController (mémorise pour cancel)

## 2. Risques

### 2.1 Métier
- **Pas de réponse visible** → UX cassée → 0 conversion
- **Chunks dans le désordre** → texte incompréhensible
- **Message non flushé à la fermeture** → données perdues

### 2.2 Techniques
- Race conditions sur le store (mutations concurrentes)
- Memory leak si ReadableStream pas closed
- AbortController pas appelé → coût LLM gaspillé (cf. **R5** audit)
- Backpressure si chunks plus rapides que rendering

### 2.3 Mapping audit
- **C5** — SSE event `message_complete` non contractuel (test doit prouver le bug et valider le fix)
- **R5** — SSE writer swallow errors (test abort doit valider propagation)

## 3. Stratégie de test

### 3.1 Couches utilisées
- [x] Unit (`sse-reader.ts` parser)
- [x] Integration (route + orchestrator complet via MSW)
- [x] Component (hook `useChatSend` avec mock fetch)
- [x] E2E (visiteur reçoit réponse complète)

### 3.2 Données de test
- MSW handler `chat-internal` qui retourne SSE stream contrôlé
- Helper `makeSseStream(events[])` pour fabriquer streams custom

## 4. Couverture cible

| Métrique | Cible |
|----------|-------|
| Coverage line `sse-reader.ts` | 95 % |
| Coverage line `use-chat-send.ts` | 95 % |
| Branch coverage gestion erreurs | 95 % |
| Pass rate CI | 100 % |
| Latence first chunk (E2E avec MSW) | < 800 ms P95 |

## 5. Liens

- 📊 [test-matrix.csv](test-matrix.csv)
- 📜 [scenarios.gherkin](scenarios.gherkin)
- 📐 [sequence-diagram.puml](sequence-diagram.puml)
- 🧪🎭 [tests-plan.md](tests-plan.md) — Plan combiné vitest + Playwright
- 🔗 [msw-handlers.md](msw-handlers.md)

## Métadonnées

- **Owner** : Frontend + Backend (joint)
- **Priorité** : P0 (bloquant release)
- **Status** : DRAFT
