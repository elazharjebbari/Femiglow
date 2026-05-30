# Plan de Test - Gestion des Cles API

> Module : 170 - API Keys Management
> Classification : CONFIDENTIEL (contient des specifications de tests de securite)
> Date : 2026-05-25
> Stack : Vitest 2.1.x + jsdom, Playwright 1.48, MSW 2.x, Node.js crypto

---

## 1. Strategie de test

### 1.1 Approche pyramidale renforcee securite

```
                    +-------------------+
                    |   Penetration     |   <-- Manuel + scripts
                    |   Tests (5%)      |
                    +-------------------+
                  +------------------------+
                  |  Tests de securite     |   <-- Vitest + scripts
                  |  dedies (10%)         |
                  +------------------------+
                +--------------------------+
                |   Tests E2E              |   <-- Playwright 1.48
                |   (15%)                  |
                +--------------------------+
              +----------------------------+
              |   Tests d'integration      |   <-- Vitest + MSW 2.x
              |   (25%)                    |
              +----------------------------+
            +------------------------------+
            |   Tests unitaires            |   <-- Vitest 2.1.x + jsdom
            |   (45%)                      |
            +------------------------------+
```

### 1.2 Principes directeurs

1. **La securite est un critere bloquant** : aucune PR n'est mergee si un test de securite echoue
2. **Les cles de test ne sont jamais reelles** : utilisation exclusive de cles fictives prefixees `test-`
3. **Chaque couche valide la non-fuite** : a chaque niveau, verifier que les cles ne sortent jamais en clair
4. **Couverture asymetrique** : les modules de securite (encryption, masquage) ont un objectif de couverture plus eleve
5. **Tests deterministes** : pas de dependance aux services externes (MSW pour les appels API)
6. **Isolation complete** : chaque suite de tests reinitialise les singletons et le state

---

## 2. Objectifs de couverture

### 2.1 Couverture par module

| Module | Fichier | Objectif couverture | Justification |
|--------|---------|---------------------|---------------|
| EncryptionService | `encryption-service.ts` | >= 95% | Module critique de securite |
| Fonction mask() | `encryption-service.ts` | 100% | Toutes les branches de masquage |
| ApiKeyManager | `api-key-manager.ts` | >= 90% | CRUD + resolution + cache |
| ApiKeyValidator | `api-key-validator.ts` | >= 85% | Test de connectivite (mocke) |
| Route GET api-keys | `api-keys/route.ts` | >= 90% | Liste masquee |
| Route POST api-keys | `api-keys/route.ts` | >= 90% | Creation + chiffrement |
| Route DELETE api-keys | `[id]/route.ts` | >= 85% | Suppression + fallback |
| Route POST test | `test/route.ts` | >= 85% | Validation + rate limit |
| ApiKeyCard | Inline `page.tsx` | >= 80% | Composant presentationnel |
| ApiKeyForm | Inline `page.tsx` | >= 85% | Formulaire securise |
| ApiKeyStatusIndicator | Inline `page.tsx` | >= 80% | Composant presentationnel |
| KeyMaskDisplay | Inline `page.tsx` | >= 80% | Composant presentationnel |

### 2.2 Couverture globale

| Metrique | Objectif |
|----------|----------|
| Statements | >= 88% |
| Branches | >= 85% |
| Functions | >= 90% |
| Lines | >= 88% |

### 2.3 Seuils bloquants (fail CI)

```typescript
// vitest.config.ts (extrait)
coverage: {
  thresholds: {
    'apps/web/src/lib/ai-engine/services/encryption-service.ts': {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
    'apps/web/src/lib/ai-engine/services/api-key-manager.ts': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
    'apps/web/src/app/api/admin/ai-engine/config/api-keys/**': {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
  },
},
```

---

## 3. Categories de tests de securite

### 3.1 Chiffrement - Correctness Tests

| ID | Test | Priorite | Description |
|----|------|----------|-------------|
| SEC-ENC-01 | Round-trip encrypt/decrypt | CRITIQUE | `decrypt(encrypt(X)) === X` pour toutes les cles de test |
| SEC-ENC-02 | IV unicite | CRITIQUE | Deux chiffrements du meme plaintext produisent des ciphertexts differents |
| SEC-ENC-03 | Detection de falsification | CRITIQUE | Modifier 1 bit du ciphertext fait echouer le dechiffrement |
| SEC-ENC-04 | AuthTag verification | CRITIQUE | Modifier l'authTag fait echouer le dechiffrement |
| SEC-ENC-05 | Cle derivee differente | ELEVE | Dechiffrer avec une autre cle master echoue avec erreur claire |
| SEC-ENC-06 | Salt different | ELEVE | Dechiffrer avec un salt different echoue |
| SEC-ENC-07 | Format de stockage | MOYEN | Le format est bien `base64:base64:base64` avec separateur `:` |
| SEC-ENC-08 | Taille IV correcte | MOYEN | L'IV genere fait exactement 12 octets (96 bits) |
| SEC-ENC-09 | Taille AuthTag correcte | MOYEN | L'AuthTag fait exactement 16 octets (128 bits) |
| SEC-ENC-10 | Service indisponible | ELEVE | Encryption echoue proprement si cle master absente |

### 3.2 Non-fuite de cles (Key Never Leaked Tests)

| ID | Test | Priorite | Description |
|----|------|----------|-------------|
| SEC-LEAK-01 | Reponse GET masquee | CRITIQUE | La reponse de GET /api-keys ne contient jamais de cle en clair |
| SEC-LEAK-02 | Reponse POST masquee | CRITIQUE | La reponse de POST /api-keys ne contient que la cle masquee |
| SEC-LEAK-03 | Reponse DELETE propre | ELEVE | La reponse de DELETE ne contient pas de cle |
| SEC-LEAK-04 | Audit log propre | CRITIQUE | L'audit log ne contient jamais `encryptedKey` ni `apiKey` en clair |
| SEC-LEAK-05 | Console.log propre | ELEVE | Aucun `console.log` ne contient de cle en clair |
| SEC-LEAK-06 | Erreur propre | ELEVE | Les messages d'erreur ne contiennent jamais de cle |
| SEC-LEAK-07 | State React propre | ELEVE | Le state parent ne contient jamais de cle en clair |
| SEC-LEAK-08 | DOM propre | CRITIQUE | Le DOM ne contient jamais de cle en clair (sauf input password actif) |
| SEC-LEAK-09 | Network tab propre | ELEVE | Les reponses HTTP interceptees ne contiennent pas de cle |
| SEC-LEAK-10 | Serialisation JSON propre | MOYEN | `JSON.stringify(response)` ne contient pas de pattern de cle |

### 3.3 Authentification et autorisation

| ID | Test | Priorite | Description |
|----|------|----------|-------------|
| SEC-AUTH-01 | GET sans session | CRITIQUE | Retourne 401 sans cookie de session |
| SEC-AUTH-02 | POST sans session | CRITIQUE | Retourne 401 sans cookie de session |
| SEC-AUTH-03 | DELETE sans session | CRITIQUE | Retourne 401 sans cookie de session |
| SEC-AUTH-04 | POST test sans session | CRITIQUE | Retourne 401 sans cookie de session |
| SEC-AUTH-05 | Session expiree | ELEVE | Retourne 401 avec un cookie de session expire |
| SEC-AUTH-06 | Session invalide | ELEVE | Retourne 401 avec un cookie invalide/corrompu |

### 3.4 Prevention XSS

| ID | Test | Priorite | Description |
|----|------|----------|-------------|
| SEC-XSS-01 | Nom de label malicieux | ELEVE | Un label contenant `<script>alert('xss')</script>` est echappe |
| SEC-XSS-02 | Cle masquee malicieuse | MOYEN | Un maskedKey contenant du HTML est echappe dans le rendu |
| SEC-XSS-03 | Message d'erreur propre | MOYEN | Les erreurs du serveur sont affichees en texte, pas en HTML |

### 3.5 Prevention CSRF et injection

| ID | Test | Priorite | Description |
|----|------|----------|-------------|
| SEC-CSRF-01 | SameSite cookie | MOYEN | Verifier que le cookie de session a l'attribut SameSite |
| SEC-INJ-01 | Injection SQL via providerType | ELEVE | Envoyer `'; DROP TABLE--` comme providerType -> rejet Zod |
| SEC-INJ-02 | Injection SQL via label | ELEVE | Envoyer `'; DROP TABLE--` comme label -> echappe par Drizzle |
| SEC-INJ-03 | Injection via apiKey | MOYEN | La cle est chiffree avant stockage, pas d'injection possible |

### 3.6 Rate limiting

| ID | Test | Priorite | Description |
|----|------|----------|-------------|
| SEC-RATE-01 | 5 requetes OK | ELEVE | 5 requetes POST /test dans la meme minute passent |
| SEC-RATE-02 | 6e requete rejetee | ELEVE | La 6e requete retourne 429 |
| SEC-RATE-03 | Reset apres 1 minute | MOYEN | Apres 1 minute, les requetes passent a nouveau |
| SEC-RATE-04 | Rate limit par session | MOYEN | Deux sessions differentes ont des limites independantes |

---

## 4. Gestion des donnees de test

### 4.1 Cles de test

**REGLE ABSOLUE : jamais de cle API reelle dans le code de test.**

```typescript
// test/fixtures/api-keys.ts
export const TEST_KEYS = {
  openai: {
    valid: 'sk-proj-test-abcdef123456789ABCDEFGHIJKLMNOP',
    invalid: 'sk-proj-test-invalid-key-00000000000000',
    short: 'sk-test',
    empty: '',
    withSpecialChars: 'sk-proj-test-abc!@#$%^&*()_+=-[]{}',
  },
  anthropic: {
    valid: 'sk-ant-api03-test-xyz789abc123def456ghi789jkl',
    invalid: 'sk-ant-api03-test-invalid-0000000000000',
  },
  google: {
    valid: 'AIzaSyD-test-abcdefghijk1234567890-TEST',
    invalid: 'AIzaSyD-test-invalid-000000000000-FAIL',
  },
  elevenlabs: {
    valid: 'test-el-abcdefghijk123456789-VALID',
    invalid: 'test-el-invalid-000000000000-FAIL',
  },
  ollama: {
    valid: 'http://localhost:11434',
    invalid: 'http://nonexistent-host:99999',
  },
} as const;

export const TEST_ENCRYPTION = {
  masterKey: 'test-master-key-for-unit-tests-only-32chars!',
  salt: 'test-salt-16chars!',
  wrongKey: 'wrong-master-key-for-unit-tests-32chars!',
  wrongSalt: 'wrong-salt-16ch!',
} as const;
```

### 4.2 Conventions de nommage

- Toutes les cles de test contiennent le prefixe `test-` apres le prefixe du fournisseur
- Les cles invalides contiennent `invalid` ou `0000`
- Les variables d'environnement de test utilisent le prefixe `TEST_`

### 4.3 Isolation des tests

```typescript
// beforeEach pattern pour les tests de services
beforeEach(() => {
  // Reset des singletons
  resetEncryptionService();
  resetApiKeyManager();

  // Reset des variables d'environnement de test
  process.env.AI_ENGINE_ENCRYPTION_KEY = TEST_ENCRYPTION.masterKey;
  process.env.AI_ENGINE_ENCRYPTION_SALT = TEST_ENCRYPTION.salt;

  // Reset du cache
  vi.restoreAllMocks();
});

afterEach(() => {
  // Nettoyage securise
  delete process.env.AI_ENGINE_ENCRYPTION_KEY;
  delete process.env.AI_ENGINE_ENCRYPTION_SALT;
  resetEncryptionService();
  resetApiKeyManager();
});
```

### 4.4 Base de donnees de test

Les tests d'integration utilisent une base PostgreSQL dediee (ou sqlite en memoire pour les tests unitaires) :

```typescript
// test/setup-db.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

export async function setupTestDb() {
  const testDb = drizzle(process.env.TEST_DATABASE_URL!);
  await migrate(testDb, { migrationsFolder: './drizzle' });
  return testDb;
}

export async function cleanupTestDb(db: ReturnType<typeof drizzle>) {
  await db.delete(aiEngineApiKeys);
  await db.delete(aiEngineAuditLog);
}
```

---

## 5. Priorites de test (Risk-Based Testing)

### 5.1 Matrice risque / couverture

| Risque | Impact | Prob. | Priorite test | Couverture min |
|--------|--------|-------|---------------|----------------|
| Fuite de cle API en clair | Critique | Moyen | P0 - Bloquant | 100% des chemins |
| Chiffrement defaillant | Critique | Faible | P0 - Bloquant | 95% |
| Acces non authentifie | Critique | Moyen | P0 - Bloquant | 100% des routes |
| Injection SQL | Eleve | Faible | P1 - Eleve | 90% |
| XSS dans les labels | Moyen | Moyen | P1 - Eleve | 85% |
| Rate limit contourne | Moyen | Moyen | P1 - Eleve | 85% |
| Perte de donnees (delete) | Eleve | Faible | P2 - Moyen | 90% |
| Erreur de masquage | Moyen | Faible | P2 - Moyen | 100% des prefixes |
| Cache perime | Faible | Moyen | P3 - Faible | 80% |
| UI degradee | Faible | Moyen | P3 - Faible | 80% |

### 5.2 Ordre d'execution recommande

```
Phase 1 (P0) : Tests de securite critiques
  1. EncryptionService - round-trip, IV, tamper
  2. Non-fuite dans les reponses API
  3. Authentification sur toutes les routes

Phase 2 (P1) : Tests de securite eleves
  4. ApiKeyManager - CRUD complet
  5. Rate limiting
  6. Prevention injection / XSS

Phase 3 (P2) : Tests fonctionnels
  7. Routes API - scenarios nominaux
  8. Composants UI - rendu et interactions
  9. Chaine de resolution DB > env

Phase 4 (P3) : Tests de robustesse
  10. Gestion des erreurs
  11. Cache et performance
  12. Etats limites (cle vide, tres longue, caracteres speciaux)

Phase 5 : Tests E2E
  13. Flux CRUD complets
  14. Scenarios de securite en navigateur

Phase 6 : Tests de penetration (manuel)
  15. Revue des reponses HTTP brutes
  16. Inspection du DOM
  17. Analyse du trafic reseau
```

---

## 6. Environnement de test

### 6.1 Configuration Vitest

```typescript
// vitest.config.ts (extrait pour le module API Keys)
{
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'apps/web/src/lib/ai-engine/services/encryption-service.ts',
        'apps/web/src/lib/ai-engine/services/api-key-manager.ts',
        'apps/web/src/lib/ai-engine/services/api-key-validator.ts',
        'apps/web/src/app/api/admin/ai-engine/config/api-keys/**/*.ts',
      ],
    },
  },
}
```

### 6.2 Configuration Playwright

```typescript
// playwright.config.ts (extrait)
{
  projects: [
    {
      name: 'api-keys-chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /api-keys.*\.spec\.ts/,
    },
    {
      name: 'api-keys-mobile',
      use: { ...devices['iPhone 13'] },
      testMatch: /api-keys.*\.spec\.ts/,
    },
  ],
}
```

### 6.3 Variables d'environnement de test

```env
# .env.test
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/femiglow_test
AI_ENGINE_ENCRYPTION_KEY=test-master-key-for-unit-tests-only-32chars!
AI_ENGINE_ENCRYPTION_SALT=test-salt-16chars!
```

---

## 7. Metriques de qualite

### 7.1 Criteres de completion

| Critere | Seuil | Mesure |
|---------|-------|--------|
| Tests unitaires passes | 100% | `vitest run` exit code 0 |
| Tests E2E passes | 100% | `playwright test` exit code 0 |
| Couverture globale | >= 88% | Vitest coverage report |
| Couverture encryption | >= 95% | Vitest coverage report |
| Zero fuite de cle | 0 match | Grep dans les reponses serialisees |
| Tests de securite | 100% passes | Suite dediee `security.test.ts` |
| Temps d'execution unitaires | < 30s | CI timing |
| Temps d'execution E2E | < 120s | CI timing |

### 7.2 Rapport de test

Le rapport de test inclut :
- Nombre de tests par categorie (unit, integration, E2E, security)
- Couverture par fichier avec seuils de couleur
- Liste des tests de securite avec statut PASS/FAIL
- Temps d'execution total
- Nombre de cles de test utilisees (verification qu'aucune cle reelle n'est presente)

---

## 8. Revue de securite pre-merge

### 8.1 Checklist automatisee (CI)

- [ ] Aucune cle API reelle dans le code source (grep patterns connus)
- [ ] Tous les tests de securite (SEC-*) passent
- [ ] Couverture >= 95% sur `encryption-service.ts`
- [ ] Couverture >= 85% sur les routes API
- [ ] Aucun `console.log` contenant des cles dans le code de production
- [ ] Aucun `encryptedKey` dans les serialisations de reponse

### 8.2 Revue manuelle (PR review)

- [ ] Les tests de round-trip couvrent tous les fournisseurs
- [ ] Les tests de masquage couvrent tous les prefixes connus
- [ ] Les tests d'authentification couvrent toutes les routes
- [ ] Les tests E2E verifient que le DOM ne contient pas de cle
- [ ] Le code de nettoyage du state React est present et teste
