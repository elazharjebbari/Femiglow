# 03 — Plan d'action (étape par étape, avec tests à chaque étape)

> Chaque étape liste : livrable, fichiers, **tests à écrire/faire passer**, et la
> porte de validation. IDs de tests → [`../04-tests/test-matrix.csv`](../04-tests/test-matrix.csv).

---

## P0 — Socle inerte

### A0.1 — Flag d'environnement
- **Faire** : ajouter `CHECKOUT_OPTIMISTIC_WIZARD_ENABLED` + `NEXT_PUBLIC_…` dans `src/lib/env.ts` (défaut `false`).
- **Tests** : `TST-U-00` (env parse le flag, défaut OFF).
- **Gate** : tsc + vitest verts.

### A0.2 — `lead-id.ts` (client)
- **Faire** : `newLeadId()` (`createId('cl')`), `isLeadId()` regex.
- **Tests** : `TST-U-01` (format, unicité statistique, round-trip `isLeadId`).

### A0.3 — Migration `lead_event_outbox`
- **Faire** : migration Prisma additive (table + index + `CHECK` `chat_lead.id` en `NOT VALID`→`VALIDATE`).
- **Tests** : `TST-I-00` (migration up/down ; insert/lecture ; contrainte UNIQUE).
- **Gate** : migration réversible vérifiée sur DB de test.

### A0.4 — Schémas (Zod + JSON)
- **Faire** : étendre `createLeadInputSchema` (leadId requis) ; ajouter `Envelope`, batch `/sync` ; aligner sur `02-data-flow/schemas/*`.
- **Tests** : `TST-U-02` (Zod accepte/rejette ; parité avec JSON Schemas).

---

## P1 — Idempotence serveur (upsert)

### A1.1 — `lead-repo` create→upsert
- **Faire** : `upsertWizardLead(id, fields)` (`ON CONFLICT(id) DO UPDATE`, fill-forward non-null) ; `upsertAddress`/`upsertPayment` (créent la row si absente).
- **Tests** : `TST-I-01` (upsert crée), `TST-I-02` (re-upsert ne dégrade pas / fill-forward), `TST-I-03` (address avant create → row créée), `TST-I-04` (visitorId incohérent rejeté).

### A1.2 — `lead-service` (application)
- **Faire** : orchestration upsert + (P2) enqueue outbox, dans une transaction ; `applyLeadCreate/Address/Payment`.
- **Tests** : `TST-U-03` (service appelle repo+idem dans le bon ordre, mocks), `TST-I-09` (transaction : rollback si enqueue échoue).

### A1.3 — Brancher les routes granulaires
- **Faire** : `route.ts` (lead/address/payment) délèguent à `lead-service` ; comportement **identique** flag OFF (legacy bit-à-bit).
- **Tests** : `TST-I-01..04` via les routes (supertest-like) ; `TST-R-OFF` (flag OFF = réponses inchangées).

---

## P2 — Outbox + worker

### A2.1 — `lead-outbox-repo`
- **Faire** : `enqueue/pickBatch(FOR UPDATE SKIP LOCKED)/markDone/reschedule(backoff, dead)`.
- **Tests** : `TST-I-05` (enqueue+pick), `TST-I-06` (SKIP LOCKED : 2 runners ne se chevauchent pas), `TST-I-07` (reschedule backoff + dead après max), `TST-I-08` (UNIQUE dedupe absorbe doublon).

### A2.2 — `lead-outbox-processor` + handlers
- **Faire** : `pickAndProcessBatch()` ; handlers délèguent à `serverFire`/`dispatchOrderWebhook` (adapters).
- **Tests** : `TST-U-04` (dispatch par type, handler mock), `TST-I-10` (handler échoue → reschedule ; réussit → done).

### A2.3 — Cron route + timer
- **Faire** : `/api/cron/lead-outbox` (Bearer `CRON_SECRET`, `maxDuration=60`) ; unit systemd `femiglow-cron-lead-outbox.timer`.
- **Tests** : `TST-I-11` (401 sans secret ; 200 + rapport avec secret).

---

## P3 — File client + transition optimiste (flag ON)

### A3.1 — `lead-sync-queue`
- **Faire** : enqueue/flush/pending/hydrate ; FIFO par leadId ; backoff+jitter ; miroir sessionStorage ; transport injectable.
- **Tests** : `TST-U-10` (FIFO/leadId), `TST-U-11` (retry backoff sur retryable), `TST-U-12` (drop sur 4xx non-409), `TST-U-13` (miroir persiste/rehydrate), `TST-U-14` (dédup mutationId). MSW : `TST-M-01..03` (latence injectée, 503→201, 409 ignoré).

### A3.2 — `wizard-store` optimiste + `use-wizard-mutations`
- **Faire** : flag ON → `goToStep()` avant enqueue ; flag OFF → legacy.
- **Tests** : `TST-U-15` (ordre goToStep→enqueue flag ON), `TST-U-16` (legacy flag OFF). e2e : `TST-E-01` (UI avance < 50 ms réseau throttlé), `TST-E-02` (3 étapes sans gel).

---

## P4 — Beacon + endpoint /sync

### A4.1 — `/api/checkout/lead/sync` (batch idempotent)
- **Faire** : `applyBatch` (upsert par envelope, désordre toléré, rate-limit + plafonds).
- **Tests** : `TST-I-12` (batch applique tout, idempotent), `TST-I-13` (désordre address→create OK), `TST-I-14` (413 si trop gros).

### A4.2 — `beacon-flush`
- **Faire** : listeners pagehide/visibilitychange → sendBeacon ; fallback keepalive ; recovery reload.
- **Tests** : e2e `TST-E-03` (close onglet → lead persisté), `TST-E-04` (reload → recovery). MSW/unit `TST-U-17` (sérialisation batch, exclusion order_create).

---

## P5 — Conversion + snapshot

### A5.1 — `order/route` snapshot complet + enqueue outbox
- **Faire** : `order_create` embarque le snapshot ; txn upsert+order+markPurchased+enqueue(effets) ; conserver fire-and-forget retiré au profit de l'outbox.
- **Tests** : `TST-I-15` (conversion sans écritures de fond préalables réussit), `TST-I-16` (double order_create = 1 commande), `TST-I-17` (effets enqueués: webhook+capi+ga4). e2e `TST-E-05` (parcours complet → thank_you).

---

## P6 — Funnel chat (FR-09)

### A6.1 — `use-chat-send` via file
- **Faire** : réutiliser `lead-sync-queue` pour la capture chat.
- **Tests** : `TST-U-18` (chat enqueue), e2e `TST-E-06` (chat confirme sans attendre réseau).

---

## P7 — Observabilité & durcissement

### A7.1 — Logs/métriques/alertes + FR-11
- **Faire** : logs `owbs.*`, compteurs file/outbox, indicateur d'erreur discret, rate-limit `/sync`.
- **Tests** : `TST-U-19` (logs émis sans PII), `TST-I-18` (rate-limit), e2e `TST-E-07` (indicateur FR-11 après échecs).

---

## P8 — Rollout & nettoyage

### A8.1 — Ramp + suppression legacy
- **Faire** : ramp flag (cf. `../05-runbook/rollout.md`) ; après stabilisation, retirer le chemin legacy + tests associés.
- **Gate** : métriques conformes (latence, perte=0, backlog outbox sain) sur la fenêtre d'observation.

---

## Validation finale (avant GA)
- Suite complète verte : `vitest` (unités+intégration), `playwright` (e2e), `tsc`, `lint`.
- Revue des NFR (latence p95 < 50 ms, perte=0, backlog outbox < seuil).
- Runbook exécuté de bout en bout en staging-like (`:3100`).
