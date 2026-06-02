# 04 — Plan Vitest (unités + intégration)

> Vitest 2.1 (globals). Unités = logique pure (mocks/faux timers). Intégration =
> routes + repos + DB de test. Co-localisation `*.test.ts` / `*.int.test.ts`.

## Unités

### `lead-id.test.ts`
- **TST-U-01** : `newLeadId()` matche `^cl_[0-9a-z]{20,}$` ; 10k tirages sans collision ; `isLeadId` accepte/rejette correctement.

### `schemas.test.ts`
- **TST-U-02** : `createLeadInputSchema` exige `leadId` valide ; rejette leadId malformé ; `Envelope`/batch conformes aux JSON Schemas (`02-data-flow/schemas/*`).

### `lead-sync-queue.test.ts` (faux timers)
- **TST-U-10** : FIFO par leadId (ordre create→address→payment respecté).
- **TST-U-11** : sur transport `{ok:false,retryable:true}` → retry avec backoff exponentiel + jitter, `attempt++`, reste dans `pending()`.
- **TST-U-12** : sur 4xx non-409 → drop, log `owbs.queue.dropped`, retiré de `pending()`.
- **TST-U-13** : `enqueue` persiste le miroir ; `hydrateFromMirror` recharge ; re-flush idempotent.
- **TST-U-14** : double `flush()` concurrent → un seul envoi par `mutationId` (mutex/dédup).

### `lead-service.test.ts` (repos + idem mockés)
- **TST-U-03** : `applyLeadCreate` appelle `upsertWizardLead` puis `outbox.enqueue` dans la transaction ; renvoie `{leadId, replayed}`.

### `lead-outbox-processor.test.ts` (handlers mockés)
- **TST-U-04** : dispatch par `type` vers le bon handler ; handler OK → `markDone` ; KO → `reschedule`.

### `beacon-flush.test.ts` (jsdom + stub sendBeacon)
- **TST-U-17** : `pagehide` → `sendBeacon('/api/checkout/lead/sync', batch)` avec les `pending()` ; `order_create` exclu du batch ; fallback keepalive si `sendBeacon` absent.

### env
- **TST-U-00** : `env.ts` parse `CHECKOUT_OPTIMISTIC_WIZARD_ENABLED`, défaut `false` ; mirror `NEXT_PUBLIC_`.
- **TST-U-15/16** : `use-wizard-mutations` — flag ON : `goToStep` AVANT `enqueue` ; flag OFF : chemin legacy `await`→`goToStep`.
- **TST-U-18** : `use-chat-send` enqueue via la file (FR-09).
- **TST-U-19** : logs `owbs.*` émis sans PII (assertion sur l'argument loggé).

## Intégration (DB de test)

### migration
- **TST-I-00** : up/down ; insert/lecture `lead_event_outbox` ; `UNIQUE(type,leadId,dedupe_key)` rejette doublon ; `CHECK chat_lead.id`.

### repos upsert
- **TST-I-01** : `upsertWizardLead` crée la row (id client).
- **TST-I-02** : re-upsert ne dégrade pas une colonne renseignée (fill-forward / INV-2).
- **TST-I-03** : `upsertAddress` **avant** create → crée la row partielle (désordre).
- **TST-I-04** : upsert avec `visitorId` incohérent vs row existante → rejet (sécurité).
- **TST-I-09** : `lead-service` transaction — si `outbox.enqueue` throw → rollback de l'upsert (INV-5).

### outbox
- **TST-I-05** : `enqueue` + `pickBatch` renvoie pending dûs.
- **TST-I-06** : deux `pickBatch` concurrents (FOR UPDATE SKIP LOCKED) ne renvoient pas la même row.
- **TST-I-07** : `reschedule` incrémente attempts + recule `next_attempt_at` ; `dead` après `max_attempts`.
- **TST-I-08** : double `enqueue` même `(type,leadId,dedupeKey)` → 1 seule row (UNIQUE).
- **TST-I-10** : processor — handler KO → `reschedule` ; OK → `done`.
- **TST-I-11** : `/api/cron/lead-outbox` → 401 sans `CRON_SECRET`, 200 + rapport avec.

### routes & batch
- **TST-R-OFF** : flag OFF → réponses des routes granulaires identiques au master (snapshot de réponses).
- **TST-I-12** : `/sync` applique tout le batch, idempotent (rejeu = mêmes effets).
- **TST-I-13** : `/sync` tolère le désordre (address avant create).
- **TST-I-14** : `/sync` → 413 si `> maxBytes`/`maxEnvelopes`.
- **TST-I-18** : rate-limit `/sync` par visitorId/IP.

### conversion
- **TST-I-15** : `order_create` réussit sans écritures de fond préalables (snapshot complet).
- **TST-I-16** : double `order_create` (même idem-key) → 1 commande.
- **TST-I-17** : conversion enqueue effets outbox `order_webhook` + `purchase_capi` + `purchase_ga4`.

## Commandes
```
pnpm vitest run src/lib/checkout src/lib/leads/outbox
pnpm vitest run --coverage src/lib/checkout/state/lead-sync-queue.test.ts
```
