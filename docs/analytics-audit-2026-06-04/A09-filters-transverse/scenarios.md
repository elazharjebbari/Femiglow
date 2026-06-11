# Scénarios A09 — Filtres transverses (réactivité · fuseau · device défaut)

Persona : **Karim**, opérateur, manipule la barre de filtres en haut de `/admin/analytics`. Horloge figée
selon le scénario.

> Rappel triage (cf. spec.md) : AN-09 et AN-10 sont **déjà corrigés** dans le code actuel — leurs
> scénarios sont des garde-fous de non-régression. AN-11 (device défaut `mobile`) est **encore actif**.

## Scénario A09-S1 — Le défaut « mobile » masque la moitié du trafic (reproduction AN-11, rouge)
Contexte: l'opérateur arrive sur `/admin/analytics` sans paramètre `device` dans l'URL.
Étant donné un `memoryStore` avec 1 session mobile et 1 session desktop
Et `DEFAULT_FILTERS.device === 'mobile'`
Quand Karim ouvre l'onglet « Vue d'ensemble » (filtres par défaut)
Alors le KPI « Sessions » affiche 1 (la session desktop est silencieusement exclue)
Et Karim croit voir tout le trafic alors qu'il n'en voit qu'une partie
Et [SPEC après-fix] le défaut device devient `all` → « Sessions » affiche 2.

## Scénario A09-S2 — Le défaut couvre tout le trafic (spécification AN-11, vert après fix)
Contexte: le défaut device est passé à `all`.
Étant donné `parseFiltersFromSearchParams(new URLSearchParams())`
Quand on lit `device`
Alors il vaut `all`
Et les KPI agrègent mobile + tablet + desktop.

## Scénario A09-S3 — Minuit marocain bien géré (non-régression AN-10)
Contexte: il est 00:30 le 4 juin à Casablanca, soit 23:30 UTC le 3 juin. Une cliente vient d'acheter.
Étant donné `now = 2026-06-03T23:30:00Z` et `period = 'today'`
Quand `resolveRange(filters, now)` est appelé
Alors `range.from` correspond au 4 juin 00:00 heure Maroc (= `2026-06-03T23:00:00Z`)
Et l'achat à `2026-06-03T23:30:00Z` est compté dans « Aujourd'hui »
Et [garde] si quelqu'un casse `startOfDay` en revenant au fuseau process (UTC), ce test re-échoue.

## Scénario A09-S4 — Changer un filtre rafraîchit l'onglet (non-régression AN-09)
Contexte: dashboard CTA pré-chargé pour `period=7d`.
Étant donné `CtaDashboard` monté avec `initialFilters={period:'7d'}` et `useSearchParams` mocké
Quand Karim sélectionne `device=desktop` (l'URL passe à `?period=7d&device=desktop`)
Alors `useAnalyticsFilters` relit l'URL, `router.replace` est appelé
Et un `fetch('/api/admin/analytics/cta?...device=desktop')` est déclenché
Et le tableau se met à jour (pas d'état figé sur `initialData`).

## Scénario A09-S5 — Pas de double-fetch au montage (non-régression AN-09, perf)
Contexte: l'URL au montage correspond exactement aux `initialFilters` pré-chargés par le RSC.
Étant donné `CtaDashboard` monté avec des filtres identiques à `initialData`
Quand le composant rend pour la première fois
Alors aucun `fetch` n'est déclenché (garde `isFirstRun` + comparaison querystring)
Et `initialData` est conservé.

## Scénario A09-S6 — Saisie d'URL bancale tolérée (edge robustesse)
Contexte: un lien partagé contient `?period=foo&device=desktop`.
Étant donné cette querystring
Quand `parseFiltersFromSearchParams` la parse
Alors `period` invalide est ignoré (retombe sur `today`) tandis que `device=desktop` est conservé
Et la sélection n'est pas entièrement réinitialisée.
