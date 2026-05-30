# Tests — Transverse (filtres, format, primitives, navigation, perf, sécurité)

> Briques partagées par les 4 onglets. Fonctionnement optimal + vérifications tous PoV. Cas :
> [`cas-de-tests.csv`](cas-de-tests.csv). Findings : AF-04, AF-05, F-FLT-01, F-PERF-*, F-SEC-01, F-FMT-*.

## 1. Fonctionnement optimal (la cible)

- **Filtres** (`filters.ts`) : enum validés ; custom `from<to` ≤ 366 j ; persistance localStorage
  (TTL 30 j) ; URL = source de vérité ; `resolveRange` correct par période **et** en fuseau Maroc
  (AF-04) ; filtres invalides → comportement **explicite** (pas de fallback muet — F-FLT-01).
- **Formatage** (`format.ts`) : FR (NBSP fine), `null→"—"`, **devise MAD**, durées, delta, buckets
  heure/jour/semaine (semaine ISO correcte aux bords d'année — F-FMT-02 ; axe heure dans le bon
  fuseau — F-FMT-01).
- **Navigation** (`AnalyticsTabs`) : onglet actif `aria-current` ; **conserve les query params** au
  changement d'onglet.
- **Primitives** : `KpiCard`, `DataTable` (tri/vide/loading), `ChartFrame`, `EmptyState`,
  `ErrorState` (+retry), `Skeleton`, `ExportCsvButton`, `AnalyticsTooltip` — testées **en
  interaction**, pas seulement en rendu.
- **Perf** : 1 fetch au mount (pas de double — F-PERF-03) ; fenêtres longues maîtrisées
  (F-PERF-01/02) ; cache court envisagé (F-PERF-04).
- **Sécurité** : routes API protégées (401) ; consent gate ; pas d'interpolation SQL brute
  exploitable (F-SEC-01).

## 2. À vérifier par point de vue

| PoV | Vérifications |
|---|---|
| **Data (Vitest)** | `resolveRange` chaque période + comparaison + **fuseau** (AF-04) ; parse filtres (invalide → garde les clés valides, F-FLT-01) ; persistance TTL ; format devise MAD/unité (AF-02) ; bucket heure/semaine (F-FMT-*) ; classification trafic |
| **Backend** | 401 sans session sur toutes les routes ; consent gate ; (F-SEC-01) valeurs hors enum rejetées en amont |
| **Frontend (RTL)** | primitives en interaction (tri DataTable, export CSV, tooltip clavier, ErrorState retry) ; FilterBar reset apparaît/disparaît ; `data-pending` |
| **UI/UX (Playwright)** | navigation onglets conserve les filtres ; persistance au reload ; période custom ; message d'erreur sur plage invalide ; badge « Mobile uniquement » (AF-05) |
| **a11y** | selects labellisés ; focus visible ; onglets clavier ; contraste ; couleur non porteuse seule |
| **Perf** | intercepter le réseau : 1 appel/endpoint au mount ; pas de refetch en boucle |

## 3. Extrait de spec (data — fuseau AF-04)

```ts
it('FN-LAY-09/AF-04 — "today" borne sur minuit heure Maroc, pas UTC', () => {
  const now = new Date('2026-05-20T00:30:00+01:00'); // 00:30 Casablanca
  const r = resolveRange(filters({ period: 'today' }), now);
  // attendu : from = 2026-05-20T00:00:00+01:00 (pas la veille en UTC)
  expect(r.from.toISOString()).toBe('2026-05-19T23:00:00.000Z');
});
```

## 4. Extrait de spec (data — filtres invalides F-FLT-01)

```ts
it('FN-LAY-08/F-FLT-01 — clé invalide ignorée, clés valides conservées', () => {
  const f = parseFiltersFromSearchParams(new URLSearchParams('period=foo&device=desktop'));
  expect(f.device).toBe('desktop');     // conservé
  expect(f.period).toBe('today');       // défaut, mais device non écrasé
});
```

## 5. Extrait de spec (UI — navigation conserve les filtres)

```ts
test('FN-LAY-02 — changer d’onglet conserve period/device/traffic', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/analytics/funnel?period=30d&device=desktop');
  await page.getByRole('tab', { name: /cta/i }).click();
  await expect(page).toHaveURL(/period=30d/);
  await expect(page).toHaveURL(/device=desktop/);
});
```
