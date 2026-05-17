import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Content Studio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/content-studio');
    await page.waitForURL('/admin/content-studio');
  });

  test('affiche le titre et le guide', async ({ page }) => {
    await expect(page.getByText('Studio contenu')).toBeVisible();
    await expect(page.getByText('AI Content Studio')).toBeVisible();
  });

  test('affiche les 4 onglets par défaut', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Pipeline' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Calendrier' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Budget' })).toBeVisible();
  });

  test('Pipeline est actif par défaut', async ({ page }) => {
    const pipelineTab = page.getByRole('button', { name: 'Pipeline' });
    await expect(pipelineTab).toHaveClass(/bg-stone-900/);
  });

  test('change vers l\'onglet Calendrier', async ({ page }) => {
    await page.getByRole('button', { name: 'Calendrier' }).click();
    await expect(page.getByText('Pipeline éditorial')).toBeVisible();
  });

  test('change vers l\'onglet Analytics', async ({ page }) => {
    await page.getByRole('button', { name: 'Analytics' }).click();
    await expect(page.getByText('Tableau de bord')).toBeVisible();
  });

  test('change vers l\'onglet Budget', async ({ page }) => {
    await page.getByRole('button', { name: 'Budget' }).click();
    await expect(page.getByText('Coûts de génération')).toBeVisible();
  });

  test('affiche le formulaire de création d\'idée', async ({ page }) => {
    await expect(page.getByText('Créer une idée')).toBeVisible();
    await expect(page.getByRole('button', { name: /Enregistrer l'idée/i })).toBeVisible();
  });

  test('affiche l\'éditeur de brouillon', async ({ page }) => {
    await expect(page.getByText('Brouillons')).toBeVisible();
  });

  test('les filtres du calendrier sont visibles après changement d\'onglet', async ({ page }) => {
    await page.getByRole('button', { name: 'Calendrier' }).click();
    await expect(page.getByText('Semaine')).toBeVisible();
    await expect(page.getByText('Mois')).toBeVisible();
  });

  test('le bouton Auj. est présent dans le calendrier', async ({ page }) => {
    await page.getByRole('button', { name: 'Calendrier' }).click();
    await expect(page.getByRole('button', { name: 'Auj.' })).toBeVisible();
  });
});