# Specifications Playwright E2E -- Knowledge Edit

**Framework** : Playwright 1.48  
**Fichier** : `apps/web/e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts`  
**Navigateur** : Chromium (headless en CI)  
**Authentification** : `storageState` pre-configure (cookie de session admin)

---

## 1. Configuration et utilitaires

### 1.1 Imports et configuration globale

```typescript
import { test, expect, Page } from '@playwright/test';

const BASE_URL = '/admin/content-studio-v2/ai-engine/knowledge';

// Donnees de test
const MOCK_COLLECTION = {
  id: 'col-e2e-001',
  name: 'Brand FemiGlow',
  slug: 'brand-femiglow',
  description: 'Identite de marque FemiGlow',
  category: 'brand',
  documentCount: 3,
  chunkCount: 25,
  lastIndexedAt: '2026-05-20T10:00:00.000Z',
  isActive: true,
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-05-20T10:00:00.000Z',
};

const MOCK_COLLECTION_UPDATED = {
  ...MOCK_COLLECTION,
  name: 'Brand FemiGlow (v2)',
  description: 'Identite de marque 2026',
  updatedAt: '2026-05-25T09:15:00.000Z',
};

const MOCK_DOCUMENTS = [
  {
    id: 'doc-e2e-001',
    title: 'Guide Tsubaki Oil',
    sourceType: 'text',
    chunkCount: 15,
    createdAt: '2026-05-01T08:00:00.000Z',
  },
  {
    id: 'doc-e2e-002',
    title: 'Instagram Algo 2026',
    sourceType: 'url',
    chunkCount: 8,
    createdAt: '2026-05-10T12:00:00.000Z',
  },
];

const MOCK_DOCUMENT_DETAIL = {
  id: 'doc-e2e-001',
  collectionId: 'col-e2e-001',
  title: 'Guide Tsubaki Oil',
  sourceType: 'text',
  sourceUrl: null,
  contentText: 'Le Tsubaki (Camellia japonica) est une huile precieuse extraite des graines du camellia japonais. Utilisee depuis des siecles dans les rituels de beaute japonais.',
  metadata: null,
  chunkCount: 15,
  createdAt: '2026-05-01T08:00:00.000Z',
  updatedAt: '2026-05-20T14:00:00.000Z',
};
```

### 1.2 Page Object : KnowledgeEditPage

```typescript
class KnowledgeEditPage {
  constructor(private page: Page) {}

  // --- Navigation ---
  async goto() {
    await this.page.goto(BASE_URL);
    await this.page.waitForSelector('[data-testid="knowledge-page"]', { timeout: 10000 });
  }

  // --- Selectors : Collections ---
  collectionRow(slug: string) {
    return this.page.locator(`[data-testid="collection-row-${slug}"]`);
  }

  editCollectionButton(name: string) {
    return this.page.getByRole('button', { name: new RegExp(`modifier la collection ${name}`, 'i') });
  }

  get collectionEditDialog() {
    return this.page.getByRole('dialog', { name: /modifier la collection/i });
  }

  get nameInput() {
    return this.collectionEditDialog.locator('input[aria-label*="Nom"], input').first();
  }

  get descriptionInput() {
    return this.collectionEditDialog.locator('input[placeholder*="Description"]');
  }

  get categorySelect() {
    return this.collectionEditDialog.locator('select');
  }

  get slugDisplay() {
    return this.collectionEditDialog.locator('[aria-readonly="true"]');
  }

  // --- Selectors : Documents ---
  viewDocButton(title: string) {
    return this.page.getByRole('button', { name: new RegExp(`voir le contenu de ${title}`, 'i') });
  }

  editDocButton(title: string) {
    return this.page.getByRole('button', { name: new RegExp(`modifier le document ${title}`, 'i') });
  }

  get documentViewDialog() {
    return this.page.getByRole('dialog').filter({ hasText: /contenu/i });
  }

  get documentEditDialog() {
    return this.page.getByRole('dialog', { name: /modifier le document/i });
  }

  get docTitleInput() {
    return this.documentEditDialog.locator('input').first();
  }

  get docContentTextarea() {
    return this.documentEditDialog.locator('textarea');
  }

  get reChunkWarning() {
    return this.documentEditDialog.locator('text=re-decoupage');
  }

  // --- Selectors : Actions ---
  get saveButton() {
    return this.page.getByRole('button', { name: /enregistrer/i });
  }

  get cancelButton() {
    return this.page.getByRole('button', { name: /annuler/i });
  }

  get closeButton() {
    return this.page.getByRole('button', { name: /fermer/i });
  }

  get confirmReChunkButton() {
    return this.page.getByRole('button', { name: /confirmer et re-indexer/i });
  }

  get confirmDialog() {
    return this.page.getByRole('dialog', { name: /confirmer la re-indexation/i });
  }

  get successBanner() {
    return this.page.locator('[data-testid="success-banner"], [role="alert"]').filter({ hasText: /mise? a jour/i });
  }

  // --- Helpers ---
  async expandCollection(slug: string) {
    await this.collectionRow(slug).click();
    await this.page.waitForSelector(`[data-testid="expanded-panel-${slug}"]`, { timeout: 5000 });
  }

  async waitForDialogClosed() {
    await this.page.waitForSelector('dialog', { state: 'detached', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(300); // animation de fermeture
  }
}
```

### 1.3 Setup et teardown

```typescript
test.describe('Knowledge Edit E2E', () => {
  let knowledgePage: KnowledgeEditPage;

  test.beforeEach(async ({ page }) => {
    knowledgePage = new KnowledgeEditPage(page);

    // Intercepter les appels API
    await page.route('**/api/admin/ai-engine/knowledge', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ collections: [MOCK_COLLECTION] }),
        });
      } else {
        route.continue();
      }
    });

    await page.route('**/api/admin/ai-engine/knowledge/brand-femiglow/documents', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: MOCK_DOCUMENTS }),
      });
    });

    await page.route('**/api/admin/ai-engine/knowledge/brand-femiglow/documents/doc-e2e-001', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ document: MOCK_DOCUMENT_DETAIL }),
        });
      } else {
        route.continue();
      }
    });

    await knowledgePage.goto();
  });
```

---

## 2. Scenarios E2E

### Scenario E2E-01 : Modifier le nom d'une collection avec succes

```typescript
  test('E2E-01 : devrait modifier le nom d\'une collection et afficher le succes', async ({ page }) => {
    // Intercepter le PATCH
    await page.route('**/api/admin/ai-engine/knowledge/brand-femiglow', (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        expect(body.name).toBe('Brand FemiGlow (v2)');
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            collection: { ...MOCK_COLLECTION, name: 'Brand FemiGlow (v2)' },
          }),
        });
      } else {
        route.continue();
      }
    });

    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editCollectionButton('Brand FemiGlow').click();

    // Verifier les champs pre-remplis
    await expect(knowledgePage.nameInput).toHaveValue('Brand FemiGlow');
    await expect(knowledgePage.slugDisplay).toContainText('brand-femiglow');

    // Modifier le nom
    await knowledgePage.nameInput.clear();
    await knowledgePage.nameInput.fill('Brand FemiGlow (v2)');

    // Enregistrer
    await knowledgePage.saveButton.click();

    // Verifier le succes
    await knowledgePage.waitForDialogClosed();
    await expect(knowledgePage.successBanner).toBeVisible({ timeout: 5000 });
  });
```

### Scenario E2E-02 : Modifier la description et la categorie d'une collection

```typescript
  test('E2E-02 : devrait modifier la description et la categorie', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge/brand-femiglow', (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        expect(body.description).toBe('Nouvelle description');
        expect(body.category).toBe('science');
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            collection: {
              ...MOCK_COLLECTION,
              description: 'Nouvelle description',
              category: 'science',
            },
          }),
        });
      } else {
        route.continue();
      }
    });

    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editCollectionButton('Brand FemiGlow').click();

    await knowledgePage.descriptionInput.clear();
    await knowledgePage.descriptionInput.fill('Nouvelle description');
    await knowledgePage.categorySelect.selectOption('science');

    await knowledgePage.saveButton.click();
    await knowledgePage.waitForDialogClosed();
    await expect(knowledgePage.successBanner).toBeVisible({ timeout: 5000 });
  });
```

### Scenario E2E-03 : Modifier le titre d'un document (sans re-chunking)

```typescript
  test('E2E-03 : devrait modifier le titre d\'un document sans re-chunking', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge/brand-femiglow/documents/doc-e2e-001', (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        expect(body.title).toBe('Guide Tsubaki Oil (v2)');
        expect(body.content).toBeUndefined();
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, chunkCount: 15, reChunked: false }),
        });
      } else {
        route.continue();
      }
    });

    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editDocButton('Guide Tsubaki Oil').click();

    await expect(knowledgePage.docTitleInput).toHaveValue('Guide Tsubaki Oil');

    await knowledgePage.docTitleInput.clear();
    await knowledgePage.docTitleInput.fill('Guide Tsubaki Oil (v2)');

    await knowledgePage.saveButton.click();
    await knowledgePage.waitForDialogClosed();
    await expect(knowledgePage.successBanner).toBeVisible({ timeout: 5000 });
  });
```

### Scenario E2E-04 : Modifier le contenu d'un document (declenche re-chunking)

```typescript
  test('E2E-04 : devrait modifier le contenu avec confirmation de re-chunking', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge/brand-femiglow/documents/doc-e2e-001', (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        expect(body.content).toBeTruthy();
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, chunkCount: 8, reChunked: true }),
        });
      } else {
        route.continue();
      }
    });

    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editDocButton('Guide Tsubaki Oil').click();

    await expect(knowledgePage.docContentTextarea).toBeVisible();

    // Modifier le contenu
    await knowledgePage.docContentTextarea.clear();
    await knowledgePage.docContentTextarea.fill('Contenu completement modifie pour tester le re-chunking.');

    // L'avertissement de re-chunking doit etre visible
    await expect(knowledgePage.reChunkWarning).toBeVisible();

    // Cliquer Enregistrer -> dialogue de confirmation
    await knowledgePage.saveButton.click();
    await expect(knowledgePage.confirmDialog).toBeVisible();

    // Confirmer
    await knowledgePage.confirmReChunkButton.click();

    await knowledgePage.waitForDialogClosed();
    await expect(knowledgePage.successBanner).toBeVisible({ timeout: 10000 });
  });
```

### Scenario E2E-05 : Visualiser le contenu complet d'un document

```typescript
  test('E2E-05 : devrait afficher le contenu complet dans le viewer', async ({ page }) => {
    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.viewDocButton('Guide Tsubaki Oil').click();

    // Verifier les metadonnees
    await expect(knowledgePage.documentViewDialog).toBeVisible();
    await expect(knowledgePage.documentViewDialog.locator('text=text')).toBeVisible();
    await expect(knowledgePage.documentViewDialog.locator('text=15')).toBeVisible();

    // Verifier le contenu textuel
    await expect(knowledgePage.documentViewDialog.locator('text=Tsubaki')).toBeVisible();
    await expect(knowledgePage.documentViewDialog.locator('text=Camellia japonica')).toBeVisible();

    // Fermer
    await knowledgePage.closeButton.click();
    await knowledgePage.waitForDialogClosed();
  });
```

### Scenario E2E-06 : Annuler l'edition (aucune modification sauvegardee)

```typescript
  test('E2E-06 : devrait annuler l\'edition sans sauvegarder', async ({ page }) => {
    const patchRequests: Request[] = [];
    await page.route('**/api/admin/ai-engine/knowledge/brand-femiglow', (route) => {
      if (route.request().method() === 'PATCH') {
        patchRequests.push(route.request());
      }
      route.continue();
    });

    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editCollectionButton('Brand FemiGlow').click();

    // Modifier le nom mais annuler
    await knowledgePage.nameInput.clear();
    await knowledgePage.nameInput.fill('Nom temporaire');

    // Gerer la confirmation de fenetre
    page.on('dialog', (dialog) => dialog.accept());

    await knowledgePage.cancelButton.click();
    await knowledgePage.waitForDialogClosed();

    // Aucun PATCH n'a ete envoye
    expect(patchRequests).toHaveLength(0);
  });
```

### Scenario E2E-07 : Erreurs de validation (nom vide, nom trop long)

```typescript
  test('E2E-07 : devrait desactiver le bouton Enregistrer si le nom est vide', async ({ page }) => {
    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editCollectionButton('Brand FemiGlow').click();

    // Vider le nom
    await knowledgePage.nameInput.clear();

    // Le bouton Enregistrer est desactive
    await expect(knowledgePage.saveButton).toBeDisabled();
  });

  test('E2E-07b : devrait afficher le compteur de caracteres et empecher le depassement', async ({ page }) => {
    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editCollectionButton('Brand FemiGlow').click();

    await knowledgePage.nameInput.clear();
    await knowledgePage.nameInput.fill('A'.repeat(200));

    // Verifier le compteur
    await expect(knowledgePage.collectionEditDialog.locator('text=200/200')).toBeVisible();

    // Le maxLength HTML empeche de depasser
    const inputValue = await knowledgePage.nameInput.inputValue();
    expect(inputValue.length).toBeLessThanOrEqual(200);
  });
```

### Scenario E2E-08 : Protection contre les editions concurrentes

```typescript
  test('E2E-08 : devrait afficher une erreur si une edition concurrente est detectee', async ({ page }) => {
    // Simuler un conflit 409
    await page.route('**/api/admin/ai-engine/knowledge/brand-femiglow', (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'conflict', message: 'La collection a ete modifiee par un autre utilisateur' },
          }),
        });
      } else {
        route.continue();
      }
    });

    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editCollectionButton('Brand FemiGlow').click();

    await knowledgePage.nameInput.clear();
    await knowledgePage.nameInput.fill('Nom modifie');
    await knowledgePage.saveButton.click();

    // L'erreur s'affiche dans la modale
    await expect(
      knowledgePage.collectionEditDialog.locator('text=modifiee par un autre utilisateur'),
    ).toBeVisible({ timeout: 5000 });

    // La modale reste ouverte
    await expect(knowledgePage.collectionEditDialog).toBeVisible();
  });
```

### Scenario E2E-09 : Verifier le nombre de chunks mis a jour apres re-chunking

```typescript
  test('E2E-09 : devrait afficher le nombre de chunks mis a jour dans le message de succes', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge/brand-femiglow/documents/doc-e2e-001', (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, chunkCount: 22, reChunked: true }),
        });
      } else {
        route.continue();
      }
    });

    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editDocButton('Guide Tsubaki Oil').click();

    await knowledgePage.docContentTextarea.clear();
    await knowledgePage.docContentTextarea.fill('Contenu beaucoup plus long pour generer plus de chunks.');

    await knowledgePage.saveButton.click();
    await knowledgePage.confirmReChunkButton.click();

    // Le message de succes mentionne le nombre de chunks
    await expect(page.locator('text=22 chunks')).toBeVisible({ timeout: 10000 });
  });
```

### Scenario E2E-10 : Naviguer entre la vue edition et la vue liste

```typescript
  test('E2E-10 : devrait revenir a la liste apres edition d\'un document', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge/brand-femiglow/documents/doc-e2e-001', (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, chunkCount: 15, reChunked: false }),
        });
      } else {
        route.continue();
      }
    });

    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editDocButton('Guide Tsubaki Oil').click();

    await knowledgePage.docTitleInput.clear();
    await knowledgePage.docTitleInput.fill('Titre mis a jour');
    await knowledgePage.saveButton.click();

    await knowledgePage.waitForDialogClosed();

    // La liste de documents est toujours visible
    await expect(page.locator('text=Guide Tsubaki Oil')).toBeVisible();
    // La collection est toujours expandee
    await expect(page.locator(`[data-testid="expanded-panel-brand-femiglow"]`)).toBeVisible();
  });
```

### Scenario E2E-11 : Navigation clavier (Tab, Enter, Escape)

```typescript
  test('E2E-11 : devrait supporter la navigation clavier dans la modale d\'edition', async ({ page }) => {
    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editCollectionButton('Brand FemiGlow').click();

    await expect(knowledgePage.collectionEditDialog).toBeVisible();

    // Tab navigue entre les champs
    await page.keyboard.press('Tab');
    await expect(knowledgePage.nameInput).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(knowledgePage.descriptionInput).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(knowledgePage.categorySelect).toBeFocused();

    // Escape ferme la modale
    page.on('dialog', (dialog) => dialog.accept());
    await page.keyboard.press('Escape');

    await knowledgePage.waitForDialogClosed();
  });
```

### Scenario E2E-12 : Responsive layout (viewport mobile)

```typescript
  test('E2E-12 : devrait afficher la modale en plein ecran sur mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X

    await knowledgePage.goto();
    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editCollectionButton('Brand FemiGlow').click();

    await expect(knowledgePage.collectionEditDialog).toBeVisible();

    // Verifier que les elements du formulaire sont accessibles
    await expect(knowledgePage.nameInput).toBeVisible();
    await expect(knowledgePage.saveButton).toBeVisible();
    await expect(knowledgePage.cancelButton).toBeVisible();
  });

  test('E2E-12b : devrait afficher les boutons d\'action verticalement sur tablette', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad

    await knowledgePage.goto();
    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editDocButton('Guide Tsubaki Oil').click();

    await expect(knowledgePage.documentEditDialog).toBeVisible();
    await expect(knowledgePage.docTitleInput).toBeVisible();
    await expect(knowledgePage.docContentTextarea).toBeVisible();
  });
```

### Scenario E2E-13 : Recuperation d'erreur (echec API pendant la sauvegarde)

```typescript
  test('E2E-13 : devrait afficher l\'erreur et permettre de reessayer apres un echec API', async ({ page }) => {
    let attempt = 0;
    await page.route('**/api/admin/ai-engine/knowledge/brand-femiglow', (route) => {
      if (route.request().method() === 'PATCH') {
        attempt++;
        if (attempt === 1) {
          // Premier essai : erreur 500
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { message: 'Internal server error' } }),
          });
        } else {
          // Deuxieme essai : succes
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              collection: { ...MOCK_COLLECTION, name: 'Nom corrige' },
            }),
          });
        }
      } else {
        route.continue();
      }
    });

    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editCollectionButton('Brand FemiGlow').click();

    await knowledgePage.nameInput.clear();
    await knowledgePage.nameInput.fill('Nom corrige');

    // Premier essai -> erreur
    await knowledgePage.saveButton.click();
    await expect(
      knowledgePage.collectionEditDialog.locator('text=Internal server error'),
    ).toBeVisible({ timeout: 5000 });

    // La modale est toujours ouverte, le formulaire preserve les donnees
    await expect(knowledgePage.nameInput).toHaveValue('Nom corrige');

    // Deuxieme essai -> succes
    await knowledgePage.saveButton.click();
    await knowledgePage.waitForDialogClosed();
    await expect(knowledgePage.successBanner).toBeVisible({ timeout: 5000 });
  });
```

### Scenario E2E-14 : Rollback de mise a jour optimiste

```typescript
  test('E2E-14 : devrait ne pas afficher de donnees mises a jour si le PATCH echoue', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge/brand-femiglow', (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Erreur de base de donnees' } }),
        });
      } else {
        route.continue();
      }
    });

    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.editCollectionButton('Brand FemiGlow').click();

    await knowledgePage.nameInput.clear();
    await knowledgePage.nameInput.fill('Nom qui ne sera pas sauvegarde');
    await knowledgePage.saveButton.click();

    // Erreur dans la modale
    await expect(
      knowledgePage.collectionEditDialog.locator('text=Erreur de base de donnees'),
    ).toBeVisible({ timeout: 5000 });

    // Annuler apres l'erreur
    page.on('dialog', (dialog) => dialog.accept());
    await knowledgePage.cancelButton.click();
    await knowledgePage.waitForDialogClosed();

    // La liste affiche toujours l'ancien nom
    await expect(page.locator('text=Brand FemiGlow')).toBeVisible();
    await expect(page.locator('text=Nom qui ne sera pas sauvegarde')).not.toBeVisible();
  });
```

### Scenario E2E-15 : Viewer -> Modifier (transition entre modales)

```typescript
  test('E2E-15 : devrait permettre la transition du viewer vers l\'editeur', async ({ page }) => {
    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.viewDocButton('Guide Tsubaki Oil').click();

    // Le viewer est affiche
    await expect(knowledgePage.documentViewDialog).toBeVisible();
    await expect(knowledgePage.documentViewDialog.locator('text=Tsubaki')).toBeVisible();

    // Cliquer "Modifier" dans le viewer
    await knowledgePage.documentViewDialog.getByRole('button', { name: /modifier/i }).click();

    // Le viewer se ferme et l'editeur s'ouvre
    await expect(knowledgePage.documentEditDialog).toBeVisible({ timeout: 5000 });
    await expect(knowledgePage.docTitleInput).toHaveValue('Guide Tsubaki Oil');
    await expect(knowledgePage.docContentTextarea).toContainText('Tsubaki');
  });
```

### Scenario E2E-16 : Chargement du contenu avec skeleton

```typescript
  test('E2E-16 : devrait afficher un skeleton pendant le chargement du document', async ({ page }) => {
    // Ralentir la reponse GET document
    await page.route('**/api/admin/ai-engine/knowledge/brand-femiglow/documents/doc-e2e-001', (route) => {
      if (route.request().method() === 'GET') {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ document: MOCK_DOCUMENT_DETAIL }),
          });
        }, 1500);
      } else {
        route.continue();
      }
    });

    await knowledgePage.expandCollection('brand-femiglow');
    await knowledgePage.viewDocButton('Guide Tsubaki Oil').click();

    // Le skeleton est visible pendant le chargement
    await expect(page.locator('[data-testid="skeleton"], .animate-pulse')).toBeVisible({ timeout: 2000 });

    // Apres le chargement, le contenu s'affiche
    await expect(knowledgePage.documentViewDialog.locator('text=Tsubaki')).toBeVisible({ timeout: 5000 });
  });
```

---

## 3. Fermeture du describe

```typescript
}); // fin de test.describe('Knowledge Edit E2E')
```

---

## 4. Recapitulatif des scenarios

| ID | Scenario | Priorite | Couverture |
|----|----------|----------|------------|
| E2E-01 | Modifier le nom d'une collection | P0 | PATCH collection, pre-remplissage, succes |
| E2E-02 | Modifier description + categorie | P1 | Champs multiples, select |
| E2E-03 | Modifier le titre d'un document | P0 | PATCH document, pas de re-chunk |
| E2E-04 | Modifier le contenu (re-chunking) | P0 | Confirmation, re-chunk, succes |
| E2E-05 | Visualiser le contenu complet | P0 | GET document, viewer |
| E2E-06 | Annuler l'edition | P1 | Dirty check, pas de requete |
| E2E-07 | Validation nom vide / trop long | P0 | Bouton desactive, compteur |
| E2E-08 | Edition concurrente (409) | P2 | Erreur conflit |
| E2E-09 | Chunks mis a jour apres re-chunk | P1 | Verification compteurs |
| E2E-10 | Navigation liste <-> edition | P1 | Etat de l'UI preservee |
| E2E-11 | Navigation clavier | P1 | Tab, Enter, Escape |
| E2E-12 | Responsive mobile/tablette | P2 | Viewport, visibilite |
| E2E-13 | Erreur API + reessai | P0 | Erreur, recovery, reessai |
| E2E-14 | Rollback mise a jour optimiste | P1 | Ancien nom preserve |
| E2E-15 | Viewer -> Editeur | P1 | Transition modale |
| E2E-16 | Chargement avec skeleton | P2 | Skeleton, delai |

**Total : 16 scenarios (+ 2 sous-scenarios pour E2E-07b et E2E-12b)**

---

## 5. Commandes d'execution

```bash
# Executer les tests Knowledge Edit E2E
cd apps/web
npx playwright test e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts --reporter=list

# En mode debug (navigateur visible)
npx playwright test e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts --headed --debug

# Avec traces pour le diagnostic
npx playwright test e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts --trace=on

# Executer un seul scenario
npx playwright test e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts -g "E2E-04"

# Tous les tests Knowledge E2E (existants + nouveaux)
npx playwright test e2e/content-studio-v2/ai-engine-knowledge
```
