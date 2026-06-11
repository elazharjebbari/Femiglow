# N03 — Intégration onglet Coupons (page RSC `active=coupons` → CouponsManager)

## Rôle & surface
Garantir que la page `/admin/coupons` (Server Component) câble correctement la nav : elle exige une session
admin (`requireAdmin`), charge les coupons, monte `<AdminShell active="coupons">` autour de
`<CouponsManager/>`. Effet observable nav : sur cet écran, l'onglet **Coupons** est surligné (et non plus
« Réglages » comme avant le correctif). Surface : `apps/web/src/app/admin/coupons/page.tsx`. Fichiers cibles
de test : `src/app/admin/coupons/page.test.tsx` (frontière documentée ci-dessous) **et** N10 (E2E réel).

## Frontière de test (DOCUMENTÉE — à lire avant d'écrire le test)
Tester un **RSC async** directement en Vitest est inconfortable : la fonction `AdminCouponsPage` est `async`,
appelle `requireAdmin` (qui lit cookies/headers et peut `redirect`) et `listCoupons` (accès DB). On **ne**
rend pas le RSC dans jsdom. On scinde la garantie en deux niveaux :

- **(a) Niveau composant (Vitest, ce dossier)** — on prouve la **conséquence nav** de la décision du RSC :
  `render(<AdminShell adminEmail="admin@femiglow.ma" active="coupons"><CouponsManager initialCoupons={[]} /></AdminShell>)`
  et on assert que `admin-nav-coupons` est surligné (`aria-current="page"` + `bg-stone-900`) et que
  `coupons-manager` est présent dans le `<main>`. C'est le **contrat de montage** que le RSC doit respecter :
  passer `active="coupons"` (pas `"settings"`) et rendre `CouponsManager` comme enfant. Optionnellement, un
  test statique/AST ou une simple lecture de constante peut figer `active="coupons"` côté source, mais
  l'oracle principal reste le rendu composant.
- **(b) Niveau E2E (Playwright, N10)** — on prouve la **réalité RSC** : login storageState → `goto('/admin/coupons')`
  → `coupons-manager` visible → `admin-nav-coupons` a `aria-current="page"`. Seul l'E2E exécute le vrai RSC,
  `requireAdmin` et l'accès DB.

Cette scission est la dette assumée du découplage : l'unité ne « rend » pas le RSC, elle verrouille le
contrat de props ; l'E2E couvre l'exécution réelle.

## Fonctionnement optimal (ce qui DOIT se passer)
1. `requireAdmin('/admin/coupons')` → session valide (sinon redirige vers login — couvert E2E N10 et
   `admin-coupons.spec.ts` existant).
2. `listCoupons()` → liste sérialisée (`startsAt/endsAt/createdAt` en ISO string).
3. Rendu : `<AdminShell adminEmail={session.email} active="coupons"><CouponsManager initialCoupons={initial}/></AdminShell>`.
4. Effet nav : onglet Coupons surligné ; `CouponsManager` (testid `coupons-manager`) monté dans `<main>`.

## Contrat I/O
- RSC sans props (route segment). Dépendances : `requireAdmin`, `listCoupons`. `export const dynamic = 'force-dynamic'`.
- `AdminShell` reçoit `active="coupons"` (valeur figée, oracle central de N03) et `adminEmail=session.email`.
- `CouponsManager` reçoit `initialCoupons` (peut être `[]`).

## Cas limites & non-happy-path
- **Non authentifié** : `requireAdmin` redirige vers `/admin/login` ⇒ la page ne rend pas la nav (oracle E2E,
  cf. `admin-coupons.spec.ts` qui teste déjà la redirection ; non re-testé en unité ici).
- **`initialCoupons` vide** : la nav et `CouponsManager` se montent quand même ; l'onglet Coupons reste surligné.
- **Régression historique** : avant correctif, la page passait `active="settings"` → l'onglet Réglages était
  surligné à tort sur l'écran Coupons. Oracle anti-régression : avec `active="coupons"`, `admin-nav-settings`
  n'est **pas** surligné.

## Invariants couverts
- **NAV-INV-ACTIVE** appliqué à la route réelle `/admin/coupons` (l'onglet courant = Coupons).
- **NAV-INV-PRESENCE** : l'onglet Coupons existe et est atteignable depuis cette page.
- Lacune d'audit : aucun test ne reliait `/admin/coupons` au surlignage correct (bug `active="settings"`).

## Critères d'acceptation (observables)
- Niveau (a) : avec `active="coupons"`, `getByTestId('admin-nav-coupons')` a `aria-current="page"` ; et
  `getByTestId('coupons-manager')` est présent ; et `getByTestId('admin-nav-settings')` n'a PAS `aria-current`.
- Niveau (b) — N10 : sur `/admin/coupons` réel, `coupons-manager` visible et `admin-nav-coupons` a `aria-current="page"`.
- Source : `page.tsx` passe littéralement `active="coupons"` (revue/oracle statique optionnel).

## Points à vérifier — tous points de vue
- Backend : `requireAdmin` garde la route ; `listCoupons` sérialise les dates en ISO. · Frontend : enfant =
  `CouponsManager`, pas autre chose. · UI/UX : cohérence « page courante = onglet surligné ». · Data :
  `initialCoupons` injecté server-side (pas de fetch au montage côté `CouponsManager`, cf. dossier coupon F01).
  · A11y : onglet courant annoncé via `aria-current`. · i18n : néant (admin FR).
