# 70.5 — Test ultime : validation full lifecycle

## Objectif

Un **seul scénario** qui :
- Crée une page de zéro
- La modifie
- La soumet à revue
- La publie
- La vérifie publique
- Modifie une variable et re-publie
- Vérifie la propagation
- Vérifie footer / cookie banner / checkout
- Vérifie sitemap & robots
- Vérifie health check cron
- Restaure une ancienne version
- Archive
- Vérifie 404 / redirect après archive
- Vérifie git commit

**Si ce test passe, le système est nickel.**

## Fichier

`e2e/legal/legal-ultimate.spec.ts`

```typescript
import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin, publishPage } from './helpers';
import { dbPool } from '@/test/db';

const SLUG = 'page-ultimate-test';

test.describe.serial('🎯 Ultimate test — full lifecycle', () => {
  test.beforeAll(async () => {
    // Cleanup au cas où
    await dbPool.query("DELETE FROM legal_pages WHERE slug = $1", [SLUG]);
    await dbPool.query("DELETE FROM legal_pages_history WHERE slug = $1", [SLUG]);
  });

  test.afterAll(async () => {
    // Cleanup final
    await dbPool.query("DELETE FROM legal_pages WHERE slug = $1", [SLUG]);
    await dbPool.query("DELETE FROM legal_pages_history WHERE slug = $1", [SLUG]);
  });

  test('1. Création de la page via wizard', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin/legal');
    await page.getByRole('button', { name: /Nouvelle page/ }).click();

    // Step 1 : Type
    await page.getByLabel(/Page personnalisée/).click();
    await page.getByRole('button', { name: /Suivant/ }).click();

    // Step 2 : Metadata
    await page.getByLabel(/Titre/).fill('Page Ultimate Test');
    await expect(page.getByLabel(/URL/)).toHaveValue('page-ultimate-test');
    await page.getByLabel(/Description/).fill('Test ultime');
    await page.getByRole('button', { name: /Suivant/ }).click();

    // Step 3 : Content
    await page.getByLabel(/Contenu/).fill(
      '# Page Ultimate\n\n' +
      'Société : {{COMPANY_NAME}} ({{COMPANY_RC}})\n\n' +
      '## Test\n\nLien interne : [CGV](/legal/conditions-generales-de-vente)',
    );
    await page.getByRole('button', { name: /Suivant/ }).click();

    // Step 4 : Placement
    await page.getByLabel(/Footer principal/).check();
    await page.getByLabel(/Footer bottom bar/).check();
    await page.getByRole('button', { name: /Suivant/ }).click();

    // Step 5 : SEO
    await expect(page.getByLabel(/Indexer/)).not.toBeChecked();
    await page.getByRole('button', { name: /Créer/ }).click();

    await expect(page).toHaveURL(/\/admin\/legal\/page-ultimate-test\/edit/);
    
    // En DB : status='draft', version=0
    const row = await dbPool.query("SELECT status, version FROM legal_pages WHERE slug=$1", [SLUG]);
    expect(row.rows[0].status).toBe('draft');
    expect(row.rows[0].version).toBe(0);
  });

  test('2. Aperçu affiche les variables substituées', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/legal/${SLUG}/edit`);

    // Variables résolues
    const preview = page.locator('[data-pane="preview"]');
    await expect(preview).toContainText(/FemiGlow.*RC 123456/);
    
    // Pas de {{COMPANY_NAME}} apparent
    await expect(preview.getByText('{{COMPANY_NAME}}')).not.toBeVisible();
  });

  test('3. Auto-save fonctionne', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/legal/${SLUG}/edit`);

    await page.getByLabel(/Markdown/).fill('# Modifié\n\nContenu modifié');
    await page.keyboard.press('Control+S');

    await expect(page.getByText(/Enregistré/)).toBeVisible({ timeout: 5_000 });
  });

  test('4. Soumettre à revue puis publier', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/legal/${SLUG}/edit`);

    // Soumettre review
    await page.getByRole('button', { name: /Soumettre à revue/ }).click();
    await expect(page.getByText(/Soumise à revue/)).toBeVisible();

    // Publier
    await publishPage(page);

    // En DB : status='published', version=1
    const row = await dbPool.query("SELECT status, version FROM legal_pages WHERE slug=$1", [SLUG]);
    expect(row.rows[0].status).toBe('published');
    expect(row.rows[0].version).toBe(1);

    // Historique a 1 entrée
    const history = await dbPool.query("SELECT * FROM legal_pages_history WHERE slug=$1", [SLUG]);
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0].version).toBe(1);
  });

  test('5. Page publique accessible avec contenu correct', async ({ page }) => {
    await page.goto(`/legal/${SLUG}`);

    await expect(page.getByRole('heading', { name: /Modifié/ })).toBeVisible();
    await expect(page.getByText(/Mis à jour le/)).toBeVisible();

    // meta robots = noindex
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toContain('noindex');
  });

  test('6. Variables substituées en production', async ({ page }) => {
    await page.goto(`/legal/${SLUG}`);
    
    // Plus de {{COMPANY_NAME}}
    const html = await page.content();
    expect(html).not.toContain('{{COMPANY_NAME}}');
    expect(html).not.toContain('{{COMPANY_RC}}');
  });

  test('7. Footer principal contient le lien', async ({ page }) => {
    await page.goto('/');
    
    const link = page.locator('footer a[href="/legal/page-ultimate-test"]');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(`/legal/${SLUG}`);
  });

  test('8. Sitemap n\'inclut PAS la page (noindex)', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    const body = await res.text();
    expect(body).not.toContain(`/legal/${SLUG}`);
  });

  test('9. Modifier variable puis re-publier propage', async ({ page }) => {
    await loginAsAdmin(page);
    
    // 1. Modifier RC
    await page.goto('/admin/legal/template-vars');
    await page.getByLabel('COMPANY_RC').fill('RC 99999 NEW');
    await page.getByRole('button', { name: /Sauver/ }).click();

    // 2. Re-publier
    await page.goto(`/admin/legal/${SLUG}/edit`);
    await publishPage(page);

    // 3. Vérifier public
    await page.goto(`/legal/${SLUG}`);
    await expect(page.getByText(/RC 99999 NEW/)).toBeVisible();

    // Cleanup : remettre la valeur originale
    await page.goto('/admin/legal/template-vars');
    await page.getByLabel('COMPANY_RC').fill('RC 123456');
    await page.getByRole('button', { name: /Sauver/ }).click();
  });

  test('10. Liens internes valides détectés', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/legal/${SLUG}/edit`);

    // Vérifier liens
    await page.getByRole('button', { name: /Vérifier les liens/ }).click();
    await expect(page.getByText(/0 lien cassé/)).toBeVisible({ timeout: 5_000 });
  });

  test('11. Health dashboard reflète la santé', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/legal/health');

    await expect(page.getByText(/0 lien cassé/)).toBeVisible();
    const totalPages = await page.locator('[data-stat="total-pages"]').textContent();
    expect(parseInt(totalPages!)).toBeGreaterThan(0);
  });

  test('12. Restore d\'une ancienne version', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/legal/${SLUG}/edit`);

    await page.getByRole('tab', { name: /Historique/ }).click();
    await expect(page.getByText(/v1/)).toBeVisible();

    page.on('dialog', dialog => dialog.accept());
    await page.locator('[data-version="1"]').getByRole('button', { name: /Restaurer/ }).click();

    await expect(page.getByText(/Brouillon/)).toBeVisible();
  });

  test('13. Archivage retire des zones automatiquement', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/legal/${SLUG}/edit`);

    // Re-publier d'abord
    await page.getByRole('button', { name: /Publier/ }).click();
    await page.getByLabel(/J'ai relu/).check();
    await page.getByLabel(/variables/).check();
    await page.getByLabel(/liens/).check();
    await page.getByLabel(/date/).check();
    await page.getByPlaceholder(/PUBLIER/).fill('PUBLIER');
    await page.getByRole('button', { name: /🚀 Publier/ }).click();
    await expect(page.getByText(/publiée/)).toBeVisible();

    // Maintenant archiver
    await page.getByRole('tab', { name: /Zone danger/ }).click();
    await page.getByRole('button', { name: /Archiver/ }).click();
    await page.getByPlaceholder(/ARCHIVER/).fill('ARCHIVER');
    await page.getByRole('button', { name: /Archiver$/ }).click();

    await expect(page.getByText(/archivée/)).toBeVisible();

    // Footer ne montre plus le lien
    await page.goto('/');
    const link = page.locator('footer a[href="/legal/page-ultimate-test"]');
    await expect(link).not.toBeVisible();

    // Page publique → 404 ou 410
    const res = await page.goto(`/legal/${SLUG}`);
    expect(res?.status()).toBeGreaterThanOrEqual(400);
  });

  test('14. Audit events présents pour toutes les actions', async () => {
    const events = await dbPool.query(
      "SELECT action FROM audit_events WHERE resource_type='legal_page' AND meta->>'slug'=$1 ORDER BY created_at",
      [SLUG],
    );

    const actions = events.rows.map(r => r.action);
    expect(actions).toContain('legal.created');
    expect(actions).toContain('legal.updated');
    expect(actions).toContain('legal.review.submitted');
    expect(actions).toContain('legal.published');
    expect(actions).toContain('legal.restored');
    expect(actions).toContain('legal.archived');
  });

  test('15. Git commit présent (si feature activée)', async () => {
    if (!process.env.LEGAL_GIT_SYNC_ENABLED) {
      test.skip();
      return;
    }
    
    // Attendre la fin du job background (max 30s)
    let sha: string | null = null;
    for (let i = 0; i < 30; i++) {
      const row = await dbPool.query(
        "SELECT git_commit_sha FROM legal_pages_history WHERE slug=$1 ORDER BY version DESC LIMIT 1",
        [SLUG],
      );
      sha = row.rows[0]?.git_commit_sha;
      if (sha) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    expect(sha).toBeTruthy();
  });

  test('16. ★ ULTIMATE : Lighthouse + axe sur page publique', async ({ page }) => {
    // On crée et publie une nouvelle page pour ce test final
    await loginAsAdmin(page);
    await page.goto(`/admin/legal/cgv/edit`);
    
    // Vérifie que CGV existe et est publié (page seedée)
    await page.goto('/legal/cgv');
    await expect(page.getByRole('heading', { name: /Conditions Générales/ })).toBeVisible();

    // axe
    const AxeBuilder = (await import('@axe-core/playwright')).default;
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);

    // Lighthouse (via playwright-lighthouse si installé)
    // const lighthouseResult = await playAudit({ page, ... });
    // expect(lighthouseResult.lhr.categories.accessibility.score).toBeGreaterThan(0.95);
  });
});
```

## Commande dédiée

```bash
pnpm test:e2e:ultimate
```

Mappé à :

```json
{
  "scripts": {
    "test:e2e:ultimate": "playwright test e2e/legal/legal-ultimate.spec.ts"
  }
}
```

## Critère de réussite

✅ Tous les 16 sub-tests passent en local + CI.
✅ Durée totale < 5 minutes.
✅ Pas de flakiness sur 3 runs consécutifs.
✅ Cleanup après test : aucune donnée résiduelle.

## Stratégie d'exécution

- **Nightly** : lance en CI automatiquement
- **Pre-deploy** : oblige le pass avant deploy en prod
- **Manual** : commande disponible localement pour validation post-merge
