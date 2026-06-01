# ADR-0005 — Flush de dernier recours via `sendBeacon` + endpoint batch `/sync`

- **Statut :** Accepté
- **Date :** 2026-06-01
- **Réf exigences :** FR-06, NFR-02

## Contexte

Avec l'envoi de fond (ADR-0003), il existe une fenêtre où des envelopes sont
encore en file quand l'utilisateur **ferme/masque l'onglet** ou perd le réseau.
Sans filet, on perdrait la donnée saisie (et la capture d'abandon associée).

## Décision

1. Écouter `visibilitychange` (→ `document.visibilityState === 'hidden'`) **et**
   `pagehide` (couvre iOS Safari, bfcache).
2. À ce moment, sérialiser le **reste de la file** en un batch et l'envoyer via
   `navigator.sendBeacon('/api/checkout/lead/sync', blob)`.
   - `sendBeacon` est **fire-and-forget**, survit à la navigation, mais **n'autorise
     pas d'en-têtes custom** → l'`Idempotency-Key` de chaque envelope est porté
     **dans le corps** (schéma [`../../02-data-flow/schemas/beacon-payload.schema.json`](../../02-data-flow/schemas/beacon-payload.schema.json)).
3. Créer **`POST /api/checkout/lead/sync`** : accepte `{ envelopes: Envelope[] }`,
   applique chaque envelope en **upsert idempotent** (réutilise la logique des
   endpoints granulaires), tolère le désordre, renvoie un rapport par envelope.
4. Fallback si `sendBeacon` indisponible/false : `fetch(..., { keepalive:true })`.

Le même endpoint `/sync` sert aussi de **transport batch** pour la reprise après
reload (ADR-0003).

## Conséquences

- **+** Garantie « zéro perte » de lead validé (NFR-02), même fermeture brutale.
- **+** Un seul endpoint batch idempotent ⇒ surface serveur réduite et testable.
- **−** `sendBeacon` ne donne pas de feedback de succès → on **ne retire pas** les envelopes du miroir tant qu'une session ultérieure n'a pas confirmé (réémission idempotente possible : sans effet grâce à l'`Idempotency-Key`).
- **−** Limite de taille beacon (~64 KB) : nos batchs sont petits ; garde-fou + troncature FIFO si dépassement (rarissime).

## Option future (hors scope, N3)

Background Sync API + IndexedDB pour une durabilité offline réelle. Reportée :
gain marginal vs complexité, support Chromium-only. Réévaluable si la télémétrie
montre des pertes résiduelles malgré le beacon.
