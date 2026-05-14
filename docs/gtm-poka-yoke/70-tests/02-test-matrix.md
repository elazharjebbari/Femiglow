# Matrice de tests détaillée

## Tests unit Vitest

### `bundle-id.test.ts`

| # | Test | Inputs | Output attendu |
|---|---|---|---|
| 1 | `computeBundleId` produit 12 chars hex | input minimal | `/^[a-f0-9]{12}$/` |
| 2 | Déterminisme | même input × 2 | hash identique |
| 3 | Stable malgré ordre events | events [A,B] vs [B,A] | hash identique |
| 4 | Sensible à `resolvedNames` change | meta=Purchase → meta=PremiumPurchase | hash différent |
| 5 | Sensible à `mappingVersion` | v17 vs v18 | hash différent |
| 6 | Sensible à `configVersion` | v4 vs v5 | hash différent |
| 7 | Sensible à `containerId` | GTM-A vs GTM-B | hash différent |
| 8 | Sensible à `generatedAt` | T0 vs T0+1s | hash différent |
| 9 | `isValidBundleId` accepte hash valide | `'a7c4f2e9b81d'` | `true` |
| 10 | `isValidBundleId` rejette autres | `''`, `'abc'`, `'A7C4F2E9B81D'`, `123` | `false` |

### `pair-validator.test.ts`

| # | Test | Inputs | Output attendu |
|---|---|---|---|
| 1 | Happy path 2 fichiers cohérents | valid config + mapping | `ok: true`, errors: [], 0 warning |
| 2 | R-001 bundleId mismatch | 2 fichiers avec bundleId différents | `errors[0].code === 'bundle_mismatch'` |
| 3 | R-002 schema version inconnue | `schemaVersion: 'fg-mapping/99.0'` | `errors[0].code === 'invalid_schema_version'` |
| 4 | R-003 container ID mismatch | GTM-PROD vs GTM-STAGING | `errors[0].code === 'container_id_mismatch'` |
| 5 | R-004 event mappé absent côté config | mapping a 'foo', config n'a pas de trigger 'foo' | `errors[0].code === 'event_not_covered'` |
| 6 | R-005 variable absente | mapping ref `{{FG Locale}}`, config n'a pas | `errors[0].code === 'missing_variable'` |
| 7 | R-006 requiredConfigVersion not met | `requiredConfigVersion: 'v5'`, config v4 | `errors[0].code === 'config_too_old'` |
| 8 | R-007 vendor cohérence | warning seulement | `warnings[0].code === 'vendor_inconsistency'` |
| 9 | R-008 event orphelin config | config a 'bar', mapping n'a pas | `warnings[0].code === 'event_orphan'` |
| 10 | R-009 JSON invalide | `mappingJson: 'not json'` | `errors[0].code === 'invalid_json'`, autres règles court-circuitées |
| 11 | Recommandations dans le bon ordre | mix de errors et warnings | `recommendations[0].action.includes('Corriger')` |
| 12 | Sortie stable (snapshot) | input fixe | matches snapshot |
| 13 | Performance | input 500KB | exécution < 200ms |

### `drift-detector.test.ts` — `classifyDrift`

| # | Test | Inputs | Output attendu |
|---|---|---|---|
| 1 | Aucun ping, édit récent | lastPing=null, lastEditAt=2h | `status: 'ok'` |
| 2 | Aucun ping, édit ancien <24h | lastEditAt=8h | `status: 'warning'` `silence_excess` |
| 3 | Aucun ping, édit ancien >24h | lastEditAt=48h | `status: 'critical'` `silence_excess` |
| 4 | Ping cohérent | toutes versions matchent | `status: 'ok'` |
| 5 | mapping_version mismatch | admin v17, ping v16 | `status: 'critical'` `mapping_version_drift` |
| 6 | config_version mismatch | admin v4, ping v3 | `status: 'critical'` `config_version_drift` |
| 7 | container_id mismatch | GTM-A admin, GTM-B ping | `status: 'critical'` `container_id_mismatch` |
| 8 | bundleId mismatch isolé | versions OK, bundleId diffère | `status: 'warning'` `bundle_mismatch` |
| 9 | manifest_mismatch flag | ping.manifestMismatch=true | `status: 'critical'` `manifest_flag_mismatch` |
| 10 | Multiples raisons | mapping + config drift | `status: 'critical'`, reasons.length === 2 |

### `drift-detector.test.ts` — `recomputeDriftFromPing`

| # | Test | Setup | Output |
|---|---|---|---|
| 1 | Ping ok → state ok, pas de history | state was ok | state.status === 'ok', no new history |
| 2 | Ping drift → transition history INSERT | state was ok | history has 1 new row (ok → critical) |
| 3 | Ping ok après critical, hystérésis | state critical < 5min | state reste critical |
| 4 | Ping ok après critical, hystérésis past | state critical > 5min | state passe ok, history INSERT |
| 5 | Email envoyé sur critical | transition ok → critical | mock `sendAdminEmail` appelé |
| 6 | Pas d'email sur warning | transition ok → warning | mock pas appelé (digest) |
| 7 | Idempotent | recompute même ping × 2 | même état, pas de doublon history |

### `sentinel-schemas.test.ts`

Snapshot Zod parse pour chaque cas (valide, invalide bundleId, manquant champ, champ extra, etc.).

## Tests MSW

### `sentinel-route.msw.test.ts`

```ts
describe('POST /api/track/sentinel', () => {
  it('accepte un payload valide → 204', async () => {
    const res = await fetch('/api/track/sentinel', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://femiglow.ma' },
      body: JSON.stringify(validPing),
    });
    expect(res.status).toBe(204);
  });

  it('rejette payload invalide → 400', async () => { ... });
  it('rejette origine non-allowlist → 403', async () => { ... });
  it('rate-limit après 60 req/min', async () => { ... });
  it('INSERT en DB sur succès', async () => { ... });
  it('déclenche recomputeDrift', async () => { ... });
});
```

### `validate-pair-route.msw.test.ts`

```ts
describe('POST /api/admin/tracking/gtm/validate-pair', () => {
  it('admin connecté + valid input → 200 result', async () => { ... });
  it('non-admin → 401', async () => { ... });
  it('input malformed → 400', async () => { ... });
  it('error count matches pair-validator output', async () => { ... });
});
```

### `sync-status-route.msw.test.ts`

```ts
describe('GET /api/admin/tracking/gtm/sync-status', () => {
  it('renvoie l\'état complet', async () => { ... });
  it('non-admin → 401', async () => { ... });
  it('cache miss / hit cohérence (60s)', async () => { ... });
});
```

## Tests Playwright

### `sync-status.spec.ts`
```ts
test('admin voit l\'état OK quand cohérent', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/tracking/gtm/sync-status');
  await expect(page.getByTestId('global-status-badge')).toContainText('Tout est cohérent');
});

test('banner global apparaît sur drift critical', async ({ page, request }) => {
  await seedDrift(request, 'critical');
  await loginAsAdmin(page);
  await page.goto('/admin');
  await expect(page.getByTestId('drift-banner')).toBeVisible();
  await page.getByTestId('drift-banner-link').click();
  await expect(page).toHaveURL(/sync-status/);
});

test('auto-refresh 30s détecte un changement de statut', async ({ page, request }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/tracking/gtm/sync-status');
  await expect(page.getByTestId('global-status-badge')).toContainText('cohérent');
  await seedDrift(request, 'critical');
  await page.waitForTimeout(31_000);  // attend 1 cycle
  await expect(page.getByTestId('global-status-badge')).toContainText('CRITIQUE');
});
```

### `validate-pair.spec.ts`
```ts
test('wizard 3 étapes happy path', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/tracking/gtm/validate-pair');
  await page.getByTestId('config-dropzone').setInputFiles('fixtures/valid-config-v4.json');
  await page.getByTestId('btn-next-step').click();
  await page.getByTestId('mapping-dropzone').setInputFiles('fixtures/valid-mapping-v17.json');
  await page.getByTestId('btn-validate').click();
  await expect(page.getByTestId('verdict')).toContainText('OK');
});

test('mismatch bundleId bloque', async ({ page }) => {
  // ...
});
```

## Fixtures à créer

```
apps/web/src/test/fixtures/gtm-poka-yoke/
  ├ valid-config-v4.json
  ├ valid-mapping-v17.json
  ├ mismatch-bundle-config.json
  ├ mismatch-bundle-mapping.json
  ├ missing-variable-config.json
  ├ invalid-json.txt
  ├ sentinel-ping-valid.json
  ├ sentinel-ping-drift.json
  └ README.md
```
