# 30.6 — Taxonomie d'erreurs tracking

## Hiérarchie

```
TrackingError (abstract base)
  ├─ ProviderError (per-provider)
  │    ├─ ProviderDisabledError
  │    ├─ ProviderUnsupportedEventError
  │    ├─ ProviderConsentDeniedError
  │    ├─ ProviderQuotaExceededError
  │    ├─ ProviderAuthError (OAuth expired, invalid token)
  │    ├─ ProviderTimeoutError
  │    └─ ProviderUpstreamError (5xx, network)
  ├─ ValidationError
  │    ├─ UnknownEventError
  │    ├─ InvalidParamsError
  │    └─ MissingRequiredFieldError
  ├─ ConfigError
  │    ├─ MissingCustomerIdError
  │    ├─ MissingConversionActionError
  │    └─ MissingDeveloperTokenError
  └─ IngestError
       ├─ RateLimitExceededError
       ├─ BatchTooLargeError
       └─ InvalidJsonError
```

## Codes d'erreur stables

| Code | HTTP | Provider | Critical | User-facing | Action |
|---|---|---|---|---|---|
| `EVENT_UNKNOWN` | 400 | n/a | ✅ | "Événement inconnu" | Reject batch |
| `EVENT_INVALID_PARAMS` | 400 | n/a | ⚠ | "Paramètres invalides" | Reject event, continue batch |
| `RATE_LIMIT` | 429 | n/a | ⚠ | "Trop d'événements" | Retry after-X |
| `CONSENT_DENIED` | 200 | per-provider | ❌ | — | Skip provider, log |
| `PROVIDER_DISABLED` | 200 | per-provider | ❌ | — | Skip provider |
| `PROVIDER_UNSUPPORTED` | 200 | per-provider | ❌ | — | Skip provider |
| `ADAPTER_AUTH_FAILED` | 500 | per-provider | ✅ | — | Mark provider error |
| `ADAPTER_QUOTA_EXCEEDED` | 500 | per-provider | ✅ | — | Backoff + alert |
| `ADAPTER_TIMEOUT` | 500 | per-provider | ⚠ | — | Retry 3x |
| `ADAPTER_UPSTREAM_5XX` | 500 | per-provider | ⚠ | — | Retry 3x |
| `ADAPTER_UPSTREAM_4XX` | 500 | per-provider | ✅ | — | Log, alert, no retry |
| `MISSING_CUSTOMER_ID` | 500 | google_ads | ✅ | — | Skip + log |
| `MISSING_CONVERSION_ACTION` | 500 | google_ads | ✅ | — | Skip + log |

## Format de logging

```typescript
{
  level: 'error' | 'warn',
  event: 'tracking.dispatch.failed',
  provider_kind: 'google_ads',
  event_name: 'purchase',
  event_id: 'uuid',
  error_code: 'ADAPTER_QUOTA_EXCEEDED',
  http_status: 429,
  latency_ms: 1850,
  attempts: 3,
  message: 'Quota usage 89%, retry-after: 60s',
  context: {
    customer_id: '7082...',
    conversion_action: 'AbCdEf...',
  }
}
```

Pas de PII dans les logs (email, téléphone). Seulement event_id et identifiants
publics.

## Mapping erreurs HTTP côté `/api/track`

| Cas | HTTP code | Body |
|---|---|---|
| Batch valide | 200 | `{ received: N }` |
| Batch partiellement invalide | 200 | `{ received: N, rejected: [...] }` |
| Rate limit | 429 | `{ error: { code: 'RATE_LIMIT', retryAfter: 5 } }` |
| Batch trop gros | 413 | `{ error: { code: 'BATCH_TOO_LARGE' } }` |
| JSON invalide | 400 | `{ error: { code: 'INVALID_JSON' } }` |
| Server error | 500 | `{ error: { code: 'INTERNAL_ERROR' } }` |

Important : on **n'échoue jamais** un batch entier si une dispatch CAPI rate
(le client ne devrait pas retry). Les échecs CAPI sont loggés en interne et
n'impactent pas la réponse client.

## Circuit breaker par provider

Si un provider a > 30% d'erreurs sur les 5 dernières minutes :
1. Status passe à `error` dans `tracking_providers`
2. Notification email à l'admin (`audit_events.action = 'tracking.provider.circuit_broken'`)
3. Skip automatique pendant 15 min (`error_recovery_at`)
4. Re-test automatique après cooldown

## Alerting

| Condition | Sévérité | Action |
|---|---|---|
| Provider error rate > 10% sur 1h | Warning | Email admin |
| Provider error rate > 30% sur 5min | Critical | Email admin + circuit break |
| Provider auth failed | Critical | Email admin immédiat |
| Quota proche limite | Warning | Email admin |
| Aucune conversion 24h | Critical | Email admin (anomalie) |
