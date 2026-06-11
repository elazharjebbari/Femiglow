# Plan d'action — TDD par finding

> Méthode : pour chaque finding, **test rouge** (reproduit le bug) → **fix** →
> **vert**. Branche dédiée `fix/tracking-value-2026-05` (pas master, pas la WIP).
> Exporter canonique = `plan/exporter.ts`. Aucune modif de la branche
> `feat/locale-switcher-v2` hors fichiers tracking listés.

## Phase 1 — P0 : la valeur de conversion part (déblocage ROAS)

Objectif : Google Ads, GA4 et Meta reçoivent enfin `value`/`currency` corrects.

- **T-01** `plan/exporter.ts` — pointer les DLV conversion vers `params.*` :
  - `ensureDlv('DLV - value', 'params.value')`, `'params.currency'`,
    `'params.transaction_id'`, `'params.items'`.
  - Test : `plan/__tests__/exporter.test.ts` — le tag `awct` d'un `purchase`
    référence des variables dont le `name` DLV = `params.value`/`params.currency`/
    `params.transaction_id`.
- **T-02** `plan/exporter.ts` — `gaawe` : ajouter event-settings ecommerce
  (value, currency, transaction_id, items) pour les events à valeur.
  - Test : `GA4 Evt — purchase` contient des paramètres event-settings `value`/
    `currency` pointant `params.*`.
- **T-03** `plan/exporter.ts` (+ option `meta.ts`) — injecter `custom_data`
  (value, currency, contents) dans le `fbq('track', …, {…})`.
  - Test : snapshot du tag `Meta Evt — purchase` contient `value`/`currency`.

**Sortie de phase** : suite `plan/__tests__/exporter.test.ts` verte + snapshot
container mis à jour. **Checkpoint PO** possible ici (P0 livrables).

## Phase 2 — P1 : complétude providers + valeur lead chat

- **T-05** `plan/exporter.ts` — branche Pinterest (Init + Evt `pintrk`), gating
  attribution, parité Snap/TikTok. Test container Pinterest.
- **T-06** (décidé) — `value` du lead chat = **prix kit avec promo**.
  - `/api/chat/lead/contact/route.ts` : renvoyer `{ value, currency }`
    (`value = (promoPriceCents ?? priceCents)/100`, via `products/public.ts`).
  - `LeadFormBubble.tsx:249` : émettre `generate_lead` avec `value`/`currency`
    de la réponse API.
  - Tests : route (value cohérente avec promo kit) + `LeadFormBubble.test.tsx`.

## Phase 3 — P2 : convergence & garde-fous

- **T-09 / T-04 / T-08** — reconverger le drift sur `exportPlan`
  (`snapshot.ts`), déprécier `gtm/builders.ts` + `mappings/gtm-export.ts`
  (avis de dépréciation sur la route `export-gtm` ou redirection UI).
- **T-07** (décidé : **GA4 client GTM only**) — `googleAdapter.supports` ne route
  que les events server-scope (`purchase_server`) → plus de double-comptage.
- Round-trip drift vert, tests de non-régression sur tout `lib/tracking`.

## Garde-fous transverses (qualité)

- **Source unique du chemin DLV** : introduire une constante
  `DATALAYER_PATHS = { value:'params.value', currency:'params.currency', … }`
  importée par l'exporter ET typée depuis `DataLayerEntry` (évite la
  réapparition de T-01).
- Un **test contractuel** : pour chaque clé `value/currency/transaction_id/items`,
  le chemin DLV utilisé par l'exporter doit exister dans une entry produite par
  `TrackingClient.emit` (assert dynamique, pas de string en dur divergente).
- Aucune valeur de Pixel ID réelle dans les fixtures (placeholders only).

## Estimation

| Phase | Findings | Fichiers touchés | Risque |
|-------|----------|------------------|--------|
| 1 | T-01,02,03 | `plan/exporter.ts`, (`meta.ts`), tests | Moyen (snapshots à régénérer) |
| 2 | T-05,06 | `plan/exporter.ts`, `LeadFormBubble.tsx`, tests | Faible |
| 3 | T-04,07,08,09 | `snapshot.ts`, routes export, tests | Moyen (dépréciations) |
