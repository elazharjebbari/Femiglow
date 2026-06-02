# F12 — Plan de tests concret

## A. RTL (parité par surface — le cœur)
- **F12-S10/S11/S12/S13** : pour chaque mutation (lead/address/chat), togglé `process.env.NEXT_PUBLIC_…` → flag OFF = chemin legacy (appel `wizardClient`/fetch direct, succès après réponse) ; flag ON = optimiste (enqueue / succès immédiat).
- **F12-S14 parité bit-à-bit** : garde-fou — avec flag OFF, asserter que les appels et l'ordre sont **identiques** au master (utiliser des spies ; comparer les invocations).

## B. Intégration (garde-fou serveur)
- **F12-S20** : serveur flag OFF → `POST /api/checkout/lead/sync` → **204**.
- **F12-S21** : serveur flag OFF → `POST /api/checkout/lead` avec un `leadId` client → le service prend le chemin **legacy** (createWizardLead, id serveur), n'utilise pas l'upsert client.

## C. Playwright (rollout réel)
- **F12-S02** : build flag **OFF** (ou route forçant le legacy) → parcours → l'étape suivante n'apparaît **qu'après** la réponse réseau (legacy prouvé).
- **F12-S03 kill-switch** : sur un build dont le serveur lit le flag à l'exécution, basculer `CHECKOUT_OPTIMISTIC_WIZARD_ENABLED` OFF → le comportement repasse legacy **sans rebuild** (NB : le client `NEXT_PUBLIC` est figé au build → documenter que le kill-switch client nécessite un build OFF, tandis que le serveur bascule à chaud).
- **F12-S04** : flag OFF → aucun POST `/api/checkout/lead/sync` observé.

## D. Étapes
1. Parité RTL par surface (S10-S14) — **gate anti-régression**.
2. Garde-fous serveur (S20/S21).
3. e2e legacy + kill-switch (S02/S03/S04).

> **Important** : `NEXT_PUBLIC_*` est **inliné au build**. Le kill-switch *serveur*
> est à chaud ; le kill-switch *client* nécessite un build flag-OFF. À documenter
> clairement dans le runbook de rollout.
