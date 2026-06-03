# N04 — AdminShell : a11y + responsive + déconnexion

## Rôle & surface
Garantir que la coquille admin est accessible et structurellement saine quel que soit le viewport :
navigation nommée, aucune violation axe critique/serious, liens focusables, layout responsive (rangée
horizontale sur mobile, colonne en sidebar sur desktop) et formulaire de déconnexion bien câblé. Surface :
`AdminShell.tsx` (`<aside>`, `<nav aria-label="Navigation principale">`, `<ul className="flex gap-2 lg:flex-col lg:gap-1">`,
`<form action="/api/admin/logout" method="post">` avec bouton « Se déconnecter », masqué mobile via
`hidden lg:block`). Fichier de test : `src/components/admin/AdminShell.nav.test.tsx`. Helper axe :
`expectNoAxeViolations` de `@/test/axe`.

## Fonctionnement optimal (ce qui DOIT se passer)
- **Nav nommée** : un `role="navigation"` avec nom accessible « Navigation principale » (le test existant le
  couvre déjà pour `active="dashboard"` ; N04 étend en vérifiant qu'il reste accessible avec `active="coupons"`).
- **axe** : `expectNoAxeViolations(container)` ne remonte aucune violation critique/serious, y compris avec
  l'onglet Coupons rendu et actif (le test axe existant ne couvrait que `active="dashboard"`).
- **Focus / cliquabilité** : chaque onglet est un `<a>` (rôle `link`) avec `href` réel, donc focusable au
  clavier ; aucune `<div>` cliquable simulée.
- **Responsive (assertion de classes, pas de média réelle)** : jsdom n'évalue pas les media-queries Tailwind ;
  on **assert les classes** porteuses du comportement responsif :
  - `<ul>` porte `flex gap-2 lg:flex-col lg:gap-1` (mobile : rangée `flex` ; desktop `lg:` : colonne).
  - `<aside>` porte `lg:w-60` (largeur fixe de sidebar au-delà du breakpoint `lg`).
  - le `<form>` de déconnexion porte `hidden lg:block` (caché en mobile, visible desktop).
- **Déconnexion** : un `<form action="/api/admin/logout" method="post">` contenant un bouton submit dont le
  texte accessible est « Se déconnecter ».

## Contrat I/O
- Composant pur ; la seule « I/O » est la cible POST du formulaire de logout (`/api/admin/logout`). On vérifie
  l'`action` et la `method` du form, pas la réponse réseau (couvert ailleurs).

## Cas limites & non-happy-path
- **axe avec actif Coupons** : pas de régression de contraste/nom sur l'état surligné (`bg-stone-900` + texte blanc).
- **Bouton logout présent dans le DOM même en jsdom** : la classe `hidden lg:block` cache visuellement en
  mobile mais l'élément reste dans le DOM ; l'oracle porte sur la présence + texte + classes, pas sur la
  visibilité calculée.
- **Nom accessible insensible à la casse** : `getByRole('navigation', { name: /navigation principale/i })`.
- **`adminEmail` rendu** : l'email opérateur est affiché (`{adminEmail}`) — vérifier qu'un email passé apparaît,
  sans validation de format (hors scope).

## Invariants couverts
- **NAV-INV-A11Y** : nav nommée, 0 violation axe critique/serious, focus visible (liens natifs), cible cliquable.
- Lacune d'audit : axe et nav nommée n'étaient testés qu'avec `active="dashboard"` ; aucun test responsive ni
  logout avant ce dossier.

## Critères d'acceptation (observables)
- `getByRole('navigation', { name: /navigation principale/i })` existe (avec `active="coupons"`).
- `await expectNoAxeViolations(container)` passe avec `active="coupons"`.
- `getAllByRole('link')` sous la nav : tous ont un `href` non vide (focusables).
- `<ul>` a `className` matchant `/flex/`, `/gap-2/`, `/lg:flex-col/`, `/lg:gap-1/`.
- `<aside>` a `className` matchant `/lg:w-60/`.
- Le `<form>` logout : `action` se termine par `/api/admin/logout`, `method="post"`, classe matche `/hidden/`
  et `/lg:block/` ; bouton avec nom accessible « Se déconnecter ».
- L'email passé en prop apparaît dans le DOM (`getByText(adminEmail)`).

## Points à vérifier — tous points de vue
- Backend : `/api/admin/logout` est la cible (POST). · Frontend : liens natifs `<a>`, pas de handler JS pour
  naviguer. · UI/UX/design : sidebar 240px (`lg:w-60`) en desktop, barre horizontale scrollable en mobile ;
  logout discret (texte souligné au hover). · Data : `adminEmail` affiché tel quel. · A11y : nav nommée,
  axe propre, focus clavier, contraste de l'actif. · i18n : libellés FR figés.
