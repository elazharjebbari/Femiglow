# Specifications Playwright E2E - Gestion des Cles API

> Module : 170 - API Keys Management
> Framework : Playwright 1.48
> Base URL : /admin/content-studio-v2/ai-engine/config
> MSW : 2.x (interception via service worker en mode navigateur)
> Date : 2026-05-25

---

## 1. Configuration E2E

### 1.1 Fichier de test

```
apps/web/e2e/
  api-keys/
    api-keys-crud.spec.ts        # 8 scenarios CRUD
    api-keys-security.spec.ts    # 4 scenarios securite
    api-keys-ux.spec.ts          # 6 scenarios UX/accessibilite
```

### 1.2 Fixtures communes

```typescript
// e2e/fixtures/api-keys.fixture.ts
import { test as base, expect } from '@playwright/test';

type ApiKeysFixtures = {
  authenticatedPage: Page;
  configPage: Page;
};

export const test = base.extend<ApiKeysFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Login admin via API directe (skip UI login)
    await page.context().addCookies([{
      name: 'femiglow-admin-session',
      value: SEALED_TEST_SESSION_COOKIE,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    }]);
    await use(page);
  },
  configPage: async ({ authenticatedPage }, use) => {
    await authenticatedPage.goto('/admin/content-studio-v2/ai-engine/config');
    // Attendre le chargement de la page
    await authenticatedPage.waitForSelector('[data-testid="config-tabs"]');
    await use(authenticatedPage);
  },
});
```

### 1.3 Helper pour naviguer vers l'onglet Cles API

```typescript
async function navigateToApiKeysTab(page: Page) {
  // Cliquer sur l'onglet "Cles API"
  await page.click('[data-testid="tab-api-keys"]');
  // Attendre que la grille de cartes soit chargee
  await page.waitForSelector('[data-testid="api-keys-grid"]');
}
```

### 1.4 Interception MSW en mode navigateur

```typescript
// Les handlers MSW sont charges via le service worker Playwright
// Voir 05-tests/msw-handlers.md pour les definitions de handlers
async function setupMswInterception(page: Page) {
  await page.route('/api/admin/ai-engine/config/api-keys**', async (route) => {
    // Les routes sont mockees via les handlers definis dans msw-handlers.md
    // selon le scenario de test
  });
}
```

---

## 2. Scenarios CRUD (8 tests)

### Fichier : `api-keys-crud.spec.ts`

---

### E2E-AK-01 : Ajouter une nouvelle cle API pour OpenAI

**Priorite** : CRITIQUE
**User Story** : US-170.2

```typescript
test('doit permettre d\'ajouter une cle API OpenAI', async ({ configPage }) => {
  await navigateToApiKeysTab(configPage);

  // 1. Verifier l'etat initial : OpenAI non configure
  const openaiCard = configPage.locator('[data-testid="api-key-card-openai"]');
  await expect(openaiCard).toContainText('Non configuree');
  await expect(openaiCard.locator('[data-testid="btn-configure"]')).toBeVisible();

  // 2. Cliquer sur "Configurer"
  await openaiCard.locator('[data-testid="btn-configure"]').click();

  // 3. Verifier que le formulaire s'affiche
  const form = configPage.locator('[data-testid="api-key-form"]');
  await expect(form).toBeVisible();

  // 4. Selectionner OpenAI (peut etre pre-selectionne si clic depuis la carte)
  const providerSelect = form.locator('[data-testid="select-provider"]');
  await providerSelect.selectOption('openai');

  // 5. Saisir la cle API
  const keyInput = form.locator('[data-testid="input-api-key"]');
  await keyInput.fill('sk-proj-test-e2e-openai-key-123456789ABCDEF');

  // 6. Saisir un label optionnel
  const labelInput = form.locator('[data-testid="input-label"]');
  await labelInput.fill('E2E Test - Production');

  // 7. Cliquer "Sauvegarder et tester"
  await form.locator('[data-testid="btn-save"]').click();

  // 8. Attendre le toast de succes
  await expect(configPage.locator('[data-sonner-toast]')).toContainText('succes');

  // 9. Verifier que la carte OpenAI est mise a jour
  await expect(openaiCard).toContainText('sk-proj-...CDEF');
  await expect(openaiCard).toContainText('Base de donnees');
  await expect(openaiCard).not.toContainText('Non configuree');

  // 10. Verifier que la cle complete n'apparait NULLE PART dans le DOM
  const pageContent = await configPage.content();
  expect(pageContent).not.toContain('sk-proj-test-e2e-openai-key');
});
```

---

### E2E-AK-02 : Voir l'affichage masque des cles (sk-...xxxx)

**Priorite** : CRITIQUE
**User Story** : US-170.1

```typescript
test('doit afficher les cles masquees pour chaque fournisseur configure', async ({ configPage }) => {
  // Setup : 3 fournisseurs configures (OpenAI DB, Anthropic env, Google DB)
  await navigateToApiKeysTab(configPage);

  // 1. OpenAI (source DB) : affichage masque
  const openaiMask = configPage.locator('[data-testid="api-key-card-openai"] [data-testid="masked-key"]');
  await expect(openaiMask).toHaveText(/sk-proj-\.\.\..{4}$/);

  // 2. Anthropic (source env) : affichage masque
  const anthropicMask = configPage.locator('[data-testid="api-key-card-anthropic"] [data-testid="masked-key"]');
  await expect(anthropicMask).toHaveText(/sk-ant-\.\.\..{4}$/);

  // 3. Google (source DB) : affichage masque
  const googleMask = configPage.locator('[data-testid="api-key-card-google"] [data-testid="masked-key"]');
  await expect(googleMask).toHaveText(/AIza\.\.\..{4}$/);

  // 4. Verifier les badges de source
  await expect(configPage.locator('[data-testid="api-key-card-openai"]')).toContainText('Base de donnees');
  await expect(configPage.locator('[data-testid="api-key-card-anthropic"]')).toContainText('Env var');

  // 5. ElevenLabs et Ollama non configures
  await expect(configPage.locator('[data-testid="api-key-card-elevenlabs"]')).toContainText('Non configuree');
  await expect(configPage.locator('[data-testid="api-key-card-ollama"]')).toContainText('Non configuree');
});
```

---

### E2E-AK-03 : Editer une cle API existante

**Priorite** : ELEVE
**User Story** : US-170.3

```typescript
test('doit permettre d\'editer une cle API existante', async ({ configPage }) => {
  await navigateToApiKeysTab(configPage);

  // 1. Cliquer sur "Editer" pour OpenAI
  const openaiCard = configPage.locator('[data-testid="api-key-card-openai"]');
  await openaiCard.locator('[data-testid="btn-edit"]').click();

  // 2. Verifier que le formulaire s'affiche en mode edit
  const form = configPage.locator('[data-testid="api-key-form"]');
  await expect(form).toBeVisible();

  // 3. Le fournisseur est pre-selectionne et non modifiable
  const providerSelect = form.locator('[data-testid="select-provider"]');
  await expect(providerSelect).toBeDisabled();
  await expect(providerSelect).toHaveValue('openai');

  // 4. L'ancienne cle n'est PAS affichee
  const keyInput = form.locator('[data-testid="input-api-key"]');
  await expect(keyInput).toHaveValue(''); // Vide, pas l'ancienne cle

  // 5. Saisir la nouvelle cle
  await keyInput.fill('sk-proj-test-e2e-new-key-ZYXWVUTSRQPO');

  // 6. Sauvegarder
  await form.locator('[data-testid="btn-save"]').click();

  // 7. Toast de succes
  await expect(configPage.locator('[data-sonner-toast]')).toContainText('succes');

  // 8. La cle masquee est mise a jour
  await expect(openaiCard.locator('[data-testid="masked-key"]')).toHaveText(/sk-proj-\.\.\..{4}$/);
});
```

---

### E2E-AK-04 : Supprimer une cle API avec confirmation

**Priorite** : ELEVE
**User Story** : US-170.4

```typescript
test('doit supprimer une cle API apres confirmation', async ({ configPage }) => {
  await navigateToApiKeysTab(configPage);

  // 1. Intercepter le dialog de confirmation
  configPage.on('dialog', async dialog => {
    expect(dialog.message()).toContain('Supprimer');
    await dialog.accept();
  });

  // 2. Cliquer sur "Supprimer" pour OpenAI
  const openaiCard = configPage.locator('[data-testid="api-key-card-openai"]');
  await openaiCard.locator('[data-testid="btn-delete"]').click();

  // 3. Attendre le toast
  await expect(configPage.locator('[data-sonner-toast]')).toContainText(/supprim/i);

  // 4. Verifier que la carte est mise a jour
  // Si un fallback env var existe, la carte passe a "Env var"
  // Sinon, "Non configuree"
  await expect(openaiCard).toContainText(/Env var|Non configuree/);
});
```

---

### E2E-AK-05 : Tester la validite d'une cle (succes)

**Priorite** : ELEVE
**User Story** : US-170.5

```typescript
test('doit tester une cle API et afficher le resultat succes', async ({ configPage }) => {
  await navigateToApiKeysTab(configPage);

  // 1. Cliquer "Tester" pour OpenAI
  const openaiCard = configPage.locator('[data-testid="api-key-card-openai"]');
  await openaiCard.locator('[data-testid="btn-test"]').click();

  // 2. Verifier l'etat "Test en cours..."
  await expect(openaiCard.locator('[data-testid="status-indicator"]')).toContainText('Test en cours');

  // 3. Attendre le resultat (MSW retourne succes)
  await expect(openaiCard.locator('[data-testid="status-indicator"]')).toContainText('Valide', {
    timeout: 5000,
  });

  // 4. Verifier la date du test
  await expect(openaiCard).toContainText(/Teste/i);
});
```

---

### E2E-AK-06 : Tester la validite d'une cle (echec - cle invalide)

**Priorite** : ELEVE
**User Story** : US-170.5

```typescript
test('doit afficher l\'echec si la cle est invalide', async ({ configPage }) => {
  // Setup : MSW retourne une erreur de validation pour Anthropic
  await configPage.route('/api/admin/ai-engine/config/api-keys/test', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valid: false,
        provider: 'anthropic',
        latencyMs: 180,
        error: 'Cle API invalide ou expiree',
        details: null,
      }),
    });
  });

  await navigateToApiKeysTab(configPage);

  // 1. Cliquer "Tester" pour Anthropic
  const anthropicCard = configPage.locator('[data-testid="api-key-card-anthropic"]');
  await anthropicCard.locator('[data-testid="btn-test"]').click();

  // 2. Attendre le resultat
  await expect(anthropicCard.locator('[data-testid="status-indicator"]')).toContainText('Invalide', {
    timeout: 5000,
  });
});
```

---

### E2E-AK-07 : Naviguer vers l'onglet Cles API

**Priorite** : MOYEN
**User Story** : US-170.1

```typescript
test('doit naviguer vers l\'onglet Cles API et charger les donnees', async ({ configPage }) => {
  // 1. Verifier que l'onglet "Cles API" est visible
  const apiKeysTab = configPage.locator('[data-testid="tab-api-keys"]');
  await expect(apiKeysTab).toBeVisible();
  await expect(apiKeysTab).toContainText('Cles API');

  // 2. Cliquer sur l'onglet
  await apiKeysTab.click();

  // 3. Attendre le chargement (squelettes puis contenu)
  await configPage.waitForSelector('[data-testid="api-keys-grid"]');

  // 4. Verifier que les 5 cartes fournisseurs sont presentes
  const cards = configPage.locator('[data-testid^="api-key-card-"]');
  await expect(cards).toHaveCount(5);

  // 5. Verifier les noms des fournisseurs
  await expect(configPage.locator('[data-testid="api-key-card-openai"]')).toContainText('OpenAI');
  await expect(configPage.locator('[data-testid="api-key-card-anthropic"]')).toContainText('Anthropic');
  await expect(configPage.locator('[data-testid="api-key-card-google"]')).toContainText('Google AI');
  await expect(configPage.locator('[data-testid="api-key-card-elevenlabs"]')).toContainText('ElevenLabs');
  await expect(configPage.locator('[data-testid="api-key-card-ollama"]')).toContainText('Ollama');
});
```

---

### E2E-AK-08 : Configurer plusieurs fournisseurs

**Priorite** : MOYEN
**User Story** : US-170.2

```typescript
test('doit permettre de configurer plusieurs fournisseurs consecutivement', async ({ configPage }) => {
  await navigateToApiKeysTab(configPage);

  // 1. Configurer OpenAI
  await configPage.locator('[data-testid="api-key-card-openai"] [data-testid="btn-configure"]').click();
  await configPage.locator('[data-testid="input-api-key"]').fill('sk-proj-test-e2e-multi-1-AAAA');
  await configPage.locator('[data-testid="btn-save"]').click();
  await expect(configPage.locator('[data-sonner-toast]')).toContainText('succes');

  // 2. Configurer Google AI
  await configPage.locator('[data-testid="api-key-card-google"] [data-testid="btn-configure"]').click();
  await configPage.locator('[data-testid="input-api-key"]').fill('AIzaSyD-test-e2e-multi-2-BBBB');
  await configPage.locator('[data-testid="btn-save"]').click();
  await expect(configPage.locator('[data-sonner-toast]').last()).toContainText('succes');

  // 3. Verifier que les deux sont configures
  await expect(configPage.locator('[data-testid="api-key-card-openai"]')).toContainText('Base de donnees');
  await expect(configPage.locator('[data-testid="api-key-card-google"]')).toContainText('Base de donnees');
});
```

---

## 3. Scenarios UX et accessibilite (6 tests)

### Fichier : `api-keys-ux.spec.ts`

---

### E2E-AK-09 : Cle avec caracteres speciaux

**Priorite** : MOYEN

```typescript
test('doit accepter une cle contenant des caracteres speciaux', async ({ configPage }) => {
  await navigateToApiKeysTab(configPage);

  await configPage.locator('[data-testid="api-key-card-elevenlabs"] [data-testid="btn-configure"]').click();
  await configPage.locator('[data-testid="input-api-key"]').fill('test-el-special!@#$%^&*()-key-1234');
  await configPage.locator('[data-testid="btn-save"]').click();

  await expect(configPage.locator('[data-sonner-toast]')).toContainText('succes');
  await expect(configPage.locator('[data-testid="api-key-card-elevenlabs"]')).toContainText('Base de donnees');
});
```

---

### E2E-AK-10 : Annuler le formulaire d'ajout/edition

**Priorite** : MOYEN

```typescript
test('doit fermer le formulaire sans sauvegarder au clic sur Annuler', async ({ configPage }) => {
  await navigateToApiKeysTab(configPage);

  // 1. Ouvrir le formulaire
  await configPage.locator('[data-testid="api-key-card-elevenlabs"] [data-testid="btn-configure"]').click();
  const form = configPage.locator('[data-testid="api-key-form"]');
  await expect(form).toBeVisible();

  // 2. Saisir une cle
  await configPage.locator('[data-testid="input-api-key"]').fill('test-el-cancel-key-000000');

  // 3. Annuler
  await form.locator('[data-testid="btn-cancel"]').click();

  // 4. Verifier que le formulaire est ferme
  await expect(form).not.toBeVisible();

  // 5. Verifier que rien n'a ete sauvegarde
  await expect(configPage.locator('[data-testid="api-key-card-elevenlabs"]')).toContainText('Non configuree');
});
```

---

### E2E-AK-11 : Gestion d'erreur serveur (500)

**Priorite** : MOYEN

```typescript
test('doit afficher un message d\'erreur si le serveur retourne 500', async ({ configPage }) => {
  // Intercepter pour retourner 500
  await configPage.route('/api/admin/ai-engine/config/api-keys', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Cle de chiffrement non configuree',
          code: 'ENCRYPTION_KEY_MISSING',
        }),
      });
    } else {
      await route.continue();
    }
  });

  await navigateToApiKeysTab(configPage);

  // Tenter d'ajouter une cle
  await configPage.locator('[data-testid="api-key-card-elevenlabs"] [data-testid="btn-configure"]').click();
  await configPage.locator('[data-testid="input-api-key"]').fill('test-el-error-key-111111');
  await configPage.locator('[data-testid="btn-save"]').click();

  // Verifier le toast d'erreur
  await expect(configPage.locator('[data-sonner-toast]')).toContainText(/erreur|chiffrement/i);
});
```

---

### E2E-AK-12 : Layout responsive (mobile)

**Priorite** : FAIBLE

```typescript
test('doit afficher les cartes en une seule colonne sur mobile', async ({ configPage }) => {
  // Redimensionner en viewport mobile
  await configPage.setViewportSize({ width: 375, height: 812 });

  await navigateToApiKeysTab(configPage);

  // Verifier que les cartes sont empilees (grid 1 colonne)
  const grid = configPage.locator('[data-testid="api-keys-grid"]');
  const gridStyle = await grid.evaluate(el => window.getComputedStyle(el).gridTemplateColumns);

  // En mobile, une seule colonne
  expect(gridStyle.split(' ').length).toBeLessThanOrEqual(1);
});
```

---

### E2E-AK-13 : Navigation au clavier

**Priorite** : MOYEN

```typescript
test('doit etre entierement navigable au clavier', async ({ configPage }) => {
  await navigateToApiKeysTab(configPage);

  // 1. Tab pour atteindre le premier bouton interactif
  await configPage.keyboard.press('Tab');
  await configPage.keyboard.press('Tab');
  // Verifier le focus sur un element de la grille
  const focusedElement = await configPage.evaluate(() => document.activeElement?.tagName);
  expect(focusedElement).toBeTruthy();

  // 2. Ouvrir le formulaire avec Enter sur le bouton "Configurer"
  const configureBtn = configPage.locator('[data-testid="btn-configure"]').first();
  await configureBtn.focus();
  await configPage.keyboard.press('Enter');

  // 3. Verifier que le formulaire est ouvert
  const form = configPage.locator('[data-testid="api-key-form"]');
  await expect(form).toBeVisible();

  // 4. Fermer avec Escape
  await configPage.keyboard.press('Escape');
  await expect(form).not.toBeVisible();
});
```

---

## 4. Scenarios de securite E2E (4 tests)

### Fichier : `api-keys-security.spec.ts`

---

### E2E-AK-14 : La cle API n'est jamais visible dans le DOM

**Priorite** : CRITIQUE

```typescript
test('la cle API ne doit jamais apparaitre en clair dans le DOM', async ({ configPage }) => {
  // Setup : intercepter GET pour retourner des cles configurees
  await navigateToApiKeysTab(configPage);

  // 1. Verifier le HTML complet de la page
  const pageContent = await configPage.content();

  // Les patterns de cles de test ne doivent pas apparaitre
  const dangerousPatterns = [
    'sk-proj-test-',
    'sk-ant-api03-test-',
    'AIzaSyD-test-',
    'test-el-',
    'encryptedKey',
  ];

  dangerousPatterns.forEach(pattern => {
    expect(pageContent, `Le DOM ne doit pas contenir "${pattern}"`).not.toContain(pattern);
  });

  // 2. Verifier que les cles masquees SONT presentes
  expect(pageContent).toMatch(/sk-proj-\.\.\./);

  // 3. Verifier les attributs data-* (ne doivent pas stocker de cle)
  const allDataAttributes = await configPage.evaluate(() => {
    const elements = document.querySelectorAll('[data-api-key], [data-encrypted-key], [data-raw-key]');
    return elements.length;
  });
  expect(allDataAttributes).toBe(0);
});
```

---

### E2E-AK-15 : Session expiree pendant une operation sur une cle

**Priorite** : ELEVE

```typescript
test('doit gerer proprement une session expiree pendant l\'ajout d\'une cle', async ({ configPage }) => {
  await navigateToApiKeysTab(configPage);

  // 1. Ouvrir le formulaire
  await configPage.locator('[data-testid="api-key-card-elevenlabs"] [data-testid="btn-configure"]').click();

  // 2. Simuler l'expiration de session : les prochains appels retournent 401
  await configPage.route('/api/admin/ai-engine/config/api-keys', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session expiree. Veuillez vous reconnecter.' }),
      });
    } else {
      await route.continue();
    }
  });

  // 3. Tenter de sauvegarder
  await configPage.locator('[data-testid="input-api-key"]').fill('test-el-expired-session-key');
  await configPage.locator('[data-testid="btn-save"]').click();

  // 4. Verifier le message d'erreur
  await expect(configPage.locator('[data-sonner-toast]')).toContainText(/session|reconnecter/i);
});
```

---

### E2E-AK-16 : La cle n'est pas dans le localStorage/sessionStorage

**Priorite** : ELEVE

```typescript
test('la cle API ne doit jamais etre stockee dans le storage du navigateur', async ({ configPage }) => {
  await navigateToApiKeysTab(configPage);

  // 1. Ajouter une cle
  await configPage.locator('[data-testid="api-key-card-elevenlabs"] [data-testid="btn-configure"]').click();
  await configPage.locator('[data-testid="input-api-key"]').fill('test-el-storage-check-key-XXXX');
  await configPage.locator('[data-testid="btn-save"]').click();
  await expect(configPage.locator('[data-sonner-toast]')).toContainText('succes');

  // 2. Verifier localStorage
  const localStorage = await configPage.evaluate(() => JSON.stringify(window.localStorage));
  expect(localStorage).not.toContain('test-el-storage-check');
  expect(localStorage).not.toContain('apiKey');
  expect(localStorage).not.toContain('encryptedKey');

  // 3. Verifier sessionStorage
  const sessionStorage = await configPage.evaluate(() => JSON.stringify(window.sessionStorage));
  expect(sessionStorage).not.toContain('test-el-storage-check');
  expect(sessionStorage).not.toContain('apiKey');
  expect(sessionStorage).not.toContain('encryptedKey');
});
```

---

### E2E-AK-17 : Les reponses reseau ne contiennent pas de cle en clair

**Priorite** : CRITIQUE

```typescript
test('les reponses reseau ne doivent jamais contenir de cle API en clair', async ({ configPage }) => {
  const networkResponses: string[] = [];

  // Intercepter toutes les reponses reseau
  configPage.on('response', async response => {
    if (response.url().includes('/api/admin/ai-engine/config/api-keys')) {
      try {
        const body = await response.text();
        networkResponses.push(body);
      } catch {
        // Ignorer les erreurs de lecture
      }
    }
  });

  await navigateToApiKeysTab(configPage);

  // Effectuer plusieurs operations
  await configPage.locator('[data-testid="api-key-card-openai"] [data-testid="btn-test"]').click();
  await configPage.waitForTimeout(2000); // Attendre les reponses

  // Verifier toutes les reponses capturees
  networkResponses.forEach((body, i) => {
    expect(body, `Reponse reseau ${i} ne doit pas contenir de cle en clair`).not.toMatch(
      /sk-proj-test-|sk-ant-api03-test-|AIzaSyD-test-|test-el-/
    );
    expect(body, `Reponse reseau ${i} ne doit pas contenir encryptedKey`).not.toContain('encryptedKey');
  });
});
```

---

## 5. Resume des tests E2E

| ID | Fichier | Description | Priorite |
|----|---------|-------------|----------|
| E2E-AK-01 | crud | Ajouter une cle API OpenAI | CRITIQUE |
| E2E-AK-02 | crud | Voir l'affichage masque (sk-...xxxx) | CRITIQUE |
| E2E-AK-03 | crud | Editer une cle existante | ELEVE |
| E2E-AK-04 | crud | Supprimer une cle avec confirmation | ELEVE |
| E2E-AK-05 | crud | Tester la validite (succes) | ELEVE |
| E2E-AK-06 | crud | Tester la validite (echec) | ELEVE |
| E2E-AK-07 | crud | Naviguer vers l'onglet Cles API | MOYEN |
| E2E-AK-08 | crud | Configurer plusieurs fournisseurs | MOYEN |
| E2E-AK-09 | ux | Cle avec caracteres speciaux | MOYEN |
| E2E-AK-10 | ux | Annuler le formulaire | MOYEN |
| E2E-AK-11 | ux | Erreur serveur (500) | MOYEN |
| E2E-AK-12 | ux | Layout responsive mobile | FAIBLE |
| E2E-AK-13 | ux | Navigation au clavier | MOYEN |
| E2E-AK-14 | security | Cle jamais visible dans le DOM | CRITIQUE |
| E2E-AK-15 | security | Session expiree pendant operation | ELEVE |
| E2E-AK-16 | security | Cle pas dans localStorage/sessionStorage | ELEVE |
| E2E-AK-17 | security | Reponses reseau propres (pas de cle) | CRITIQUE |

**Total : 17 scenarios E2E**
