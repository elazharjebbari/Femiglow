# Stratégie de test (nav admin)

Hérite de [`coupon-loyalty-qa-ui-2026-06-03/00-overview/test-strategy.md`](../../coupon-loyalty-qa-ui-2026-06-03/00-overview/test-strategy.md)
(types U/I/C/M/E/A/V ; schéma `test-cases.csv` ; cycle MSW par fichier). Spécificités nav :

## Centre de gravité
La **couche rendu** (`AdminShell`) est P0 : c'est l'onglet que l'opérateur voit/clique. On la teste
exhaustivement en **composant** (Testing Library) — inventaire, ordre, actif, a11y, responsive — car
c'est rapide, déterministe et couvre 90 % du risque « onglet manquant/mal surligné ».

## Frontière MSW
`NavEditor` parle à `PATCH /api/admin/settings/nav`. On mocke cette frontière avec un handler dédié
`navSettingsHandlers` (à créer dans `src/test/msw/`) couvrant : **200** (succès, version incrémentée),
**409** (conflit `If-Match`/version stale), **422** (validation serveur, issues mappées par ligne),
**500/réseau**. On vérifie l'envoi du header `If-Match: <version>` et le mapping des erreurs vers les lignes.

## Contrat (couche I)
`PATCH /api/admin/settings/[section]` testé en **import direct** (pattern du dossier précédent :
`vi.mock` `getAdminSession`, `upsertAppConfig`, `logAuditEvent`, `next/cache`). Cas : 401, 404 section
inconnue, `If-Match` manquant→400, 422 payload invalide, 409 version stale, 200 + audit + revalidateTag.

## Schéma `test-cases.csv` (identique)
`id,feature_id,titre,type,priorite,couche,preconditions,etapes,donnees,resultat_attendu,oracle,risque_couvert,fichier_test_cible`
- `id` = `NNN-XSSS` (ex. `N01-C001`, `N08-M004`). Repris verbatim dans `it('…')`.

## Oracles UI nav
- Onglet présent : `getByTestId('admin-nav-coupons')` + texte « Coupons » + `href="/admin/coupons"`.
- Actif : `aria-current="page"` sur l'onglet courant **et sur lui seul** ; classe active `bg-stone-900`.
- A11y : `getByRole('navigation', { name: /navigation principale/i })` + axe 0 critique/serious.
- Sauvegarde : succès → message « Navigation enregistrée. » ; 409 → « …recharge la page. » ; 422 → erreurs par ligne.

## Anti-flaky
Vitest = **boucle 3×** (`for i in 1 2 3; do pnpm test … ; done`) — `--repeat-each` n'existe PAS sur Vitest.
Playwright = `--repeat-each=2`.
