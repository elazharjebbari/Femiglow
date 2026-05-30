# Procedure de Boucle de Correction -- Knowledge Edit + API Keys Management

> **Objectif** : Definir une procedure systematique pour interpreter les resultats de tests, classifier et corriger les echecs, et s'assurer que chaque correction n'introduit pas de regression.
> **Date de reference** : 2026-05-25

---

## 1. Vue d'Ensemble du Processus

```
  [Execution des tests]
         |
         v
  [Collecte des resultats]
         |
         v
  [Classification des echecs]
         |
    +----+----+
    |         |
    v         v
[Critiques] [Mineurs]
    |         |
    v         v
[Correction  [Correction
 prioritaire] secondaire]
    |         |
    v         v
  [Re-test du fichier concerne]
         |
         v
  [Re-test de regression]
         |
    +----+----+
    |         |
    v         v
  [PASSE]  [ECHEC]
    |         |
    v         |
  [Suivant]   +---> [Retour a Classification]
         |
         v
  [Batterie complete]
         |
    +----+----+
    |         |
    v         v
  [0 echec] [Echecs restants]
    |         |
    v         |
  [DONE]      +---> [Nouvelle iteration]
```

---

## 2. Interpretation des Resultats de Tests

### 2.1 Resultats Vitest

#### Format de sortie standard

```
 PASS  apps/web/src/lib/ai-engine/knowledge/collections.test.ts (3 tests)
 FAIL  apps/web/src/lib/ai-engine/security/encryption.test.ts (2 tests | 1 failed)
   x encrypt + decrypt roundtrip pour une cle OpenAI standard
     Error: Expected "sk-test-1234" but received "sk-test-1234\x00"
     at apps/web/src/lib/ai-engine/security/encryption.test.ts:45:20

Test Files  1 failed | 15 passed | 16 total
Tests       1 failed | 59 passed | 60 total
```

#### Comment lire les resultats

| Symbole | Signification | Action |
|---------|--------------|--------|
| `PASS` (vert) | Le fichier de test a reussi | Aucune action |
| `FAIL` (rouge) | Au moins un test a echoue | Analyser le message d'erreur |
| `x` (rouge) | Test specifique en echec | Lire le stack trace |
| `SKIP` (jaune) | Test saute (skip/todo) | Verifier si volontaire |
| `Timed out` | Le test a depasse le timeout | Augmenter le timeout ou optimiser |

#### Messages d'erreur courants

| Message | Cause probable | Solution |
|---------|---------------|----------|
| `Expected X but received Y` | Valeur retournee incorrecte | Corriger la logique metier |
| `TypeError: X is not a function` | Fonction non exportee ou mal importee | Verifier les exports/imports |
| `Cannot find module` | Chemin d'import incorrect | Corriger le chemin d'import |
| `Zod validation error` | Schema Zod incorrect ou payload invalide | Corriger le schema ou le payload de test |
| `ECONNREFUSED` | DB ou serveur non accessible | Verifier les mocks ou la connexion |
| `Timeout` | Operation trop lente | Verifier les mocks async |

### 2.2 Resultats Playwright

#### Format de sortie standard

```
  1 failed
    ai-engine-knowledge-edit.spec.ts:15:5 > doit permettre d editer le nom
  11 passed

  Failures:
    1) ai-engine-knowledge-edit.spec.ts:15:5
       Error: Timed out 5000ms waiting for expect(locator).toBeVisible()
         Locator: getByRole('button', { name: 'Editer' })
         at /var/www/femiglow-staging/apps/web/e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts:25:30
```

#### Comment lire les resultats

| Indicateur | Signification | Action |
|------------|--------------|--------|
| `X failed` | Nombre de tests E2E echoues | Analyser chaque echec |
| `Timeout waiting for` | Element UI non trouve ou non visible | Verifier le selecteur ou la presence de l'element |
| `strict mode violation` | Plusieurs elements correspondent au selecteur | Affiner le selecteur |
| `Navigation failed` | La page n'a pas pu charger | Verifier le serveur dev |
| `Target closed` | Le navigateur s'est ferme | Bug de teardown ou crash |

#### Outils de debug Playwright

```bash
# Re-executer avec trace complete
pnpm exec playwright test ai-engine-knowledge-edit.spec.ts --trace on

# Visualiser la trace
pnpm exec playwright show-trace test-results/*/trace.zip

# Mode headed (voir le navigateur)
pnpm exec playwright test ai-engine-knowledge-edit.spec.ts --headed

# Mode debug interactif
pnpm exec playwright test ai-engine-knowledge-edit.spec.ts --debug

# Screenshot a l'echec (active par defaut dans playwright.config.ts)
# Les screenshots sont dans test-results/
ls test-results/
```

---

## 3. Classification des Echecs

### 3.1 Matrice de Classification

| Categorie | Criteres | Exemples | Priorite |
|-----------|---------|----------|----------|
| **CRITIQUE** | Bloque une fonctionnalite complete, faille de securite, perte de donnees | Echec du chiffrement, cle API en clair dans la reponse, crash de l'API, corruption de donnees | P0 -- Corriger immediatement |
| **ELEVE** | Fonctionnalite partiellement cassee, regression sur l'existant | Formulaire d'edition ne sauvegarde pas, bouton Editer absent, re-indexation echoue | P1 -- Corriger avant merge |
| **MOYEN** | Comportement incorrect mais non bloquant | Message d'erreur incorrect, timestamp non mis a jour, masquage incomplet | P2 -- Corriger dans l'iteration |
| **FAIBLE** | Cosmetique, documentation, tests instables (flaky) | Style CSS leger, test E2E instable du au timing, warning TypeScript | P3 -- Corriger si temps disponible |

### 3.2 Procedure de Classification

Pour chaque echec, repondre aux questions suivantes :

```
1. Est-ce une faille de securite ?
   OUI -> CRITIQUE (P0)
   NON -> Question 2

2. Est-ce que l'echec bloque une fonctionnalite entiere ?
   OUI -> CRITIQUE (P0)
   NON -> Question 3

3. Est-ce une regression sur un test existant ?
   OUI -> ELEVE (P1)
   NON -> Question 4

4. Est-ce que la fonctionnalite est partiellement cassee ?
   OUI -> ELEVE (P1)
   NON -> Question 5

5. Est-ce que l'echec impacte l'experience utilisateur ?
   OUI -> MOYEN (P2)
   NON -> Question 6

6. Est-ce un probleme purement cosmetique ou de style ?
   OUI -> FAIBLE (P3)
   NON -> MOYEN (P2)
```

### 3.3 Grille de Priorite de Correction

```
+------------------+-------------------+-------------------+
|                  | Impact Eleve      | Impact Faible     |
+------------------+-------------------+-------------------+
| Effort Faible    | Corriger en       | Corriger en       |
| (< 15 min)       | PREMIER (P0/P1)   | TROISIEME (P2)    |
+------------------+-------------------+-------------------+
| Effort Eleve     | Corriger en       | Corriger en       |
| (> 30 min)       | DEUXIEME (P1)     | DERNIER (P3)      |
+------------------+-------------------+-------------------+
```

---

## 4. Procedure de Correction

### 4.1 Workflow de Correction

```bash
# Etape 1 : Identifier l'echec
# Lire le message d'erreur complet
# Identifier le fichier source et la ligne

# Etape 2 : Reproduire l'echec en isolation
pnpm exec vitest run <fichier_test> --reporter=verbose

# Etape 3 : Analyser la cause
# - Ouvrir le fichier source
# - Ouvrir le fichier de test
# - Comparer l'attendu vs le reel
# - Verifier les mocks

# Etape 4 : Corriger
# - Modifier le fichier source (pas le test, sauf si le test est incorrect)
# - Verifier la compilation TypeScript
pnpm exec tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "error" | head -5

# Etape 5 : Re-tester le fichier concerne
pnpm exec vitest run <fichier_test> --reporter=verbose

# Etape 6 : Verification de non-regression
pnpm exec vitest run --reporter=verbose 2>&1 | tail -5
```

### 4.2 Correction par categorie d'echec

#### 4.2.1 Echecs de logique metier

**Symptome** : `Expected X but received Y`

**Procedure** :
1. Identifier la fonction testee
2. Ajouter un `console.log` temporaire pour tracer les valeurs intermediaires
3. Corriger la logique
4. Supprimer le `console.log`
5. Re-tester

```bash
# Exemple : updateCollection retourne l'ancien nom
# 1. Ouvrir collections.ts
# 2. Verifier que .set() inclut bien le nouveau nom
# 3. Verifier que .returning() est appele
# 4. Corriger et re-tester
pnpm exec vitest run apps/web/src/lib/ai-engine/knowledge/collections.test.ts -t "doit mettre a jour le nom"
```

#### 4.2.2 Echecs de validation Zod

**Symptome** : `Zod validation error: ...`

**Procedure** :
1. Verifier le schema Zod dans la route API
2. Verifier le payload envoye dans le test
3. Corriger le schema ou le payload
4. Re-tester

```bash
# Exemple : le schema rejette un slug valide
# Verifier la regex du slug
grep -n "slug.*regex\|slug.*pattern" apps/web/src/app/api/admin/ai-engine/knowledge/*/route.ts
```

#### 4.2.3 Echecs de chiffrement/securite

**Symptome** : `decrypt failed` ou `Authentication tag mismatch`

**Procedure** :
1. Verifier que `AI_ENGINE_ENCRYPTION_KEY` est bien defini dans l'environnement de test
2. Verifier que la cle est bien de 32 bytes (base64 de ~44 chars)
3. Verifier que le format du ciphertext est correct (iv:ciphertext:authTag)
4. Re-tester avec un plaintext simple

```bash
# Debug du chiffrement
node -e "
const key = process.env.AI_ENGINE_ENCRYPTION_KEY;
console.log('Key defined:', !!key);
console.log('Key length:', key ? Buffer.from(key, 'base64').length : 0, 'bytes');
"
```

#### 4.2.4 Echecs E2E (selecteur introuvable)

**Symptome** : `Timeout waiting for expect(locator).toBeVisible()`

**Procedure** :
1. Verifier que l'element existe dans le DOM rendu
2. Verifier le selecteur (role, name, testid)
3. Ajouter un `await page.pause()` pour debugger
4. Verifier si l'element est cache derriere un scroll ou un overlay

```bash
# Debug E2E
pnpm exec playwright test ai-engine-knowledge-edit.spec.ts --debug
# -> Le debugger s'arrete avant chaque action
# -> Inspecter le DOM pour trouver l'element
```

#### 4.2.5 Echecs de regression

**Symptome** : Un test qui passait avant echoue maintenant

**Procedure** :
1. Identifier le commit qui a introduit la regression
2. Comparer le diff avec le fichier avant modification
3. Verifier si le test depend d'un comportement qui a change
4. Corriger sans casser la nouvelle fonctionnalite

```bash
# Trouver le commit fautif
git bisect start
git bisect bad HEAD
git bisect good <commit_avant_modifications>
# Puis tester a chaque etape
pnpm exec vitest run <fichier_en_regression>
```

---

## 5. Procedure de Re-test

### 5.1 Re-test apres correction unitaire

```bash
# 1. Re-tester le fichier concerne
pnpm exec vitest run <fichier_corrige.test.ts> --reporter=verbose
# Attendu : 0 echec

# 2. Re-tester les fichiers dependants
# Identifier les fichiers qui importent le module corrige
grep -rn "from.*<module_corrige>" apps/web/src/ | grep -v node_modules | head -10
# Tester chaque fichier dependant
pnpm exec vitest run <fichier_dependant.test.ts>

# 3. Re-tester la suite complete du module
pnpm exec vitest run apps/web/src/lib/ai-engine/ --reporter=verbose
```

### 5.2 Re-test apres correction d'integration

```bash
# 1. Re-tester le contrat API concerne
pnpm exec vitest run apps/web/src/test/api-contracts/<contrat_concerne>.contract.test.ts

# 2. Re-tester tous les contrats AI Engine
pnpm exec vitest run apps/web/src/test/api-contracts/ai-engine-*.contract.test.ts

# 3. Re-tester les tests E2E lies
pnpm exec playwright test e2e/content-studio-v2/ai-engine-knowledge*.spec.ts
pnpm exec playwright test e2e/content-studio-v2/ai-engine-api-keys*.spec.ts
```

### 5.3 Re-test de regression complet

```bash
# OBLIGATOIRE apres chaque correction critique
echo "=== Re-test de regression complet ==="

# 1. Tests unitaires complets
pnpm exec vitest run 2>&1 | tail -5
UNIT_OK=$?

# 2. Tests E2E complets
pnpm exec playwright test 2>&1 | tail -5
E2E_OK=$?

# 3. Verdict
if [ $UNIT_OK -eq 0 ] && [ $E2E_OK -eq 0 ]; then
  echo "REGRESSION : AUCUNE - Correction validee"
else
  echo "REGRESSION DETECTEE - Analyser les echecs"
fi
```

---

## 6. Verification de Non-Regression apres Chaque Correction

### 6.1 Tests a executer systematiquement

Apres chaque correction, les suites suivantes doivent etre executees :

```bash
# Suite minimale de regression (< 30 secondes)
pnpm exec vitest run \
  apps/web/src/test/api-contracts/ai-engine-knowledge.contract.test.ts \
  apps/web/src/test/api-contracts/ai-engine-config.contract.test.ts \
  apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/ \
  apps/web/src/app/admin/content-studio-v2/ai-engine/config/__tests__/ \
  --reporter=verbose
```

### 6.2 Matrice de regression par fichier modifie

| Fichier modifie | Tests a re-executer |
|----------------|-------------------|
| `schema-ai-engine.ts` | TOUS les tests AI Engine |
| `knowledge/collections.ts` | collections.test.ts + knowledge.contract.test.ts + knowledge-edit.contract.test.ts + knowledge-page.test.tsx |
| `knowledge/documents.ts` | documents.test.ts + knowledge-edit.contract.test.ts + knowledge-page.test.tsx |
| `knowledge/ingestion.ts` | ingestion.test.ts + knowledge-edit.contract.test.ts |
| `security/encryption.ts` | encryption.test.ts + api-key-service.test.ts + api-keys.contract.test.ts |
| `providers/api-key-service.ts` | api-key-service.test.ts + api-keys.contract.test.ts + config-page.test.tsx |
| `config/engine-config.ts` | engine-config.test.ts + TOUS les tests qui utilisent getEngineConfig |
| `knowledge/page.tsx` | knowledge-page.test.tsx + knowledge-edit E2E |
| `config/page.tsx` | config-page.test.tsx + api-keys E2E |
| `[slug]/route.ts` | knowledge.contract.test.ts + knowledge-edit.contract.test.ts |
| `[id]/api-key/route.ts` | api-keys.contract.test.ts |

---

## 7. Definition de "Done"

### 7.1 Criteres de "Done" pour Knowledge Edit

- [ ] **Fonctionnel** : L'utilisateur admin peut editer le nom, slug, description et categorie d'une collection
- [ ] **Fonctionnel** : L'utilisateur admin peut editer le titre et le contenu d'un document
- [ ] **Fonctionnel** : La modification du contenu d'un document declenche automatiquement la re-indexation (re-chunking + re-embedding)
- [ ] **Fonctionnel** : Les messages de succes et d'erreur sont affiches correctement
- [ ] **Fonctionnel** : L'edition d'un slug verifie l'unicite et affiche une erreur en cas de doublon
- [ ] **API** : Les routes GET et PUT pour collections et documents sont implementees et securisees
- [ ] **API** : La validation Zod rejette les payloads invalides avec des messages clairs
- [ ] **UI** : Le formulaire inline d'edition est coherent avec le style existant (creation)
- [ ] **UI** : Un seul element est en edition a la fois
- [ ] **UI** : Les spinners de chargement sont affiches pendant les operations
- [ ] **Tests** : >= 85% de couverture sur les services
- [ ] **Tests** : >= 80% de couverture sur les routes API
- [ ] **Tests** : >= 3 tests E2E couvrant les flux critiques
- [ ] **Tests** : 0 regression sur les tests existants
- [ ] **Securite** : Les inputs sont valides et echappes
- [ ] **Accessibilite** : Navigation clavier fonctionnelle

### 7.2 Criteres de "Done" pour API Keys Management

- [ ] **Fonctionnel** : L'utilisateur admin peut saisir et sauvegarder une cle API pour chaque provider
- [ ] **Fonctionnel** : La cle est chiffree avant stockage en base (AES-256-GCM)
- [ ] **Fonctionnel** : La cle n'est JAMAIS retournee en clair dans les reponses API
- [ ] **Fonctionnel** : La cle est masquee dans l'UI (sk-...xxxx)
- [ ] **Fonctionnel** : L'utilisateur peut tester la validite d'une cle
- [ ] **Fonctionnel** : L'utilisateur peut supprimer une cle (avec confirmation)
- [ ] **Fonctionnel** : Les cles en base ont priorite sur les env vars
- [ ] **Fonctionnel** : La suppression d'une cle DB fait fallback sur l'env var
- [ ] **API** : Les routes GET, PUT, DELETE, POST (test) sont implementees et securisees
- [ ] **API** : La reponse GET /providers inclut hasApiKey, apiKeyMasked, apiKeySetAt
- [ ] **UI** : Le champ de cle est de type password avec toggle visibilite
- [ ] **UI** : Le resultat du test est affiche (badge vert/rouge + latence)
- [ ] **UI** : La source de la cle est indiquee (env var / base)
- [ ] **Tests** : >= 95% de couverture sur le service de chiffrement
- [ ] **Tests** : >= 85% de couverture sur le service de gestion des cles
- [ ] **Tests** : >= 3 tests E2E couvrant les flux critiques
- [ ] **Tests** : 0 regression sur les tests existants
- [ ] **Securite** : Audit log de chaque modification de cle
- [ ] **Securite** : Rate limiting sur l'endpoint de test
- [ ] **Securite** : Confirmation requise pour la suppression
- [ ] **Accessibilite** : Labels ARIA sur le champ de cle et le toggle

### 7.3 Criteres de "Done" globaux

- [ ] **Tests** : 0 echec sur TOUS les tests (unitaires + integration + E2E)
- [ ] **Tests** : Nombre total de tests superieur a la baseline (622 unit + 27 E2E)
- [ ] **Code** : TypeScript compile en mode strict sans erreur
- [ ] **Code** : ESLint passe sans erreur
- [ ] **Code** : Pas de `any` dans le nouveau code
- [ ] **Code** : Pas de `@ts-ignore` dans le nouveau code
- [ ] **Code** : Tous les imports utilisent les alias (`@/lib/...`)
- [ ] **Migration** : La migration Drizzle est generee et testee
- [ ] **Docs** : Les commentaires inline sont a jour
- [ ] **Securite** : Revue de securite validee

---

## 8. Checklist de Sign-off

### 8.1 Sign-off par le developpeur

```
Date : ___________
Developpeur : ___________

Tests unitaires :
  [ ] Nombre total : _____ (baseline: 622)
  [ ] Echecs : _____ (cible: 0)
  [ ] Couverture nouveaux fichiers : _____ % (cible: >= 80%)

Tests E2E :
  [ ] Nombre total : _____ (baseline: 27)
  [ ] Echecs : _____ (cible: 0)

Securite :
  [ ] Revue des logs : aucune cle en clair
  [ ] Revue du code : pas de fuite de donnees sensibles
  [ ] Chiffrement teste : roundtrip OK
  [ ] Masquage teste : aucune cle visible

Fonctionnel :
  [ ] Edition collection : teste manuellement
  [ ] Edition document : teste manuellement
  [ ] Re-indexation : testee manuellement
  [ ] Ajout cle API : teste manuellement
  [ ] Test cle API : teste manuellement
  [ ] Suppression cle API : testee manuellement
  [ ] Fallback env var : teste manuellement

Regression :
  [ ] Tests existants : 0 regression
  [ ] Pages UI existantes : pas de changement visuel non voulu

Signature : ___________
```

### 8.2 Sign-off pour merge

```
Date : ___________
Revieweur : ___________

Code review :
  [ ] Architecture coherente avec l'existant
  [ ] Nommage des fichiers respecte les conventions
  [ ] Pas de code mort ou commente
  [ ] Gestion d'erreur complete
  [ ] TypeScript strict, pas de any

Tests review :
  [ ] Cas nominaux couverts
  [ ] Cas d'erreur couverts
  [ ] Cas limites couverts
  [ ] Mocks realistes

Securite review :
  [ ] Pas de secret en dur
  [ ] Chiffrement correct (AES-256-GCM)
  [ ] Masquage correct
  [ ] Authentification sur tous les endpoints
  [ ] Validation des entrees

Signature : ___________
Decision : [ ] MERGE / [ ] REVISIONS NECESSAIRES
```

---

## 9. Scenarios de Correction Frequents

### 9.1 Scenario : Test E2E instable (flaky)

**Symptome** : Le test passe parfois et echoue parfois.

**Cause probable** : Timing/race condition, animation CSS, chargement async.

**Solution** :
```typescript
// Avant (instable) :
await page.click('[data-testid="edit-btn"]');
expect(page.locator('[data-testid="edit-form"]')).toBeVisible();

// Apres (stable) :
await page.click('[data-testid="edit-btn"]');
await expect(page.locator('[data-testid="edit-form"]')).toBeVisible({ timeout: 5000 });
```

### 9.2 Scenario : Mock MSW qui ne match pas

**Symptome** : `Error: [MSW] Found an unhandled request: PUT /api/admin/ai-engine/knowledge/neuromarketing`

**Cause probable** : Le handler MSW n'est pas enregistre pour la methode PUT.

**Solution** : Ajouter le handler dans `ai-engine-handlers.ts` et le registrer dans `server.ts`.

### 9.3 Scenario : TypeScript erreur apres ajout de champ au schema

**Symptome** : `Property 'updatedAt' does not exist on type '...'`

**Cause probable** : Le type infere par Drizzle n'inclut pas le nouveau champ.

**Solution** : Relancer `pnpm exec tsc --noEmit` apres modification du schema. Si le probleme persiste, verifier que le fichier est bien sauvegarde et que le cache TypeScript est nettoye.

### 9.4 Scenario : Echec de chiffrement en CI/CD

**Symptome** : `Error: AI_ENGINE_ENCRYPTION_KEY is not defined`

**Cause probable** : La variable d'environnement n'est pas definie dans l'environnement de test.

**Solution** : Ajouter une cle de test dans le setup Vitest :
```typescript
// vitest.setup.ts
process.env.AI_ENGINE_ENCRYPTION_KEY = Buffer.from('test-key-32-bytes-exactly-here!!').toString('base64');
```
