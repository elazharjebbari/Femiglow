# Tests — Onglet Insights

> Le module le plus riche (matviews, refresh, drill-down, exports, settings). Fonctionnement
> optimal + vérifications tous PoV. Cas : [`cas-de-tests.csv`](cas-de-tests.csv).
> Findings : AF-05 (double barre), F-INS-02..06.

## 1. Fonctionnement optimal (la cible)

Vues : **overview** (KPIs + variations + timeseries + heatmap + top events), **pages** (+drill-down),
**components** (+dead + drill-down), **sections**, **funnel** (stages/dropoffs/revenue/purchasers).
Filtres propres (`window/env/device/locale/trafficSource` + custom). **Refresh** matview (cron/
manuel, lock, status, firstRun). **Settings** (enabled, intervalMinutes ∈ {5,10,15,30,60}). **Export
CSV** par view + **Export PNG**.

**Invariants de justesse** :
- `avgEventsPerSession = totalEvents / uniqueSessions` ; `bounceRate ∈ [0,1]` ; `share ∈ [0,1]` et
  `Σ share ≈ 1` ; heatmap 7×24 ; `variations` = comparaison vs période précédente cohérente.
- `firstRun=true` ⇒ vues vides + **état dédié** (≠ EmptyState « pas de trafic » — F-INS-03).
- refresh : `running → success` ; **lock** empêche un 2e run concurrent (skip propre — F-INS-06) ;
  `refreshedAt` mis à jour et **visible** (F-INS-02).
- revenu funnel insights cohérent en unité/devise (F-INS-04, aligné AF-02).
- export CSV : colonnes attendues, séparateur, échappement, encodage ; PNG non vide.

**Comportement UI** :
- réactivité **correcte** (modèle de référence) : changer un filtre refetch **toutes** les vues.
- **AF-05** : la `FilterBar` du layout (period/device/traffic) ne pilote pas Insights → **une seule
  barre effective** doit être présentée à l'opérateur (masquer/neutraliser le doublon).
- drill-down ouvre le **drawer** (focus-trap, Échap) ; onglets internes commutent.

## 2. À vérifier par point de vue

| PoV | Vérifications |
|---|---|
| **Data (Vitest)** | aggregate KPIs (avg/bounce/share) ; variations ; heatmap 7×24 ; funnel stages/dropoffs ; revenu unité (F-INS-04) ; purge/rétention ; audit log |
| **Backend (MSW)** | overview/pages/components/sections/funnel/refresh/settings/export ; Zod (window custom, interval autorisé) ; 401 |
| **Frontend (RTL)** | `useInsightsFilters` URL↔filters ; `useInsightsFetch` refetch ; drawer ; firstRun ; loading/empty/error |
| **UI/UX (Playwright)** | refresh+lock concurrent ; export CSV (download) ; export PNG non vide (fr/ar/en) ; drill-down ; **une seule barre de filtres effective** (AF-05) ; refreshedAt visible |
| **a11y** | heatmap équivalent textuel ; drawer focus-trap + Échap ; boutons export labellisés ; onglets role=tab |
| **Perf** | matview = lecture rapide ; refresh non bloquant ; pas de double run |

## 3. Extrait de spec (refresh concurrent — F-INS-06)

```ts
it('FN-INS-12/F-INS-06 — deux refresh concurrents : 1 success, 1 skipped', async () => {
  const [a, b] = await Promise.all([runInsightsRefresh('manual'), runInsightsRefresh('manual')]);
  const states = [a, b].map((r) => (r.skipped ? 'skipped' : 'ok')).sort();
  expect(states).toEqual(['ok', 'skipped']); // le lock protège
});
```

## 4. Extrait de spec (UI — refetch toutes vues + drawer)

```ts
test('FN-INS-02/06 — changer window refetch et drill-down ouvre le drawer', async ({ page }) => {
  await routeInsights(page, { '7d': INS_SMALL, '30d': INS_BIG });
  await loginAsAdmin(page); await page.goto('/admin/analytics/insights?window=7d');
  const before = await page.getByTestId('insights-overview').innerText();
  await page.getByTestId('insights-window').selectOption('30d');
  await expect.poll(async () => page.getByTestId('insights-overview').innerText()).not.toBe(before);
  await page.getByRole('button', { name: /pages/i }).click();
  await page.getByRole('row').nth(1).click();
  await expect(page.getByTestId('insights-drawer')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('insights-drawer')).toBeHidden();
});
```

## 5. Extrait de spec (UI — AF-05 : une seule barre effective)

```ts
test('AF-05 — sur /insights, la FilterBar layout ne crée pas de doublon trompeur', async ({ page }) => {
  await loginAsAdmin(page); await page.goto('/admin/analytics/insights');
  // décision design : soit la barre layout est masquée, soit elle pilote Insights.
  // Test : changer 'device' dans UNE barre n'entre pas en conflit avec l'autre.
  // (à finaliser selon le correctif retenu — voir 30-plan-action)
});
```
