# Stratégie de tests — Content Studio P1

## Stack de test

| Outil | Usage | Config existante |
|-------|-------|-----------------|
| **Vitest** | Tests unitaires et d'intégration | `vitest.config.ts` — jsdom, globals, setup `vitest.setup.ts` |
| **MSW v2** | Mock des appels API | `msw` ^2.14.2 déjà installé, `src/test/msw/server.ts` existant |
| **Playwright** | Tests E2E navigateur | `playwright.config.ts` existant, 53 specs existants |
| **@testing-library/react** | Tests de composants React | Déjà installé et configuré dans `vitest.setup.ts` |
| **jest-axe** | Tests d'accessibilité | Déjà installé, `expectNoAxeViolations()` existant |

## Couverture actuelle

| Module | Tests | Couverture |
|--------|-------|------------|
| `state-machine.ts` | 14 tests (transitions) | Bonne |
| `brand-rules.ts` | 8 tests (règles, scores) | Bonne |
| `postiz.ts` | 9 tests (payload, upload) | Bonne |
| `schemas.ts` | 9 tests (validation Zod) | Bonne |
| `automation.ts` | 3 tests (retry, schedule) | Bonne |
| `image-generation.ts` | 1 test (mock) | Minimale |
| `service.ts` | 0 | Aucune |
| `repository.ts` | 0 | Aucune |
| `auth.ts` | 0 | Aucune |
| `generation.ts` | 0 (OpenAI path) | Aucune |
| API routes (13) | 0 | Aucune |
| `ContentStudioClient.tsx` | 0 | Aucune |
| E2E Content Studio | 0 | Aucune |

## Plan de tests par étape

### Étape 5 — Tests unitaires

#### 5a. `service.test.ts`

```typescript
// service.test.ts — Tests du service layer avec state machine enforce

describe('ContentStudio service', () => {
  // Setup : mock le repository et les services externes
  
  describe('createContentIdea', () => {
    it('crée une idée avec des données valides');
    it('positionne le statut initial à "idea"');
  });
  
  describe('generateIdeaDrafts', () => {
    it('transition idea → generated');
    it('rejette si le statut est "needs_review"');
    it('rejette si le statut est "approved"');
  });
  
  describe('approveContentDraft', () => {
    it('transition needs_review → approved si pas de violations bloquantes');
    it('rejette si le draft a des violations bloquantes');
    it('rejette si le statut est "idea"');
  });
  
  describe('createDraftInPostiz', () => {
    it('transition approved → scheduled');
    it('rejette si le statut est "needs_review"');
  });
});
```

#### 5b. `auth.test.ts`

```typescript
// auth.test.ts — Tests de l'authentification API

describe('requireContentStudioEnabled', () => {
  it('passe si CONTENT_STUDIO_ENABLED=true');
  it('jette HttpError 403 si CONTENT_STUDIO_ENABLED=false');
});

describe('requireAdminApi', () => {
  it('jette HttpError 401 si pas de session');
  it('retourne la session si valide');
});
```

#### 5c. Component tests

```typescript
// StudioGuide.test.tsx
describe('StudioGuide', () => {
  it('rend le guide si enabled=true');
  it('affiche le warning si enabled=false');
});

// DraftCardList.test.tsx
describe('DraftCardList', () => {
  it('rend la liste des drafts');
  it('appelle onSelectDraft au clic');
  it('met en surbrillance le draft sélectionné');
});
```

### Étape 6 — Tests d'intégration API avec MSW

#### 6a. MSW handlers

```typescript
// src/test/msw/content-studio.ts
import { http, HttpResponse } from 'msw';

export const contentStudioHandlers = [
  http.get('/api/admin/content-studio/ideas', () => {
    return HttpResponse.json({ ideas: [buildContentIdea()] });
  }),
  http.post('/api/admin/content-studio/ideas', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ idea: { ...buildContentIdea(), ...body } });
  }),
  // ... autres handlers
];
```

#### 6b. API route tests

```typescript
// api-routes.test.ts — Tests avec MSW mockant le service layer

describe('Content Studio API routes', () => {
  describe('Authentification', () => {
    it('retourne 401 sans session');
    it('retourne 403 si Content Studio désactivé');
  });
  
  describe('POST /ideas', () => {
    it('crée une idée avec des données valides');
    it('retourne 400 si les données sont invalides');
  });
  
  describe('Workflow complet', () => {
    it('créer idée → générer → reviewer → approuver → programmer');
  });
  
  describe('Erreurs', () => {
    it('retourne 409 pour une transition invalide');
    it('retourne 400 pour une validation Zod échouée');
  });
});
```

### Étape 7 — Tests E2E Playwright

```typescript
// e2e/content-studio.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Content Studio', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/admin/login');
    await page.fill('[name="email"]', process.env.ADMIN_EMAIL!);
    await page.fill('[name="password"]', process.env.ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');
  });
  
  test('charge la page Content Studio', async ({ page }) => {
    await page.goto('/admin/content-studio');
    await expect(page.locator('h1, h2')).toContainText(/content studio/i);
  });
  
  test('affiche le guide d\'aide', async ({ page }) => {
    await page.goto('/admin/content-studio');
    const guide = page.locator('[data-testid="studio-guide"]');
    await expect(guide).toBeVisible();
  });
  
  test('affiche une erreur 401 sans session', async ({ page }) => {
    // Clear cookies
    await page.context().clearCookies();
    const response = await page.request.get('/api/admin/content-studio/ideas');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('unauthorized');
  });
});
```

### Factories de test

```typescript
// src/test/factories/content-studio.ts

export function buildContentIdea(overrides?: Partial<ContentIdea>): ContentIdea {
  return {
    id: 'idea_test1',
    pillar: 'rituel',
    objective: 'consideration',
    platform: 'instagram',
    format: 'post',
    prompt: 'Prompt de test',
    sourceType: 'manual',
    status: 'idea',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function buildContentDraft(overrides?: Partial<ContentDraft>): ContentDraft {
  return {
    id: 'draft_test1',
    briefId: 'brief_test1',
    platform: 'instagram',
    format: 'post',
    variantLabel: 'Sobre',
    caption: 'Caption de test',
    hook: 'Hook de test',
    cta: 'CTA de test',
    altText: 'Alt text de test',
    hashtags: ['#femiglow'],
    status: 'generated',
    scoreTotal: 96,
    editedBy: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// + buildContentPost, buildContentPostizDelivery, etc.
```

## Seuils de couverture cibles

| Module | Statements | Lines | Functions | Branches |
|--------|-----------|-------|-----------|----------|
| state-machine.ts | 100% | 100% | 100% | 100% |
| brand-rules.ts | 90%+ | 90%+ | 90%+ | 85%+ |
| schemas.ts | 100% | 100% | 100% | 100% |
| auth.ts | 100% | 100% | 100% | 100% |
| service.ts | 80%+ | 80%+ | 70%+ | 70%+ |
| postiz.ts | 85%+ | 85%+ | 85%+ | 75%+ |
| automation.ts | 85%+ | 85%+ | 85%+ | 75%+ |
| Composants UI | 70%+ | 70%+ | 60%+ | 60%+ |