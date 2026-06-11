# F15 — POST /api/chat/message (SSE orchestrator endpoint)

## 1. Description fonctionnelle

### Cible
Endpoint principal du chat. Reçoit le message visiteur, orchestre tout le pipeline
(sanitize → intent → modération → RAG/FAQ → LLM → events), retourne un stream SSE.

### Contrat I/O

**Request** (Zod `ChatMessageInput`) :
```typescript
{
  sessionId: string,
  content: string,             // 1-2000 chars
  language?: 'fr-MA' | 'ar' | 'ar-MA',
  pageContext?: { url: string, title?: string },
  abortable?: boolean,         // default true
}
```

**Response** (SSE `text/event-stream`) — séquence d'events `ChatStreamEvent` :
```
event: start
data: {"messageId":"m_1","latency":42}

event: chunk
data: {"text":"Bonjour"}

event: chunk
data: {"text":" visiteur !"}

event: source
data: {"id":"src_1","url":"/kit","score":0.82,"label":"Page kit"}

event: lead-form-offer
data: {"reason":"purchase-intent","copyVariant":"default"}

event: end
data: {"messageId":"m_1","usage":{"tokensIn":120,"tokensOut":42,"cost":0.012}}
```

### Codes HTTP
- 200 — SSE stream
- 401 — session inconnue
- 422 — validation (Zod)
- 429 — rate limit (IP/session/visitor)
- 503 — chat_enabled=false ou tous providers down (futur ADR-004 level 3)

### Edge cases
| Cas | Comportement |
|-----|--------------|
| Session inconnue / forgotten | 401 |
| Content vide / > 2000 chars | 422 |
| Rate limit hit | 429 + retry-after |
| Moderation inbound flagged | event `chunk` avec message scripté + event `end` (PAS d'event `message_complete` — voir C5) |
| Charter inbound flagged | event `error` + log |
| Tous providers down (breaker open) | event `error` + log + (futur) fallback CANNED_ONLY |
| Budget mensuel dépassé | event `error` + (futur) fallback CANNED_ONLY |
| FAQ match | event `chunk` avec scripted reply + event `end` (pas de LLM) |
| Client abort | request.signal.aborted → propagation upstream LLM, persist partial |

## 2. Risques mappés audit

| Risque | Test associé |
|--------|--------------|
| C2 — Modération outbound advisory | Test prouve que toxique arrive client (RED) ; passe une fois fix livré |
| C5 — SSE event `message_complete` non contractuel | Test valide enum strict |
| C6 — Race breaker memory↔Redis | Test concurrence |
| R2 — FAQ branch hors modération | Test FAQ + contenu toxique |
| R5 — SSE writer swallow errors | Test abort propagation |

## 3. Tests proposés (28+ cas)

### Unit (orchestrator-level, mocked DB/HTTP)
- Pipeline order respecté (sanitize avant moderation avant RAG)
- Inbound moderation bloque (event chunk script + end)
- Charter inbound bloque
- Budget guard appelé AVANT streamReply (C4 régression)
- AbortController propagé au provider (R5 régression)

### Integration (vraies DB + MSW pour LLM)
- POST 200 SSE bien formé sur happy path
- POST 422 sur content vide
- POST 429 quand rate limit session
- POST 429 quand rate limit visitor (I4 régression)
- POST 503 quand chat_enabled=false
- POST 200 avec FAQ match (pas d'event source RAG)
- POST 200 avec RAG (events source présents)
- POST event lead-form-offer sur purchase-intent
- POST events strictement dans enum ChatStreamEvent (C5 régression)
- POST envoie chunk modéré pour message blocklist
- POST persiste partial message si client abort
- POST envoie event error si tous providers fail
- POST applique budget guard (C4 régression)

### E2E (via Playwright)
- Visiteur envoie message → reçoit réponse complète
- Visiteur tape message contenant insulte → reçoit scripted reply
- Visiteur en /kit → tools (futur) appelés (skip si ADR-002 absent)
- Visitor ar-MA → reçoit réponse en darija
- 10 messages rapides → 429 sur le 11e (rate limit)
- Abort mid-stream → request annulée côté serveur

### Tests négatifs critiques (bug regression)
- `attributeConversion` jamais appelé en runtime (I1 — test négatif explicite tant que pas fixé)
- `message_complete` event renamé en `end` (C5)
- `assertBudget` appelé dans la route (C4)
- visitor rate-limit consommé (I4)

## 4. Test matrix

Voir [test-matrix.csv](test-matrix.csv) — 28 cas.

## 5. Scénarios Gherkin clés

```gherkin
Scénario: Réponse nominale
  Étant donné une session active
  Quand POST /api/chat/message avec content="Bonjour"
  Alors je reçois un stream SSE
  Et le premier event est "start"
  Et au moins un event "chunk" suit
  Et le dernier event est "end"
  Et aucun event hors enum n'est émis

Scénario: Modération inbound bloque
  Étant donné une session active
  Et que le moderation API flag le contenu
  Quand POST /api/chat/message avec content toxique
  Alors je reçois "chunk" avec message scripté de refus
  Et puis "end"
  Et JAMAIS "message_complete"
  Et le user message est persisté APRÈS moderation (R1 fix)

Scénario: Visitor rate limit (régression I4)
  Étant donné un visitor_id qui a fait 90 req dans la dernière minute
  Quand POST /api/chat/message
  Alors le statut est 429
  Et le header retry-after est présent

Scénario: Budget guard (régression C4)
  Étant donné que le budget mensuel est dépassé
  Quand POST /api/chat/message
  Alors aucun appel LLM n'est fait
  Et je reçois event "error" code="budget_exceeded"
  (futur ADR-004 : fallback CANNED_ONLY)
```

## 6. MSW handlers requis

| Handler | Cas |
|---------|-----|
| `openai-chat` ok | happy path |
| `openai-chat` 500 | provider failure |
| `openai-chat` slow (timeout) | breaker test |
| `openai-moderations` flagged | moderation block |
| `openai-embeddings` ok | RAG + FAQ |

## Métadonnées
- Owner: Backend
- Priorité: P0
- Risques audit: C2, C5, C6, R2, R5, I4 (test régression), C4 (test régression), I1 (test négatif)
