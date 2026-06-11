# Plan d'action — batterie QA navigation admin & onglet Coupons

> Même méthode que [`coupon-loyalty-qa-ui-2026-06-03/90-action-plan`](../../coupon-loyalty-qa-ui-2026-06-03/90-action-plan/action-plan.md) :
> vagues + porte de qualité + **boucle de correction**. Tout depuis `apps/web/`.

## Vagues

| Vague | Objet | Features | Couche | Gate |
|---|---|---|---|---|
| **W0** | Fondation MSW `navSettingsHandlers` + smoke | infra | M | smoke vert |
| **W1** | Config & contrat | N05, N06, N09 | U/I | verts |
| **W2** | AdminShell + intégration onglet | N01, N02, N03, N04 | C/A | verts |
| **W3** | NavEditor | N07, N08 | C/M | verts |
| **W4** | E2E parcours | N10, N11 | E | verts |
| **W5** | Durcissement | tous | — | anti-flaky, lint+typecheck 0, traçabilité |

Ordre intérieur→extérieur : contrats/config (W1) avant composants (W2/W3) avant E2E (W4).
W2 peut se faire en parallèle de W1 (aucune dépendance — AdminShell est autonome).

## Détail

- **W0** : `src/test/msw/nav-settings-handlers.ts` → `navSettingsHandlers({version, fail})` couvrant
  `PATCH /api/admin/settings/nav` : 200 (version++), 409 (version_conflict), 422 (validation_failed +
  details par ligne), 500/`network`, et **echo du header `If-Match`**. + smoke.
- **W1** :
  - **N05** `nav-config.test.ts` — `navDefault` valide `navSchema` ; clés uniques (superRefine) ; `coupons`
    présent (position 9) ; positions 0..10 monotones ; `.strict()` (clé inconnue rejetée) ; max 20.
  - **N06** `resolve.nav.test.ts` — mock `getAppConfigRow` : DB absente→defaults (v0, isDefault) ;
    DB valide→DB ; DB corrompue→failsafe defaults (isDefault) + `logger.warn` ; `isDefault` structurel.
  - **N09** `[section]/route.nav.test.ts` — 401 / 404 section inconnue / If-Match manquant→400 /
    422 payload / 409 version stale / 200 + `logAuditEvent('app-config.update')` + `revalidateTag` ×2.
- **W2** :
  - **N01/N02/N04** `AdminShell.nav.test.tsx` — inventaire 21 onglets + ordre + Coupons (`admin-nav-coupons`,
    href, libellé) ; actif unique (`aria-current`/`bg-stone-900`) paramétré ; a11y (nav nommée + axe) ;
    responsive (classes) ; déconnexion (form POST `/api/admin/logout`).
  - **N03** `app/admin/coupons/page.test.tsx` — niveau composant : `AdminShell active="coupons"` surligne
    `admin-nav-coupons` + anti-régression `active!=settings` ; (RSC réel couvert par N10).
- **W3** :
  - **N07** `NavEditor.test.tsx` — add/move↑↓(bornes)/remove/update + `normalizePositions` + `dirty` +
    validation client (`navSchema` → « N erreur(s) à corriger. » + erreurs par ligne).
  - **N08** `NavEditor.save.test.tsx` — via `navSettingsHandlers` : header `If-Match` envoyé ; 200 →
    « Navigation enregistrée. » + version++ ; 409 → message conflit ; 422 → erreurs mappées ; réseau → message.
- **W4** :
  - **N10** `e2e/admin-nav-coupons.spec.ts` — login storageState → `/admin/coupons` → `admin-nav-coupons`
    `aria-current=page` → clic Dashboard → bascule actif.
  - **N11** `e2e/admin-nav-editor.spec.ts` — `/admin/settings/navigation` → NavEditor visible (table grid).

## Boucle de correction
Identique au dossier précédent : écrire → run ciblé → si rouge, distinguer **oracle faux** (corriger le
test) de **bug produit** (consigner decision-log, ne pas masquer) ; vert → non-régression du périmètre →
anti-flaky (boucle 3× Vitest / `--repeat-each=2` Playwright). Aucun `skip` non justifié.

## DoD
20 docs (11 features × fichiers) + code vert + typecheck/lint 0 + anti-flaky + traçabilité « fait ».
