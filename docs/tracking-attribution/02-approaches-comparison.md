# 2. Trois approches évaluées + verdict

## Approche A — Filtrage côté GTM (client-side conditions)

### Principe

L'attribution est calculée côté client (au landing) et annotée dans chaque
`dataLayer.push()`. Les tags GTM des pixels publicitaires portent une
**condition de trigger** :

```
GTM > Trigger "Conversion event"
  Fire on : CustomEvent matching event_name
  AND : attribution.channel = 'google_ads' (pour le tag Ads)
                            OR 'direct' / 'organic'
```

### Forces

- ✅ **Minimal lift** — on garde le pipeline GTM existant
- ✅ **Configurable** par l'admin (la condition est générée par l'exporter
   à partir des settings)
- ✅ **Debug facile** : Tag Assistant montre `attribution.channel` à chaque
   event ; les tags qui ne fire pas sont annotés "trigger condition not met"
- ✅ **Pas de changement côté backend** des pipelines existants

### Faiblesses

- ❌ **Sensible aux ad blockers** : un visiteur avec uBlock ne charge pas
   GTM → aucune attribution n'est appliquée (mais aucun pixel ne fire non
   plus, donc le défaut est cohérent : pas de fausses conversions)
- ❌ **Latence côté visiteur** : l'attribution doit être lue/écrite dans
   `localStorage` ou cookie avant chaque emit (impact négligeable)
- ❌ **Cookies tiers** : si on stocke l'attribution en cookie tiers, ITP
   Safari peut purger après 7j (à atténuer avec un cookie first-party)

### Pertinence

**Très haute pour démarrer**. Implémentation rapide, valeur immédiate. Pas
besoin de toucher aux pipelines server-side. Fonctionne pour 90% des cas.

---

## Approche B — Dispatch sélectif 100% server-side

### Principe

Tous les events conversion passent par `/api/track` puis le serveur :

1. Lit l'attribution depuis la base (`visitor_attribution`)
2. Applique la stratégie
3. Dispatch **uniquement** vers le provider attribué via les APIs
   serveur :
   - **Meta CAPI** (existant)
   - **Google Ads Offline Conversion Import** (à créer — server cron)
   - **TikTok Events API** (à créer)
   - **Snap Conversions API** (à créer)
   - **Pinterest Conversions API** (à créer)

Les tags GTM ne portent **plus aucune conversion** ; uniquement les events
d'audience.

### Forces

- ✅ **Bypass ad blockers** : les APIs serveur passent sous le radar
- ✅ **Précision maximale** : pas de cookie deps, deduplication via event_id
- ✅ **GDPR-friendly** : pas de cookie tiers, hashing serveur
- ✅ **Industrie 2025-2026** : Meta, Google, TikTok poussent tous vers le
   server-side pour Apple ITP + Chrome 3rd-party cookies deprecation

### Faiblesses

- ❌ **Lift énorme** : 3 nouvelles intégrations API (Google Ads OCI, TikTok,
   Snap) + retries + monitoring + audit logs
- ❌ **Latence côté reporting** : OCI Google Ads = upload batch quotidien
   (conversions visibles à J+1)
- ❌ **Pas d'audience-building pixel-side** : Meta CAPI peut alimenter les
   audiences MAIS le pixel client est meilleur pour cela (signal plus
   frais, contexte navigateur)
- ❌ **Migration plus risquée** : tout le pipeline existant doit être
   réécrit

### Pertinence

**Haute à long terme**. Bonne cible pour la phase 2/3. Pas adaptée pour un
démarrage rapide.

---

## Approche C — Hybride (recommandée)

### Principe

Combine **A pour les conversions et la rapidité**, et progressivement
**B pour le CAPI** où il est déjà disponible (Meta).

#### Côté **client (GTM)** :

- Events d'**audience** (`page_view`, `view_item`, `view_item_list`,
  `add_to_cart`, `view_cart`) → fire sur **tous les pixels** (pour
  Lookalike / Custom Audiences)
- Events de **conversion** (`purchase`, `lead_capture`, `checkout_intent`,
  `sign_up`, etc.) → fire **uniquement sur le canal attribué** (via la
  condition GTM)

#### Côté **server** :

- Meta CAPI (déjà branché) : appliquer la stratégie d'attribution AVANT
  l'appel CAPI → ne fire CAPI que si `attribution.channel === 'meta'`
  (ou stratégie l'autorise)
- Google Ads OCI / TikTok / Snap : phases futures

### Forces

- ✅ **Démarrage immédiat** (phase 1 = approche A pure)
- ✅ **Évolutif** (phase 2 = + CAPI Meta selectif, phase 3 = + Google OCI,
   phase 4 = + TikTok Events API)
- ✅ **Best of both** : audiences alimentées sur tous canaux, conversions
   sur 1 canal
- ✅ **Standard industriel** : pattern recommandé par Meta dans sa doc
   CAPI ("client-side for audiences, server-side for conversions")
- ✅ **Compatible Consent Mode v2** : la stratégie est appliquée avant
   chaque fire, et respecte les gates de consent

### Faiblesses

- ❌ **Complexité conceptuelle** : il faut expliquer aux opérateurs la
   distinction "audience event" vs "conversion event" (mitigé par notre
   admin UI qui catégorise nativement les events via le mapping)
- ❌ **Maintenance évolutive** : ajouter un nouveau provider demande de
   décider de sa condition d'attribution (mais l'architecture data-driven
   fait que c'est juste 1 ligne dans `event-mapping.ts`)

### Pertinence

**Optimale**. C'est le compromis sain entre time-to-value et qualité long
terme. **Verdict : on retient l'approche C en phasage.**

---

## Verdict & phasage

| Phase | Contenu | Durée estimée | Couvre |
|---|---|---|---|
| **1** | Approche A complète (cookie + dataLayer + GTM conditions + UI admin) | ~6h | 100% côté client |
| 2 | Brancher Meta CAPI sur la stratégie d'attribution | ~2h | Renforce Meta |
| 3 | Google Ads OCI upload nocturne | ~8h | Bypass adblock côté Ads |
| 4 | TikTok Events API server-side | ~6h | Bypass adblock côté TikTok |
| 5 | Snap / Pinterest Conversion APIs | ~6h | Idem |

**Ce doc couvre la phase 1.** Les phases suivantes sont mentionnées en
fin de runbook pour visibilité.

## Tableau récapitulatif

| Critère | A (GTM) | B (Server) | C (Hybride) |
|---|---|---|---|
| Time-to-value | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| Précision | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Résistance adblock | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Maintenabilité | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Cost dev | $ | $$$$ | $$ |
| Cost ops | Faible | Élevé (cron, retries) | Moyen |
