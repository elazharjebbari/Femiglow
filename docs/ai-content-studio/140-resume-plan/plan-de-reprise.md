# Plan de Reprise — AI Content Studio

**Date** : 2026-05-17
**Branche** : master (6 commits `feat(content-studio)` ahead of origin)
**Source** : Session Codex du 14-15 mai 2026, analyse technique du code actuel

---

## État des lieux

### Ce qui est implémenté et fonctionnel

| Composant | Statut | Fichier(s) clé(s) |
|-----------|--------|--------------------|
| Schema DB + Migration | ✅ | `schema-content-studio.ts`, `0050_*.sql` |
| State Machine | ✅ | `state-machine.ts` |
| Brand Rules Engine | ✅ | `brand-rules.ts` (8 tests) |
| Génération texte (fallback + OpenAI) | ✅ | `generation.ts` |
| Génération images (mock + OpenAI) | ✅ | `image-generation.ts` |
| Repository (Drizzle + memory) | ✅ | `repository.ts` |
| Service layer | ✅ | `service.ts` |
| Postiz Bridge (upload + draft) | ✅ | `postiz.ts` (9 tests) |
| Automation (cron jobs) | ✅ | `automation.ts` (3 tests) |
| API Admin | ✅ | `/api/admin/content-studio/*` (11 routes) |
| API Cron | ✅ | `/api/cron/content-studio/*` (4 routes) |
| UI Admin (monolithique) | ✅ | `ContentStudioClient.tsx` (1567 lignes) |
| Admin config + RBAC | ✅ | `AdminShell.tsx`, `defaults.ts`, `schemas.ts` |
| Smoke test | ✅ | `smoke-content-studio.ts` |
| Tests unitaires | ✅ | 44 tests (brand 8, postiz 9, state-machine 14, schemas 9, automation 3, image 1) |
| Config staging | ✅ | `CONTENT_STUDIO_IMAGE_PROVIDER=mock` |

### Bugs connus / en suspens

| # | Bug | Sévérité | Détail |
|---|-----|----------|--------|
| 1 | **Route automation : 401/403 pas propre** | Haute | `requireAdmin()` fait un `redirect()` au lieu de renvoyer du JSON `401/403`. Pour un appel API `fetch()`, le client reçoit une page HTML de login au lieu d'une erreur structurée. |
| 2 | **Compartiment IA affiche ancienne liste** | Basse | Corrigé dans la session Codex, mais vérifier que le fix est bien dans le dernier build. |

### Écarts entre la spec et l'implémentation

| Feature dans la spec | État | Localisation spec |
|----------------------|------|-------------------|
| Brief editor UI (édition manuelle) | ❌ Non implémenté | `fonctionnalites.md` item 2 |
| Multi-format (story frames, carousel) | ❌ Seulement 3 variantes texte | `fonctionnalites.md` item 3 |
| Visual direction panel (fiche direction artistique) | ❌ Non implémenté | `fonctionnalites.md` item 4 |
| Actions de review (demander variation, rejeter avec raison) | ❌ Seulement approve | `fonctionnalites.md` item 6 |
| Calendar vues semaine/mois + filtres | ❌ Pipeline minimal seulement | `fonctionnalites.md` item 7 |
| Feedback loop v1 (notes manuelles, tags gagnant/perdant) | ❌ Non implémenté | `fonctionnalites.md` item 9 |
| Feedback loop v2 (résumé IA, recommandations) | ❌ Non implémenté | `fonctionnalites.md` item 9 |
| UTM builder | ❌ Colonne vide `{}` | `conception-plan` C5 |
| Budget reset cron | ❌ Var d'env existe, pas de cron | `orchestration.md` |
| Job queue (`content_job`) | ❌ Pas de table | `orchestration.md` |
| Idempotency keys | ❌ Non implémenté | `orchestration.md` |
| Panneau Santé Postiz UI | ⚠️ Route OK, 401 bug | Session Codex dernier point |
| Analytics/insights UI | ❌ Données importées mais pas affichées | `conception-plan` C5 |
| Pages séparées (`/calendar`, `/ideas`, `/drafts/[id]`, `/campaigns`, `/settings`) | ❌ Tout sur une seule page | `routes-map.md` |

---

## Plan de reprise

### Priorisation

Les tâches sont ordonnées par dépendance technique et impact utilisateur. Chaque tâche est conçue pour être atomique et committable indépendamment.

---

### P0 — Corriger les bloquants (1 tâche)

#### Tâche P0.1 : Corriger l'authentification des routes API admin

**Problème** : `requireAdmin()` utilise `redirect()` qui renvoie une page HTML au lieu d'un JSON `401/403` pour les appels `fetch()`.

**Solution** : Créer une variante `requireAdminJson()` (ou modifier `requireAdmin` pour accepter un paramètre `format`) qui renvoie `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` quand il n'y a pas de session, au lieu de faire un `redirect()`.

**Fichiers impactés** :
- `apps/web/src/lib/content-studio/auth.ts` — ajouter la variante JSON
- `apps/web/src/app/api/admin/content-studio/automation/route.ts` — utiliser la variante JSON
- Tous les autres routes `api/admin/content-studio/*` — vérifier et migrer si nécessaire

**Patterns à respecter** :
- Réutiliser le pattern d'auth existant du projet (cf. autres routes admin qui font du JSON)
- Ne pas casser les routes qui fonctionnent déjà en navigation directe

**Tests** : Vérifier manuellement qu'un `curl -X POST /api/admin/content-studio/automation` sans cookie renvoie bien un `401 JSON`.

---

### P1 — Stabiliser l'existant (3 tâches)

#### Tâche P1.1 : Extraire le composant monolithique en sous-composants

**Problème** : `ContentStudioClient.tsx` fait 1567 lignes. Inmaintenable.

**Solution** : Découper en composants fonctionnels dans `apps/web/src/components/admin/content-studio/` :

```
ContentStudioClient.tsx      → orchestrator (state + fetch)
├── IdeaPanel.tsx             → saisie idée + génération
├── DraftEditor.tsx           → édition brouillon + brand score
├── MediaPicker.tsx           → picker importés / IA + génération visuelle
├── PostizPanel.tsx           → statut livraison + retry + date cible
├── CalendarPipeline.tsx      → pipeline éditorial + dates
├── AutomationPanel.tsx       → santé Postiz + dry-run
└── StudioGuide.tsx           → section d'aide repliable
```

**Patterns** :
- Garder le même système de couleurs sémantiques (rose, sky, amber, indigo, violet, green)
- Éviter les prop-drilling excessifs : utiliser un context ou passer les handlers via props
- Chaque composant dans son propre fichier, types partagés dans `types.ts`

#### Tâche P1.2 : Ajouter les tests E2E mock Postiz

**Problème** : Pas de tests E2E automatisés. Le smoke script est manuel.

**Solution** : Créer `apps/web/src/lib/content-studio/e2e.test.ts` (ou route mock) qui simule le workflow complet sans toucher au vrai Postiz :

1. Créer une idée
2. Générer des brouillons (provider mock)
3. Associer un média
4. Approuver
5. Créer un draft Postiz (mock la réponse Postiz)
6. Vérifier les transitions d'état

**Patterns** :
- Suivre le pattern des tests existants (`brand-rules.test.ts`, `postiz.test.ts`)
- Utiliser le fallback mock pour les images
- Mock `fetch` pour les appels Postiz

#### Tâche P1.3 : Mettre à jour le runbook avec l'état final

**Problème** : Le runbook (`130-runbook/prototype-runbook.md`) ne reflète pas exactement l'état actuel.

**Solution** : Mettre à jour avec :
- La config env finale (`CONTENT_STUDIO_IMAGE_PROVIDER=mock`)
- Les 6 commits de référence
- Les 44 tests existants
- Le bug P0.1 connu
- Les prochaines étapes (ce plan)

---

### P2 — UX produit (4 tâches)

#### Tâche P2.1 : Actions de review complètes

**Spec** : `fonctionnalites.md` item 6

**À implémenter** :
- Bouton "Demander une variation" → crée un nouveau draft lié à la même idée avec un angle différent
- Bouton "Rejeter avec raison" → passe le draft en `rejected` avec un champ `rejectionReason`
- Bouton "Annuler la programmation" → remet un post `scheduled` en `approved`

**Fichiers impactés** :
- `state-machine.ts` — ajouter transitions `approved → approved` (cancel schedule), `draft → rejected`
- `schemas.ts` — ajouter `rejectionReason` au draft update schema
- `service.ts` — ajouter `requestVariation()`, `rejectDraft()`, `cancelSchedule()`
- Nouvelles routes API : `/drafts/[id]/reject`, `/posts/[id]/cancel-schedule`
- UI : boutons dans le `DraftEditor`

#### Tâche P2.2 : Brief editor UI

**Spec** : `fonctionnalites.md` item 2, `architecture.md` `briefService`

**À implémenter** :
- Section éditable du brief généré automatiquement
- Champs : angle éditorial, preuve/référence, CTA, interdits, asset recommandé
- Sauvegarde du brief modifié avant génération des drafts
- Affichage du brief dans le panneau idée

**Fichiers à créer/modifier** :
- `service.ts` — extraire `generateBriefForIdea()` en service dédié
- `schemas.ts` — ajouter `briefUpdateSchema`
- Route API : `/ideas/[id]/brief`
- UI : onglet "Brief" dans l'éditeur d'idée

#### Tâche P2.3 : Calendar avec vues semaine/mois + filtres

**Spec** : `fonctionnalites.md` item 7

**À implémenter** :
- Vue semaine et vue mois (en plus du pipeline actuel)
- Filtres par : canal (Instagram/Facebook/...), pilier éditorial, campagne, format
- Navigation entre les vues

**Patterns UI** :
- Utiliser les tokens de couleur existants (voir `design-tokens.yaml`)
- Réutiliser les cartes du pipeline actuel

**Fichiers** :
- `CalendarPipeline.tsx` — refactorer en 3 vues
- Nouveau : `CalendarWeekView.tsx`, `CalendarMonthView.tsx`
- Route API : ajouter filtres aux endpoints existants `GET /posts`

#### Tâche P2.4 : Panneau Santé Postiz — finaliser

**Problème** : La route `/api/admin/content-studio/automation` existe mais l'UI n'est pas intégrée dans le composant.

**À implémenter** :
- Section "Santé Postiz" dans l'interface
- Compteurs : livraisons sent/failed/pending
- Dernières livraisons avec statut visuel
- Boutons : dry-run retry, sync intégrations, import statut
- Snapshots performance : vues, likes, portée

**Fichiers** :
- Nouveau : `AutomationPanel.tsx`
- Route API existante : `/api/admin/content-studio/automation` (après fix P0.1)

---

### P3 — Feedback loop & Analytics (3 tâches)

#### Tâche P3.1 : Notes manuelles + Tags gagnant/perdant

**Spec** : `fonctionnalites.md` item 9

**À implémenter** :
- Table `content_learning_notes` — déjà dans le schema DB mais pas de route API
- Routes CRUD : `/posts/[id]/notes`
- UI : section "Notes" dans le panneau post
- Tags gagnant/perdant sur les posts avec compteurs

**Fichiers** :
- `repository.ts` — ajouter les queries pour `contentLearningNotes`
- `service.ts` — ajouter `addNote()`, `tagPost()`
- Nouvelles routes API
- UI : composant notes dans le post panel

#### Tâche P3.2 : UTM Builder

**Spec** : `fonctionnalites.md` item 9, colonne `contentPosts.utm` déjà présente

**À implémenter** :
- Génération automatique d'URLs UTM pour chaque post
- Paramètres : source (instagram/facebook/...), medium (social), campaign, content (pilier éditorial)
- Affichage dans le panneau Postiz
- Stockage dans `contentPosts.utm`

**Fichiers** :
- `service.ts` — ajouter `generateUtmForPost()`
- `schemas.ts` — ajouter validation UTM
- UI : section UTM dans le panneau post

#### Tâche P3.3 : Dashboard analytics avec insights

**Spec** : `fonctionnalites.md` item 9, `conception-plan` C5

**À implémenter** :
- Page ou section avec les snapshots importés de Postiz
- Métriques : vues, likes, portée, CTR par post
- Comparaison par pilier/format
- Tendances hebdomadaires

**Fichiers** :
- Nouveau : `AnalyticsPanel.tsx`
- Route API : `/api/admin/content-studio/analytics`
- `repository.ts` — queries sur `contentPostizSnapshots`

---

### P4 — Robustesse & Production (3 tâches)

#### Tâche P4.1 : Job queue pour Postiz

**Spec** : `orchestration.md` — table `content_job`

**Problème** : Actuellement les appels Postiz sont synchrones. Si Postiz est lent ou en erreur, l'utilisateur attend.

**Solution** :
- Créer la table `content_job` (id, type, payload, status, attempts, maxAttempts, nextAttemptAt, createdAt, updatedAt)
- Les mutations Postiz (upload, draft, schedule) deviennent asynchrones : on crée un job, on retourne immédiatement, le cron le traite
- Backoff exponentiel sur les retries
- UI : afficher le statut du job en temps réel

**Fichiers** :
- Nouveau : `schema-content-studio.ts` — ajouter `contentJobs`
- Nouveau : `content-studio/jobs.ts`
- Migration : `0051_content_studio_jobs.sql`
- `automation.ts` — traiter les jobs en attente

#### Tâche P4.2 : Budget tracking + reset cron

**Spec** : `orchestration.md` — `content-studio-budget-reset`

**À implémenter** :
- Suivi du budget de génération (texte + images) dans une table ou un fichier
- Cron quotidien qui reset le compteur
- Blocage automatique quand le budget est dépassé
- Affichage du budget restant dans l'UI

**Fichiers** :
- `env.ts` — `CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS` (déjà présent)
- Nouveau : `content-studio/budget.ts`
- Nouvelle route cron : `/api/cron/content-studio/budget-reset`
- UI : indicateur de budget dans le header

#### Tâche P4.3 : Idempotency keys

**Spec** : `orchestration.md`

**À implémenter** :
- Ajouter un champ `idempotencyKey` aux mutations critiques (génération, review, Postiz schedule, upload)
- Vérifier avant chaque mutation qu'aucun enregistrement avec la même clé n'existe
- Retourner l'enregistrement existant si la clé est déjà utilisée

**Fichiers** :
- `schemas.ts` — ajouter `idempotencyKey`
- `repository.ts` — vérifier l'existence avant insertion
- `service.ts` — générer les clés et les vérifier

---

### P5 — Refactor architectural (2 tâches)

#### Tâche P5.1 : Pages séparées par fonctionnalité

**Spec** : `routes-map.md`

**Problème** : Tout est sur une seule page.

**Solution** : Créer les routes Next.js App Router :

```
/admin/content-studio              → page d'accueil (pipeline + stats)
/admin/content-studio/ideas         → liste idées + création
/admin/content-studio/ideas/[id]    → détail idée + brief + drafts
/admin/content-studio/drafts        → liste brouillons
/admin/content-studio/drafts/[id]   → éditeur de draft
/admin/content-studio/calendar      → calendrier éditorial
/admin/content-studio/campaigns     → gestion campagnes
/admin/content-studio/settings      → config (Postiz, IA, budget)
```

**Patterns** :
- Layout partagé avec navigation latérale (comme les autres sections admin)
- Charger les données côté serveur quand c'est possible
- Client components seulement pour les mutations et l'interactivité

#### Tâche P5.2 : Séparer les services métier

**Problème** : `service.ts` fait trop de choses (orchestration + logique métier + Postiz + génération).

**Solution** : Extraire en services dédiés :

```
service.ts          → orchestration uniquement
briefService.ts     → génération et édition de briefs
generationService.ts → déjà extrait, mais à enrichir
visualDirectionService.ts → direction artistique + génération images
schedulerService.ts  → planification + Postiz
analyticsService.ts  → lectures sur les snapshots
budgetService.ts     → suivi et contrôle du budget
```

---

## Résumé des priorités

| Priorité | Tâches | Effort estimé |
|----------|--------|---------------|
| **P0** | Corriger auth 401/403 | 1-2h |
| **P1** | Extraire composants, E2E tests, runbook | 1 jour |
| **P2** | Review actions, brief editor, calendar, santé Postiz | 2-3 jours |
| **P3** | Notes/tags, UTM, analytics dashboard | 2 jours |
| **P4** | Job queue, budget cron, idempotency | 2 jours |
| **P5** | Pages séparées, services métier | 2 jours |

**Recommandation** : Commencer par P0.1 (bloquant), puis P1.1 (dette technique UI), puis P2 dans l'ordre (valeur produit immédiate). P3-P5 sont des améliorations qui peuvent être faites en parallèle ou après stabilisation.

---

## Conventions de code à respecter

### Backend
- Fichier `types.ts` pour tous les types et constantes
- Fichier `schemas.ts` pour les schémas Zod
- Fichier `repository.ts` pour les queries Drizzle
- Fichier `service.ts` pour l'orchestration
- Un fichier par domaine métier (`brand-rules.ts`, `postiz.ts`, etc.)
- Tests : un fichier `.test.ts` par module, colocé dans `content-studio/`
- Routes API : RESTful, nested resources, Zod validation
- Auth : `requireContentStudioEnabled()` + `requireAdmin()` sur toutes les routes admin
- Cron : `authorizeCron()` sur toutes les routes cron

### Frontend
- Couleurs sémantiques : rose (idées), sky (production), amber (médias), indigo (preview), violet (Postiz), green (validation)
- Components : un fichier par composant dans `components/admin/content-studio/`
- Data fetching : `postJson()` helper pour les mutations
- Feature flag : vérification `CONTENT_STUDIO_ENABLED` côté serveur + client

### DB
- Préfixe `content_` pour toutes les tables
- Nouvelle table = nouvelle migration numérotée
- Index sur les colonnes de recherche fréquente
- Colonnes `createdAt` / `updatedAt` sur chaque table