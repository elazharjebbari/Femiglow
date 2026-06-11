# Audit — Firing par canal d'attribution + Meta Purchase (2026-05-31)

## Contexte
Deux symptômes rapportés :
1. « Le système fire toutes les balises vers tous les canaux » alors que la
   stratégie voulue est « fire la balise du dernier canal connu ».
2. « Meta Purchase ne fire pas » sur l'event `purchase`, alors qu'on veut
   qu'il se déclenche.

## Comment ça marche (état réel du code)

Deux chemins, **symétriques en théorie** :

| Chemin | Fichier | Gating attribution |
|--------|---------|--------------------|
| **Serveur (CAPI)** | `src/lib/tracking/server/dispatcher.ts` → `attribution/dispatch-gate.ts` | `shouldDispatchByAttribution()` skip un provider si le canal ≠ attendu |
| **Client (GTM)** | `src/lib/tracking/plan/exporter.ts` (`exportPlan`) | trigger `[attr / provider]` avec `filter` MATCH_REGEX sur `{{DLV - attribution.channel}}` |

La variable `{{DLV - attribution.channel}}` est peuplée **par event** par
`TrackingClient.emit()` (`client.ts` L150-189 : lit le cookie d'attribution →
`applyStrategy()` → push `attribution.channel` dans le dataLayer).

**Politique de gating** (`event-mapping.ts` `getAttributionMode`) :
- `primary`  → tag **gaté** (ne fire que sur le canal attribué + fallback). Meta : `{Purchase, Lead}`.
- `broadcast` → tag **non gaté** → fire sur tous les canaux. **Tout le reste.**

→ Donc « fire tous les canaux » est **VRAI ET VOULU pour les events broadcast**
(audience + secondary : view_item, add_to_cart, add_payment_info…). Seules les
conversions **primary** (Purchase, Lead) sont gatées. (cf. Finding F3.)

## Findings

### F1 — CRITIQUE : le pixel des conversions primary ne fire pas pour `social_organic`, `email` (asymétrie client/serveur)
L'exporter génère le filtre client (`exporter.ts` L620) :
```
{{DLV - attribution.channel}}  MATCH_REGEX  ^(<provider>|direct|organic|broadcast)$
```
Mais la taxonomie réelle (`attribution/types.ts` `ATTRIBUTION_CHANNELS`) contient :
`google_ads, meta, tiktok, snap, pinterest, bing_ads, email, organic, social_organic, direct`.

→ Les canaux **`social_organic`** (clic organique Instagram/Facebook) et **`email`**
ne sont **PAS** dans l'allowlist → **aucun pixel de conversion primary ne fire**
pour ces visiteurs, **y compris Meta Purchase**. Pour une marque à forte présence
IG/FB comme FemiGlow, `social_organic` = une part majeure du trafic.

**Asymétrie aggravante** : côté serveur, `dispatch-gate.ts` `BROADCAST_CHANNELS`
inclut `social_organic` ET `unknown` (autorisés). Donc pour ces visiteurs :
- CAPI serveur : Purchase **envoyé** ✓
- Pixel navigateur : Purchase **bloqué** ✗
→ Meta reçoit l'event serveur sans l'event browser → **matching/EMQ dégradé + dedup cassée.**

### F2 — Meta Purchase est `primary` (gaté), pas `broadcast`
`META_PRIMARY_NAMES = {Purchase, Lead}` (`event-mapping.ts` L473). Donc même
allowlist corrigée (F1), Meta Purchase reste bloqué pour un visiteur attribué à
un AUTRE canal payant (google_ads, tiktok…). L'utilisateur veut Meta Purchase
**toujours** sur `purchase`.

### F3 — DESIGN (pas un bug) : broadcast pour audience/secondary
Seules les primary sont gatées ; tout le reste fire partout par design
(alimente audiences + smart bidding, cf. `docs/tracking-attribution/04`).
L'attente « last-known-channel pour TOUT » diffère du design. → décision produit.

### F4 — Duplication de la source de vérité « broadcast channels »
La liste des canaux « broadcast/fallback » est **dupliquée** :
- serveur : `dispatch-gate.ts` `BROADCAST_CHANNELS = {direct, organic, social_organic, broadcast, unknown}`
- client : regex en dur `^(...|direct|organic|broadcast)$` dans `exporter.ts`
→ elles ont **dérivé** (F1). Risque de re-divergence à chaque évolution.

## Plan d'action (corrections)

| # | Correctif | Fichier | Effet |
|---|-----------|---------|-------|
| **C1** | Élargir l'allowlist client pour inclure `social_organic` (+ `email` + canal vide/`unknown`) | `exporter.ts` L620 (regex) | Meta/TikTok/Snap Purchase firent pour les visiteurs organiques sociaux & email |
| **C2** | Factoriser UNE source de vérité des broadcast channels, partagée client+serveur | nouvelle const + `dispatch-gate.ts` + `exporter.ts` | élimine F4, garantit la symétrie |
| **C3** | (option utilisateur) Rendre **Meta Purchase broadcast** | `event-mapping.ts` `META_PRIMARY_NAMES` ou override par-event | Meta Purchase fire sur TOUS les canaux |
| **C4** | (décision) Garder broadcast pour secondary, ou gater plus largement | `event-mapping.ts` | aligne le comportement sur l'attente |

## Décisions à prendre (avant implémentation)
1. **C3 — Meta Purchase broadcast ?** Oui = Meta reçoit tous les purchases (recommandé
   pour l'optimisation Meta, Meta gère sa propre attribution). Non = on garde le gating.
2. **C4 — stratégie globale** : garder « broadcast secondary + gate primary » (recommandé)
   ou passer à « strict last-known-channel partout » ?
3. **C1 — `email` dans l'allowlist des pixels payants ?** (un email click doit-il créditer
   le pixel payant ? souvent oui en fallback, à confirmer.)

Voir `RUNBOOK.md` pour l'application + la vérification.
