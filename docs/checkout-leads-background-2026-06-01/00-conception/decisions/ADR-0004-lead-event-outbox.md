# ADR-0004 — Effets de bord durables via `lead_event_outbox` + worker cron

- **Statut :** Accepté
- **Date :** 2026-06-01
- **Réf exigences :** FR-08, NFR-05, NFR-06, G6

## Contexte

Certains effets sont **lourds et/ou externes** : tracking serveur (CAPI Meta,
GA4 MP), webhook sortant (`dispatchOrderWebhook`), relances. Les exécuter
**dans le chemin requête** rallonge la réponse et les rend fragiles (un échec
réseau externe perdrait l'effet). Le repo possède **déjà** un pattern éprouvé :
`email_outbox` + `pickAndProcessBatch()` (`FOR UPDATE SKIP LOCKED`) + cron
systemd 60 s (`/api/cron/email-outbox`).

## Décision

Introduire une table **`lead_event_outbox`** calquée sur `email_outbox` et un
worker cron **`/api/cron/lead-outbox`** :

- **Écriture** : à la persistance d'un step (ou à la conversion), insérer une row
  d'effet (`type`, `leadId`, `payload`, `status='pending'`, `attempts=0`,
  `next_attempt_at`) **dans la même transaction** que l'upsert métier (garantie
  transactionnelle outbox : pas d'effet sans état, pas d'état sans effet).
- **Drain** : le worker prend un batch `WHERE status='pending' AND next_attempt_at<=now() FOR UPDATE SKIP LOCKED`, exécute le handler (tracking/webhook), marque `done` ou re-planifie avec **backoff** (`attempts++`, `next_attempt_at`), `dead` après `max_attempts`.
- **Réutilisation** : les handlers délèguent au dispatcher webhook + serverFire existants (pas de nouvelle logique d'intégration).

Frontière claire : `after()`/`waitUntil` (ADR rejeté ci-dessous) auraient pu
différer ces effets *post-réponse*, mais **in-process** ⇒ perdus au restart et
non-retry. L'outbox DB est **durable** et **rejouable**.

## Conséquences

- **+** Effets durables, ordonnés, retry/backoff, survie au restart, observables (backlog mesurable).
- **+** Réutilise un blueprint **déjà en prod** (faible risque, cohérence opératoire).
- **+** Découple totalement la réponse HTTP des effets externes.
- **−** Ajoute 1 table + 1 migration + 1 worker + 1 timer systemd + supervision backlog.
- **−** Latence d'effet bornée par la cadence cron (60 s) — acceptable (NFR-05) ; pour le « near-real-time » tracking client, on garde l'`emit()` **client** existant (immédiat) ; l'outbox couvre le **serveur** (CAPI/webhook).

## Alternatives rejetées

- **`unstable_after()` / `waitUntil`** : non durable (in-process), pas de retry, expérimental en 14.2 — insuffisant pour des effets externes critiques (webhook). Peut servir d'**appoint** pour des effets non-critiques, pas comme socle.
- **File externe (BullMQ + Redis)** : nouvelle dépendance infra + ops ; l'outbox DB+cron couvre le besoin sans nouveau composant.
