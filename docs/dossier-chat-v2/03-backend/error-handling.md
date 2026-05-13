# Gestion des erreurs & résilience

> Stratégie unifiée pour les erreurs dans le pipeline chat. Pas d'erreur 500 user‑facing, jamais. Toujours dégrader gracieusement.

## Hiérarchie d'erreurs

```
ChatError (base)
├── ChatValidationError       (400)  — input user invalide (Zod fail)
├── ChatAuthError             (401)  — session expirée
├── ChatRateLimitError        (429)  — too many requests
├── ChatBudgetExhaustedError  (503)  — budget mensuel dépassé → service level 3
├── ChatProviderError         (502)  — LLM provider KO → fallback breaker
├── ChatToolError             (502 interne) — tool foireux, géré sans bloquer
├── ChatNotFoundError         (404)  — canned pair / faq / source introuvable
├── ChatForbiddenError        (403)  — audience mismatch, RGPD
└── ChatInternalError         (500)  — bug imprévu, capture Sentry
```

Toutes héritent de `ChatError` avec :
- `code` : string court (`VALIDATION`, `BUDGET`, etc.)
- `message` : user‑facing, déjà localisé en `language`
- `cause` : Error originale (pas exposé au client)
- `userVisible` : boolean

## Politique par couche

### Niveau HTTP route handler

Toute route `/api/chat/*` :

```
export async function POST(req: Request) {
  try {
    const parsed = inputSchema.safeParse(await req.json())
    if (!parsed.success) {
      return Response.json({ error: 'VALIDATION', details: parsed.error.format() }, { status: 400 })
    }
    
    // ... business logic ...
    
  } catch (err) {
    return handleChatError(err, req)
  }
}

function handleChatError(err, req): Response {
  if (err instanceof ChatError) {
    // log léger sans stack (déjà géré)
    logger.warn({ code: err.code, path: req.url })
    return Response.json(
      { error: err.code, message: err.message },
      { status: err.httpStatus }
    )
  }
  
  // Erreur imprévue
  Sentry.captureException(err, { tags: { area: 'chat' } })
  return Response.json(
    { error: 'INTERNAL', message: GENERIC_FAIL_MESSAGE[language] },
    { status: 500 }
  )
}
```

### Niveau orchestrator

L'orchestrator **n'émet jamais 500 vers le client**. Stratégie :

```
async function streamReply(text, sessionId, signal):
  try:
    intent = await detectIntent(text)
  except err:
    Sentry.captureException(err)
    intent = { intent: 'misc', confidence: 0, source: 'regex' }   # fallback
  
  try:
    toolResults = await execTools(...)
  except err:
    Sentry.captureException(err)
    toolResults = []   # LLM continue sans
  
  try:
    ragChunks = await retrieveRag(...)
  except err:
    Sentry.captureException(err)
    ragChunks = []
  
  try:
    yield* streamFromProvider(...)   # appel LLM
  except ProviderError as err:
    if breaker.canFallback():
      yield* streamFromFallbackProvider(...)
    else:
      yield {
        event: 'error',
        data: { code: 'PROVIDER_DOWN', message: localizedMsg }
      }
      yield* streamFromCannedFallback(...)   # serveur scripted apology + lead form
  except BudgetExhaustedError:
    serviceLevel.set(3)
    yield* streamFromCannedFallback(...)
```

### Niveau provider / breaker

Logique existante préservée :
- 3 fails consécutifs en 30 s → open breaker pour ce provider, pendant cooldown 60 s.
- Pendant cooldown, router redirige vers le secondary.
- Half‑open : 1 requête de test ; succès → close, échec → re‑open.

Extension v2 :
- Si tous les providers en breaker open OU budget exhausted → `serviceLevel = 3` (canned only).
- Event `chat_service_level_changed` émis.

## Messages user‑facing localisés

Tous les messages d'erreur visibles user sont définis dans `lib/chat/services/error-messages.ts` :

```
const MESSAGES = {
  VALIDATION: {
    fr: "Votre message contient un caractère non supporté ou est trop long.",
    ar: "رسالتكم تحتوي على حرف غير مدعوم أو طويلة جدا.",
    ar-MA: "Risalt'ek fiha herf machi mdo3am wla twila bzaf."
  },
  RATE_LIMIT: {
    fr: "Vous nous écrivez très vite. Patientez quelques secondes.",
    ar: "تكتبون بسرعة كبيرة. انتظروا بضع ثوان.",
    ar-MA: "Katkateb b sor3a kbira. Stana chwiya."
  },
  PROVIDER_DOWN: {
    fr: "Notre assistant rencontre une difficulté technique. Nous vous proposons de laisser vos coordonnées pour vous recontacter rapidement.",
    ar: "مساعدنا يواجه صعوبة تقنية. اتركوا بياناتكم و سنتصل بكم قريبا.",
    ar-MA: "L-assistant 3andou m'chkil tekni. Khelli coordonnées dyalek w ghantasel bik."
  },
  BUDGET_EXHAUSTED: {
    # Visuellement identique à PROVIDER_DOWN pour ne pas révéler la raison commerciale
    fr: "Notre assistant rencontre une difficulté technique. Laissez vos coordonnées pour être rappelé.",
    ...
  },
  INTERNAL: {
    fr: "Une erreur inattendue est survenue. Notre équipe est notifiée.",
    ar: "حدث خطأ غير متوقع. تم إشعار فريقنا.",
    ar-MA: "K'darat 3andna m'chkila. Fri9na 3rifna."
  }
}
```

## Retry & idempotence

| Opération | Retries | Backoff | Idempotence |
|---|---|---|---|
| Embed query | 2 | 200 ms, 500 ms | Naturelle |
| Provider LLM stream | 1 (autre provider) | immédiat | Stream n'est pas retryable au milieu |
| Tool call | 0 | — | Selon tool |
| Insert chat_message | 0 | — | UUID client-side |
| Insert event KPI | 1 | 100 ms | UUID client-side |
| Outbound webhook lead | 3 | 1s, 4s, 16s | HMAC + idempotency key |
| KB sync per source | 0 | — | rawHash |

## Anti‑patterns interdits

- ❌ `catch (e) { /* swallow */ }` — toujours logger ou re‑raise.
- ❌ `throw new Error('something failed')` — toujours typer (`ChatXxxError`).
- ❌ Retry à l'infini sans backoff.
- ❌ Retourner 500 sans avoir tenté un fallback canned.
- ❌ Inclure stack trace ou path interne dans le message user.
- ❌ Localiser sur `req.headers['accept-language']` (utiliser la `language` de la session).

## Observabilité

Toute erreur génère :
- 1 event KPI `chat_error` avec `{ code, intent?, retry_count, fallback_used }`.
- 1 capture Sentry (sauf `VALIDATION` et `RATE_LIMIT` qui sont trop bruyants → logger.warn).
- Tag Sentry `chat.area = 'orchestrator' | 'tool' | 'rag' | 'canned' | 'provider'`.

Alertes Sentry :
- > 5 % de `INTERNAL` sur 5 min → page on‑call.
- > 10 % de `PROVIDER_DOWN` sur 5 min → vérifier provider primary.
- > 5 % de `RATE_LIMIT` sur 1 h → audit potentiel abuse.

## Tests

| Cas | Type | Critère |
|---|---|---|
| Validation fail → 400 + message FR | unit | OK |
| Provider down → fallback secondary | integration | OK |
| Tous providers down → canned message | integration | OK + lead form |
| Budget dépassé → service level 3 | integration | OK |
| Tool timeout → LLM continue sans | integration | OK |
| RAG fail → LLM continue sans context | integration | OK |
| 500 imprévu → Sentry capturé + 500 + message générique | integration | OK |
| Rate limit → 429 sans 5xx | unit | OK |
