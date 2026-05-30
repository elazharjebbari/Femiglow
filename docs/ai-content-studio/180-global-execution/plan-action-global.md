# Plan d'Action Global -- Knowledge Edit + API Keys Management

> **Branche** : `feat/ai-engine-langgraph-mvp`
> **Port staging** : 8012
> **Date de reference** : 2026-05-25
> **Stack** : Next.js 14 App Router, TypeScript strict, Drizzle ORM + PostgreSQL, Vitest 2.1.x, Playwright 1.48, MSW 2.x

---

## 1. Vue d'ensemble des deux features

### Feature 1 -- Knowledge Edit (KE)

**Objectif** : Permettre l'edition et la mise a jour des collections et des documents de la base de connaissances de l'AI Engine depuis l'interface admin.

**Situation actuelle** :
- La page `/admin/content-studio-v2/ai-engine/knowledge` gere deja : listing, creation, expansion/documents, ingestion de documents (texte/URL), suppression de documents, suppression de collections, generation d'embeddings.
- La route API `GET /api/admin/ai-engine/knowledge/[slug]` n'expose aucun endpoint GET (seul DELETE existe).
- La route API `PUT /api/admin/ai-engine/knowledge/[slug]` n'existe pas.
- La route API `PUT /api/admin/ai-engine/knowledge/[slug]/documents/[docId]` n'existe pas.
- Le service `collections.ts` ne possede pas de fonction `updateCollection()`.
- Le service n'a pas de `updateDocument()`.
- L'UI ne propose aucun bouton "Editer" sur les collections ni sur les documents.

**Perimetre fonctionnel** :
1. Edition de collection (nom, slug, description, categorie)
2. Edition de document (titre, contenu textuel, sourceType, sourceUrl)
3. Re-indexation automatique apres modification de document (re-chunking + re-embedding)
4. Validation Zod cote API
5. Retour visuel dans l'UI (toast succes/erreur, mise a jour optimiste)

### Feature 2 -- API Keys Management (AKM)

**Objectif** : Permettre la gestion des cles API des fournisseurs IA directement depuis l'interface de configuration, sans avoir a modifier les variables d'environnement manuellement.

**Situation actuelle** :
- La page `/admin/content-studio-v2/ai-engine/config` affiche les providers avec leur statut (`configured` = true/false) base sur les env vars.
- L'edition des providers permet de modifier : priorite, budget, rate limit, enabled, fallback.
- Les cles API sont resolues uniquement via `getEngineConfig()` dans `engine-config.ts` qui lit les env vars.
- Il n'existe aucun mecanisme de stockage securise des cles API en base de donnees.
- Le schema Drizzle `aiEngineProviderConfigs` possede un champ `apiKeyEnvVar` (nom de la variable d'env) mais pas de champ pour stocker la cle elle-meme.

**Perimetre fonctionnel** :
1. Ajout d'un champ `encryptedApiKey` au schema Drizzle
2. Service de chiffrement/dechiffrement (AES-256-GCM) pour stocker les cles en base
3. Endpoint API pour definir/supprimer une cle API par provider
4. Endpoint API pour tester la validite d'une cle (appel de sante au provider)
5. Modification de `getEngineConfig()` pour prioriser la cle en base puis fallback env vars
6. UI avec formulaire de saisie de cle (masquee), bouton test, indicateur de statut
7. Audit log de chaque modification de cle

---

## 2. Phases d'execution

### Phase 1 -- Fondations Backend (8h estimees)

**Objectif** : Preparer le schema de base de donnees, les services metier et les utilitaires necessaires aux deux features.

#### 1.1 Knowledge Edit -- Backend (3h)

| Tache | Fichier(s) | Detail | Effort |
|-------|-----------|--------|--------|
| T1.1.1 | `schema-ai-engine.ts` | Ajouter un champ `updatedAt` a `aiEngineKnowledgeCollections` et `aiEngineKnowledgeDocuments` | 15min |
| T1.1.2 | `knowledge/collections.ts` | Implementer `updateCollection(id, {name?, slug?, description?, category?})` avec validation de slug unique | 45min |
| T1.1.3 | `knowledge/collections.ts` | Implementer `getCollectionById(id)` (en complement de `getCollection(slug)`) | 15min |
| T1.1.4 | Nouveau fichier `knowledge/documents.ts` | Implementer `updateDocument(docId, {title?, contentText?, sourceType?, sourceUrl?, metadata?})` | 45min |
| T1.1.5 | `knowledge/documents.ts` | Implementer `getDocumentById(docId)` | 15min |
| T1.1.6 | `knowledge/ingestion.ts` | Refactorer pour exposer une fonction `reindexDocument(docId)` qui supprime les anciens chunks et re-chunk + re-embed | 45min |

**Dependances** : Aucune dependance externe. Necessite acces DB en dev/staging.

**Critere de validation** : Tests unitaires passent pour chaque fonction avec mocks Drizzle.

#### 1.2 API Keys Management -- Backend (5h)

| Tache | Fichier(s) | Detail | Effort |
|-------|-----------|--------|--------|
| T1.2.1 | `schema-ai-engine.ts` | Ajouter `encryptedApiKey` (text, nullable) et `apiKeySetAt` (timestamp, nullable) a `aiEngineProviderConfigs` | 20min |
| T1.2.2 | Nouveau fichier `lib/ai-engine/security/encryption.ts` | Service AES-256-GCM : `encrypt(plaintext)`, `decrypt(ciphertext)`, utilisant `AI_ENGINE_ENCRYPTION_KEY` env var | 60min |
| T1.2.3 | `lib/ai-engine/security/encryption.ts` | Ajouter `maskApiKey(key)` (affiche `sk-...xxxx` les 4 derniers chars) | 15min |
| T1.2.4 | Nouveau fichier `lib/ai-engine/providers/api-key-service.ts` | Service CRUD : `setApiKey(providerId, key)`, `getApiKey(providerId)`, `deleteApiKey(providerId)`, `hasApiKey(providerId)` | 60min |
| T1.2.5 | `lib/ai-engine/providers/api-key-service.ts` | Implementer `testApiKey(providerType, key)` avec appel de sante specifique par provider (OpenAI: GET /models, Anthropic: POST /messages dry-run, Google: GET models, ElevenLabs: GET /voices) | 60min |
| T1.2.6 | `lib/ai-engine/config/engine-config.ts` | Modifier `getEngineConfig()` pour charger les cles depuis la DB (si disponibles) en priorite, puis fallback sur env vars. Ajouter `getEngineConfigAsync()` | 45min |
| T1.2.7 | Nouveau fichier `lib/ai-engine/security/audit.ts` | Service d'audit : `logApiKeyChange(providerId, action, adminId)` ecrivant dans les logs et optionnellement en DB | 15min |

**Dependances** :
- T1.2.2 necessite la variable d'environnement `AI_ENGINE_ENCRYPTION_KEY` (32 bytes, base64).
- T1.2.5 necessite que les SDKs des providers soient disponibles (deja le cas dans le projet).

**Critere de validation** :
- Le chiffrement est bidirectionnel (encrypt -> decrypt = original).
- Les cles ne sont JAMAIS loguees en clair.
- Le test de cle retourne un resultat clair (valide/invalide/erreur reseau).

#### 1.3 Migration Drizzle (commune)

| Tache | Fichier(s) | Detail | Effort |
|-------|-----------|--------|--------|
| T1.3.1 | `drizzle/migrations/` | Generer et appliquer la migration pour les nouveaux champs (updatedAt sur knowledge tables, encryptedApiKey + apiKeySetAt sur provider_config) | 30min |

---

### Phase 2 -- Routes API (6h estimees)

**Objectif** : Exposer les endpoints REST pour les deux features.

#### 2.1 Knowledge Edit -- API Routes (3h)

| Tache | Fichier(s) | Detail | Effort |
|-------|-----------|--------|--------|
| T2.1.1 | `api/admin/ai-engine/knowledge/[slug]/route.ts` | Ajouter handler `GET` pour recuperer une collection par slug avec ses metadonnees | 30min |
| T2.1.2 | `api/admin/ai-engine/knowledge/[slug]/route.ts` | Ajouter handler `PUT` avec schema Zod : `{name?, slug?, description?, category?}`. Validation slug unique. Retourner la collection mise a jour | 45min |
| T2.1.3 | `api/admin/ai-engine/knowledge/[slug]/documents/[docId]/route.ts` | Ajouter handler `GET` pour recuperer un document avec ses metadonnees | 30min |
| T2.1.4 | `api/admin/ai-engine/knowledge/[slug]/documents/[docId]/route.ts` | Ajouter handler `PUT` avec schema Zod : `{title?, contentText?, sourceType?, sourceUrl?, metadata?}`. Si `contentText` modifie, declencher re-indexation | 45min |
| T2.1.5 | Tous les handlers | Ajouter `requireAdminApi()` sur chaque endpoint, gestion d'erreur uniforme avec `formatErrorResponse` | 30min |

**Schema de validation PUT collection** :
```typescript
const updateCollectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).nullable().optional(),
  category: z.string().min(1).max(50).optional(),
});
```

**Schema de validation PUT document** :
```typescript
const updateDocumentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  contentText: z.string().max(100000).optional(),
  sourceType: z.enum(['text', 'url', 'pdf', 'csv']).optional(),
  sourceUrl: z.string().url().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
```

#### 2.2 API Keys Management -- API Routes (3h)

| Tache | Fichier(s) | Detail | Effort |
|-------|-----------|--------|--------|
| T2.2.1 | Nouveau fichier `api/admin/ai-engine/config/providers/[id]/api-key/route.ts` | Handler `PUT` : recevoir `{apiKey: string}`, chiffrer, stocker. Retourner `{masked: "sk-...xxxx", setAt: "..."}` | 45min |
| T2.2.2 | Meme fichier | Handler `DELETE` : supprimer la cle chiffree. Retourner `{success: true}` | 20min |
| T2.2.3 | Meme fichier | Handler `GET` : retourner `{hasSKey: boolean, masked: string|null, setAt: string|null}` | 20min |
| T2.2.4 | Nouveau fichier `api/admin/ai-engine/config/providers/[id]/api-key/test/route.ts` | Handler `POST` : recevoir `{apiKey?: string}` (si absent, utiliser la cle en base). Tester la connexion. Retourner `{valid: boolean, error?: string, latencyMs: number}` | 45min |
| T2.2.5 | `api/admin/ai-engine/config/providers/route.ts` (GET existant) | Enrichir la reponse provider avec `hasApiKey: boolean`, `apiKeyMasked: string|null`, `apiKeySetAt: string|null` | 30min |
| T2.2.6 | Tous les handlers API Keys | Ajouter audit logging sur chaque operation sensible | 20min |

**Securite** :
- Les cles API ne sont JAMAIS retournees en clair dans les reponses API.
- L'endpoint DELETE necessite une confirmation (header `X-Confirm-Delete: true`).
- Rate limiting : max 10 appels/min sur l'endpoint de test.

---

### Phase 3 -- Composants Frontend (8h estimees)

**Objectif** : Construire les interfaces utilisateur pour les deux features en suivant les design tokens CS v2 (ivory + terracotta).

#### 3.1 Knowledge Edit -- Frontend (4h)

| Tache | Fichier(s) | Detail | Effort |
|-------|-----------|--------|--------|
| T3.1.1 | `knowledge/page.tsx` | Ajouter un bouton "Editer" (icone Pencil) sur chaque ligne de collection (a cote du bouton "Supprimer") | 20min |
| T3.1.2 | `knowledge/page.tsx` | Implementer un formulaire inline d'edition de collection (similaire au formulaire de creation existant) avec pre-remplissage des valeurs actuelles | 60min |
| T3.1.3 | `knowledge/page.tsx` | Ajouter un bouton "Editer" sur chaque ligne de document dans la vue expandee | 20min |
| T3.1.4 | `knowledge/page.tsx` | Implementer un formulaire inline d'edition de document avec champs pre-remplis : titre, contenu, sourceType, sourceUrl | 60min |
| T3.1.5 | `knowledge/page.tsx` | Ajouter les handlers `handleUpdateCollection()` et `handleUpdateDocument()` avec fetch PUT + gestion d'erreur + refresh | 40min |
| T3.1.6 | `knowledge/page.tsx` | Gestion de l'etat `editingColId` et `editingDocId` avec toggle entre mode lecture et mode edition | 20min |

**Composants primitifs utilises** :
- `Button` (variants: primary, ghost, danger)
- `Input` (avec label, placeholder)
- `Badge` (tone: accent, success, warning, etc.)
- Select natif avec style CS v2

**Design UX** :
- L'edition se fait en inline (pas de modale) pour rester coherent avec le pattern existant (creation de collection, ingestion de document).
- Un seul element peut etre en edition a la fois.
- Le bouton "Sauvegarder" est desactive si aucun champ n'a ete modifie.
- Un spinner apparait pendant la sauvegarde.
- Un toast confirme le succes ou affiche l'erreur.

#### 3.2 API Keys Management -- Frontend (4h)

| Tache | Fichier(s) | Detail | Effort |
|-------|-----------|--------|--------|
| T3.2.1 | `config/page.tsx` | Ajouter dans le footer de chaque `ProviderCard` un lien "Gerer la cle API" | 15min |
| T3.2.2 | `config/page.tsx` ou nouveau composant `ApiKeyManager.tsx` | Creer le composant `ApiKeyManager` avec : champ de saisie masque (type password), bouton toggle visibilite, indicateur de statut (configuree/non configuree), bouton test, bouton supprimer | 90min |
| T3.2.3 | `ApiKeyManager.tsx` | Integrer l'appel `PUT /api/admin/ai-engine/config/providers/[id]/api-key` pour definir la cle | 30min |
| T3.2.4 | `ApiKeyManager.tsx` | Integrer l'appel `POST .../api-key/test` pour tester la cle avec affichage du resultat (latence, validite) | 30min |
| T3.2.5 | `ApiKeyManager.tsx` | Integrer l'appel `DELETE .../api-key` avec confirmation dialogue | 20min |
| T3.2.6 | `config/page.tsx` | Modifier le `ProviderCard` pour afficher le statut de la cle (env var vs. base, date de configuration) | 30min |
| T3.2.7 | `config/page.tsx` | Ajouter une section "Securite" dans le header de la page config avec indicateur global (X/Y cles configurees) | 15min |

**Design UX** :
- Le champ de cle API est de type `password` par defaut avec un bouton oeil pour toggle.
- La cle n'est jamais affichee en entier apres sauvegarde (seulement `sk-...xxxx`).
- Le bouton "Tester" lance un spinner avec un resultat en badge (vert = valide, rouge = invalide).
- La suppression de cle requiert un double clic ou un dialogue de confirmation.
- Les cles provenant des env vars sont indiquees comme "Variable d'environnement" avec un badge special.

---

### Phase 4 -- Integration Frontend-Backend (4h estimees)

**Objectif** : Connecter les composants frontend aux routes API et valider le flux de bout en bout.

| Tache | Detail | Effort |
|-------|--------|--------|
| T4.1 | Integration KE : tester le flux complet edition collection (clic Editer -> modification -> sauvegarde -> refresh) | 45min |
| T4.2 | Integration KE : tester le flux complet edition document (expansion -> clic Editer -> modification contenu -> sauvegarde -> re-indexation automatique) | 45min |
| T4.3 | Integration KE : tester les cas d'erreur (slug duplique, contenu trop long, document inexistant) | 30min |
| T4.4 | Integration AKM : tester le flux complet (saisie cle -> sauvegarde -> test -> verification statut provider) | 45min |
| T4.5 | Integration AKM : tester la priorite cle DB vs env var (DB gagne, suppression DB -> fallback env var) | 30min |
| T4.6 | Integration AKM : tester le flux suppression de cle avec confirmation | 20min |
| T4.7 | Validation croisee : s'assurer que la modification d'une cle API n'affecte pas les sessions de generation en cours | 25min |

**Dependances** : Phases 1, 2, 3 completees.

---

### Phase 5 -- Tests (10h estimees)

**Objectif** : Atteindre une couverture de test exhaustive selon la pyramide : unit -> integration -> E2E.

#### 5.1 Tests unitaires -- Vitest (4h)

| Suite | Fichier | Cas de test | Effort |
|-------|---------|-------------|--------|
| TU-KE-01 | `knowledge/collections.test.ts` | `updateCollection()` : mise a jour nom, slug, description, categorie, slug duplique, collection inexistante | 45min |
| TU-KE-02 | `knowledge/documents.test.ts` | `updateDocument()` : mise a jour titre, contenu, sourceType, document inexistant, contenu vide | 45min |
| TU-KE-03 | `knowledge/ingestion.test.ts` | `reindexDocument()` : suppression anciens chunks, re-chunking, re-embedding, gestion erreur embedding | 45min |
| TU-AKM-01 | `security/encryption.test.ts` | `encrypt()` + `decrypt()` bidirectionnel, cles vides, cles longues, caracteres speciaux, IV unique par appel | 30min |
| TU-AKM-02 | `security/encryption.test.ts` | `maskApiKey()` : formats OpenAI (sk-...), Anthropic (sk-ant-...), Google, cle courte (<8 chars) | 15min |
| TU-AKM-03 | `providers/api-key-service.test.ts` | `setApiKey()`, `getApiKey()`, `deleteApiKey()`, `hasApiKey()` avec mock DB | 45min |
| TU-AKM-04 | `providers/api-key-service.test.ts` | `testApiKey()` : succes OpenAI, echec Anthropic, timeout Google, provider inconnu | 30min |
| TU-AKM-05 | `config/engine-config.test.ts` | `getEngineConfigAsync()` : priorite DB > env, fallback si pas de cle DB, reset cache | 30min |

#### 5.2 Tests d'integration -- API Contracts (3h)

| Suite | Fichier | Cas de test | Effort |
|-------|---------|-------------|--------|
| TI-KE-01 | `ai-engine-knowledge-edit.contract.test.ts` | PUT /knowledge/[slug] : succes, validation Zod, slug duplique, 404 | 45min |
| TI-KE-02 | `ai-engine-knowledge-edit.contract.test.ts` | GET /knowledge/[slug] : succes, 404 | 20min |
| TI-KE-03 | `ai-engine-knowledge-edit.contract.test.ts` | PUT /knowledge/[slug]/documents/[docId] : succes, re-indexation declenchee, 404 | 45min |
| TI-AKM-01 | `ai-engine-api-keys.contract.test.ts` | PUT /providers/[id]/api-key : succes, cle chiffree en base, masked retourne | 30min |
| TI-AKM-02 | `ai-engine-api-keys.contract.test.ts` | DELETE /providers/[id]/api-key : succes, sans header confirmation -> 400 | 20min |
| TI-AKM-03 | `ai-engine-api-keys.contract.test.ts` | POST /providers/[id]/api-key/test : cle valide, cle invalide, provider inexistant | 30min |
| TI-AKM-04 | `ai-engine-api-keys.contract.test.ts` | GET /config/providers enrichi avec hasApiKey, apiKeyMasked | 20min |

#### 5.3 Tests E2E -- Playwright (3h)

| Suite | Fichier | Cas de test | Effort |
|-------|---------|-------------|--------|
| TE-KE-01 | `ai-engine-knowledge-edit.spec.ts` | Flux complet : ouvrir Knowledge -> expander collection -> clic Editer -> modifier nom -> sauvegarder -> verifier mise a jour | 45min |
| TE-KE-02 | `ai-engine-knowledge-edit.spec.ts` | Edition document : expander -> editer document -> modifier titre + contenu -> sauvegarder -> verifier re-indexation | 45min |
| TE-KE-03 | `ai-engine-knowledge-edit.spec.ts` | Cas d'erreur : slug duplique -> toast erreur, annulation edition | 20min |
| TE-AKM-01 | `ai-engine-api-keys.spec.ts` | Flux complet : ouvrir Config -> Providers -> "Gerer cle API" -> saisir cle -> sauvegarder -> verifier badge "Configuree" | 45min |
| TE-AKM-02 | `ai-engine-api-keys.spec.ts` | Test de cle : saisir cle -> tester -> verifier resultat (valide/invalide) | 30min |
| TE-AKM-03 | `ai-engine-api-keys.spec.ts` | Suppression de cle : supprimer -> confirmer -> verifier badge "Non configuree" | 15min |

---

### Phase 6 -- Boucle de Correction et Tests de Regression (4h estimees)

**Objectif** : Corriger tous les echecs de tests, verifier les regressions, atteindre la definition de "done".

| Tache | Detail | Effort |
|-------|--------|--------|
| T6.1 | Executer la batterie de tests complete (`pnpm test`, `pnpm e2e`) et collecter les echecs | 30min |
| T6.2 | Classifier les echecs : critiques (blocants) vs mineurs (cosmetiques) | 15min |
| T6.3 | Corriger les echecs critiques par ordre de priorite | 120min |
| T6.4 | Re-executer les tests apres chaque correction pour verifier l'absence de regression | 30min |
| T6.5 | Corriger les echecs mineurs | 30min |
| T6.6 | Execution finale de la batterie complete et verification 0 echec | 15min |

**Critere de sortie** :
- 0 echec sur tous les niveaux de test (unit, integration, E2E)
- Couverture >= 80% sur les nouveaux fichiers
- Pas de regression sur les tests existants (622 unit + 27 E2E)

---

### Phase 7 -- Deploiement et Verification (2h estimees)

| Tache | Detail | Effort |
|-------|--------|--------|
| T7.1 | Revue de code : PR self-review avec checklist securite (pas de cle en clair dans les logs, chiffrement correct, masquage) | 20min |
| T7.2 | Generer et appliquer la migration Drizzle en staging | 15min |
| T7.3 | Definir `AI_ENGINE_ENCRYPTION_KEY` dans les env vars de staging | 5min |
| T7.4 | Deployer sur staging (port 8012) | 15min |
| T7.5 | Smoke tests manuels : edition collection, edition document, ajout/test/suppression cle API | 30min |
| T7.6 | Verifier les logs pour absence de fuite de cles | 10min |
| T7.7 | Documenter les changements dans le changelog | 10min |

---

## 3. Diagramme de dependances entre phases

```
Phase 1 (Backend)
  |
  +-------> Phase 2 (API Routes)
  |              |
  |              +-------> Phase 3 (Frontend)
  |              |              |
  |              |              +-------> Phase 4 (Integration)
  |              |                             |
  |              |                             +-------> Phase 5 (Tests)
  |              |                                            |
  |              |                                            +-------> Phase 6 (Correction)
  |              |                                                           |
  |              |                                                           +-------> Phase 7 (Deploiement)
  |              |
  +--- T1.1.x (KE Backend) et T1.2.x (AKM Backend) peuvent etre paralleles
  |
  +--- T2.1.x (KE API) et T2.2.x (AKM API) peuvent etre paralleles
  |
  +--- T3.1.x (KE Frontend) et T3.2.x (AKM Frontend) peuvent etre paralleles
```

**Parallelisme possible** :
- Au sein de chaque phase, les taches KE et AKM sont independantes et peuvent etre realisees en parallele.
- La Phase 5 peut demarrer partiellement des que la Phase 3 est terminee pour une feature (tests KE pendant que AKM est en Phase 4).

---

## 4. Estimation globale

| Phase | Effort (heures) | Parallelisable |
|-------|-----------------|----------------|
| Phase 1 -- Fondations Backend | 8h | Oui (KE // AKM) |
| Phase 2 -- Routes API | 6h | Oui (KE // AKM) |
| Phase 3 -- Composants Frontend | 8h | Oui (KE // AKM) |
| Phase 4 -- Integration | 4h | Partiellement |
| Phase 5 -- Tests | 10h | Oui (unit // integ // E2E) |
| Phase 6 -- Correction | 4h | Non |
| Phase 7 -- Deploiement | 2h | Non |
| **TOTAL** | **42h** | |

**Avec parallelisme maximal (2 developpeurs)** : ~28h calendaires

**Avec un seul developpeur** : ~42h calendaires (soit ~5.5 jours ouvres)

---

## 5. Evaluation des risques

### Risques eleves

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|-----------|
| Fuite de cle API dans les logs | Faible | Critique | Revue de code obligatoire, filtre de logs, tests de non-fuite |
| Corruption de la base de connaissances lors du re-indexation | Moyenne | Eleve | Transaction DB, backup avant re-indexation, rollback automatique |
| Cle de chiffrement perdue/corrompue | Faible | Critique | Documentation de la rotation de cle, backup de la cle de chiffrement |

### Risques moyens

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|-----------|
| Conflit de slug lors de l'edition de collection | Moyenne | Moyen | Validation unique cote serveur, message d'erreur explicite |
| Latence lors du test de cle API (providers lents) | Moyenne | Faible | Timeout de 10s, indicateur de progression |
| Regression sur les tests existants (622 unit + 27 E2E) | Faible | Moyen | Execution de la suite complete avant merge |

### Risques faibles

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|-----------|
| Incompatibilite de migration Drizzle | Faible | Moyen | Migration testee en dev avant staging |
| UI cassee sur mobile | Moyenne | Faible | Tests responsive avec Playwright viewport mobile |

---

## 6. Criteres Go/No-Go

### Go pour Phase 2 (apres Phase 1)

- [ ] Les fonctions `updateCollection()` et `updateDocument()` sont implementees et testees unitairement
- [ ] Le service de chiffrement est fonctionnel (test bidirectionnel)
- [ ] Le service `api-key-service.ts` est implemente avec mock DB
- [ ] La migration Drizzle genere les bons SQL
- [ ] Pas de regression dans les tests existants

### Go pour Phase 3 (apres Phase 2)

- [ ] Tous les endpoints API repondent correctement (testes avec curl/httpie)
- [ ] Les schemas Zod valident correctement les payloads
- [ ] L'authentification admin fonctionne sur chaque endpoint
- [ ] Le masquage de cle fonctionne (jamais de cle en clair dans la reponse)

### Go pour Phase 4 (apres Phase 3)

- [ ] Les formulaires d'edition collection et document rendent correctement
- [ ] Le composant `ApiKeyManager` rend correctement
- [ ] Pas d'erreur TypeScript en mode strict
- [ ] Les primitives CS v2 (Button, Input, Badge) sont correctement utilisees

### Go pour Phase 7 (apres Phases 5+6)

- [ ] 0 echec sur la totalite des tests (unit + integration + E2E)
- [ ] Couverture >= 80% sur les nouveaux fichiers
- [ ] Pas de regression sur les 622 tests unit et 27 E2E existants
- [ ] Revue de securite validee (pas de fuite de cle)
- [ ] Migration testee en environnement de staging
- [ ] Variables d'environnement documentees

---

## 7. Conventions et standards

### Nommage des fichiers

- Routes API : `apps/web/src/app/api/admin/ai-engine/...`
- Services : `apps/web/src/lib/ai-engine/...`
- Composants : `apps/web/src/components/admin/content-studio-v2/ai-engine/...`
- Tests unitaires : co-localises avec le fichier source (`*.test.ts`)
- Tests integration : `apps/web/src/test/api-contracts/ai-engine-*.contract.test.ts`
- Tests E2E : `apps/web/e2e/content-studio-v2/ai-engine-*.spec.ts`
- MSW handlers : `apps/web/src/test/msw/ai-engine-handlers.ts`

### Style de code

- TypeScript strict mode (pas de `any`, pas de `@ts-ignore`)
- Validation Zod sur tous les inputs API
- Gestion d'erreur via `formatErrorResponse()` / `HttpError`
- Authentification via `requireAdminApi()`
- Logging via `createLogger()`
- Design tokens CS v2 (variables CSS `--cs-*`)

### Commits

- Format : `feat(scope): description` / `fix(scope): description` / `test(scope): description`
- Un commit par tache ou groupe de taches logiquement lies
- Tests dans des commits separes du code fonctionnel

---

## 8. Livrables finaux

1. **Code source** : Toutes les modifications commitees sur `feat/ai-engine-langgraph-mvp`
2. **Tests** : Suite complete passant au vert (nouvelles + existantes)
3. **Migration** : Script SQL de migration Drizzle
4. **Documentation** : Mise a jour des commentaires inline et du present plan
5. **Checklist de deploiement** : Variables d'environnement, migration, verification post-deploiement
