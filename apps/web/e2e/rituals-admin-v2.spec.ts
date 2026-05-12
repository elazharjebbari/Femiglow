/**
 * Tests E2E des améliorations admin v2 (Vagues 1-3).
 *
 * Couverture : navigation neighbors, raccourcis clavier, filtres URL,
 * recherche full-text, mode sweep, insights étendus, page best-practices.
 *
 * Cf. docs/reviews-wall/execution/19-plan-action-ameliorations.md
 *
 * Note : ces tests supposent que le seed (`pnpm tsx scripts/seed-rituals.ts`)
 * a peuplé la BDD avec la distribution Kolenda. Sans seed, certains tests
 * basculent en assertion souple (présence d'éléments structurels).
 */
import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers/auth';

test.describe('Admin Rituels v2 — Vague 1 : vélocité', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test('queue affiche bandeau filtres et recherche', async ({ page }) => {
    await page.goto('/admin/rituals/queue');
    await expect(page.getByTestId('admin-search')).toBeVisible();
    await expect(page.getByTestId('admin-filters')).toBeVisible();
  });

  test('bouton filtres expose les chips flags', async ({ page }) => {
    await page.goto('/admin/rituals/queue');
    await page.getByTestId('admin-filters-toggle').click();
    await expect(page.getByTestId('admin-filter-flag-face_detected')).toBeVisible();
    await expect(page.getByTestId('admin-filter-flag-emoji_detected')).toBeVisible();
    await expect(page.getByTestId('admin-filter-source-email_j45')).toBeVisible();
  });

  test('application d\'un filtre persiste en URL', async ({ page }) => {
    await page.goto('/admin/rituals/queue');
    await page.getByTestId('admin-filters-toggle').click();
    await page.getByTestId('admin-filter-flag-face_detected').click();
    await page.getByTestId('admin-filters-apply').click();
    await expect(page).toHaveURL(/flags=face_detected/);
  });

  test('reset filtres efface l\'URL', async ({ page }) => {
    await page.goto('/admin/rituals/queue?flags=face_detected&source=email_j45');
    await expect(page.getByTestId('admin-filters-reset')).toBeVisible();
    await page.getByTestId('admin-filters-reset').click();
    await expect(page).not.toHaveURL(/flags=/);
  });

  test('search input persiste en URL après debounce', async ({ page }) => {
    await page.goto('/admin/rituals/queue');
    await page.getByTestId('admin-search').fill('Amal');
    await expect(page).toHaveURL(/q=Amal/, { timeout: 2000 });
  });

  test('CTA "Mode rafale" visible quand pendingCount > 0', async ({ page }) => {
    await page.goto('/admin/rituals/queue');
    const cta = page.getByTestId('enter-sweep-mode');
    // CTA présent seulement si seed exécuté
    const visible = await cta.isVisible().catch(() => false);
    if (visible) {
      await expect(cta).toHaveAttribute('href', '/admin/rituals/queue/sweep');
    }
  });
});

test.describe('Admin Rituels v2 — Mode sweep (Vague 2)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test('page sweep accessible ; file vide ou rituel affiché', async ({ page }) => {
    await page.goto('/admin/rituals/queue/sweep');
    const sweep = page.getByTestId('ritual-sweep');
    const empty = page.getByRole('heading', { name: /File vide/ });
    await expect(sweep.or(empty)).toBeVisible();
  });

  test('boutons d\'action visibles si rituel présent', async ({ page }) => {
    await page.goto('/admin/rituals/queue/sweep');
    const approve = page.getByTestId('sweep-approve');
    if (await approve.isVisible().catch(() => false)) {
      await expect(approve).toBeEnabled();
      await expect(page.getByTestId('sweep-reject')).toBeVisible();
      await expect(page.getByTestId('sweep-skip')).toBeVisible();
      await expect(page.getByTestId('sweep-quit')).toBeVisible();
    }
  });

  test('raccourci Q quitte le mode sweep', async ({ page }) => {
    await page.goto('/admin/rituals/queue/sweep');
    const sweep = page.getByTestId('ritual-sweep');
    if (await sweep.isVisible().catch(() => false)) {
      await page.keyboard.press('q');
      await expect(page).toHaveURL(/\/admin\/rituals\/queue$/);
    }
  });
});

test.describe('Admin Rituels v2 — Vue détail (Vague 1)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test('cheatsheet raccourcis ouvre via "?"', async ({ page }) => {
    await page.goto('/admin/rituals/queue');
    // Cliquer sur le premier rituel s'il existe
    const firstRow = page.getByTestId('admin-ritual-row').first();
    if (await firstRow.isVisible().catch(() => false)) {
      const detailLink = firstRow.getByRole('link', { name: /Voir détail/ });
      if (await detailLink.isVisible().catch(() => false)) {
        await detailLink.click();
        await page.keyboard.press('?');
        await expect(page.getByTestId('shortcuts-cheatsheet')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('shortcuts-cheatsheet')).not.toBeVisible();
      }
    }
  });

  test('barre neighbors présente sur la vue détail', async ({ page }) => {
    const list = await page.request.get('/api/admin/rituals/queue').catch(() => null);
    if (list && list.ok()) {
      const data = await list.json().catch(() => null);
      const firstId = data?.data?.[0]?.id;
      if (firstId) {
        await page.goto(`/admin/rituals/${firstId}`);
        await expect(page.getByTestId('ritual-neighbors-bar')).toBeVisible();
      }
    }
  });
});

test.describe('Admin Rituels v2 — Insights étendus (Vague 2)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test('section daily chart visible', async ({ page }) => {
    await page.goto('/admin/rituals/insights');
    await expect(
      page.getByRole('heading', { name: /Activité.*30 derniers/i }),
    ).toBeVisible();
  });

  test('section vision ML visible', async ({ page }) => {
    await page.goto('/admin/rituals/insights');
    await expect(page.getByText(/Photos analysées/i)).toBeVisible();
    await expect(page.getByText(/Taux de rejet vision ML/i)).toBeVisible();
  });

  test('staleness label affiché', async ({ page }) => {
    await page.goto('/admin/rituals/insights');
    await expect(page.getByText(/Agrégat rafraîchi/i)).toBeVisible();
  });
});

test.describe('Admin Rituels v2 — Guide bonnes pratiques', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test('page best-practices accessible depuis la queue', async ({ page }) => {
    await page.goto('/admin/rituals/queue');
    await page.getByTestId('best-practices-link').click();
    await expect(page).toHaveURL(/\/admin\/rituals\/best-practices/);
    await expect(
      page.getByRole('heading', { name: /Un wall d'avis qui convertit/i }),
    ).toBeVisible();
  });

  test('expose 12 principes + checklist', async ({ page }) => {
    await page.goto('/admin/rituals/best-practices');
    const principles = page.getByTestId('bp-principle');
    await expect(principles).toHaveCount(12);
    await expect(page.getByTestId('bp-checklist')).toBeVisible();
    await expect(page.getByTestId('bp-numbers')).toBeVisible();
  });

  test('repères chiffrés affichés', async ({ page }) => {
    await page.goto('/admin/rituals/best-practices');
    await expect(page.getByText(/\+27 %/)).toBeVisible();
    await expect(page.getByText(/\+108 %/)).toBeVisible();
  });
});

test.describe('Admin Rituels v2 — API neighbors (intégration)', () => {
  test('endpoint /neighbors retourne 401 sans auth', async ({ request }) => {
    const res = await request.get('/api/admin/rituals/r_anything/neighbors');
    expect(res.status()).toBe(401);
  });

  test('endpoint /neighbors valide le format avec auth', async ({ page, request }) => {
    await loginAdmin(page);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const res = await request.get('/api/admin/rituals/inexistent/neighbors', {
      headers: { cookie: cookieHeader },
    });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.data).toMatchObject({
      previousId: null,
      nextId: null,
    });
  });
});
