# Tests parcours utilisateurs (J1 → J5)

Référence : `07-ui-ux/user-journeys.md`.

## J1 — Première configuration (Amal, persona principal)

```typescript
import { test, expect } from '@playwright/test'
import { WizardPage } from './pages/WizardPage'

test.describe('J1 — Première configuration @critical', () => {
  test('Amal crée le premier plan de tracking en moins de 8 minutes', async ({ page }) => {
    const wizard = new WizardPage(page)
    await wizard.goto()

    // Step 1 — Choisir providers
    await wizard.expectStep(1)
    await page.getByRole('checkbox', { name: 'GA4' }).check()
    await page.getByRole('checkbox', { name: 'Google Ads' }).check()
    await page.getByRole('checkbox', { name: 'Meta Pixel' }).check()
    await wizard.clickContinuer()

    // Step 2 — IDs (autofill détecté)
    await wizard.expectStep(2)
    await expect(page.getByText('auto-rempli')).toHaveCount(3)
    await wizard.fillGa4MeasurementId('G-5VHP17SDZM')
    await page.getByLabel('Google Ads Conversion ID').fill('AW-987654321')
    await page.getByLabel('Meta Pixel ID').fill('1234567890123456')
    await wizard.clickContinuer()

    // Step 3 — Events
    await wizard.expectStep(3)
    await page.getByRole('row', { name: /page_view/ }).getByRole('checkbox', { name: 'GA4' }).check()
    await page.getByRole('row', { name: /purchase/ }).getByRole('checkbox', { name: /Ads/ }).check()
    await wizard.clickContinuer()

    // Step 4 — Environnements
    await wizard.expectStep(4)
    await expect(page.getByText('production')).toBeVisible()
    await wizard.clickContinuer()

    // Step 5 — Récap + activation
    await wizard.expectStep(5)
    await expect(page.getByText(/Aucun blocage/)).toBeVisible()
    await page.getByRole('button', { name: /Activer en production/ }).click()
    await page.getByRole('button', { name: /Confirmer activation/ }).click()

    // Validation finale
    await expect(page.getByText(/Plan actif/)).toBeVisible({ timeout: 5_000 })
    await expect(page).toHaveURL(/\/admin\/tracking$/)
  })

  test('autosave conserve la progression après refresh', async ({ page }) => {
    const wizard = new WizardPage(page)
    await wizard.goto()

    await page.getByRole('checkbox', { name: 'GA4' }).check()
    await wizard.clickContinuer()
    await wizard.fillGa4MeasurementId('G-DRAFT01234')

    await wizard.expectAutosaveBadge()

    // Reload
    await page.reload()

    // La valeur est toujours là
    await expect(page.getByLabel('GA4 Measurement ID')).toHaveValue('G-DRAFT01234')
    await expect(page.getByText(/Brouillon restauré/)).toBeVisible()
  })
})
```

## J2 — Migration d'un système existant (Younes)

```typescript
test.describe('J2 — Migration legacy @critical', () => {
  test('Younes importe un GTM JSON existant via mode expert', async ({ page }) => {
    await page.goto('/admin/tracking/new?mode=expert')
    
    // Importer JSON via paste
    await page.getByRole('button', { name: /Importer JSON/ }).click()
    const fileInput = page.locator('input[type=file]')
    await fileInput.setInputFiles('e2e/fixtures/legacy-gtm-export.json')

    // Vérifier le parsing
    await expect(page.getByText(/15 tags détectés/)).toBeVisible()
    await expect(page.getByText(/3 providers identifiés/)).toBeVisible()

    // Vérifier le JSON preview à droite
    const preview = page.locator('[data-testid="json-preview"]')
    await expect(preview).toContainText('G-5VHP17SDZM')

    // Activer
    await page.getByRole('button', { name: /Valider et activer/ }).click()
    await page.getByRole('button', { name: /Confirmer/ }).click()

    await expect(page.getByText(/Plan migré et activé/)).toBeVisible()
  })
})
```

## J3 — Modification rapide (Amal, ajustement)

```typescript
test.describe('J3 — Modification rapide', () => {
  test('Amal ajoute un nouveau provider sans casser la prod', async ({ page }) => {
    // Plan actif existant (seed)
    await page.goto('/admin/tracking')
    await page.getByRole('row', { name: /Plan actif Production v8/ })
      .getByRole('button', { name: /Modifier/ }).click()

    // Cloner en draft
    await page.getByRole('button', { name: /Modifier ce plan/ }).click()
    await expect(page.getByText(/Vous éditez une copie/)).toBeVisible()

    // Ajouter TikTok
    await page.getByRole('button', { name: /Étape 1/ }).click()
    await page.getByRole('checkbox', { name: 'TikTok Pixel' }).check()
    await page.getByRole('button', { name: /Étape 2/ }).click()
    await page.getByLabel('TikTok Pixel ID').fill('TT-PIXEL-001')

    // Récap → activer
    await page.getByRole('button', { name: /Étape 5/ }).click()
    await page.getByRole('button', { name: /Activer/ }).click()
    await page.getByRole('button', { name: /Confirmer activation/ }).click()

    // L'ancien plan est archivé
    await page.goto('/admin/tracking/history')
    await expect(page.getByText(/Production v8.*Archivé/)).toBeVisible()
    await expect(page.getByText(/Production v9.*Actif/)).toBeVisible()
  })
})
```

## J4 — Investigation d'un dysfonctionnement (Younes, debug)

```typescript
test.describe('J4 — Investigation drift', () => {
  test('Younes diagnostique un drift entre client et serveur', async ({ page, request }) => {
    // Simuler un drift via API : injecter un bundleId obsolète côté client
    await request.post('/api/test/inject-drift', {
      data: {
        clientBundleId: 'old-bundle-hash-123',
        serverBundleId: 'new-bundle-hash-456',
      },
    })

    await page.goto('/admin/tracking/health')

    // Bannière critique
    await expect(page.getByRole('alert')).toContainText(/Drift critique détecté/)
    
    // Détails
    await page.getByRole('button', { name: /Voir détails/ }).click()
    await expect(page.getByText(/Bundle client.*old-bundle/)).toBeVisible()
    await expect(page.getByText(/Bundle serveur.*new-bundle/)).toBeVisible()
    
    // Lien vers le runbook
    const runbookLink = page.getByRole('link', { name: /Runbook drift/ })
    await expect(runbookLink).toHaveAttribute('href', /\/runbook\/drift/)
  })
})
```

## J5 — Validation par CMO avant activation (Aïcha)

```typescript
test.describe('J5 — Review CMO @critical', () => {
  test('Aïcha review et valide un plan en draft', async ({ page }) => {
    // Aïcha utilise un autre storage state
    await page.context().clearCookies()
    await page.context().addCookies(/* aicha cookies */)

    await page.goto('/admin/tracking/plan/draft-001/review')

    // Vue récap lecture seule
    await expect(page.getByRole('heading', { name: /Récap du plan/ })).toBeVisible()
    await expect(page.locator('input[disabled]').first()).toBeVisible()

    // Voir le diff vs prod
    await page.getByRole('button', { name: /Comparer avec la prod/ }).click()
    await expect(page.getByText(/3 changements/)).toBeVisible()
    await expect(page.getByText(/\+ TikTok Pixel/)).toBeVisible()

    // Approuver (note interne)
    await page.getByLabel('Commentaire').fill('OK pour activation, vérifier event purchase')
    await page.getByRole('button', { name: /Approuver/ }).click()

    await expect(page.getByText(/Plan approuvé par Aïcha/)).toBeVisible()
  })

  test('Aïcha rejette un plan avec placeholders', async ({ page }) => {
    await page.goto('/admin/tracking/plan/draft-bad/review')

    await expect(page.getByRole('alert')).toContainText(/Placeholder détecté/)
    await page.getByRole('button', { name: /Renvoyer en édition/ }).click()
    await page.getByLabel('Motif').fill('Remplacer G-PROD0000 par le vrai ID')
    await page.getByRole('button', { name: /Confirmer le renvoi/ }).click()

    // Amal reçoit notification
    await expect(page.getByText(/Renvoyé à l'éditeur/)).toBeVisible()
  })
})
```

## Mesures de performance des parcours

```typescript
test('J1 reste sous 8 minutes (cible métier)', async ({ page }) => {
  const start = Date.now()
  // ... toutes les étapes
  const elapsed = (Date.now() - start) / 1000
  console.log(`J1 elapsed: ${elapsed}s`)
  expect(elapsed).toBeLessThan(8 * 60)
})
```

⚠ Ces mesures sont indicatives (CI plus lent). Cible à valider sur staging avec un vrai opérateur.
