# ADR-0003 — File de synchronisation client (`lead-sync-queue`)

- **Statut :** Accepté
- **Date :** 2026-06-01
- **Réf exigences :** FR-03, FR-06, NFR-02, NFR-04

## Contexte

Après transition optimiste (ADR-0001), il faut envoyer les mutations de façon
fiable malgré un réseau mobile faillible, sans bloquer l'UI, et sans perdre de
données si l'utilisateur ferme l'onglet.

## Décision

Implémenter une file **en mémoire, miroir `sessionStorage`**, ordonnée **FIFO par
`leadId`** :

- **Modèle** : `Envelope { mutationId, leadId, scope, idempotencyKey, payload, enqueuedAt, attempt }` (schéma : [`../../02-data-flow/schemas/wizard-mutation-envelope.schema.json`](../../02-data-flow/schemas/wizard-mutation-envelope.schema.json)).
- **enqueue** : ajoute l'envelope, persiste le miroir, déclenche un `flush()` non-awaité.
- **flush (live)** : `fetch(endpoint, { method, headers:{Idempotency-Key}, body, keepalive:true })`. Sur succès → retire l'envelope du miroir. Sur échec réseau/5xx → **retry avec backoff exponentiel + jitter** (250 ms → 4 s, max N=6).
- **flush (pagehide)** : sur `visibilitychange:hidden` / `pagehide`, envoyer le **reste** via `navigator.sendBeacon('/api/checkout/lead/sync', batchBlob)` (cf. ADR-0005).
- **reprise** : au montage du wizard, ré-hydrater depuis `sessionStorage` et re-flusher (couvre un rechargement de page).
- **dédup** : un `mutationId` (uuid) + `Idempotency-Key` garantissent qu'un double-flush n'a aucun effet serveur (ADR-0006).

Choix de stockage : **`sessionStorage`** (pas `localStorage`) pour s'aligner avec
`idempotency-key.ts` (durée onglet) et éviter qu'une vieille envelope rejoue une
mutation obsolète 24 h plus tard.

## Conséquences

- **+** UI jamais bloquée ; résilience réseau (retry) ; résilience fermeture (beacon) ; résilience reload (miroir).
- **+** Testable isolément (file pure, injecter un transport mock) → MSW/Vitest.
- **−** Complexité d'ordonnancement (FIFO par lead, backoff) → encapsulée et couverte par tests.
- **−** `keepalive` limite le body à ~64 KB → nos payloads sont petits (< 4 KB) : OK ; garde-fou de taille quand même.

## Alternatives rejetées

- **IndexedDB + Background Sync API** : durabilité supérieure mais Chromium-only + complexité ; reporté (ADR-0005, option future si réseau très dégradé).
- **Envoi inline non-awaité sans file** : simple mais perd retry/ordre/reprise → fragile sur mobile.
