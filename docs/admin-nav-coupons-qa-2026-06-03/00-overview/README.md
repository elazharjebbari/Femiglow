# 00 — Overview : navigation admin & onglet Coupons

## 1. Vision & doctrine

Garantir que **l'opérateur trouve, voit et active** ses écrans depuis la navigation — en particulier le
nouvel onglet **Coupons** — et que la **configuration de la navigation** (éditeur + persistance) est fiable.
Doctrine identique au dossier coupon/fidélité : on teste le **comportement observable** (présence d'un
onglet, surlignage actif, navigation au clic, message d'erreur de sauvegarde) via Testing Library
(composant), MSW (frontière réseau) et Playwright (parcours). Cf.
[`coupon-loyalty-qa-ui-2026-06-03/00-overview/`](../../coupon-loyalty-qa-ui-2026-06-03/00-overview/) pour
le `TEMPLATE.md`, la `test-strategy.md` (types U/I/C/M/E/A/V) et la `tooling.md` (cycle MSW par fichier,
`cd apps/web`, etc.) — non dupliqués ici.

## 2. Architecture testée (deux couches)

- **Couche rendu** — `apps/web/src/components/admin/AdminShell.tsx` : tableau `NAV` (statique) →
  `<nav aria-label="Navigation principale">` → `<Link data-testid="admin-nav-<key>" aria-current>`.
  C'est ce que voit réellement l'opérateur. **C'est la couche prioritaire** (P0).
- **Couche config** — `apps/web/src/lib/admin-config/` : `defaults.ts` (`navDefault`, inclut `coupons`),
  `schemas.ts` (`navSchema`), `resolve.ts` (cascade DB→defaults + failsafe + `isDefault`), éditeur
  `components/admin/settings/NavEditor.tsx` (PATCH `/api/admin/settings/nav`, `If-Match`), contrat
  `app/api/admin/settings/[section]/route.ts`.
  ⚠ **Découplage documenté** : `AdminShell` rend une liste **codée en dur** ; il n'utilise PAS encore la
  config résolue. La config est donc une **source de vérité parallèle** (éditable via `NavEditor`). Les
  tests vérifient chaque couche pour ce qu'elle est ; l'écart est consigné comme dette (cf. decision-log).

## 3. Audit de couverture (avant ce dossier)

- `AdminShell.test.tsx` : **3 tests** (nav nommée, aria-current sur 1 item, axe). Aucun test d'inventaire
  des onglets, d'onglet Coupons, de responsive, ni de data-testids (inexistants avant).
- `NavEditor` : **0 test** (édition, validation client, sauvegarde réseau, conflit de version).
- `resolve.ts` cascade nav : couverture indirecte au mieux ; pas de test ciblé failsafe/`isDefault` côté nav.
- Contrat `PATCH [section]` pour `section='nav'` : pas de test dédié à la nav.
- Page `/admin/coupons` : aucun test de l'intégration onglet (active=coupons).

## 4. Invariants (oracles transverses)

- **NAV-INV-PRESENCE** : tout écran admin a un onglet ; **Coupons** est présent, libellé « Coupons »,
  href `/admin/coupons`, `data-testid="admin-nav-coupons"`.
- **NAV-INV-ACTIVE** : exactement **un** onglet porte `aria-current="page"` = celui correspondant à la page.
- **NAV-INV-ROUTE** : chaque onglet pointe vers un `href` `/admin/...` cohérent avec sa clé.
- **NAV-INV-A11Y** : `nav` nommée, aucune violation axe critique/serious, focus visible, cible cliquable.
- **NAV-INV-CONFIG** : `navDefault` valide `navSchema` ; clés uniques ; `coupons` présent.
- **NAV-INV-FAILSAFE** : payload DB invalide ⇒ `resolve` retombe sur `defaults` (jamais de crash).
- **NAV-INV-LOCK** : sauvegarde nav exige `If-Match` (version) ; version stale ⇒ 409, aucune écriture.
- **NAV-INV-PERSIST** : une sauvegarde valide ⇒ 200 + version incrémentée + audit `app-config.update`.

## 5. Définition de « fini » (DoD)
Comme le dossier précédent : `spec.md` + `test-cases.csv` + `scenarios.md` + `fixtures.json` (+ `flow.puml`
si pertinent) par fonctionnalité ; code de test **vert** ; lint+typecheck 0 ; anti-flaky (boucle 3× Vitest,
`--repeat-each` Playwright) ; traçabilité à jour.
