# Protocole SSE — 7 événements canoniques

> Le serveur stream du Server-Sent Events. Chaque ligne est un événement JSON. Le client consomme via `EventSource` natif + parsers Zod.

## Format wire

```
event: <event-type>
data: <JSON string>
\n
```

Exemple complet d'un tour :

```
event: meta
data: {"provider":"openai","model":"gpt-4o-mini","messageId":"4f...","intent":"pricing"}

event: tool_call
data: {"tool":"get_product","status":"ok","resultPreview":{"slug":"pack-femiglow","priceMad":199}}

event: source
data: {"chunkId":"...","label":"Page produit Pack","url":"/kit"}

event: delta
data: "Le Pack FemiGlow est à"

event: delta
data: " 199 dh au lieu de 390 dh."

event: lead_form_offered
data: {"reason":"purchase-intent"}

event: done
data: {"totalCost":0.0014,"latencyMs":1623,"firstTokenMs":612}
```

## Catalogue des 7 événements

### 1. `event: meta`

Envoyé en **premier** systématiquement. Contient les metadata du tour.

```ts
type MetaEvent = {
  type: 'meta'
  data: {
    provider: 'openai' | 'anthropic' | 'mistral' | 'gemini' | 'ollama' | 'canned' | 'faq'
    model?: string                  // null pour canned/faq
    messageId: string               // UUID de l'assistant message à créer
    intent: string                  // détecté côté serveur
    intentConfidence: number        // 0–1
    intentSource: 'regex' | 'embedding' | 'llm-mini'
    retrievalStrategy: 'rag' | 'tool' | 'hybrid' | 'faq-bypass' | 'canned-bypass' | 'none'
    language: 'fr' | 'ar' | 'ar-MA'
  }
}
```

Action client : créer le placeholder assistant message avec ces meta.

### 2. `event: source`

Émis 0 à N fois selon les chunks RAG cités. Permet d'afficher les sources sous la bulle.

```ts
type SourceEvent = {
  type: 'source'
  data: {
    chunkId: string
    label: string                   // ex. "Page produit Pack FemiGlow"
    url?: string                    // ex. "/kit" si interne, externe si URL
    relevance: number               // 0–1
  }
}
```

Action client : append à `meta.sources` du message en streaming.

### 3. `event: tool_call`

Émis quand un tool est invoqué (succès ou échec).

```ts
type ToolCallEvent = {
  type: 'tool_call'
  data: {
    tool: 'get_product' | 'get_delivery_info' | 'search_faq' | 'check_promo' | 'get_order_status'
    status: 'ok' | 'timeout' | 'error' | 'not_found'
    durationMs: number
    resultPreview?: object          // 1–2 champs publics pour debug UI éventuel
  }
}
```

Action client : afficher un `ToolBadge` éphémère sous la bulle ("🔧 Vérification livraison : OK"). N'apparait que si `status === 'ok'`.

### 4. `event: delta`

Émis en rafale pendant la génération LLM. Chaque event contient un fragment de texte.

```ts
type DeltaEvent = {
  type: 'delta'
  data: string                      // pas un objet — juste le chunk de texte
}
```

Action client : `appendDelta(messageId, text)`. Pas de re-tokenize, pas de re-parse markdown — accumulation directe puis re-render quand le `done` arrive.

Pour les **deltas en darija/arabe**, attention à la directionalité : le RTL est géré au niveau du conteneur (`dir="rtl"`), pas par chunk.

### 5. `event: lead_form_offered`

Le serveur recommande l'affichage du formulaire lead.

```ts
type LeadFormOfferedEvent = {
  type: 'lead_form_offered'
  data: {
    reason: 'purchase-intent' | 'b2b' | 'callback-request' | 'after-hours' | 'provider-down' | 'budget'
    suggestedFields: ('name' | 'phone' | 'email' | 'city')[]
    cta: string                     // localisé : "Soyez rappelée"
  }
}
```

Action client : ouvrir le `LeadForm` inline sous la bulle assistant.

### 6. `event: done`

Signal de fin de stream **sans erreur**.

```ts
type DoneEvent = {
  type: 'done'
  data: {
    totalCost: number               // USD
    latencyMs: number
    firstTokenMs: number
    inputTokens: number
    outputTokens: number
    messageId: string               // confirmation
  }
}
```

Action client : flip message → `status: 'completed'`, fsm → `resolved`, close EventSource.

### 7. `event: error`

Erreur en milieu/début de stream. Pas de `done` ne sera envoyé après.

```ts
type ErrorEvent = {
  type: 'error'
  data: {
    code: 'PROVIDER_DOWN' | 'BUDGET_EXHAUSTED' | 'TOOL_FAILED' | 'INTERNAL' | 'RATE_LIMIT'
    message: string                 // déjà localisé FR/AR/AR-MA
    fallbackOffered: boolean        // true si le serveur va enchaîner sur du canned
  }
}
```

Action client : marquer message `status: 'failed'`, afficher message + retry OU lead form selon `fallbackOffered`.

## Implémentation client

### Hook `useChatSSE`

```ts
function useChatSSE() {
  const ingest = useChatStore(s => s._ingestSseEvent)
  const sourceRef = useRef<EventSource | null>(null)
  
  const open = useCallback(({ sessionId, text }: { sessionId: string, text: string }) => {
    // EventSource natif ne supporte pas POST direct ; on utilise SSE-over-fetch
    // via abortable streaming (fetch + ReadableStream)
    const ctrl = new AbortController()
    
    fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, text, pathname: location.pathname }),
      signal: ctrl.signal,
    }).then(async res => {
      if (!res.ok) {
        ingest({ type: 'error', data: { code: 'INTERNAL', message: '…', fallbackOffered: false } })
        return
      }
      
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        
        let idx
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const parsed = parseSseFrame(raw)
          if (parsed) ingest(parsed)
        }
      }
    }).catch(err => {
      if (err.name === 'AbortError') return
      ingest({ type: 'error', data: { code: 'INTERNAL', message: '…', fallbackOffered: false } })
    })
    
    return () => ctrl.abort()
  }, [ingest])
  
  return { open }
}

function parseSseFrame(raw: string): SseEvent | null {
  const lines = raw.split('\n')
  let type = ''
  let dataStr = ''
  for (const line of lines) {
    if (line.startsWith('event: ')) type = line.slice(7).trim()
    else if (line.startsWith('data: ')) dataStr = line.slice(6)
  }
  if (!type) return null
  try {
    return SseEventSchema.parse({ type, data: type === 'delta' ? dataStr : JSON.parse(dataStr) })
  } catch {
    return null
  }
}
```

### Schema Zod côté client

```ts
const SseEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('meta'),    data: MetaSchema }),
  z.object({ type: z.literal('source'),  data: SourceSchema }),
  z.object({ type: z.literal('tool_call'), data: ToolCallSchema }),
  z.object({ type: z.literal('delta'),   data: z.string() }),
  z.object({ type: z.literal('lead_form_offered'), data: LeadFormOfferedSchema }),
  z.object({ type: z.literal('done'),    data: DoneSchema }),
  z.object({ type: z.literal('error'),   data: ErrorSchema }),
])
```

## Reconnexion & robustesse

| Situation | Action |
|---|---|
| Connexion perdue mid-stream | Pas de retry auto (stream non-idempotent). Affiche un retry button. |
| Buffer overflow (1 MB) | Close stream, error code `BUFFER_OVERFLOW`. |
| Frame mal formée | Skip silencieusement, log Sentry. |
| EventSource bloqué par AdBlocker | Détection (timeout > 5 s sans event) → fallback non-stream JSON. |
| Onglet en background | Pas de pause (stream continue), mais cadence visible quand l'utilisateur revient. |

## Headers HTTP serveur

```
content-type: text/event-stream
cache-control: no-cache, no-transform
connection: keep-alive
x-accel-buffering: no                   # disable nginx buffering
```

## Backpressure

Si le client ne lit pas assez vite (CPU saturé), le `fetch().body.getReader()` applique naturellement de la backpressure. On a budget 30 s **côté serveur** pour terminer un stream, sinon timeout côté Vercel/Cloudflare → `event: error`.

## Tests

| Cas | Type | Critère |
|---|---|---|
| Parsing frame meta → state OK | unit | OK |
| Frame mal formée → skip + log | unit | OK |
| Buffer reconstitue chunks coupés | unit | OK |
| Abort en milieu de stream | integration | EventSource closed, ressources clean |
| MSW mock 7 événements | MSW | full pipeline test |
| Stream 5 secondes sans interruption | E2E | OK |
| Error event → UI fallback | E2E | OK |
