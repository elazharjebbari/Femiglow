# Runbook — Correction firing par canal + Meta Purchase

Pré-requis : être sur `master` à jour, `cd apps/web`, node 22.
Tous les changements sont dans `src/lib/tracking/`. Tester après CHAQUE étape.

---

## Étape 0 — Reproduire / mesurer (avant)
But : confirmer quels canaux bloquent les pixels primary AUJOURD'HUI.

```bash
cd apps/web
# Voir le regex d'allowlist généré (doit être ^(<provider>|direct|organic|broadcast)$)
grep -n "MATCH_REGEX\|direct|organic|broadcast" src/lib/tracking/plan/exporter.ts
# Voir la liste serveur (désynchronisée)
grep -n "BROADCAST_CHANNELS" -A6 src/lib/tracking/attribution/dispatch-gate.ts
# Taxonomie réelle des canaux
grep -n "ATTRIBUTION_CHANNELS" -A12 src/lib/tracking/attribution/types.ts
```
Constat attendu : `social_organic`, `email` (et canal vide) ∈ taxonomie mais ∉ regex client.

---

## Étape 1 — C2 : source de vérité unique des « broadcast / fallback channels »
Créer la constante partagée et la consommer des deux côtés.

1. Dans `src/lib/tracking/attribution/types.ts`, ajouter :
   ```ts
   /** Canaux où une conversion primary est broadcastée à tous les pixels payants
    *  (visiteur non attribué à un canal payant identifié). Source de vérité
    *  partagée client (exporter GTM) ET serveur (dispatch-gate). */
   export const BROADCAST_FALLBACK_CHANNELS = [
     'direct',
     'organic',
     'social_organic',
     'email',
     'broadcast', // valeur sentinelle stratégie=broadcast
     'unknown',   // canal non résolu / cookie vide
   ] as const;
   ```
2. `dispatch-gate.ts` : remplacer le `BROADCAST_CHANNELS` local par un `new Set(BROADCAST_FALLBACK_CHANNELS)`.

## Étape 2 — C1 : aligner le regex client sur la constante
Dans `src/lib/tracking/plan/exporter.ts`, fonction `ensureAttributionTrigger`
(≈ L608-624), remplacer le regex en dur :
```ts
// AVANT
value: `^(${providerKey}|direct|organic|broadcast)$`,
// APRÈS — provider attendu + tous les fallbacks broadcast (source unique)
value: `^(${providerKey}|${BROADCAST_FALLBACK_CHANNELS.join('|')}|)$`,
```
> Le `|` final autorise aussi la **chaîne vide** (canal non encore résolu au 1er
> event) — évite de perdre une conversion pendant la fenêtre de capture.

Importer `BROADCAST_FALLBACK_CHANNELS` en haut du fichier.

## Étape 3 — C3 (option) : Meta Purchase TOUJOURS (broadcast)
Choix produit. Si « Meta Purchase doit toujours fire » :

- Dans `src/lib/tracking/providers/event-mapping.ts`, retirer `'Purchase'` de
  `META_PRIMARY_NAMES` (laisser `Lead`) :
  ```ts
  const META_PRIMARY_NAMES: ReadonlySet<string> = new Set(['Lead']);
  ```
  → `getAttributionMode('purchase','meta')` rend `broadcast` → le tag Meta Purchase
  fire sur le trigger CustomEvent classique (sans filtre attribution) = tous canaux.

> Conséquence : Meta reçoit 100 % des purchases (browser + CAPI dedupés par
> `event_id`). C'est l'usage recommandé pour l'optimisation Meta. À acter.
> NB : faire le même choix côté serveur est automatique — `dispatch-gate` lit
> aussi `getAttributionMode`, donc passer Meta/purchase en broadcast débloque
> le CAPI pour les visiteurs non-meta aussi (cohérence client/serveur).

(Variante moins radicale si tu veux garder Lead+Purchase gatés pour les AUTRES
mais broadcaster Meta purchase uniquement : ajouter un override par-couple
`(event,provider)` plutôt que toucher META_PRIMARY_NAMES — me demander.)

## Étape 4 — Tests
```bash
cd apps/web
pnpm test -- src/lib/tracking/plan/__tests__/exporter.test.ts \
             src/lib/tracking/attribution \
             src/lib/tracking/providers/event-mapping.test.ts
pnpm typecheck
```
Ajouter/ajuster :
- exporter : un test « le trigger `[attr/meta]` autorise social_organic + email + vide ».
- event-mapping (si C3) : `getAttributionMode('purchase','meta') === 'broadcast'`.
- dispatch-gate : un visiteur `social_organic` → Meta purchase `allowed:true`.

## Étape 5 — Vérifier l'export régénéré (preuve fonctionnelle)
```bash
# Après un nouvel export de plan (UI /admin/tracking ou API), inspecter :
F=~/Downloads/<nouvel-export>.json
# 1) le filtre Meta purchase autorise bien les canaux élargis
jq '.containerVersion.trigger[] | select(.name|test("purchase.*attr.*meta";"i")) | .filter' "$F"
# 2) (si C3) Meta purchase fire sur le trigger NEUTRE (pas [attr]) :
jq -r '.containerVersion.tag[] | select(.name|test("Meta.*purchase";"i")) | "\(.name) → trig \(.firingTriggerId)"' "$F"
```
Attendu : regex `^(meta|direct|organic|social_organic|email|broadcast|unknown|)$`
(C1), et si C3 le tag Meta purchase pointe sur `CE — purchase` (neutre).

## Étape 6 — Validation runtime (GTM Preview / Tag Assistant)
1. Importer le conteneur régénéré dans GTM (workspace de test).
2. GTM **Preview** sur le site, simuler 3 parcours :
   - visiteur **organique IG** (referrer instagram) → `social_organic` → **Meta Purchase doit fire**.
   - visiteur **direct** → `direct` → Meta Purchase fire.
   - visiteur **Google Ads** (`gclid`) → `google_ads` → Meta Purchase : fire si C3
     appliqué (broadcast), sinon ne fire pas (gardé pour Ads).
3. Vérifier la **dedup** Meta : browser + CAPI portent le même `event_id` (param `eventID`).

## Rollback
Tout est code (pas de migration). `git revert <sha>` du commit + redeploy.
Le conteneur GTM précédent reste importable (garder l'ancien export).

---

## Résumé décisionnel à valider AVANT de coder
- [ ] C1+C2 : élargir + factoriser l'allowlist (corrige le bug F1). **Recommandé, sans risque.**
- [ ] C3 : Meta Purchase broadcast (toujours fire). **À acter (impact mesure Meta).**
- [ ] C4 : garder broadcast-secondary (recommandé) vs strict last-known-channel.
