# N02 — AdminShell : onglet actif (aria-current + style) par route

## Rôle & surface
Garantir que pour une valeur d'`active` donnée, **un seul** onglet est marqué courant : il porte
`aria-current="page"` ET la classe active `bg-stone-900 text-white` ; tous les autres ont `aria-current`
absent (`undefined`) et la classe inactive `text-stone-700`. C'est le signal visuel et a11y qui dit à
Karim « tu es ici ». Enjeu : quand `active="coupons"`, l'onglet **Coupons** (et lui seul) est surligné.
Surface : `AdminShell.tsx` (calcul `isActive = item.key === active`). Fichier de test :
`src/components/admin/AdminShell.nav.test.tsx`.

## Fonctionnement optimal (ce qui DOIT se passer)
`AdminShell` reçoit `active` (union de clés). Pour chaque item :
- si `item.key === active` ⇒ `aria-current="page"` + `className` contient `bg-stone-900` et `text-white` ;
- sinon ⇒ pas d'attribut `aria-current` + `className` contient `text-stone-700` (et `hover:bg-stone-100`).

Il y a donc **exactement un** lien avec `aria-current="page"` dès lors qu'`active` correspond à une clé
réelle du tableau `NAV` (ce qui est garanti par le typage union de la prop). Le test existant
`AdminShell.test.tsx` ne couvre que `active="leads"` et vérifie l'attribut sur le lien Leads ; N02 **étend**
en couvrant : unicité de l'actif, le cas `coupons`, la cohérence classe/attribut, et une couverture
paramétrée sur plusieurs clés représentatives.

## Contrat I/O
- Prop pivot : `active`. Aucune autre I/O. La couleur active `bg-stone-900` est un token Tailwind stone-900
  (gris quasi-noir), pas terracotta : la charte terracotta `#C28A6E` concerne l'« économie » côté vitrine,
  pas la nav admin — ne pas confondre.

## Cas limites & non-happy-path
- **Unicité** : pour n'importe quelle valeur d'`active`, le nombre de liens avec `aria-current="page"` est
  exactement 1 (jamais 0, jamais 2). Tester explicitement avec `coupons`, `dashboard`, `settings`.
- **Cohérence attribut/classe** : l'onglet qui a `aria-current="page"` est aussi celui qui a `bg-stone-900` ;
  aucun onglet ne doit avoir la classe active sans l'attribut, ni l'inverse.
- **Non-contamination** : quand `active="coupons"`, l'onglet `audit` (voisin immédiat) n'a PAS `aria-current`
  et n'a PAS `bg-stone-900` (anti faux-positif sur les voisins).
- Clés à libellé ambigu : `getByRole('link', { name: /coupons/i })` est sans ambiguïté ici (un seul lien
  contient « Coupons ») — préférer néanmoins `getByTestId('admin-nav-coupons')` pour la robustesse.

## Invariants couverts
- **NAV-INV-ACTIVE** : exactement un onglet `aria-current="page"` = celui de la page.
- Lacune d'audit : avant ce dossier, seul `active="leads"` était testé et seulement l'attribut (pas la classe,
  pas l'unicité, pas `coupons`).

## Critères d'acceptation (observables)
- Avec `active="coupons"` : `getByTestId('admin-nav-coupons')` a `aria-current === 'page'` et `className`
  matche `/bg-stone-900/` et `/text-white/`.
- Le nombre total de liens avec `[aria-current="page"]` est === 1.
- `getByTestId('admin-nav-audit')` (avec `active="coupons"`) n'a pas `aria-current` et son `className` matche
  `/text-stone-700/` (pas `/bg-stone-900/`).
- Test paramétré : pour chaque `active` dans {dashboard, coupons, settings, leads}, l'onglet de cette clé est
  le seul actif et porte la bonne classe.

## Points à vérifier — tous points de vue
- Backend : néant. · Frontend : `isActive` strict par égalité de clé, pas de match par préfixe d'URL.
  · UI/UX : contraste suffisant (blanc sur stone-900) — l'état actif est visuellement non ambigu. · Data :
  `active` provient du RSC parent (cf. N03). · A11y : `aria-current="page"` est le bon token ARIA pour l'onglet
  courant. · i18n : néant (pas de texte localisé en jeu).
