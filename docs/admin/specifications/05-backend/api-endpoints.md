# API Endpoints — Catalogue

Toutes les routes admin vivent sous `/api/admin`. Toutes utilisent le
runtime Node.js (cf. [`../04-frontend/rendering-strategy.md`](../04-frontend/rendering-strategy.md#edge-runtime-vs-nodejs-runtime)).

## Conventions communes

| Aspect | Valeur |
|---|---|
| Content-Type request | `application/json` |
| Content-Type response | `application/json` (sauf CSV exports) |
| Headers obligatoires | `X-Request-Id` (auto-injecté si absent) |
| Cache | `Cache-Control: no-store, max-age=0` |
| Format d'erreur | `{ error: string, issues?: ZodIssue[] }` |
| Authentification | cookie `femiglow.admin.session` (sauf login & cron) |

## 1. Authentification

### POST `/api/admin/login`
| Aspect | Valeur |
|---|---|
| Auth | publique |
| Rate-limit | 5 req / 15 min / IP, 5 req / 15 min / email |
| Body | `{ email: string, password: string }` |
| 200 | `{ ok: true, redirect: "/admin/dashboard" }` |
| 400 | `validation_failed` |
| 401 | `unauthorized` |
| 429 | `rate_limited` |
| Side-effects | crée session iron-session, journalise audit |

### POST `/api/admin/logout`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| Body | aucun |
| 200 | `{ ok: true }` |
| Side-effects | détruit la session, journalise audit |

### GET `/api/admin/session`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| 200 | `{ user: { id, email, name } }` |
| 401 | `unauthorized` |

## 2. Leads

### GET `/api/admin/leads`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| Query | `type, status, from, to, city, q, sort, order, cursor, format` |
| 200 (`format=json`) | `{ items: Lead[], nextCursor?: string, total: number }` |
| 200 (`format=csv`) | `text/csv; charset=utf-8`, header `Content-Disposition: attachment` |
| 400 | `validation_failed` (filtre invalide) |

### GET `/api/admin/leads/[id]`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| 200 | `Lead & { events: LeadEvent[], deliveries: WebhookDelivery[] }` |
| 404 | `not_found` (incl. soft-deleted) |

### PATCH `/api/admin/leads/[id]/status`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| Body | `{ status: LeadStatus, reason?: string }` |
| 200 | `Lead` (état mis à jour) |
| 400 | `validation_failed` |
| 404 | `not_found` |
| 409 | `conflict` (transition interdite) |
| Side-effects | crée `lead_event` type `status_change` |

### POST `/api/admin/leads/[id]/notes`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| Body | `{ body: string }` |
| 201 | `LeadEvent` |
| 400 | `validation_failed` |
| 404 | `not_found` |

## 3. Webhooks

### GET `/api/admin/webhooks`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| 200 | `{ items: WebhookEndpoint[] }` (avec stats agrégées) |

### POST `/api/admin/webhooks`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| Body | `WebhookEndpointInput` (cf. [`webhook-form.md`](../04-frontend/pages/webhook-form.md)) |
| 201 | `WebhookEndpoint & { secret: string }` (secret en clair, **une seule fois**) |
| 400 | `validation_failed` |
| 409 | `conflict` (URL déjà existante) |

### GET `/api/admin/webhooks/[id]`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| 200 | `WebhookEndpoint` (sans secret) |
| 404 | `not_found` |

### PATCH `/api/admin/webhooks/[id]`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| Body | `Partial<WebhookEndpointInput>` |
| 200 | `WebhookEndpoint` |
| 404 | `not_found` |

### DELETE `/api/admin/webhooks/[id]`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| 204 | (vide) |
| 404 | `not_found` |
| Side-effects | soft-delete (`deleted_at`), annule livraisons pending |

### POST `/api/admin/webhooks/[id]/rotate-secret`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| 200 | `{ secret: string }` |
| 404 | `not_found` |

### POST `/api/admin/webhooks/[id]/test`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| Rate-limit | 10 req / minute / endpoint |
| 200 | `{ httpStatus, latencyMs, responseBody }` |
| 404 | `not_found` |
| 502 | `endpoint_unreachable` |

### GET `/api/admin/webhooks/[id]/deliveries`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| Query | `status, from, to, event, http_code, cursor` |
| 200 | `{ items: WebhookDelivery[], nextCursor?: string }` |

### POST `/api/admin/webhook-deliveries/[id]/retry`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| 200 | `WebhookDelivery` |
| 404 | `not_found` |
| 409 | `conflict` (déjà delivered, ou status incompatible) |

## 4. Dashboard

### GET `/api/admin/kpi`
| Aspect | Valeur |
|---|---|
| Auth | requise |
| 200 | `{ leads24h, untreated, failedDeliveries24h, computedAt: string }` |

## 5. Cron

### POST `/api/cron/tick`
| Aspect | Valeur |
|---|---|
| Auth | header `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron) |
| 200 | `{ processed: number, failed: number, deadLettered: number }` |
| 401 | `unauthorized` |
| Side-effects | consomme batch (≤ 50) de `webhook_deliveries` `pending` avec `next_attempt_at <= NOW()` |

## 6. Routes publiques (existantes, hors scope admin mais émettent des webhooks)

| Route | Méthode | Émet |
|---|---|---|
| `/api/public/contact` | POST | `lead.created` |
| `/api/public/orders` | POST | `lead.created`, `order.created` |
| `/api/public/orders/[id]/pay` | POST | `order.paid` |
| `/api/public/newsletter` | POST | `newsletter.subscribed` |
| `/api/public/b2b` | POST | `b2b.requested` |

## Codes d'erreur internes

Cf. [`error-handling.md`](./error-handling.md) pour le mapping complet.

| Code interne | HTTP |
|---|---|
| `unauthorized` | 401 |
| `forbidden` | 403 |
| `not_found` | 404 |
| `validation_failed` | 400 |
| `rate_limited` | 429 |
| `conflict` | 409 |
| `endpoint_unreachable` | 502 |
| `persistence_unavailable` | 503 |
| `internal_error` | 500 |
