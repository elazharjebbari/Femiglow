# Plan d'action -- Knowledge Edit

**Feature** : AI Engine / Knowledge Base / UPDATE  
**Branche** : `feat/knowledge-edit`  
**Estimation totale** : 14-18 heures  
**Date de debut prevue** : 2026-05-26  
**Date de livraison cible** : 2026-05-28

---

## 1. Vue d'ensemble des etapes

```
[1] Schema DB ──> [2] Service Layer ──> [3] API Routes ──> [4] Barrel Index
       |                  |                    |                   |
       v                  v                    v                   v
[5] MSW Handlers ──> [6] Composants UI ──> [7] Integration UI ──> [8] Tests unitaires
                                                                       |
                                                                       v
                                              [9] Tests E2E ──> [10] Boucle de correction
                                                                       |
                                                                       v
                                              [11] Verification finale ──> [12] Deploiement
```

---

## 2. Detail des etapes

### Etape 1 : Verification et migration du schema DB

**Description** : Ajouter les colonnes `updated_at` aux tables `ai_engine_knowledge_collection` et `ai_engine_knowledge_document`. Mettre a jour le schema Drizzle et generer la migration.

**Fichiers a modifier** :
- `apps/web/src/lib/db/schema-ai-engine.ts` -- ajout de `updatedAt` dans les deux tables
- `drizzle/migrations/xxxx_add_updated_at_knowledge.sql` -- fichier de migration genere

**Estimation** : 0.5 heure

**Dependances** : Aucune (premiere etape)

**Criteres de verification** :
- [ ] La colonne `updated_at` existe dans les deux tables du schema Drizzle
- [ ] `npx drizzle-kit generate:pg` genere une migration valide
- [ ] La migration s'applique sans erreur : `npx drizzle-kit push:pg`
- [ ] Les donnees existantes ont `updated_at = created_at`
- [ ] `npx tsc --noEmit` passe sans erreur

**Commandes de verification** :
```bash
cd apps/web
npx tsc --noEmit
npx drizzle-kit generate:pg
```

---

### Etape 2 : Service Layer -- updateCollection + getDocumentById

**Description** : Implementer les fonctions `updateCollection()` et `getDocumentById()` dans `collections.ts`. Mettre a jour l'interface `CollectionRow` et la fonction `mapRow()`.

**Fichiers a modifier** :
- `apps/web/src/lib/ai-engine/knowledge/collections.ts` -- ajout de `UpdateCollectionData`, `DocumentDetail`, `updateCollection()`, `getDocumentById()`, mise a jour de `mapRow()` et `CollectionRow`

**Estimation** : 1.5 heures

**Dependances** : Etape 1 (schema `updatedAt` requis)

**Criteres de verification** :
- [ ] L'interface `CollectionRow` contient le champ `updatedAt: Date`
- [ ] `mapRow()` mappe correctement `updatedAt`
- [ ] `updateCollection()` accepte un objet partiel et met a jour uniquement les champs fournis
- [ ] `updateCollection()` met toujours a jour `updatedAt`
- [ ] `updateCollection()` leve une erreur si la collection n'existe pas
- [ ] `getDocumentById()` retourne le document complet incluant `contentText`
- [ ] `getDocumentById()` retourne null si le document n'existe pas ou n'appartient pas a la collection
- [ ] `npx tsc --noEmit` passe sans erreur

**Commandes de verification** :
```bash
cd apps/web
npx tsc --noEmit
npx vitest run src/lib/ai-engine/knowledge/collections.test.ts
```

---

### Etape 3 : Service Layer -- updateDocument

**Description** : Implementer la fonction `updateDocument()` dans `ingestion.ts`. Gerer les deux cas : titre seul (sans re-chunking) et contenu modifie (avec re-chunking transactionnel).

**Fichiers a modifier** :
- `apps/web/src/lib/ai-engine/knowledge/ingestion.ts` -- ajout de `UpdateDocumentData`, `UpdateDocumentResult`, `updateDocument()`

**Estimation** : 2 heures

**Dependances** : Etape 1 (schema), Etape 2 (`updateCollectionCounts`)

**Criteres de verification** :
- [ ] `updateDocument()` avec `title` seul ne declenche pas de re-chunking
- [ ] `updateDocument()` avec `content` supprime les anciens chunks et re-cree les nouveaux dans une transaction
- [ ] Le nombre de chunks retourne correspond au nombre reel de chunks inseres
- [ ] `updateCollectionCounts()` est appele apres un re-chunking reussi
- [ ] En cas d'erreur OpenAI, la transaction fait rollback et les anciens chunks sont preserves
- [ ] Le resultat inclut `error` en cas d'echec
- [ ] `npx tsc --noEmit` passe sans erreur

**Commandes de verification** :
```bash
cd apps/web
npx tsc --noEmit
npx vitest run src/lib/ai-engine/knowledge/ingestion.test.ts
```

---

### Etape 4 : API Routes -- PATCH collection + GET/PATCH document

**Description** : Ajouter les handlers PATCH et GET dans les fichiers de route existants. Implementer la validation Zod, l'authentification et la gestion d'erreurs.

**Fichiers a modifier** :
- `apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/route.ts` -- ajout du handler `PATCH`
- `apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/documents/[docId]/route.ts` -- ajout des handlers `GET` et `PATCH`, ajout de `maxDuration = 120`

**Estimation** : 1.5 heures

**Dependances** : Etape 2 et 3 (service layer)

**Criteres de verification** :
- [ ] PATCH collection valide -> 200 avec collection mise a jour
- [ ] PATCH collection sans champ -> 400 avec erreur Zod
- [ ] PATCH collection inexistante -> 404
- [ ] GET document valide -> 200 avec document complet
- [ ] GET document inexistant -> 404
- [ ] PATCH document titre -> 200 avec reChunked=false
- [ ] PATCH document contenu -> 200 avec reChunked=true
- [ ] `maxDuration = 120` est exporte dans le fichier [docId]/route.ts
- [ ] `npx tsc --noEmit` passe sans erreur

**Commandes de verification** :
```bash
cd apps/web
npx tsc --noEmit
# Test manuel avec curl :
curl -X PATCH http://localhost:3000/api/admin/ai-engine/knowledge/brand-femiglow \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"name": "Test"}'
```

---

### Etape 5 : Barrel Index + Exports

**Description** : Mettre a jour le fichier `index.ts` pour exporter toutes les nouvelles fonctions, interfaces et types.

**Fichiers a modifier** :
- `apps/web/src/lib/ai-engine/knowledge/index.ts` -- ajout des exports

**Estimation** : 0.25 heure

**Dependances** : Etapes 2 et 3

**Criteres de verification** :
- [ ] Tous les nouveaux exports sont accessibles via `@/lib/ai-engine/knowledge`
- [ ] Les imports dans les routes API fonctionnent correctement
- [ ] `npx tsc --noEmit` passe sans erreur

---

### Etape 6 : Handlers MSW

**Description** : Creer les handlers MSW 2.x pour les trois nouveaux endpoints (PATCH collection, GET document, PATCH document) avec les variants de succes et d'erreur.

**Fichiers a creer** :
- `apps/web/src/test/msw/handlers/ai-engine-knowledge-edit.handlers.ts`

**Fichiers a modifier** :
- `apps/web/src/test/msw/handlers/index.ts` -- ajout des re-exports

**Estimation** : 1 heure

**Dependances** : Etape 4 (contrats API finalises)

**Criteres de verification** :
- [ ] Le handler PATCH collection simule la validation Zod
- [ ] Le handler PATCH document simule le delai de re-chunking
- [ ] Les handlers d'erreur (500, 401, 404, 409) sont disponibles
- [ ] Les handlers sont exportes depuis le barrel index MSW
- [ ] `npx tsc --noEmit` passe sans erreur

---

### Etape 7 : Composants UI -- Modales d'edition

**Description** : Implementer les quatre nouveaux composants inline dans `page.tsx` : `CollectionEditDialog`, `DocumentViewDialog`, `DocumentEditDialog`, `ConfirmReChunkDialog`. Ajouter les boutons d'action sur les lignes de collections et documents.

**Fichiers a modifier** :
- `apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx` -- ajout de :
  - Imports (Pencil, Eye, AlertCircle, RefreshCw, Dialog, Skeleton)
  - Interface DocumentDetail
  - 18 nouveaux useState
  - 6 nouvelles fonctions handlers
  - 4 composants modaux (JSX)
  - Boutons d'action sur CollectionRow et DocumentRow

**Estimation** : 3 heures

**Dependances** : Etapes 4 et 6 (API fonctionnelle + MSW pour le dev iteratif)

**Criteres de verification** :
- [ ] Le bouton "Modifier" apparait sur chaque collection (panneau expand)
- [ ] Le bouton "Voir" (oeil) et "Modifier" (crayon) apparaissent sur chaque document
- [ ] La modale d'edition de collection pre-remplit nom, description, categorie
- [ ] Le slug est affiche en lecture seule dans la modale
- [ ] La modale de visualisation affiche le contenu complet avec metadonnees
- [ ] La modale d'edition de document affiche le textarea du contenu
- [ ] Le compteur de caracteres fonctionne
- [ ] L'avertissement de re-chunking apparait quand le contenu est modifie
- [ ] La confirmation de re-chunking s'affiche avant la soumission
- [ ] Le dirty checking previent la fermeture accidentelle
- [ ] `npx tsc --noEmit` passe sans erreur

**Commandes de verification** :
```bash
cd apps/web
npx tsc --noEmit
npm run dev  # Verification visuelle sur http://localhost:3000
```

---

### Etape 8 : Integration UI -- Tests manuels

**Description** : Tester manuellement l'integration complete de l'UI avec l'API backend en environnement de developpement local. Verifier les flux complets bout-en-bout.

**Fichiers concernes** : Aucune creation, verification uniquement

**Estimation** : 1 heure

**Dependances** : Etapes 1 a 7

**Criteres de verification** :
- [ ] Modifier le nom d'une collection -> la liste se rafraichit
- [ ] Modifier le contenu d'un document -> le re-chunking s'execute, les chunks sont mis a jour
- [ ] Visualiser un document -> le contenu complet s'affiche
- [ ] Annuler une edition -> aucune modification en base
- [ ] Erreur API simulee -> le message d'erreur s'affiche dans la modale
- [ ] Le toast de succes s'affiche apres chaque operation reussie

---

### Etape 9 : Tests unitaires Vitest

**Description** : Ecrire les tests unitaires pour le service layer, les routes API et les composants UI.

**Fichiers a modifier** :
- `apps/web/src/lib/ai-engine/knowledge/collections.test.ts` -- ajout describe `updateCollection`, `getDocumentById`
- `apps/web/src/lib/ai-engine/knowledge/ingestion.test.ts` -- ajout describe `updateDocument`

**Fichiers a creer** :
- `apps/web/src/test/api-contracts/ai-engine-knowledge-edit.contract.test.ts`
- `apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/knowledge-page-edit.test.tsx`

**Estimation** : 2.5 heures

**Dependances** : Etapes 2, 3, 4, 6, 7

**Criteres de verification** :
- [ ] 48+ cas de test ecrits (cf. test-matrix.csv)
- [ ] Tous les cas P0 couverts
- [ ] `npx vitest run --reporter=verbose` : 0 failures
- [ ] Couverture > 90% sur les nouvelles fonctions (`npx vitest run --coverage`)

**Commandes de verification** :
```bash
cd apps/web
npx vitest run --reporter=verbose \
  src/lib/ai-engine/knowledge/collections.test.ts \
  src/lib/ai-engine/knowledge/ingestion.test.ts \
  src/test/api-contracts/ai-engine-knowledge-edit.contract.test.ts \
  src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/knowledge-page-edit.test.tsx
```

---

### Etape 10 : Tests E2E Playwright

**Description** : Ecrire les scenarios E2E couvrant les flux utilisateur complets.

**Fichiers a creer** :
- `apps/web/e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts`

**Estimation** : 2 heures

**Dependances** : Etapes 7, 9

**Criteres de verification** :
- [ ] 16+ scenarios E2E ecrits (cf. playwright-specs.md)
- [ ] Tous les scenarios P0 passent
- [ ] `npx playwright test --reporter=list` : 0 failures
- [ ] Temps d'execution < 120 secondes
- [ ] 3 runs consecutifs sans flaky test

**Commandes de verification** :
```bash
cd apps/web
npx playwright test e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts --reporter=list
# Verification de stabilite (3 runs) :
for i in 1 2 3; do npx playwright test e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts --reporter=dot; done
```

---

### Etape 11 : Boucle de correction

**Description** : Corriger les erreurs TypeScript, les tests echoues et les regressions detectees. Iterer jusqu'a ce que toutes les verifications passent.

**Fichiers concernes** : Tous les fichiers modifies dans les etapes precedentes

**Estimation** : 1.5 heures

**Dependances** : Etapes 9 et 10

**Criteres de verification** :
- [ ] `npx tsc --noEmit` : 0 erreurs
- [ ] `npx vitest run` : 0 failures sur TOUS les tests (existants + nouveaux)
- [ ] `npx playwright test` : 0 failures sur TOUS les tests (existants + nouveaux)
- [ ] Aucune regression detectee sur les tests existants

**Commandes de verification** :
```bash
cd apps/web
npx tsc --noEmit
npx vitest run --reporter=verbose
npx playwright test --reporter=list
```

---

### Etape 12 : Verification finale et deploiement

**Description** : Verification complete avant le merge. Revue du code, verification de la couverture, test de non-regression.

**Fichiers concernes** : Aucune creation, verification uniquement

**Estimation** : 1 heure

**Dependances** : Etape 11

**Criteres de verification** :
- [ ] `npx tsc --noEmit` : 0 erreurs
- [ ] `npx vitest run --coverage` : couverture > 90% sur les nouvelles fonctions
- [ ] `npx playwright test` : 0 failures, 0 flaky
- [ ] Le diff git ne contient pas de fichiers parasites (.env, node_modules, etc.)
- [ ] Les tests existants ne sont pas modifies (sauf ajout de `updatedAt` dans les mocks)
- [ ] La migration DB est reversible
- [ ] Le PR est cree avec la description et la checklist
- [ ] Le PR passe la CI GitHub Actions

**Commandes de verification** :
```bash
cd apps/web
npx tsc --noEmit
npx vitest run --coverage src/lib/ai-engine/knowledge/
npx playwright test e2e/content-studio-v2/ai-engine-knowledge
git diff --stat HEAD~1
```

---

## 3. Diagramme de Gantt simplifie

```
Jour 1 (lundi 26 mai) :
  [09:00-09:30] Etape 1  : Schema DB
  [09:30-11:00] Etape 2  : Service updateCollection + getDocumentById
  [11:00-13:00] Etape 3  : Service updateDocument
  [14:00-15:30] Etape 4  : API Routes
  [15:30-15:45] Etape 5  : Barrel Index
  [15:45-16:45] Etape 6  : MSW Handlers

Jour 2 (mardi 27 mai) :
  [09:00-12:00] Etape 7  : Composants UI
  [13:00-14:00] Etape 8  : Integration manuelle
  [14:00-16:30] Etape 9  : Tests unitaires Vitest

Jour 3 (mercredi 28 mai) :
  [09:00-11:00] Etape 10 : Tests E2E Playwright
  [11:00-12:30] Etape 11 : Boucle de correction
  [13:30-14:30] Etape 12 : Verification + deploiement
```

---

## 4. Risques et mitigations

| Risque | Impact | Probabilite | Mitigation |
|--------|--------|------------|------------|
| Tests existants echouent apres ajout de `updatedAt` | Moyen | Moyenne | Mettre a jour les mocks existants des le debut (Etape 1) |
| Re-chunking trop lent en CI | Faible | Faible | Les tests utilisent des mocks, pas de vrai embedding |
| Conflit de merge avec la branche principale | Moyen | Faible | Rebase frequent, branche dediee |
| Composant Dialog manquant ou incompatible | Eleve | Faible | Verifier l'existence du composant en Etape 7 avant d'implementer |
| Regression sur les tests E2E existants | Moyen | Faible | Executer tous les tests existants a chaque etape |
