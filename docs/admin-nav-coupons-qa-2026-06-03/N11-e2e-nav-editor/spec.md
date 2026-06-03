# N11 — E2E NavEditor : visibilité & table d'items (best-effort)

## Rôle & surface
Prouver, en bout de chaîne, que l'éditeur de navigation dynamique est **atteignable et rendu** pour
l'opérateur : `goto('/admin/settings/navigation')` → `NavEditor` visible avec sa table d'items
(colonnes #, Key, Label, Href, Icon, Rôle, Actions) et au moins une ligne (la config résolue contient les
défauts, dont `coupons`). Niveau **best-effort** (P2) : on ne pilote pas la sauvegarde réseau ici (couverte
par N08 composant+MSW et N09 contrat) ; on valide le rendu et la présence des contrôles. Surface :
`apps/web/src/app/admin/settings/navigation/page.tsx` (RSC, `active="settings"`) →
`apps/web/src/components/admin/settings/NavEditor.tsx`. Fichier cible : `e2e/admin-nav-editor.spec.ts`.
Auth via `storageState` `.auth/admin.json`.

## Fonctionnement optimal (ce qui DOIT se passer)
1. Contexte authentifié (storageState). `goto('/admin/settings/navigation')`.
2. La page rend `AdminShell active="settings"` (l'onglet Réglages est surligné) autour de `NavEditor`.
3. `NavEditor` affiche :
   - le titre de section « Navigation » (via `SectionEditorShell`) ;
   - une `<table role="grid">` avec les en-têtes « Key », « Label », « Href », « Icon », « Rôle », « Actions » ;
   - au moins une `<tr role="row">` de données (la cascade `getSection('nav')` retombe au pire sur les
     défauts, qui contiennent plusieurs items dont `coupons`) ;
   - un compteur « N items » et un bouton « + Ajouter un item ».
4. Comme `NavEditor` reflète la **config** (source parallèle, cf. overview §2), on peut y trouver une ligne
   dont le `Label` vaut « Coupons » si les défauts l'incluent — best-effort, à vérifier sans bloquer le test
   si la config DB a été éditée.

## Contrat I/O
- Lecture seule pour N11 (pas de PATCH). `NavEditor` parlerait à `PATCH /api/admin/settings/nav` au clic
  « Enregistrer », mais N11 ne déclenche pas la sauvegarde.
- Sélecteurs robustes : `getByRole('grid')` ou la table ; en-têtes via `getByRole('columnheader', { name })` ;
  bouton via `getByRole('button', { name: /ajouter un item/i })`.

## Cas limites & non-happy-path
- **Onglet Réglages surligné** : sur `/admin/settings/navigation`, `admin-nav-settings` porte `aria-current="page"`
  (l'éditeur nav vit sous Réglages, pas sous un onglet dédié). Oracle complémentaire utile.
- **Config éditée / DB custom** : ne pas exiger une ligne « Coupons » spécifique (la DB peut avoir été modifiée) ;
  exiger plutôt « au moins une ligne de données » et la présence des contrôles. La présence de Coupons est un
  assert best-effort (`if visible then expect`), non bloquant.
- **Compile-on-demand** : `test.setTimeout(60_000)`, auto-waiting `toBeVisible`.
- **Route inexistante / 404** : si le segment route changeait, l'absence de `NavEditor` ferait échouer le test —
  signal utile (régression de route).

## Invariants couverts
- **NAV-INV-CONFIG** (effet observable) : la config résolue est éditable et rendue (table non vide).
- Niveau (b) de la couche config : N05/N06/N07/N08/N09 testent unité/contrat ; N11 confirme l'accessibilité
  réelle de l'éditeur.

## Critères d'acceptation (observables)
- Après `goto('/admin/settings/navigation')` : `getByRole('grid')` (ou la table) visible.
- En-têtes présents : « Key », « Label », « Href », « Icon », « Rôle », « Actions ».
- Au moins une ligne de données : `locator('tbody tr')` count ≥ 1.
- Bouton « + Ajouter un item » visible ; texte « N items » présent.
- `admin-nav-settings` a `aria-current="page"`.
- Best-effort : si une cellule Label « Coupons » est visible, l'assert passe ; sinon on ne bloque pas.

## Points à vérifier — tous points de vue
- Backend : `requireAdmin` + `getSection('nav')` (cascade DB→defaults→failsafe). · Frontend : `NavEditor` monté,
  table éditable rendue. · UI/UX : contrôles d'édition (Monter/Descendre/Suppr., Ajouter) visibles. · Data :
  table reflète la config résolue (parallèle au rendu nav). · A11y : `role="grid"`/`role="row"`, en-têtes nommés.
  · i18n : libellés FR.

## Anti-flaky
Playwright `--repeat-each=2`. Auto-waiting only. Best-effort : encadrer les asserts fragiles (« Coupons » en
ligne) par une vérification de visibilité préalable.
