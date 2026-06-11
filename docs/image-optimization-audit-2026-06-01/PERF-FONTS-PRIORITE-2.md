# Priorité 2 — dégraissage des polices (render-blocking CSS /kit)

Suite de l'audit « requêtes de blocage du rendu » sur /kit. Le 2ᵉ CSS
render-blocking était le CSS `next/font` (`@font-face`). Décision validée :
**priorité 2 côté code uniquement** (pas de CDN externe — tout reste sur le
serveur LiteSpeed).

## Constat (avant)

Le **root layout** (`src/app/layout.tsx`) initialisait **4 polices** via
`next/font` et posait leurs 4 variables sur `<html>` :

| Police | Usage réel | Problème sur /fr/kit |
|---|---|---|
| Cormorant (`--font-cormorant`) | `font-display` — partout | légitime |
| Inter (`--font-inter`) | `font-body` — partout | légitime |
| **Pinyon** (`--font-pinyon`) | **uniquement** la signature d'`EditorialLetter` (page /merci) | préchargée + `@font-face` **alors qu'absente de /kit** |
| **Cairo** (`--font-cairo`) | **uniquement** en arabe (`html[lang='ar']`) | `preload:true` → woff2 arabe **préchargé sur toutes les pages FR/EN** |

Mesure : **4 woff2 chargées** sur /fr/kit (dont Pinyon + Cairo, inutiles en FR).
Le commentaire d'origine (« pas de bandwidth perdu en LTR ») était **faux** :
`next/font` émet un resource hint `HL[…,"font"]` (RSC) pour chaque police
initialisée dans le graphe de la route → préchargement effectif.

## Correctif

1. **Pinyon → scopée à `EditorialLetter`.** `localFont(...)` est désormais
   initialisée dans `src/components/sections/EditorialLetter.tsx`, et la variable
   `--font-pinyon` posée sur sa `<section>`. `next/font` ne précharge donc le
   woff2 + n'injecte le `@font-face` **que** sur les routes qui rendent ce
   composant. /kit (et les autres pages publiques) ne l'embarquent plus.

2. **Cairo → `preload: false`.** La variable reste sur `<html>` (le sélecteur
   `html[lang='ar']` de `globals.css` l'exige — les variables CSS héritent vers
   le bas). `preload:false` supprime le resource hint sur **toutes** les pages.
   En FR/EN la police n'est même pas téléchargée (aucun texte ne l'applique) ;
   en AR elle reste fonctionnelle, chargée à la demande en `display:swap`.

## Résultat (après, build prod :3100)

| Page | woff2 chargées | Détail |
|---|---|---|
| **/fr/kit** | **2** (était 4) | Cormorant + Inter uniquement |
| /ar/kit | Cairo toujours câblée | `font-family` du `<html>` référence Cairo |

Le `@font-face` Pinyon disparaît du CSS de route de /kit ; le hint woff2 Pinyon
**et** Cairo disparaissent. (NB : l'utilitaire Tailwind `.font-script{font-family:
var(--font-pinyon)…}` reste dans le CSS global — c'est une *définition de classe*,
0 `@font-face`, aucun téléchargement.)

## Tests

- **Vitest** `EditorialLetter.test.tsx` (+1) : la `<section>` porte la variable
  `--font-pinyon` et la signature la consomme (`var(--font-pinyon)`) → garde-fou
  du scoping. Mock `next/font/local` ajouté à `vitest.setup.ts`.
- **Playwright** `e2e/fonts-optimization.spec.ts` (nouveau) :
  - `/fr/kit` → exactement **2** woff2 self-hébergées chargées ;
  - `/ar/kit` → `font-family` du `<html>` contient `cairo` (AR non régressé).
- Non-régression : Vitest sections **265/265**, `public-images` e2e **8/8**,
  `tsc --noEmit` 0 erreur.

## Hors périmètre (refusé / différé)

- **CDN externe** : refusé — tout reste sur le serveur. Le levier latence (#1 de
  l'analyse) n'est donc pas appliqué. Reste pertinent côté serveur : faire
  honorer `Cache-Control: immutable` sur `/_next/static` par LiteSpeed (la prod
  renvoie `max-age=604800` au lieu du `immutable` configuré dans Next) — config
  hébergeur, pas de code.
- Réduction du Tailwind global 108 KB / inlining critique : non retenu (peu de
  fruit, fragile) — à réévaluer si PSI reste rouge.
