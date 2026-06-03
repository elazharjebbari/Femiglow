# Scénarios N02 — Onglet actif (Gherkin FR)

Persona : **Karim**, opérateur. Il a besoin du repère visuel « tu es ici » pour ne pas se perdre.

## Scénario N02-S1 — Sur la page Coupons, l'onglet Coupons est surligné (happy)

Contexte : Karim est sur l'écran Coupons (le RSC passe `active="coupons"`).

```
Étant donné que AdminShell est rendu avec active="coupons"
Quand on inspecte l'onglet "admin-nav-coupons"
Alors il porte aria-current="page"
  Et sa classe contient bg-stone-900 et text-white (état surligné)
  Et il est le seul onglet de toute la nav à porter aria-current="page"
```

## Scénario N02-S2 — Le voisin immédiat n'est pas contaminé (edge faux-positif)

Contexte : « Coupons » est juste avant « Audit » ; on vérifie qu'Audit reste éteint.

```
Étant donné que AdminShell est rendu avec active="coupons"
Quand on inspecte l'onglet "admin-nav-audit"
Alors il ne porte pas aria-current
  Et sa classe contient text-stone-700 (état inactif)
  Et sa classe ne contient pas bg-stone-900
```

## Scénario N02-S3 — Unicité de l'actif sur plusieurs pages (edge invariant)

Contexte : quelle que soit la page, jamais deux onglets surlignés, jamais zéro.

```
Étant donné une valeur d'active parmi { dashboard, coupons, settings, leads }
Quand AdminShell est rendu avec cette valeur
Alors il existe exactement un onglet avec aria-current="page"
  Et cet onglet est "admin-nav-<active>"
```
