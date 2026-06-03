# N01 — AdminShell : inventaire & ordre des onglets (Coupons inclus)

## Rôle & surface
Garantir que la sidebar admin que voit l'opérateur (Karim) rend **exactement** les 21 onglets attendus,
**dans le bon ordre**, chacun avec son libellé exact, son `href` `/admin/...` cohérent et son
`data-testid="admin-nav-<key>"`. L'enjeu déclencheur : l'onglet **Coupons** (nouveau) doit être présent,
bien nommé, bien routé, et placé **juste avant Audit**. Surface : `<nav aria-label="Navigation principale">`
de `apps/web/src/components/admin/AdminShell.tsx` (tableau statique `NAV`). Fichier de test :
`src/components/admin/AdminShell.nav.test.tsx` (NOUVEAU fichier ; ne pas dupliquer les 3 tests existants de
`AdminShell.test.tsx`).

## Fonctionnement optimal (ce qui DOIT se passer)
Au rendu de `<AdminShell adminEmail="…" active="…">`, le composant mappe le tableau `NAV` (codé en dur,
21 entrées) vers une `<ul>` de `<li>`, chacun contenant un `<Link>`. L'ordre rendu est strictement celui
du tableau source, **sans tri ni filtre** (la config dynamique `admin-config` n'est PAS consommée par
`AdminShell` — découplage documenté, cf. overview §2). Ordre exact attendu (clé → libellé → href) :

| # | key | label | href |
|---|---|---|---|
| 1 | dashboard | Tableau de bord | /admin |
| 2 | leads | Leads | /admin/leads |
| 3 | rituals | Rituels partagés | /admin/rituals/queue |
| 4 | media | Médias | /admin/media |
| 5 | components | Composants | /admin/components |
| 6 | i18n | Traductions / i18n | /admin/i18n |
| 7 | seo | SEO | /admin/seo |
| 8 | kit-video | Vidéo /kit | /admin/kit/video |
| 9 | kit-composition | Composition /kit | /admin/kit/composition |
| 10 | kit-pack | Pack /kit | /admin/kit/pack |
| 11 | legal | Pages légales | /admin/legal |
| 12 | products | Produits | /admin/products |
| 13 | content-studio | Studio contenu | /admin/content-studio |
| 14 | chat | Chat | /admin/chat |
| 15 | emails | Emails | /admin/emails |
| 16 | webhooks | Webhooks | /admin/webhooks |
| 17 | tracking | Tracking | /admin/tracking |
| 18 | analytics | Analytics | /admin/analytics |
| 19 | **coupons** | **Coupons** | **/admin/coupons** |
| 20 | audit | Audit | /admin/audit |
| 21 | settings | Réglages | /admin/settings |

Chaque lien porte `data-testid="admin-nav-<key>"` (ex. `admin-nav-coupons`). Le nombre total de liens
sous le `<nav>` est **21**. Les clés sont uniques. **Coupons** est immédiatement suivi d'**Audit**
(invariant de position relative).

## Contrat I/O
- Props : `{ adminEmail: string; active: <union>; children: ReactNode }`. `active` n'influence PAS
  l'inventaire ni l'ordre (seulement le surlignage, cf. N02).
- Aucun événement, aucun endpoint, aucun fetch. Composant purement présentationnel.

## Cas limites & non-happy-path
- `active` valant n'importe quelle clé (y compris `coupons`) ⇒ l'inventaire reste **identique** (21 onglets,
  même ordre). Tester avec au moins deux valeurs d'`active` distinctes pour prouver l'invariance.
- Aucun doublon de `data-testid` ni de clé : `admin-nav-coupons` apparaît **une seule fois**.
- Pas de lien orphelin : chaque `href` commence par `/admin` et est cohérent avec la clé (NAV-INV-ROUTE).
- Libellés exacts, accents compris : « Médias », « Rituels partagés », « Traductions / i18n », « Pages
  légales », « Réglages » — toute dérive de casse/accent doit faire échouer le test.

## Invariants couverts
- **NAV-INV-PRESENCE** : Coupons présent, libellé « Coupons », href `/admin/coupons`, testid `admin-nav-coupons`.
- **NAV-INV-ROUTE** : chaque `href` `/admin/...` cohérent avec la clé.
- Lacune d'audit : aucun test d'inventaire/ordre/testids avant ce dossier (les testids n'existaient pas).

## Critères d'acceptation (observables)
- `nav.querySelectorAll('a').length === 21` (ou `getAllByRole('link')` sous le `<nav>` = 21).
- L'ordre des `data-testid` lus dans le DOM === ordre de la table ci-dessus.
- `getByTestId('admin-nav-coupons')` existe, son `textContent` === « Coupons », son `href` se termine par `/admin/coupons`.
- L'index de `admin-nav-coupons` === index de `admin-nav-audit` − 1.
- Pour chaque clé : `getByTestId('admin-nav-<key>')` a le libellé exact et le `href` exact (test paramétré sur la table).

## Points à vérifier — tous points de vue
- Backend : néant (statique). · Frontend : ordre = ordre source, pas de tri implicite. · UI/UX : libellés
  lisibles, Coupons rangé dans la zone « commerce » (après Analytics, avant Audit). · Data : table `NAV`
  unique source de vérité du rendu. · A11y : chaque entrée est un vrai `<a>` (rôle `link`) — couvert en détail N04.
  · i18n : libellés FR figés (l'admin n'est pas localisé), pas de régression d'accents.
