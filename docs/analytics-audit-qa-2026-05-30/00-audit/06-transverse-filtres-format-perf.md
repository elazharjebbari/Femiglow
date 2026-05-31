# 06 — Transverse : filtres, formatage, perf, sécurité, a11y

Concerne les briques partagées par les 4 onglets : `lib/analytics/filters.ts`, `format.ts`,
`attribution.ts`, le fetch DB, et les primitives UI.

## 1. Filtres (`filters.ts`)

✅ **Validation Zod** : `period`, `device`, `traffic` en enum ; `custom` exige `from<to` et
`≤ 366 j` ; persistance localStorage (TTL 30 j) avec re-validation.

🟠 **AF-05 — `device` par défaut = `mobile`** (`filters.ts:40`). L'opérateur arrivant sur un onglet
voit **uniquement le trafic mobile** sans indication forte. Choix « mobile-first Maroc » défendable,
mais **piège d'interprétation** : à rendre **explicite** dans l'UI (badge « Mobile uniquement ») ou
basculer le défaut sur `all`.

🟠 **AF-04 — fuseau horaire** : `startOfDay` (`filters.ts:181`) utilise `setHours(0,0,0,0)` =
**timezone du process** (UTC sur Vercel). Pour le Maroc (UTC+1, pas de DST depuis 2018 hors
Ramadan), « Aujourd'hui » démarre à **01 h heure locale**, « Hier » est décalé. Les comparaisons
de périodes (`withComparison`) héritent du décalage. **Corriger en ancrant sur `Africa/Casablanca`**
(ou un offset configuré) et **tester** avec une `now` injectée.

🟠 **F-FLT-01 — fallback silencieux** : `parseFiltersFromSearchParams` renvoie `DEFAULT_FILTERS` si
le parse échoue (`filters.ts:112`), sans signal. Un `?period=foo` affiche « today/mobile » comme si
c'était voulu. Préférer : ignorer la clé invalide en gardant les autres, ou afficher un avertissement.

⚠️ **F-FLT-02 — désynchronisation `period` custom** : `filtersToSearchParams` n'émet `from/to` que
si `period==='custom'`. Cohérent, mais à tester (passage custom → 7d nettoie bien les bornes).

## 2. Formatage (`format.ts`)

✅ FR soigné : NBSP fine, `formatNumber`/`formatPercent`/`formatDuration`/`formatDelta`/
`formatBucket`/`suggestGranularity`. `null/NaN → "—"`.

🟠 **AF-02 (rappel) — `formatCurrency` divise par 100** (`format.ts:53`) : correct **si** la valeur
est en cents. Le défaut **`currency='EUR'`** doit être **MAD** dans le contexte FemiGlow. Vérifier
chaque appelant (CTA, Insights funnel).

⚠️ **F-FMT-01 — `formatBucket('hour')`** utilise `toLocaleTimeString` sans timezone → heure du
**navigateur de l'opérateur**, potentiellement ≠ buckets calculés côté serveur (UTC). Risque
d'axe X décalé. À aligner sur le même fuseau que les données.

⚠️ **F-FMT-02 — semaine ISO** (`formatBucket('week')`) : implémentation manuelle ; tester les bords
d'année (S52/S53, 1er janvier).

## 3. Performance & scalabilité

🟠 **F-PERF-01 — agrégation in-memory** : `fetchEvents` fait `SELECT * FROM tracking_events_log
WHERE …` sur **toute la période** puis agrège en JS (`funnel.ts:399`, `cta.ts:391`,
`checkout.ts:416`). Pour `30d/90d/all` à volume réel : transfert massif + mémoire + latence. **Pas
de `LIMIT`, pas d'agrégation SQL, pas d'index hint.**

🟠 **F-PERF-02 — matviews sous-exploitées** : `matviews.ts` + `mv_cta_performance` existent (le
commentaire `cta.ts:18` dit « privilégiée plus tard ») mais **Funnel/CTA/Checkout scannent en
direct**. Seul Insights utilise les matviews. Opportunité : router les fenêtres longues vers les mv.

🟠 **F-PERF-03 — double fetch au mount** : RSC pré-charge **et** le client refetch via l'API les
mêmes données → calcul serveur ×2 à chaque ouverture d'onglet (aggravé par F-PERF-01).

⚠️ **F-PERF-04 — pas de cache** : `revalidate=0`, `cache:'no-store'`. Chaque navigation/refetch
recalcule. Envisager un cache court (ex. 30–60 s) côté API pour amortir.

## 4. Sécurité / robustesse

🟡 **F-SEC-01 — `sql.raw()` + `escape()` maison** : les WHERE sont construits par concaténation de
chaînes (`escape` double les apostrophes). **Mitigé** par la validation Zod enum en amont
(`device`/`traffic` ne peuvent être que des valeurs connues) et les dates via `toISOString()`. Reste
une **mauvaise pratique** (fragile à toute évolution du schéma de filtres) → migrer vers des
requêtes **paramétrées** Drizzle.

✅ **Auth** : routes API protégées (`getAdminSession`/`requireAdmin`) → 401 sans session.
✅ **Consent gate** systématique.

## 5. Accessibilité / UX transverse

| Élément | À garantir |
|---|---|
| `FilterBar` | `<select>` labellisés, focus visible, bouton « Réinitialiser » apparaît hors défaut, `data-pending` pendant transition. |
| Primitives | `KpiCard`, `DataTable`, `ChartFrame`, `EmptyState`, `ErrorState`, `Skeleton`, `ExportCsvButton`, `AnalyticsTooltip` — déjà testées unitairement ; à couvrir **en interaction** (tri, export, tooltip clavier). |
| `AnalyticsTabs` | Onglet actif `aria-current`, navigation clavier, conservation des query params au changement d'onglet. |
| Charts | Description textuelle / table équivalente, contraste, pas d'info portée par la couleur seule. |
| Nombres | Format FR cohérent partout ; `—` pour null ; devises **MAD**. |

## 6. Synthèse transverse

| ID | Sév. | Résumé |
|---|---|---|
| AF-04 | P1 | Fuseau horaire serveur (today/yesterday/comparaisons) |
| AF-05 | P1 | device défaut `mobile` + double barre Insights |
| F-FLT-01 | P2 | Fallback silencieux sur filtres invalides |
| F-PERF-01/02/03 | P2 | In-memory + matviews inutilisées + double fetch |
| F-SEC-01 | P2 | `sql.raw` + escape maison (mitigé, à paramétrer) |
| F-FMT-01 | P2 | Axe X heure en fuseau navigateur ≠ serveur |
