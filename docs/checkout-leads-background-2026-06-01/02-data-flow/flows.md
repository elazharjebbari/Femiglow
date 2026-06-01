# 02 — Flux (narratif)

Diagrammes de séquence associés : [`../01-architecture/diagrams/`](../01-architecture/diagrams/).

## Flux F1 — Étape nominale (optimiste)
1. L'utilisateur remplit l'étape et clique « Continuer ».
2. Validation **Zod locale synchrone** (format, requis, consentement). Si invalide → message inline, **on bloque** (pas d'avance).
3. Si valide → `goToStep(next)` **immédiat** (l'UI avance, < 50 ms).
4. `enqueue(envelope)` dans `lead-sync-queue` (leadId client, Idempotency-Key).
5. La file envoie en tâche de fond (`fetch keepalive`), non-awaité.
6. Serveur : `lead-service` upsert `chat_lead` + enqueue effets `lead_event_outbox` (même txn) → 2xx.
7. Succès → l'envelope est retirée du miroir `sessionStorage`.

## Flux F2 — Échec réseau / origine lente
- En cas de timeout/5xx/erreur réseau : l'envelope **reste** en file, retry **backoff exponentiel + jitter** (250 ms→4 s, max 6), **même Idempotency-Key** → pas de doublon. L'UI n'est jamais impactée (l'utilisateur a déjà avancé). Après `max`, drop + log `owbs.queue.dropped` + indicateur discret (FR-11).

## Flux F3 — Fermeture / masquage d'onglet
- `pagehide` / `visibilitychange:hidden` → `beacon-flush` sérialise le **reste** de la file et `navigator.sendBeacon('/api/checkout/lead/sync', batch)`. Idempotency-Key portée **dans le corps**. Le serveur applique chaque envelope en upsert idempotent (tolère le désordre). **Zéro perte** de lead validé (NFR-02).

## Flux F4 — Reprise après reload
- Au montage du wizard, `hydrateFromMirror()` recharge les envelopes non confirmées et re-flushe. Idempotent → sans effet si déjà appliquées côté serveur.

## Flux F5 — Conversion (commande)
- `order_create` est **awaité** (l'utilisateur attend la confirmation). Le payload embarque le **snapshot complet** (lead + adresse + paiement + panier) → la commande se crée même si des écritures de fond ne sont pas encore arrivées. Dans une transaction : upsert lead (réconciliation) + `createOrder` + `markPurchased` + `enqueue` des effets (webhook order.created, purchase CAPI/GA4). Réponse → `thank_you`.

## Flux F6 — Drain de l'outbox (worker)
- Le cron (60 s) appelle `/api/cron/lead-outbox` → `pickAndProcessBatch()` : `SELECT … FOR UPDATE SKIP LOCKED`, exécute chaque handler (serverFire CAPI/GA4, dispatchOrderWebhook), `markDone` ou `reschedule` (backoff). `dead` après `max_attempts` → alerte ops.

## Flux F7 — Abandon (scanner, inchangé)
- Le scanner détecte les leads partiels sans conversion (timestamps) et enqueue `cart_abandoned_webhook`. **Préservé** car les rows partielles sont toujours écrites (F1/F3).

## Flux F8 — Funnel chat (FR-09, différé)
- `LeadFormBubble`/`use-chat-send` réutilisent `lead-sync-queue` : la saisie chat est confirmée à l'UI sans attendre le réseau ; même garanties (idempotence, beacon).

## Légende des canaux de tracking
- **Client (immédiat)** : `use-tracking.emit` (GTM/pixels) — inchangé, hors chemin bloquant.
- **Serveur (durable)** : CAPI Meta / GA4 MP / webhook via `lead_event_outbox` (retry).
