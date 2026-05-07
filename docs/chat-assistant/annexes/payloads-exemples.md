# Annexe — Exemples de payloads et events

> *Référence pour développeurs et testeurs : ce qui transite, comment*

---

## 1. Cookie session

```
Set-Cookie: fg_chat_session=<encrypted>; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax
Set-Cookie: fg_v=<visitorId>; Max-Age=315360000; Path=/; Secure; SameSite=Lax
```

## 2. `GET /api/chat/session`

### 2.1 Réponse

```jsonc
{
  "sessionId": "cs_AbCdE12345",
  "language": "fr",
  "status": "open",
  "greeting": "la maison te souhaite un matin doux. en quoi puis-je t'éclairer ?",
  "suggestions": [
    "parle-moi du rituel",
    "comment l'utiliser ?",
    "livraison au Maroc"
  ],
  "messages": [],
  "themeVariantId": "default",
  "variantOpaqueId": "v_xyz789"
}
```

## 3. `POST /api/chat/message`

### 3.1 Requête

```jsonc
{
  "sessionId": "cs_AbCdE12345",
  "text": "bonjour, c'est quoi ce rituel ?",
  "lang": "fr",
  "context": {
    "page": "/kit",
    "currentCart": []
  }
}
```

### 3.2 Stream SSE (réponse)

```
event: typing-start
data: {}

event: meta
data: { "messageId": "cm_uVzAk987", "userMessageId": "cm_user321" }

event: token
data: "le rituel "

event: token
data: "comprend "

event: token
data: "quatre gestes — "

event: token
data: "paste, powder, shine, polish."

event: typing-end
data: {}

event: meta
data: {
  "sources": [
    { "id": "kc_001", "label": "Page Kit", "score": 0.91 },
    { "id": "kc_007", "label": "Page Rituel", "score": 0.84 }
  ],
  "variantOpaqueId": "v_xyz789"
}

event: done
data: {
  "messageId": "cm_uVzAk987",
  "durationMs": 1840,
  "firstTokenMs": 720,
  "tokensIn": 612,
  "tokensOut": 178
}
```

### 3.3 Stream SSE — erreur modération

```
event: error
data: { "code": "moderation_blocked_input" }
```

### 3.4 Stream SSE — erreur quota

```
event: error
data: { "code": "quota_exceeded", "retryAfter": 60 }
```

## 4. `POST /api/chat/feedback`

```jsonc
// requête
{ "messageId": "cm_uVzAk987", "value": 1, "note": "très clair, merci" }

// réponse
{ "ok": true }
```

## 5. `POST /api/chat/event`

```jsonc
{
  "sessionId": "cs_AbCdE12345",
  "type": "suggestion_clicked",
  "payload": { "label": "parle-moi du rituel" }
}
```

## 6. `POST /api/chat/lead/email`

```jsonc
// requête
{
  "sessionId": "cs_AbCdE12345",
  "email": "khadija@example.com",
  "consent": true
}
// réponse
{ "ok": true }
```

## 7. Admin — `GET /api/admin/chat/conversations`

### 7.1 Query

```
?window=30d&lang=fr&conversion=true&q=livraison&page=1&limit=50
```

### 7.2 Réponse

```jsonc
{
  "items": [
    {
      "sessionId": "cs_AbCdE12345",
      "openedAt": "2026-05-04T14:02:11Z",
      "lastSeenAt": "2026-05-04T14:18:43Z",
      "durationSec": 992,
      "messages": 8,
      "language": "fr",
      "page": "/kit",
      "intentDominant": "product_question",
      "satisfaction": 0.5,
      "converted": true,
      "category": "moyen"
    }
    // ...
  ],
  "total": 312,
  "page": 1,
  "limit": 50
}
```

## 8. Admin — `GET /api/admin/chat/conversations/:id`

```jsonc
{
  "session": {
    "id": "cs_AbCdE12345",
    "openedAt": "2026-05-04T14:02:11Z",
    "language": "fr",
    "page": "/kit",
    "referrer": "https://www.google.com",
    "utm": { "utm_source": "instagram" },
    "convertedOrderId": "ord_98765",
    "convertedAt": "2026-05-04T14:24:01Z"
  },
  "messages": [
    {
      "id": "cm_user321",
      "role": "user",
      "content": "bonjour, c'est quoi ce rituel ?",
      "language": "fr",
      "createdAt": "2026-05-04T14:02:11Z"
    },
    {
      "id": "cm_uVzAk987",
      "role": "assistant",
      "content": "le rituel comprend quatre gestes — paste, powder, shine, polish.",
      "language": "fr",
      "tokensIn": 612,
      "tokensOut": 178,
      "latencyMs": 1840,
      "firstTokenMs": 720,
      "providerKind": "openai",
      "modelName": "gpt-4o-mini",
      "ragHits": [
        { "chunkId": "kc_001", "score": 0.91 },
        { "chunkId": "kc_007", "score": 0.84 }
      ],
      "moderation": { "input": false, "output": false, "rewritten": false },
      "cost": 0.00214,
      "createdAt": "2026-05-04T14:02:13Z"
    }
  ]
}
```

## 9. Admin — `POST /api/admin/chat/instructions`

```jsonc
// requête
{
  "scope": "default",
  "body": "Tu es l'hôtesse de FemiGlow...",
  "bodyAr": "أنت مضيفة فيمي‌غلو...",
  "bodyArMa": "نتي مضيفة فيمي‌غلو...",
  "notes": "v13 — durcir refus de jailbreak, ajouter règle code-switching"
}
// réponse
{ "id": "ci_abcdef", "version": 13, "scope": "default", "enabled": false }
```

## 10. Admin — `POST /api/admin/chat/instructions/:id/activate`

```jsonc
// requête (vide)
// réponse
{ "id": "ci_abcdef", "version": 13, "enabled": true, "previousId": "ci_zzzzz" }
```

## 11. Admin — `POST /api/admin/chat/providers/:id/test`

```jsonc
// requête (vide)
// réponse
{
  "ok": true,
  "latencyMs": 612,
  "tokensIn": 14,
  "tokensOut": 5,
  "modelEcho": "pong"
}
```

## 12. Admin — KPI

`GET /api/admin/chat/kpis?window=30d&lang=fr`

```jsonc
{
  "engagement": {
    "sessions": 8421,
    "engagedSessions": 4982,
    "engagementRate": 0.591,
    "medianMessages": 4,
    "medianDurationSec": 132,
    "earlyAbandonRate": 0.27
  },
  "conversion": {
    "rate": 0.0641,
    "lift": 0.32,
    "averageBasketEur": 320,
    "topConvertingIntents": [
      { "intent": "product_question", "rate": 0.082 },
      { "intent": "usage_question",   "rate": 0.071 },
      { "intent": "price_question",   "rate": 0.054 }
    ]
  },
  "quality": {
    "satisfaction": 0.832,
    "outOfCharterRate": 0.003,
    "languageMatchRate": 0.991
  },
  "performance": {
    "firstTokenMsP50": 880,
    "firstTokenMsP95": 2210,
    "totalMsP95": 5430,
    "errorRate": 0.0021,
    "fallbackRate": 0.014
  },
  "cost": {
    "totalEur": 142.31,
    "perSessionEur": 0.0169,
    "perMessageEur": 0.00298,
    "topProviders": [
      { "kind": "openai",  "share": 0.78, "eur": 110.95 },
      { "kind": "gemini",  "share": 0.20, "eur": 28.46 },
      { "kind": "qwen",    "share": 0.02, "eur": 2.90 }
    ]
  }
}
```

## 13. Admin — Visualisation system stream

```
GET /api/admin/chat/visualisation/stream
Accept: text/event-stream
```

```
event: pipeline.start
data: { "messageId": "cm_uVzAk987", "sessionId": "cs_AbCdE12345", "ts": "2026-05-06T14:21:09Z" }

event: pipeline.node.update
data: { "id": "moderate-in", "status": "ok", "metrics": { "latencyMs": 142 } }

event: pipeline.edge.pulse
data: { "from": "moderate-in", "to": "lang" }

...

event: pipeline.done
data: {
  "messageId": "cm_uVzAk987",
  "totalLatencyMs": 1820,
  "costEur": 0.0021,
  "providerKind": "openai",
  "model": "gpt-4o-mini"
}
```

## 14. DataLayer events (côté client)

Émis vers `window.femiglowDataLayer` (cf. `docs/tracking/`) :

```jsonc
{ "event": "chat_widget_open", "page": "/kit", "lang": "fr" }
{ "event": "chat_message_sent", "role": "user", "messageId": "cm_user321", "sessionId": "cs_AbCdE12345", "lang": "fr" }
{ "event": "chat_message_sent", "role": "assistant", "messageId": "cm_uVzAk987", "sessionId": "cs_AbCdE12345", "firstTokenMs": 720 }
{ "event": "chat_suggestion_clicked", "label": "parle-moi du rituel" }
{ "event": "chat_feedback", "messageId": "cm_uVzAk987", "value": 1 }
{ "event": "chat_conversion_attributed", "orderId": "ord_98765", "sessionId": "cs_AbCdE12345" }
```

## 15. Logs serveur (digest)

```jsonc
{
  "level": "info",
  "msg": "message_completed",
  "service": "chat",
  "sessionId": "cs_AbCdE12345",
  "messageId": "cm_uVzAk987",
  "language": "fr",
  "page": "/kit",
  "providerKind": "openai",
  "model": "gpt-4o-mini",
  "tokensIn": 612,
  "tokensOut": 178,
  "latencyTotalMs": 1820,
  "latencyFirstTokenMs": 720,
  "ragHits": 2,
  "moderation": { "input": false, "output": false, "rewritten": false },
  "costEur": 0.00214,
  "intent": "product_question",
  "ts": "2026-05-06T14:21:09Z"
}
```
