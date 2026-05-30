# Tests — Onglet Funnel

> Fonctionnement optimal attendu + éléments à vérifier sur **tous les points de vue** (data,
> backend, frontend, UI/UX, a11y, perf). Cas concrets dans [`cas-de-tests.csv`](cas-de-tests.csv).

## 1. Fonctionnement optimal (la cible)

L'onglet visualise le parcours en 5 étapes session-level (`View → Engage → CTA → Checkout →
Purchase`). Pour chaque étape : sessions, progression depuis la précédente, drop-off vers la
suivante, médiane du temps jusqu'à la suivante. Plus une **table par page d'entrée** et un
**Sankey** first_page → étape max.

**Invariants de justesse** (à verrouiller) :
- `step_n ≤ step_(n-1)` (cumul strict) ⇒ `dropoffToNext ∈ [0,1]` ou `null`.
- `progressionFromPrevious = step_n / step_(n-1)` (null sur la 1ère étape).
- médiane = vraie médiane (gère pair/impair) ; `null` si aucun échantillon.
- Sankey : une session apparaît **une seule fois**, à son étape **max** ; `Σ volumes = sessions
  ayant view` ; top 20 + « Autres » ; `truncated` correct.
- Consent gate : sessions non-`granted` exclues. Période/device/traffic respectés.

**Comportement UI optimal** :
- Au changement de **période/device/source**, les 3 blocs (Global, DropOff, Sankey, Table)
  **se rafraîchissent** (état `loading` visible, puis nouvelles valeurs). ← **AF-01 à corriger.**
- 0 session → `EmptyState` ; API en erreur → `ErrorState` + retry ; au mount, **un seul** chargement
  (pas de double fetch — F-PERF-03).

## 2. À vérifier par point de vue

| PoV | Vérifications |
|---|---|
| **Data (Vitest)** | cumul strict ; dropoff/progression ; médiane pair/impair ; Sankey étape max + truncated ; firstPage = 1er page_view (F-FUN-03) ; consent gate ; fuseau (AF-04) ; sous-comptage purchase documenté (F-FUN-02) |
| **Backend (MSW/API)** | `GET /funnel` (overview) et `?view=table` (DataTable) et `/funnel/sankey` ; **401** sans session ; shape conforme |
| **Frontend (RTL+MSW)** | refetch sur changement de filtre (**AF-01**) ; loading/empty/error ; Sankey tronqué signalé ; table triée par views |
| **UI/UX (Playwright)** | l'opérateur change un filtre → chiffres changent ; drop-off lisible ; nombres FR (`12 340`, `12,4 %`, `2m 5s`) ; responsive |
| **a11y** | table `<th scope>` ; Sankey/chart avec équivalent textuel ; drop-off pas en couleur seule ; clavier |
| **Perf** | 1 seul fetch au mount ; pas de recalcul inutile ; (bench fenêtre longue → F-PERF-01) |

## 3. Extrait de spec (data — médiane & cumul)

```ts
it('FN-FUN-07 — cumul strict et drop-off dans [0,1]', async () => {
  // 3 sessions : 1 complète, 1 jusqu'a cta, 1 jusqu'a view
  seedEvents([...sessionFull('s1'), ...sessionUpTo('s2','cta'), ...sessionUpTo('s3','view')]);
  const d = await getFunnelOverview(filters({ period: '7d' }), ANCHOR);
  const by = Object.fromEntries(d.steps.map((s) => [s.stage, s]));
  expect(by.view.sessions).toBe(3);
  expect(by.cta.sessions).toBe(2);
  expect(by.purchase.sessions).toBe(1);
  for (const s of d.steps) if (s.dropoffToNext != null)
    expect(s.dropoffToNext).toBeGreaterThanOrEqual(0), expect(s.dropoffToNext).toBeLessThanOrEqual(1);
});
```

## 4. Extrait de spec (UI — AF-01)

```ts
test('FN-FUN-02/AF-01 — changer device rafraîchit le funnel', async ({ page }) => {
  await routeAnalytics(page, { funnel: { mobile: FUN_SMALL, desktop: FUN_BIG } });
  await loginAsAdmin(page); await page.goto('/admin/analytics/funnel?device=mobile');
  const v = () => page.getByTestId('funnel-dashboard').innerText();
  const before = await v();
  await page.getByTestId('filter-device').selectOption('desktop');
  await expect.poll(v).not.toBe(before);
});
```
