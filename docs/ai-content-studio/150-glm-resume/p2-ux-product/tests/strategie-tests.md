# Stratégie de tests P2 — Vitest, MSW, Playwright

## Principes

1. **TDD** : écrire les tests avant ou en même temps que le code
2. **Couverture cible** : 80% statements/lines, 70% branches (comme P1)
3. **Trois couches de tests** : unitaires (vitest), intégration (MSW), E2E (Playwright)
4. **Factory pattern** : utiliser les factories existantes dans `src/test/factories/content-studio.ts`

---

## Tests unitaires (Vitest)

### Backend — nouveaux modules

| Module | Fichier de test | Tests attendus |
|--------|----------------|----------------|
| `schemas.ts` (nouveaux schémas) | `schemas.test.ts` | 15+ tests : valid/invalid pour rejectSchema, cancelSchema, variationSchema, rescheduleSchema, archiveSchema, briefUpdateSchema, learningNoteSchema, querySchemas |
| `repository.ts` (nouvelles fonctions) | `repository.test.ts` | 12+ tests : rejectDraft, cancelPost, archiveIdea/Draft/Post, createDraftVariation, listReviewsByDraft |
| `service.ts` (nouvelles fonctions) | `service.test.ts` | 15+ tests : rejectContentDraft, cancelScheduledPost, archive*, createDraftVariation, reschedulePost + transitions invalides |
| `utm.ts` | `utm.test.ts` | 8+ tests : generateUtmUrl (plateformes, params), parseUtmParams, edge cases |
| `budget.ts` | `budget.test.ts` | 6+ tests : getDailyBudgetStatus (sous budget, au budget, au-dessus), mock du repository |
| `analytics-service.ts` | `analytics-service.test.ts` | 6+ tests : getAnalyticsOverview, calculs par statut/plateforme/pilier |

### Frontend — nouveaux composants

| Composant | Fichier de test | Tests attendus |
|-----------|----------------|----------------|
| `RejectDialog.tsx` | `RejectDialog.test.tsx` | 4 tests : rendu, textarea, submit, cancel |
| `CancelDialog.tsx` | `CancelDialog.test.tsx` | 4 tests : rendu, textarea, submit, cancel |
| `ArchiveButton.tsx` | `ArchiveButton.test.tsx` | 3 tests : rendu, click confirm, disabled state |
| `BriefEditor.tsx` | `BriefEditor.test.tsx` | 5 tests : rendu, édition, sauvegarde, lecture seule, validation |
| `LearningNotes.tsx` | `LearningNotes.test.tsx` | 5 tests : rendu vide, ajout note, affichage notes, suppression, tags |
| `UtmBuilder.tsx` | `UtmBuilder.test.tsx` | 5 tests : rendu, génération URL, copie, params auto, validation |
| `CalendarWeekView.tsx` | `CalendarWeekView.test.tsx` | 4 tests : rendu semaine, navigation, fil posts, empty state |
| `CalendarMonthView.tsx` | `CalendarMonthView.test.tsx` | 4 tests : rendu mois, navigation, fil posts, empty state |
| `CalendarFilters.tsx` | `CalendarFilters.test.tsx` | 3 tests : rendu filtres, changement plateforme, changement statut |
| `AnalyticsDashboard.tsx` | `AnalyticsDashboard.test.tsx` | 4 tests : rendu KPIs, graphiques, empty state, loading |

---

## Tests d'intégration (MSW)

### Handlers MSW existants à enrichir

Le fichier `src/test/msw/content-studio-handlers.ts` contient déjà 8 handlers. Ajouter :

| Route | Handler | Test |
|-------|---------|------|
| `POST /drafts/:id/reject` | Nouveau | 2 tests : success, 404 |
| `POST /drafts/:id/variation` | Nouveau | 2 tests : success, 404 |
| `POST /drafts/:id/archive` | Nouveau | 2 tests : success, 404 |
| `GET /drafts/:id/reviews` | Nouveau | 2 tests : success, empty |
| `POST /posts/:id/cancel` | Nouveau | 2 tests : success, 404 |
| `PATCH /posts/:id/reschedule` | Nouveau | 2 tests : success, 404 |
| `POST /posts/:id/archive` | Nouveau | 2 tests : success, 404 |
| `POST /ideas/:id/archive` | Nouveau | 2 tests : success, 404 |
| `GET /ideas/:id` | Nouveau | 2 tests : success, 404 |
| `PATCH /briefs/:id` | Nouveau | 2 tests : success, 404 |
| `POST /posts/:id/notes` | Nouveau | 2 tests : success, validation |
| `GET /posts/:id/notes` | Nouveau | 2 tests : success, empty |
| `GET /analytics/overview` | Nouveau | 2 tests : success, empty |

**Total** : ~26 nouveaux tests d'intégration MSW

---

## Tests E2E (Playwright)

### Configuration

Les tests E2E nécessitent :
1. Un serveur staging en cours d'exécution
2. Un utilisateur admin authentifié
3. `CONTENT_STUDIO_ENABLED=true`

### Scénarios E2E

| Scénario | Fichier | Étapes |
|----------|---------|--------|
| Parcours complet idée → publication | `content-studio-full-flow.spec.ts` | 1. Créer idée 2. Générer brouillons 3. Sélectionner brouillon 4. Approuver 5. Envoyer à Postiz |
| Rejeter un brouillon | `content-studio-reject.spec.ts` | 1. Créer idée + générer 2. Rejeter un brouillon 3. Vérifier statut rejected |
| Créer une variation | `content-studio-variation.spec.ts` | 1. Créer idée + générer 2. Demander variation 3. Vérifier nouveau brouillon |
| Annuler un post planifié | `content-studio-cancel.spec.ts` | 1. Approuver brouillon 2. Envoyer à Postiz 3. Annuler 4. Vérifier statut cancelled |
| Modifier un brief | `content-studio-brief.spec.ts` | 1. Créer idée 2. Modifier le brief 3. Vérifier sauvegarde |
| Ajouter une note d'apprentissage | `content-studio-notes.spec.ts` | 1. Voir un post 2. Ajouter une note 3. Vérifier affichage |
| Builder UTM | `content-studio-utm.spec.ts` | 1. Ouvrir UTM builder 2. Remplir les champs 3. Vérifier URL générée |
| Calendrier éditorial | `content-studio-calendar.spec.ts` | 1. Voir calendrier 2. Changer vue (semaine/mois) 3. Filtrer par plateforme |

### Stockage des fixtures Playwright

```typescript
// e2e/fixtures/content-studio.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await page.goto('/admin/login');
    await page.fill('[name="email"]', process.env.ADMIN_EMAIL!);
    await page.fill('[name="password"]', process.env.ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');
    await use(page);
    await page.close();
  },
});
```

---

## Seuils de couverture

```typescript
// vitest.config.ts — mise à jour du coverage.include
coverage: {
  include: [
    'src/lib/products/feed/**/*.{ts,tsx}',
    'src/lib/products/reviews.ts',
    'src/components/sections/ProductFeedSection*.tsx',
    'src/lib/content-studio/**/*.{ts,tsx}',
    'src/components/admin/content-studio/**/*.{ts,tsx}',
  ],
  // ... thresholds inchangés : 80/80/80/70
}
```

---

## Résumé des tests P2

| Catégorie | Tests existants (P1) | Tests P2 estimés | Total |
|-----------|---------------------|------------------|-------|
| Vitest — Backend | 62 | 55+ | 117+ |
| Vitest — Frontend | 20 | 37+ | 57+ |
| MSW intégration | 8 | 26+ | 34+ |
| Playwright E2E | 0 | 8 scénarios | 8 |
| **Total** | **90** | **126+** | **216+** |