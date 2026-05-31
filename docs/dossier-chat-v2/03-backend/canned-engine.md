# Canned engine — Suggestions & continuité

> Spec d'implémentation de l'ADR‑003. Module `lib/chat/services/canned-engine.ts`. Vague V4.

## Responsabilités

1. Charger les paires canned actives pour une page donnée (`themeService.resolveSalutations()`).
2. Servir une réponse canned au clic d'une pill (`servePairByKey()`).
3. Persister proprement les deux messages (user + assistant) avec metadata.
4. Émettre les événements KPI (`suggestion_clicked`, `canned_used`).
5. Préparer le contexte LLM pour le tour suivant **sans rupture**.

## API du service

```
async function resolveSalutations(opts: {
  pathname: string
  audience: 'all' | 'b2c' | 'b2b'
  language: 'fr' | 'ar' | 'ar-MA'
}): Promise<{
  greeting: string
  suggestions: Array<{ key, label, audience }>
}>

async function servePairByKey(opts: {
  sessionId: string
  pairKey: string
  language: 'fr' | 'ar' | 'ar-MA'
  pathname: string
}): Promise<{
  userMessage: ChatMessage         // déjà persisté
  assistantMessage: ChatMessage    // déjà persisté
  scriptedReply: string            // pour le client (streaming local)
  allowFollowupLLM: boolean
}>

async function getEphemeralLLMNote(opts: {
  sessionId: string
  language: 'fr' | 'ar' | 'ar-MA'
}): Promise<string | null>
  // Retourne la note système à ajouter au prompt LLM si les 2 derniers
  // tours contiennent au moins un message canned. Sinon null.
```

## resolveSalutations

```
async function resolveSalutations({ pathname, audience, language }):
  themePreset = await getActiveThemePreset()
  
  # Greeting via pageSalutations JSONB
  matchingSalutation = themePreset.page_salutations
    .find(s => matchPattern(pathname, s.pathPattern))
    ?? themePreset.page_salutations.find(s => s.pathPattern === '*')
  
  greeting = matchingSalutation
    ? matchingSalutation[language] || matchingSalutation.fr
    : DEFAULT_GREETING[language]
  
  # Suggestions
  pairs = SELECT key, label_${language} AS label, audience
          FROM chat_canned_pair
          WHERE status = 'published'
            AND enabled = true
            AND matchPattern(page_pattern, $pathname)
            AND (audience = 'all' OR audience = $audience)
          ORDER BY order ASC
          LIMIT 3
  
  return { greeting, suggestions: pairs }
```

### Pattern matching

`matchPattern(pathname, pattern)` :
- `*` → match toujours.
- `/kit` → match exact.
- `/kit/*` → match `/kit/anything` mais pas `/kit`.
- Cas plus complexes : utiliser `path-to-regexp` (déjà dépendance Next.js indirecte).

### Fallback greeting

```
DEFAULT_GREETING = {
  fr: "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
  ar: "مرحباً ! كيف يمكنني مساعدتكم اليوم ؟",
  ar-MA: "Marhba bik ! Kifach n3awnek lyoma ?"
}
```

## servePairByKey

```
async function servePairByKey({ sessionId, pairKey, language, pathname }):
  pair = SELECT * FROM chat_canned_pair
         WHERE key = $1 AND status = 'published' AND enabled = true
  
  if !pair: throw NotFoundError('canned pair not found or not published')
  
  # Sécurité : matcher l'audience de la session
  session = await loadSession(sessionId)
  audience = session.audience ?? 'all'
  if pair.audience !== 'all' && pair.audience !== audience:
    throw ForbiddenError('canned pair not for this audience')
  
  scriptedReply = pair[`scripted_reply_${language}`] ?? pair.scripted_reply_fr
  label = pair[`label_${language}`] ?? pair.label_fr
  
  # Persist en transaction
  tx.begin()
    userMessage = INSERT chat_message {
      session_id: sessionId,
      role: 'user',
      content: label,
      language: language,
      intent: null,  # implicite via pair
      meta: { source: 'suggestion', pairKey: pair.key }
    }
    assistantMessage = INSERT chat_message {
      session_id: sessionId,
      role: 'assistant',
      content: scriptedReply,
      language: language,
      provider: null,  # pas de LLM
      cost: 0,
      latency_ms: 0,
      first_token_ms: 0,
      meta: {
        source: 'canned',
        pairKey: pair.key,
        pairVersionId: pair.current_version_id,
        ctaLabel: pair.cta_label,
        ctaUrl: pair.cta_url,
        allowFollowupLLM: pair.allow_followup_llm
      }
    }
    INSERT chat_conversation_event {
      session_id: sessionId,
      message_id: assistantMessage.id,
      type: 'suggestion_clicked',
      payload: { pairKey: pair.key, label }
    }
    INSERT chat_conversation_event {
      session_id: sessionId,
      message_id: assistantMessage.id,
      type: 'canned_used',
      payload: { pairKey: pair.key, language }
    }
  tx.commit()
  
  return {
    userMessage,
    assistantMessage,
    scriptedReply,
    allowFollowupLLM: pair.allow_followup_llm
  }
```

## getEphemeralLLMNote (continuité)

C'est **la clé** de la continuité ADR‑003.

```
async function getEphemeralLLMNote({ sessionId, language }):
  recent = SELECT role, meta FROM chat_message
           WHERE session_id = $1
           ORDER BY created_at DESC
           LIMIT 4
  
  hasCanned = recent.some(m => m.meta?.source === 'canned')
  
  if !hasCanned: return null
  
  return EPHEMERAL_NOTES[language]

EPHEMERAL_NOTES = {
  fr: "Note interne : un ou plusieurs des tours récents proviennent d'un script éditorial de la maison FemiGlow. Tu peux les considérer comme tes propres réponses et continuer dans le même ton, avec la même connaissance des faits qu'ils contiennent.",
  
  ar: "ملاحظة داخلية : بعض الردود السابقة مكتوبة مسبقا من طرف فريق فيميغلو. اعتبرها كردودك الخاصة و واصل بنفس الأسلوب.",
  
  ar-MA: "Mulahada dakhiliya : ba3d l-rdood l-fayta mektobin mn 9bel mn fri9 FemiGlow. I3tabarhom k jawabatk w kemmel b nafs l-style."
}
```

Cette note est ajoutée au `messages[0].content` (system prompt) **uniquement pour ce tour**, jamais persistée.

## Streaming local côté client

Le service backend retourne le texte complet. Côté client, hook `useLocalStream` :

```
function useLocalStream(text, opts = { wpm: 180, jitterPct: 15 }):
  state = { displayed: '', isStreaming: true }
  
  msPerWord = 60_000 / opts.wpm
  jitter = msPerWord * (opts.jitterPct / 100)
  
  words = text.split(/\s+/)
  
  forEach word, index :
    setTimeout(() => {
      state.displayed += (index === 0 ? '' : ' ') + word
      if index === words.length - 1:
        state.isStreaming = false
    }, sum_so_far(msPerWord ± jitter) for previous words)
  
  return state
```

Pause supplémentaire après ponctuation forte (`.`, `!`, `?`, `\n`) : +200 ms.

## Workflow éditorial (draft → review → published)

```
function canTransition(currentStatus, nextStatus, userRole):
  matrix = {
    draft: { review: ['content', 'po', 'admin'] },
    review: {
      published: ['po', 'admin'],
      draft: ['content', 'po', 'admin']  # retour pour modif
    },
    published: {
      archived: ['admin']  # impossible sinon, on duplique
    },
    archived: {}
  }
  return userRole in (matrix[currentStatus][nextStatus] || [])
```

À chaque transition `→ published`, on crée automatiquement une nouvelle entrée dans `chat_canned_pair_version` (snapshot des body_*).

## Tests cible

| Cas | Type | Critère |
|---|---|---|
| Resolve salutations sur `/kit` | unit | greeting + 3 pills retournées |
| Resolve avec language fallback | unit | langue manquante → FR utilisé |
| Serve pair non publiée | unit | throws NotFoundError |
| Serve pair audience b2b sur session b2c | unit | throws ForbiddenError |
| Serve persiste 2 messages + 2 events | integration | DB check |
| Get ephemeral note avec canned récent | unit | retourne string non null |
| Get ephemeral note sans canned récent | unit | retourne null |
| Continuité LLM après canned | E2E | LLM reply cohérent en ton |

Voir [`12-tests/`](../12-tests/).
