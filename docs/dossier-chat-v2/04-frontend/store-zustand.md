# Store Zustand — Shape, actions, persistance

> Source unique de vérité côté client. Persist sélective via `zustand/middleware/persist`. Cible : zero re-render gratuit, sélecteurs granulaires.

## Shape complète

```ts
interface ChatStore {
  // — Session —
  sessionId: string | null
  visitorToken: string
  language: 'fr' | 'ar' | 'ar-MA'
  audience: 'all' | 'b2c' | 'b2b'
  consentVersion: string | null
  
  // — UI —
  isOpen: boolean
  fsmState: FsmState              // 'closed' | 'greeting' | 'userTyping' | 'streaming' | ...
  serviceLevel: 0 | 1 | 2 | 3 | 4
  
  // — Conversation —
  greeting: string | null
  suggestions: Suggestion[]
  messages: ChatMessage[]
  pendingMessage: string          // texte composer non envoyé (perdu en cas refresh, by design)
  
  // — Streaming —
  streamingMessageId: string | null
  streamingProvider: string | null  // 'openai', 'anthropic', ...
  streamingError: ChatErrorView | null
  
  // — Lead form —
  leadFormOffered: boolean
  leadFormReason: 'b2b' | 'callback-request' | 'provider-down' | 'budget' | null
  leadFormSubmitted: boolean
  
  // — Feedback —
  feedbackGiven: Record<MessageId, -1 | 1>
  
  // — Diagnostics —
  unreadCount: number
  lastError: ChatErrorView | null
  
  // — Actions —
  openChat: () => void
  closeChat: () => void
  initSession: (pathname: string) => Promise<void>
  sendMessage: (text: string) => Promise<void>
  pickSuggestion: (key: string) => Promise<void>
  cancelStreaming: () => void
  retryLastMessage: () => Promise<void>
  submitLead: (input: LeadInput) => Promise<void>
  giveFeedback: (messageId: string, rating: -1 | 1) => Promise<void>
  resetSession: () => void
  setLanguage: (lang: 'fr' | 'ar' | 'ar-MA') => void
  
  // — Internals (préfixées _) —
  _appendDelta: (messageId: string, chunk: string) => void
  _ingestSseEvent: (event: SseEvent) => void
  _setFsmState: (next: FsmState) => void
  _setServiceLevel: (sl: ServiceLevel) => void
  _persistGuard: () => boolean    // sanity check pre-persist
}
```

## Sous-types

```ts
type FsmState =
  | 'closed' | 'greeting' | 'userTyping' | 'streaming'
  | 'localStreaming' | 'leadFormShown' | 'errorRecovery' | 'resolved'

interface ChatMessage {
  id: string                      // UUID v4 client-side
  role: 'user' | 'assistant' | 'system'
  content: string
  language: 'fr' | 'ar' | 'ar-MA'
  createdAt: string               // ISO
  status: 'sending' | 'sent' | 'streaming' | 'completed' | 'failed'
  meta?: {
    source?: 'llm' | 'canned' | 'faq' | 'suggestion' | 'tool-augmented'
    provider?: string
    intent?: string
    pairKey?: string
    ctaLabel?: string
    ctaUrl?: string
    sources?: { label: string, url?: string }[]
    toolsUsed?: string[]
    latencyMs?: number
    firstTokenMs?: number
  }
}

interface Suggestion {
  key: string
  label: string
  audience: 'all' | 'b2c' | 'b2b'
}

interface ChatErrorView {
  code: string                    // 'PROVIDER_DOWN' | 'VALIDATION' | ...
  message: string                 // déjà localisé
  retryable: boolean
}

type LeadInput = {
  name?: string
  phone: string
  email?: string
  city?: string
  reason?: string
  consentVersion: string
}
```

## Persistance

```ts
import { persist, createJSONStorage } from 'zustand/middleware'

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({ /* state + actions */ }),
    {
      name: 'femiglow-chat-v2',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      
      partialize: (state) => ({
        sessionId: state.sessionId,
        visitorToken: state.visitorToken,
        language: state.language,
        audience: state.audience,
        consentVersion: state.consentVersion,
        messages: state.messages.slice(-50),    // hard cap
        feedbackGiven: state.feedbackGiven,
      }),
      
      migrate: (persisted, version) => {
        if (version < 2) {
          // Migration v1 → v2 : ajout du champ language
          persisted.language = persisted.language ?? 'fr'
        }
        return persisted
      },
      
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Sanity : si > 30j depuis dernière activité, on reset
        const last = state.messages.at(-1)
        if (last && Date.now() - new Date(last.createdAt).getTime() > 30 * 86_400_000) {
          state.resetSession()
        }
      },
    }
  )
)
```

## Sélecteurs idiomatiques

Éviter de subscriber au store entier — utiliser des sélecteurs granulaires pour éviter les re-renders.

```ts
// ❌ Re-render à chaque changement de n'importe quoi
const store = useChatStore()

// ✅ Re-render seulement quand isOpen change
const isOpen = useChatStore(s => s.isOpen)

// ✅ Re-render seulement quand messages change
const messages = useChatStore(s => s.messages)

// ✅ Shallow compare pour objets
import { shallow } from 'zustand/shallow'
const { isOpen, unreadCount } = useChatStore(
  s => ({ isOpen: s.isOpen, unreadCount: s.unreadCount }),
  shallow
)
```

## Actions clés — Implémentation

### initSession

```ts
initSession: async (pathname) => {
  const { visitorToken, audience, language } = get()
  
  // Si on a déjà sessionId valide, juste demander suggestions à jour
  const res = await fetch('/api/chat/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ visitorToken, pathname, audience, language })
  })
  
  if (!res.ok) {
    set({ lastError: { code: 'INIT_FAILED', message: '…', retryable: true } })
    return
  }
  
  const snapshot = await res.json()
  set({
    sessionId: snapshot.sessionId,
    visitorToken: snapshot.visitorToken,
    language: snapshot.language,
    greeting: snapshot.greeting,
    suggestions: snapshot.suggestions,
    consentVersion: snapshot.consentVersion,
    serviceLevel: snapshot.serviceLevel,
    messages: snapshot.messages,
    fsmState: 'greeting',
  })
}
```

### sendMessage

```ts
sendMessage: async (text) => {
  const { sessionId } = get()
  if (!sessionId) return
  
  const userMessageId = crypto.randomUUID()
  const userMessage: ChatMessage = {
    id: userMessageId,
    role: 'user',
    content: text,
    language: get().language,
    createdAt: new Date().toISOString(),
    status: 'sending',
  }
  
  // 1. Optimistic update
  set(s => ({
    messages: [...s.messages, userMessage],
    pendingMessage: '',
    fsmState: 'streaming',
  }))
  
  // 2. Open SSE
  const assistantPlaceholderId = crypto.randomUUID()
  set(s => ({
    streamingMessageId: assistantPlaceholderId,
    messages: [...s.messages, {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      language: get().language,
      createdAt: new Date().toISOString(),
      status: 'streaming',
    }],
  }))
  
  await openSseStream({
    sessionId,
    text,
    onEvent: get()._ingestSseEvent,
  })
}
```

### _ingestSseEvent

```ts
_ingestSseEvent: (event) => {
  switch (event.type) {
    case 'meta':
      set(s => ({
        streamingProvider: event.data.provider,
        messages: s.messages.map(m =>
          m.id === s.streamingMessageId
            ? { ...m, meta: { ...m.meta, provider: event.data.provider } }
            : m
        ),
      }))
      break
    
    case 'delta':
      get()._appendDelta(get().streamingMessageId!, event.data)
      break
    
    case 'source':
      set(s => ({
        messages: s.messages.map(m =>
          m.id === s.streamingMessageId
            ? { ...m, meta: { ...m.meta, sources: [...(m.meta?.sources ?? []), event.data] } }
            : m
        ),
      }))
      break
    
    case 'tool_call':
      // Affiche un toast inline éphémère
      break
    
    case 'lead_form_offered':
      set({ leadFormOffered: true, leadFormReason: event.data.reason })
      break
    
    case 'done':
      set(s => ({
        streamingMessageId: null,
        streamingProvider: null,
        fsmState: 'resolved',
        messages: s.messages.map(m =>
          m.id === s.streamingMessageId
            ? { ...m, status: 'completed', meta: { ...m.meta, latencyMs: event.data.latencyMs } }
            : m.status === 'sending' ? { ...m, status: 'sent' } : m
        ),
      }))
      break
    
    case 'error':
      set(s => ({
        streamingError: { code: event.data.code, message: event.data.message, retryable: true },
        fsmState: 'errorRecovery',
        messages: s.messages.map(m =>
          m.id === s.streamingMessageId ? { ...m, status: 'failed' } : m
        ),
      }))
      break
  }
}
```

### pickSuggestion

```ts
pickSuggestion: async (key) => {
  const { sessionId, language } = get()
  if (!sessionId) return
  
  set({ fsmState: 'localStreaming' })
  
  const res = await fetch(`/api/chat/canned-pair/${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, language, pathname: location.pathname })
  })
  
  if (!res.ok) {
    /* fallback */
    return
  }
  
  const { userMessageId, assistantMessageId, scriptedReply, ctaLabel, ctaUrl } = await res.json()
  
  // Ajoute user message (juste la pill label) puis l'assistant message vide
  // qu'on va remplir via useLocalStream
  set(s => ({
    messages: [...s.messages, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',                          // sera rempli par useLocalStream
      language,
      createdAt: new Date().toISOString(),
      status: 'streaming',
      meta: { source: 'canned', ctaLabel, ctaUrl, scriptedReply },
    }],
    streamingMessageId: assistantMessageId,
  }))
  
  // Le composant MessageBubble détectera `meta.scriptedReply` et lancera useLocalStream.
}
```

## Devtools

En dev, on monte `zustand/middleware/devtools` pour le Redux DevTools Extension. Désactivé en prod via `NEXT_PUBLIC_ENV === 'production'`.

## Tests

| Cas | Type | Critère |
|---|---|---|
| initSession idempotent | unit | Appel 2× ne crée pas 2 sessions |
| sendMessage marque user 'sending' immédiat | unit | optimistic visible avant SSE |
| _ingestSseEvent('done') flip fsm → resolved | unit | OK |
| _ingestSseEvent('error') affiche fallback | unit | OK |
| persist version 1 → 2 migration | unit | language par défaut 'fr' |
| rehydrate après 31 jours → resetSession | unit | OK |
| messages cap à 50 | unit | OK |
