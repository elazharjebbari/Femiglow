# Runbook — exécution & validation

> À dérouler après feu vert PO. Chaque étape a une **commande** et une
> **vérification**. Node 22 (`~/.nvm/versions/node/v22.13.1/bin`),
> `node_modules/.bin/vitest` direct (cf. contraintes env).

## 0. Pré-requis

```bash
cd apps/web
git checkout -b fix/tracking-value-2026-05 origin/master   # ou depuis la branche convenue
export PATH="$HOME/.nvm/versions/node/v22.13.1/bin:$PATH"
```

## 1. Boucle TDD (par finding)

```bash
# rouge → fix → vert, fichier par fichier
./node_modules/.bin/vitest run src/lib/tracking/plan/__tests__/exporter.test.ts
./node_modules/.bin/vitest run src/components/chat/LeadFormBubble.test.tsx
```

**Vérif** : le test ajouté échoue AVANT le fix, passe APRÈS.

## 2. Non-régression tracking

```bash
./node_modules/.bin/vitest run src/lib/tracking src/test/integration/tracking-providers.test.ts \
  src/test/integration/tracking-ingest.test.ts
```

**Attendu** : vert. Régénérer les snapshots container si modifiés
(`-u`) **après** revue manuelle du diff.

## 3. Validation « le container est correct » (sans toucher GTM prod)

Générer un container depuis un plan de test et l'inspecter :

```bash
# via l'API admin (serveur dev port 3000, cf. session) :
#   POST /api/admin/tracking/plans/<id>/export  → { json, bundleId }
# Vérifs JSON attendues sur le container :
```

- **T-01** : le tag `awct` a `conversionValue` → variable dont le DLV `name`
  vaut `params.value` ; idem `currencyCode`→`params.currency`,
  `orderId`→`params.transaction_id`.
- **T-02** : `GA4 Evt — purchase` porte des event-settings `value`/`currency`.
- **T-03** : `Meta Evt — purchase` → le `fbq('track', …, { value, currency })`.
- **T-05** : présence de `Pinterest Init` + `Pinterest Evt — purchase`.

## 4. Validation runtime (navigateur + Tag Assistant)

> Optionnel mais recommandé avant prod — valide la résolution réelle des DLV.

1. Lancer le serveur dev (port libre) ; ouvrir le tunnel checkout, finaliser un
   achat de test.
2. `window.dataLayer` : vérifier l'entry `purchase` → `params.value` présent.
3. **Tag Assistant / GTM Preview** : sur l'event `purchase`,
   - `{{DLV - value}}` résout à un nombre (≠ `undefined`),
   - le ping `awct` contient `value=` et `currency=MAD`,
   - le ping Meta `Purchase` contient `cd[value]`.
4. Console pixels : Meta Test Events (value présent), Google Ads Tag Assistant
   (conversion avec valeur), GA4 DebugView (purchase + revenue).

## 5. Critères de sortie (definition of done)

- [ ] T-01/02/03 : value+currency arrivent côté Ads, GA4, Meta (vérif §4).
- [ ] T-05 : Pinterest présent dans le container.
- [ ] T-06 : lead chat valorisé (ou `currency` retiré) — décision PO appliquée.
- [ ] T-09 : drift-detector pointe sur `exportPlan` ; legacy déprécié.
- [ ] Suite `lib/tracking` verte + snapshots revus.
- [ ] Aucun Pixel ID réel committé ; pas de modif hors périmètre tracking.

## 6. Rollback

`git revert <commit>` (CI-only côté code). Côté GTM : ré-importer le container
précédent (toujours versionner l'export avant publication). Aucun impact data
historique (les events `tracking_events_log` ne sont pas modifiés).
