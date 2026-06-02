# F04 — Plan de tests concret

> Étend `beacon-flush.test.ts` (RTL/jsdom) + `sync/__tests__/route.test.ts` (INT) +
> `e2e/owbs-optimistic.spec.ts` (déjà TST-E-03) → nouveau `e2e/owbs-ui-zeroloss.spec.ts`.

## A. RTL/jsdom (beacon-flush)
- **F04-S04/S05/S22** : déjà couverts (file vide no-op ; fallback ; teardown) — **vérifier verts**.
- Compléter : assert le **corps** du beacon (`blob.text()` contient `lead_create`, `cl_…`, `"sentVia":"beacon"`).

## B. Intégration route /sync (mock env + applyBatch)
- **F04-S10..S14** : déjà couverts (204 flag OFF, 200 batch, désordre, 413, 400) — **vérifier verts**.

## C. Playwright (`e2e/owbs-ui-zeroloss.spec.ts`, build flag-ON)
- **F04-S01** (déjà TST-E-03) : `/lead` aborté → `visibilitychange:hidden` → `waitForRequest('**/api/checkout/lead/sync')` → corps contient `lead_create` + `cl_`.
- **F04-S02** : variante `pagehide` (dispatch event) → beacon part.
- **F04-S03 (webkit)** : même scénario sur `--project=webkit` (R-07) — **gate** zéro-perte multi-navigateur (élargir `testMatch` cross).
- **F04-S20 reprise reload** :
```ts
test('F04-S20 reload -> reflush sans doublon', async ({page}) => {
  await page.route('**/api/checkout/lead', r => r.abort());       // 1er essai échoue -> reste en file (miroir)
  await openWizard(page); await fillLead(page); await submitLead(page);
  let syncCount = 0; page.on('request', r => { if (r.url().includes('/lead/sync')) syncCount++; });
  await page.unroute('**/api/checkout/lead');                      // réseau OK après reload
  await page.reload();                                            // hydrateFromMirror + reflush
  await expect.poll(async () => await leadsCountForVisitor(page)).toBe(1); // un seul lead
});
```
- **F04-S21** : double déclenchement (reload + pagehide) → toujours 1 lead (idempotent).

## D. Étapes
1. Vérifier beacon-flush + /sync existants verts ; ajouter assertion corps beacon.
2. PW pagehide + reload-recovery (S02/S20/S21).
3. **Gate webkit** S03 (R-07) — élargir cross testMatch.
