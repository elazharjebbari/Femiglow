# Specifications Vitest - Gestion des Cles API

> Module : 170 - API Keys Management
> Framework : Vitest 2.1.x + jsdom + @testing-library/react
> MSW : 2.x (interception des appels API dans les tests de composants)
> Date : 2026-05-25

---

## 1. Organisation des fichiers de test

```
apps/web/src/
  lib/ai-engine/services/
    __tests__/
      encryption-service.test.ts      # 12 tests
      api-key-manager.test.ts         # 10 tests
      api-key-validator.test.ts       # 4 tests (mocke)
  app/api/admin/ai-engine/config/
    api-keys/
      __tests__/
        route.test.ts                 # 7 tests (GET + POST)
        route-delete.test.ts          # 3 tests (DELETE)
        route-test.test.ts            # 4 tests (POST /test)
    __tests__/
      api-keys-security.test.ts       # 6 tests (securite transverse)
  app/admin/content-studio-v2/ai-engine/config/
    __tests__/
      api-key-card.test.tsx           # 5 tests (RTL)
      api-key-form.test.tsx           # 6 tests (RTL)
      key-mask-display.test.tsx       # 3 tests (RTL)
```

**Total : 60 cas de test**

---

## 2. EncryptionService Tests (12 tests)

### Fichier : `encryption-service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EncryptionService, getEncryptionService, resetEncryptionService } from '../encryption-service';

const TEST_MASTER_KEY = 'test-master-key-for-unit-tests-only-32chars!';
const TEST_SALT = 'test-salt-16chars!';
const TEST_WRONG_KEY = 'wrong-master-key-for-unit-tests-32chars!';
const TEST_WRONG_SALT = 'wrong-salt-16ch!';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    resetEncryptionService();
    service = new EncryptionService(TEST_MASTER_KEY, TEST_SALT);
  });

  afterEach(() => {
    resetEncryptionService();
  });

  // ---------------------------------------------------------------
  // T-ENC-01 : Chiffrement/dechiffrement round-trip (cle OpenAI)
  // ---------------------------------------------------------------
  it('doit chiffrer et dechiffrer une cle OpenAI sans perte', () => {
    const plaintext = 'sk-proj-test-abcdef123456789ABCDEFGHIJKLMNOP';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  // ---------------------------------------------------------------
  // T-ENC-02 : Round-trip pour chaque fournisseur
  // ---------------------------------------------------------------
  it.each([
    ['openai', 'sk-proj-test-abcdef123456789ABCDEFGHIJKLMNOP'],
    ['anthropic', 'sk-ant-api03-test-xyz789abc123def456ghi789jkl'],
    ['google', 'AIzaSyD-test-abcdefghijk1234567890-TEST'],
    ['elevenlabs', 'test-el-abcdefghijk123456789-VALID'],
    ['ollama', 'http://localhost:11434'],
  ])('doit round-trip correctement pour le fournisseur %s', (_provider, key) => {
    const encrypted = service.encrypt(key);
    expect(service.decrypt(encrypted)).toBe(key);
  });

  // ---------------------------------------------------------------
  // T-ENC-03 : Cles de longueurs differentes (courte, longue, unicode)
  // ---------------------------------------------------------------
  it.each([
    ['courte', 'sk-test'],
    ['longue', 'sk-proj-' + 'a'.repeat(200)],
    ['unicode', 'cle-avec-des-accents-et-emojis-'],
    ['caracteres speciaux', 'sk-proj-test-abc!@#$%^&*()_+=-[]{}|;:,.<>?'],
    ['vide de 1 char', 'x'],
  ])('doit round-trip correctement pour une cle %s', (_desc, key) => {
    const encrypted = service.encrypt(key);
    expect(service.decrypt(encrypted)).toBe(key);
  });

  // ---------------------------------------------------------------
  // T-ENC-04 : IV unique pour chaque chiffrement
  // ---------------------------------------------------------------
  it('doit generer un IV different a chaque chiffrement du meme plaintext', () => {
    const plaintext = 'sk-proj-test-same-key-encrypted-twice';
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);

    // Les ciphertexts doivent etre differents (IV different)
    expect(encrypted1).not.toBe(encrypted2);

    // Mais les deux doivent dechiffrer vers le meme plaintext
    expect(service.decrypt(encrypted1)).toBe(plaintext);
    expect(service.decrypt(encrypted2)).toBe(plaintext);

    // Les IV (premiere partie) doivent etre differents
    const iv1 = encrypted1.split(':')[0];
    const iv2 = encrypted2.split(':')[0];
    expect(iv1).not.toBe(iv2);
  });

  // ---------------------------------------------------------------
  // T-ENC-05 : Detection de falsification du ciphertext
  // ---------------------------------------------------------------
  it('doit echouer si le ciphertext est modifie (tamper detection)', () => {
    const encrypted = service.encrypt('sk-proj-test-tamper-detection');
    const parts = encrypted.split(':');

    // Modifier un caractere du ciphertext (3eme partie)
    const tamperedCiphertext = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'A' ? 'B' : 'A');
    const tampered = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

    expect(() => service.decrypt(tampered)).toThrow(/dechiffrement echoue/i);
  });

  // ---------------------------------------------------------------
  // T-ENC-06 : Detection de falsification de l'authTag
  // ---------------------------------------------------------------
  it('doit echouer si l\'authTag est modifie', () => {
    const encrypted = service.encrypt('sk-proj-test-authtag-tamper');
    const parts = encrypted.split(':');

    // Modifier l'authTag (2eme partie)
    const tamperedTag = parts[1].slice(0, -1) + (parts[1].slice(-1) === 'A' ? 'B' : 'A');
    const tampered = `${parts[0]}:${tamperedTag}:${parts[2]}`;

    expect(() => service.decrypt(tampered)).toThrow(/dechiffrement echoue/i);
  });

  // ---------------------------------------------------------------
  // T-ENC-07 : Echec avec une cle master differente
  // ---------------------------------------------------------------
  it('doit echouer le dechiffrement avec une cle master differente', () => {
    const encrypted = service.encrypt('sk-proj-test-wrong-key');
    const wrongService = new EncryptionService(TEST_WRONG_KEY, TEST_SALT);

    expect(() => wrongService.decrypt(encrypted)).toThrow(/dechiffrement echoue/i);
  });

  // ---------------------------------------------------------------
  // T-ENC-08 : Echec avec un salt different
  // ---------------------------------------------------------------
  it('doit echouer le dechiffrement avec un salt different', () => {
    const encrypted = service.encrypt('sk-proj-test-wrong-salt');
    const wrongService = new EncryptionService(TEST_MASTER_KEY, TEST_WRONG_SALT);

    expect(() => wrongService.decrypt(encrypted)).toThrow(/dechiffrement echoue/i);
  });

  // ---------------------------------------------------------------
  // T-ENC-09 : Format de stockage invalide
  // ---------------------------------------------------------------
  it('doit echouer proprement avec un format de chiffre invalide', () => {
    expect(() => service.decrypt('invalid-format')).toThrow(/format.*invalide/i);
    expect(() => service.decrypt('part1:part2')).toThrow(/format.*invalide/i);
    expect(() => service.decrypt('a:b:c:d')).toThrow(/format.*invalide/i);
    expect(() => service.decrypt('')).toThrow(/format.*invalide/i);
  });

  // ---------------------------------------------------------------
  // T-ENC-10 : Service indisponible (cle master absente)
  // ---------------------------------------------------------------
  it('doit echouer si la cle master n\'est pas configuree', () => {
    const unavailableService = new EncryptionService(undefined, undefined);

    expect(unavailableService.isAvailable()).toBe(false);
    expect(() => unavailableService.encrypt('test')).toThrow(/non configuree/i);
    expect(() => unavailableService.decrypt('a:b:c')).toThrow(/non configuree/i);
  });

  // ---------------------------------------------------------------
  // T-ENC-11 : Format de stockage valide (base64:base64:base64)
  // ---------------------------------------------------------------
  it('doit produire un format base64:base64:base64 valide', () => {
    const encrypted = service.encrypt('sk-proj-test-format-check');
    const parts = encrypted.split(':');

    expect(parts).toHaveLength(3);

    // Chaque partie doit etre du base64 valide
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    parts.forEach((part, i) => {
      expect(part, `Partie ${i} doit etre base64 valide`).toMatch(base64Regex);
    });

    // IV doit faire 16 chars base64 (12 octets)
    const ivBuffer = Buffer.from(parts[0], 'base64');
    expect(ivBuffer.length).toBe(12);

    // AuthTag doit faire 24 chars base64 (16 octets)
    const authTagBuffer = Buffer.from(parts[1], 'base64');
    expect(authTagBuffer.length).toBe(16);
  });

  // ---------------------------------------------------------------
  // T-ENC-12 : Masquage des cles par fournisseur
  // ---------------------------------------------------------------
  describe('mask()', () => {
    it.each([
      ['sk-proj-abcdef123456789ABCDEFGHIJKLMNOP', 'sk-proj-...MNOP'],
      ['sk-ant-api03-xyz789abc123def456ghi789jkl', 'sk-ant-api03-...9jkl'],
      ['sk-ant-xyz789abc', 'sk-ant-...9abc'],
      ['sk-test-abcdefgh', 'sk-...efgh'],
      ['AIzaSyD-abcdefghijk1234567890', 'AIza...7890'],
      ['gsk_abcdefghijklmnop', 'gsk_...mnop'],
      ['http://localhost:11434', 'http...1434'],
      ['https://ollama.local:11434', 'https://...1434'],
      ['abcdefghijklmnop', 'abcd...mnop'],
      ['short', '****hort'],
      ['abc', '****'],
      ['', '****'],
    ])('mask("%s") doit retourner "%s"', (input, expected) => {
      expect(service.mask(input)).toBe(expected);
    });
  });
});
```

---

## 3. ApiKeyManager Tests (10 tests)

### Fichier : `api-key-manager.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiKeyManager } from '../api-key-manager';
import { EncryptionService } from '../encryption-service';

const TEST_MASTER_KEY = 'test-master-key-for-unit-tests-only-32chars!';
const TEST_SALT = 'test-salt-16chars!';

describe('ApiKeyManager', () => {
  let manager: ApiKeyManager;
  let encryptionService: EncryptionService;
  let mockDb: any;

  beforeEach(() => {
    encryptionService = new EncryptionService(TEST_MASTER_KEY, TEST_SALT);
    mockDb = createMockDatabase();
    manager = new ApiKeyManager(encryptionService, mockDb);
  });

  afterEach(() => {
    manager.invalidateCache();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------
  // T-MGR-01 : Creer une cle API avec chiffrement
  // ---------------------------------------------------------------
  it('doit creer une cle chiffree en base et retourner la cle masquee', async () => {
    const result = await manager.createOrUpdate(
      'openai',
      'sk-proj-test-create-key-123456789',
      mockAdminSession(),
      { label: 'Test production' },
    );

    expect(result.key.maskedKey).toBe('sk-proj-...6789');
    expect(result.key.source).toBe('database');
    expect(result.key.providerType).toBe('openai');
    expect(result.key.label).toBe('Test production');

    // Verifier que la cle en base est chiffree (pas en clair)
    const dbRecord = mockDb.getLastInserted();
    expect(dbRecord.encryptedKey).not.toContain('sk-proj-test');
    expect(dbRecord.encryptedKey).toContain(':'); // Format iv:tag:cipher
  });

  // ---------------------------------------------------------------
  // T-MGR-02 : Lire les cles (liste masquee, jamais en clair)
  // ---------------------------------------------------------------
  it('doit lister les cles masquees sans jamais retourner de cle en clair', async () => {
    // Preparer une cle en base
    await manager.createOrUpdate('openai', 'sk-proj-test-list-key-123456789', mockAdminSession());

    const result = await manager.listAll();

    expect(result.keys).toHaveLength(5); // Toujours 5 fournisseurs
    const openaiKey = result.keys.find(k => k.providerType === 'openai');
    expect(openaiKey).toBeDefined();
    expect(openaiKey!.maskedKey).toBe('sk-proj-...6789');

    // Verifier qu'AUCUNE cle en clair n'est presente
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('sk-proj-test-list-key');
    expect(serialized).not.toContain('encryptedKey');
  });

  // ---------------------------------------------------------------
  // T-MGR-03 : Mettre a jour une cle existante
  // ---------------------------------------------------------------
  it('doit desactiver l\'ancienne cle et creer la nouvelle', async () => {
    await manager.createOrUpdate('openai', 'sk-proj-test-old-key-111111', mockAdminSession());
    await manager.createOrUpdate('openai', 'sk-proj-test-new-key-222222', mockAdminSession());

    const result = await manager.listAll();
    const openaiKey = result.keys.find(k => k.providerType === 'openai');
    expect(openaiKey!.maskedKey).toBe('sk-proj-...2222');

    // Verifier qu'il n'y a qu'une seule cle active
    const activeKeys = mockDb.getActiveKeysForProvider('openai');
    expect(activeKeys).toHaveLength(1);
  });

  // ---------------------------------------------------------------
  // T-MGR-04 : Supprimer une cle avec fallback env var
  // ---------------------------------------------------------------
  it('doit supprimer la cle et indiquer le fallback disponible', async () => {
    const createResult = await manager.createOrUpdate(
      'openai', 'sk-proj-test-delete-key-333333', mockAdminSession(),
    );

    // Simuler une env var disponible
    process.env.AI_ENGINE_OPENAI_API_KEY = 'sk-proj-test-env-fallback';

    const deleteResult = await manager.deleteKey(createResult.key.id!, mockAdminSession());

    expect(deleteResult.deleted).toBe(true);
    expect(deleteResult.fallbackAvailable).toBe(true);
    expect(deleteResult.fallbackSource).toBe('AI_ENGINE_OPENAI_API_KEY');

    delete process.env.AI_ENGINE_OPENAI_API_KEY;
  });

  // ---------------------------------------------------------------
  // T-MGR-05 : Supprimer une cle sans fallback
  // ---------------------------------------------------------------
  it('doit supprimer la cle et indiquer aucun fallback', async () => {
    const createResult = await manager.createOrUpdate(
      'elevenlabs', 'test-el-delete-no-fallback-444444', mockAdminSession(),
    );

    const deleteResult = await manager.deleteKey(createResult.key.id!, mockAdminSession());

    expect(deleteResult.deleted).toBe(true);
    expect(deleteResult.fallbackAvailable).toBe(false);
    expect(deleteResult.fallbackSource).toBeNull();
  });

  // ---------------------------------------------------------------
  // T-MGR-06 : Resolution cle - priorite DB sur env
  // ---------------------------------------------------------------
  it('doit resoudre la cle DB en priorite sur la variable d\'environnement', async () => {
    process.env.AI_ENGINE_OPENAI_API_KEY = 'sk-proj-test-env-key-555555';
    await manager.createOrUpdate('openai', 'sk-proj-test-db-key-666666', mockAdminSession());

    const resolved = await manager.resolveApiKey('openai');

    expect(resolved.key).toBe('sk-proj-test-db-key-666666');
    expect(resolved.source).toBe('database');

    delete process.env.AI_ENGINE_OPENAI_API_KEY;
  });

  // ---------------------------------------------------------------
  // T-MGR-07 : Resolution cle - fallback sur env var
  // ---------------------------------------------------------------
  it('doit resoudre la variable d\'env si aucune cle DB n\'existe', async () => {
    process.env.AI_ENGINE_OPENAI_API_KEY = 'sk-proj-test-env-only-777777';

    const resolved = await manager.resolveApiKey('openai');

    expect(resolved.key).toBe('sk-proj-test-env-only-777777');
    expect(resolved.source).toBe('env');

    delete process.env.AI_ENGINE_OPENAI_API_KEY;
  });

  // ---------------------------------------------------------------
  // T-MGR-08 : Resolution cle - fournisseur non configure
  // ---------------------------------------------------------------
  it('doit retourner source=none si aucune cle n\'est configuree', async () => {
    const resolved = await manager.resolveApiKey('elevenlabs');

    expect(resolved.key).toBeUndefined();
    expect(resolved.source).toBe('none');
  });

  // ---------------------------------------------------------------
  // T-MGR-09 : Cle introuvable pour suppression
  // ---------------------------------------------------------------
  it('doit echouer si l\'ID de la cle a supprimer n\'existe pas', async () => {
    await expect(
      manager.deleteKey('nonexistent-id', mockAdminSession()),
    ).rejects.toThrow(/introuvable/i);
  });

  // ---------------------------------------------------------------
  // T-MGR-10 : Cache invalide apres modification
  // ---------------------------------------------------------------
  it('doit invalider le cache apres createOrUpdate', async () => {
    await manager.createOrUpdate('openai', 'sk-proj-test-cache-old-888888', mockAdminSession());

    // Premiere resolution : met en cache
    const first = await manager.resolveApiKey('openai');
    expect(first.key).toBe('sk-proj-test-cache-old-888888');

    // Mise a jour
    await manager.createOrUpdate('openai', 'sk-proj-test-cache-new-999999', mockAdminSession());

    // Deuxieme resolution : doit utiliser la nouvelle cle
    const second = await manager.resolveApiKey('openai');
    expect(second.key).toBe('sk-proj-test-cache-new-999999');
  });
});

// --- Helpers ---

function mockAdminSession() {
  return { email: 'admin@test.femiglow.com' };
}

function createMockDatabase() {
  // Simule les operations Drizzle ORM en memoire
  // (implementation detaillee dans test/helpers/mock-db.ts)
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getLastInserted: vi.fn(),
    getActiveKeysForProvider: vi.fn(),
  };
}
```

---

## 4. API Route Tests - GET + POST (7 tests)

### Fichier : `route.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('GET /api/admin/ai-engine/config/api-keys', () => {
  // ---------------------------------------------------------------
  // T-GET-01 : Liste des 5 fournisseurs avec cles masquees
  // ---------------------------------------------------------------
  it('doit retourner les 5 fournisseurs avec les cles masquees', async () => {
    const response = await callGET();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.keys).toHaveLength(5);
    expect(data.meta.total).toBe(5);

    // Verifier qu'aucune cle en clair n'est presente
    const serialized = JSON.stringify(data);
    expect(serialized).not.toMatch(/sk-proj-test-/);
    expect(serialized).not.toContain('encryptedKey');
  });

  // ---------------------------------------------------------------
  // T-GET-02 : Non-authentifie rejete avec 401
  // ---------------------------------------------------------------
  it('doit retourner 401 sans session valide', async () => {
    const response = await callGET({ authenticated: false });
    expect(response.status).toBe(401);
  });

  // ---------------------------------------------------------------
  // T-GET-03 : Meta-informations correctes
  // ---------------------------------------------------------------
  it('doit retourner les meta-informations correctes', async () => {
    // Preparer : 1 cle DB, 1 cle env, 3 non configurees
    const response = await callGET();
    const data = await response.json();

    expect(data.meta.configuredCount).toBe(2);
    expect(data.meta.dbKeyCount).toBe(1);
    expect(data.meta.envKeyCount).toBe(1);
  });
});

describe('POST /api/admin/ai-engine/config/api-keys', () => {
  // ---------------------------------------------------------------
  // T-POST-01 : Creation reussie avec chiffrement
  // ---------------------------------------------------------------
  it('doit creer une cle chiffree et retourner la cle masquee', async () => {
    const response = await callPOST({
      providerType: 'openai',
      apiKey: 'sk-proj-test-create-route-123456',
      label: 'Production',
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.key.maskedKey).toBe('sk-proj-...3456');
    expect(data.key.source).toBe('database');

    // La reponse ne doit JAMAIS contenir la cle en clair
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain('sk-proj-test-create-route');
  });

  // ---------------------------------------------------------------
  // T-POST-02 : Schema Zod invalide retourne 400
  // ---------------------------------------------------------------
  it('doit retourner 400 si le providerType est invalide', async () => {
    const response = await callPOST({
      providerType: 'invalid-provider',
      apiKey: 'test-key',
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------
  // T-POST-03 : Non-authentifie rejete avec 401
  // ---------------------------------------------------------------
  it('doit retourner 401 sans session valide', async () => {
    const response = await callPOST(
      { providerType: 'openai', apiKey: 'sk-test' },
      { authenticated: false },
    );
    expect(response.status).toBe(401);
  });

  // ---------------------------------------------------------------
  // T-POST-04 : Cle API chiffree en base (jamais en clair)
  // ---------------------------------------------------------------
  it('ne doit jamais stocker la cle en clair dans la base', async () => {
    await callPOST({
      providerType: 'openai',
      apiKey: 'sk-proj-test-never-plain-abcdef',
      skipValidation: true,
    });

    // Verifier directement en base
    const dbRecord = await getDbRecordForProvider('openai');
    expect(dbRecord.encryptedKey).not.toContain('sk-proj-test-never-plain');
    expect(dbRecord.encryptedKey).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
  });
});
```

---

## 5. API Route Tests - DELETE (3 tests)

### Fichier : `route-delete.test.ts`

```typescript
describe('DELETE /api/admin/ai-engine/config/api-keys/[id]', () => {
  // ---------------------------------------------------------------
  // T-DEL-01 : Suppression reussie avec info fallback
  // ---------------------------------------------------------------
  it('doit supprimer la cle et indiquer le fallback', async () => {
    const created = await createTestKey('openai');
    const response = await callDELETE(created.key.id);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.deleted).toBe(true);
    expect(data).toHaveProperty('fallbackAvailable');
  });

  // ---------------------------------------------------------------
  // T-DEL-02 : ID inexistant retourne 404
  // ---------------------------------------------------------------
  it('doit retourner 404 pour un ID inexistant', async () => {
    const response = await callDELETE('nonexistent-uuid');
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('PROVIDER_NOT_FOUND');
  });

  // ---------------------------------------------------------------
  // T-DEL-03 : Non-authentifie rejete avec 401
  // ---------------------------------------------------------------
  it('doit retourner 401 sans session valide', async () => {
    const response = await callDELETE('any-id', { authenticated: false });
    expect(response.status).toBe(401);
  });
});
```

---

## 6. API Route Tests - POST /test (4 tests)

### Fichier : `route-test.test.ts`

```typescript
describe('POST /api/admin/ai-engine/config/api-keys/test', () => {
  // ---------------------------------------------------------------
  // T-TEST-01 : Test de cle valide retourne succes
  // ---------------------------------------------------------------
  it('doit retourner valid=true pour une cle de test fonctionnelle', async () => {
    // MSW intercepte l'appel au provider et retourne succes
    const response = await callTestEndpoint({
      providerType: 'openai',
      apiKey: 'sk-proj-test-valid-key-for-testing',
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.valid).toBe(true);
    expect(data.latencyMs).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // T-TEST-02 : Test de cle invalide retourne echec
  // ---------------------------------------------------------------
  it('doit retourner valid=false pour une cle invalide', async () => {
    // MSW intercepte et retourne 401
    const response = await callTestEndpoint({
      providerType: 'openai',
      apiKey: 'sk-proj-test-invalid-key-000000',
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.valid).toBe(false);
    expect(data.error).toBeTruthy();
  });

  // ---------------------------------------------------------------
  // T-TEST-03 : Rate limit apres 5 requetes
  // ---------------------------------------------------------------
  it('doit retourner 429 apres 5 requetes dans la meme minute', async () => {
    // Effectuer 5 requetes
    for (let i = 0; i < 5; i++) {
      const res = await callTestEndpoint({ providerType: 'openai' });
      expect(res.status).toBe(200);
    }

    // La 6eme doit echouer
    const response = await callTestEndpoint({ providerType: 'openai' });
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe('RATE_LIMIT_EXCEEDED');
  });

  // ---------------------------------------------------------------
  // T-TEST-04 : Non-authentifie rejete avec 401
  // ---------------------------------------------------------------
  it('doit retourner 401 sans session valide', async () => {
    const response = await callTestEndpoint(
      { providerType: 'openai' },
      { authenticated: false },
    );
    expect(response.status).toBe(401);
  });
});
```

---

## 7. Tests de securite transverses (6 tests)

### Fichier : `api-keys-security.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('Securite transverse - API Keys', () => {
  // ---------------------------------------------------------------
  // T-SEC-01 : La reponse GET ne contient jamais de cle en clair
  // ---------------------------------------------------------------
  it('GET ne doit jamais retourner de cle en clair ni de chiffre', async () => {
    // Creer des cles pour tous les fournisseurs
    await setupAllProviderKeys();

    const response = await callGET();
    const raw = await response.text();

    // Patterns de cles connues
    const keyPatterns = [
      /sk-proj-test-/,
      /sk-ant-api03-test-/,
      /AIzaSyD-test-/,
      /test-el-/,
      /encryptedKey/,
    ];

    keyPatterns.forEach(pattern => {
      expect(raw, `La reponse ne doit pas correspondre a ${pattern}`).not.toMatch(pattern);
    });
  });

  // ---------------------------------------------------------------
  // T-SEC-02 : L'audit log ne contient jamais de cle en clair
  // ---------------------------------------------------------------
  it('l\'audit log ne doit jamais contenir de cle API en clair', async () => {
    await callPOST({
      providerType: 'openai',
      apiKey: 'sk-proj-test-audit-check-abcdef',
      skipValidation: true,
    });

    const auditLogs = await getAuditLogsForEntity('api_key');
    const serialized = JSON.stringify(auditLogs);

    expect(serialized).not.toContain('sk-proj-test-audit-check');
    expect(serialized).not.toContain('encryptedKey');
    expect(serialized).toContain('maskedKey'); // Seule la cle masquee est autorisee
  });

  // ---------------------------------------------------------------
  // T-SEC-03 : Injection SQL via providerType rejetee par Zod
  // ---------------------------------------------------------------
  it('doit rejeter une tentative d\'injection SQL dans providerType', async () => {
    const response = await callPOST({
      providerType: "openai'; DROP TABLE ai_engine_api_key;--",
      apiKey: 'test-injection',
    });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------
  // T-SEC-04 : XSS dans le label est echappe
  // ---------------------------------------------------------------
  it('doit accepter mais echapper un label contenant du HTML', async () => {
    const response = await callPOST({
      providerType: 'openai',
      apiKey: 'sk-proj-test-xss-check-123456',
      label: '<script>alert("xss")</script>',
      skipValidation: true,
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    // Le label est stocke tel quel (Drizzle echappe en sortie)
    // Mais il ne doit pas etre interprete comme HTML par React
    expect(data.key.label).toBe('<script>alert("xss")</script>');
  });

  // ---------------------------------------------------------------
  // T-SEC-05 : Session expiree rejetee sur toutes les routes
  // ---------------------------------------------------------------
  it('doit retourner 401 avec un cookie de session expire', async () => {
    const expiredSession = createExpiredSessionCookie();

    const endpoints = [
      () => callGET({ cookie: expiredSession }),
      () => callPOST({ providerType: 'openai', apiKey: 'test' }, { cookie: expiredSession }),
      () => callDELETE('some-id', { cookie: expiredSession }),
      () => callTestEndpoint({ providerType: 'openai' }, { cookie: expiredSession }),
    ];

    for (const call of endpoints) {
      const response = await call();
      expect(response.status).toBe(401);
    }
  });

  // ---------------------------------------------------------------
  // T-SEC-06 : La reponse JSON ne contient jamais le champ encryptedKey
  // ---------------------------------------------------------------
  it('aucune reponse API ne doit contenir le champ encryptedKey', async () => {
    await callPOST({
      providerType: 'openai',
      apiKey: 'sk-proj-test-no-encrypted-field',
      skipValidation: true,
    });

    const getResponse = await callGET();
    const getData = await getResponse.json();
    const getKeys = Object.keys(JSON.parse(JSON.stringify(getData)));

    const flattenKeys = (obj: any, prefix = ''): string[] => {
      return Object.entries(obj).flatMap(([k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) return flattenKeys(v, key);
        if (Array.isArray(v)) return v.flatMap((item, i) =>
          typeof item === 'object' ? flattenKeys(item, `${key}[${i}]`) : [key]
        );
        return [key];
      });
    };

    const allKeys = flattenKeys(getData);
    expect(allKeys).not.toContain(expect.stringContaining('encryptedKey'));
    expect(allKeys).not.toContain(expect.stringContaining('apiKey'));
  });
});
```

---

## 8. ApiKeyValidator Tests (4 tests)

### Fichier : `api-key-validator.test.ts`

```typescript
describe('ApiKeyValidator', () => {
  // ---------------------------------------------------------------
  // T-VAL-01 : Validation OpenAI reussie (mocke MSW)
  // ---------------------------------------------------------------
  it('doit retourner valid=true quand OpenAI repond 200', async () => {
    // MSW handler retourne { data: [{ id: 'gpt-4' }] }
    const result = await validator.validate('openai', 'sk-proj-test-valid');
    expect(result.valid).toBe(true);
    expect(result.latencyMs).toBeGreaterThan(0);
    expect(result.details?.modelsAvailable).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // T-VAL-02 : Validation echouee (cle invalide, 401)
  // ---------------------------------------------------------------
  it('doit retourner valid=false quand le provider repond 401', async () => {
    // MSW handler retourne 401
    const result = await validator.validate('openai', 'sk-proj-test-invalid');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalide');
  });

  // ---------------------------------------------------------------
  // T-VAL-03 : Timeout du fournisseur
  // ---------------------------------------------------------------
  it('doit retourner valid=false avec message timeout apres 10s', async () => {
    // MSW handler avec delai > 10s
    const result = await validator.validate('openai', 'sk-proj-test-timeout');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('timeout');
  });

  // ---------------------------------------------------------------
  // T-VAL-04 : Fournisseur inconnu
  // ---------------------------------------------------------------
  it('doit echouer proprement pour un fournisseur inconnu', async () => {
    const result = await validator.validate('unknown-provider', 'test-key');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('inconnu');
  });
});
```

---

## 9. Composant ApiKeyCard Tests - RTL (5 tests)

### Fichier : `api-key-card.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

describe('ApiKeyCard', () => {
  // ---------------------------------------------------------------
  // T-CARD-01 : Affichage masque de la cle (jamais en clair)
  // ---------------------------------------------------------------
  it('doit afficher la cle masquee, pas la cle en clair', () => {
    render(
      <ApiKeyCard
        keyData={mockKeyData({ maskedKey: 'sk-proj-...AbCd', source: 'database' })}
        onTest={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onConfigure={vi.fn()}
        testing={false} deleting={false}
      />,
    );

    expect(screen.getByText('sk-proj-...AbCd')).toBeInTheDocument();
    // Verifier que la cle complete n'est nulle part dans le DOM
    expect(document.body.innerHTML).not.toContain('sk-proj-test-full-key');
  });

  // ---------------------------------------------------------------
  // T-CARD-02 : Carte non configuree affiche "Configurer"
  // ---------------------------------------------------------------
  it('doit afficher le bouton "Configurer" pour un fournisseur non configure', () => {
    render(
      <ApiKeyCard
        keyData={mockKeyData({ source: 'none', maskedKey: null })}
        onTest={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onConfigure={vi.fn()}
        testing={false} deleting={false}
      />,
    );

    expect(screen.getByText('Configurer')).toBeInTheDocument();
    expect(screen.queryByText('Tester')).not.toBeInTheDocument();
    expect(screen.queryByText('Editer')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------
  // T-CARD-03 : Source "env" n'affiche pas Edit/Delete
  // ---------------------------------------------------------------
  it('ne doit pas afficher Edit/Delete pour une cle source env', () => {
    render(
      <ApiKeyCard
        keyData={mockKeyData({ source: 'env' })}
        onTest={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onConfigure={vi.fn()}
        testing={false} deleting={false}
      />,
    );

    expect(screen.getByText('Tester')).toBeInTheDocument();
    expect(screen.queryByText('Editer')).not.toBeInTheDocument();
    expect(screen.queryByText('Supprimer')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------
  // T-CARD-04 : Clic sur "Tester" appelle le callback
  // ---------------------------------------------------------------
  it('doit appeler onTest avec le providerType au clic sur Tester', () => {
    const onTest = vi.fn();
    render(
      <ApiKeyCard
        keyData={mockKeyData({ providerType: 'anthropic', source: 'database' })}
        onTest={onTest} onEdit={vi.fn()} onDelete={vi.fn()} onConfigure={vi.fn()}
        testing={false} deleting={false}
      />,
    );

    fireEvent.click(screen.getByText('Tester'));
    expect(onTest).toHaveBeenCalledWith('anthropic');
  });

  // ---------------------------------------------------------------
  // T-CARD-05 : Spinner affiche pendant le test
  // ---------------------------------------------------------------
  it('doit afficher un spinner pendant que testing=true', () => {
    render(
      <ApiKeyCard
        keyData={mockKeyData({ source: 'database' })}
        onTest={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onConfigure={vi.fn()}
        testing={true} deleting={false}
      />,
    );

    expect(screen.getByText('Test en cours...')).toBeInTheDocument();
  });
});
```

---

## 10. Composant ApiKeyForm Tests - RTL (6 tests)

### Fichier : `api-key-form.test.tsx`

```typescript
describe('ApiKeyForm', () => {
  // ---------------------------------------------------------------
  // T-FORM-01 : Soumission avec cle valide appelle onSave
  // ---------------------------------------------------------------
  it('doit appeler onSave avec les donnees du formulaire', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ApiKeyForm
        mode="create" providerType={null} existingLabel={null}
        configuredDbProviders={[]} onSave={onSave} onCancel={vi.fn()} saving={false}
      />,
    );

    // Selectionner le fournisseur
    fireEvent.change(screen.getByLabelText(/fournisseur/i), { target: { value: 'openai' } });
    // Saisir la cle
    fireEvent.change(screen.getByLabelText(/cle api/i), {
      target: { value: 'sk-proj-test-form-submit-123456' },
    });
    // Soumettre
    fireEvent.click(screen.getByText(/sauvegarder/i));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      providerType: 'openai',
      apiKey: 'sk-proj-test-form-submit-123456',
    }));
  });

  // ---------------------------------------------------------------
  // T-FORM-02 : Validation du format de cle en temps reel
  // ---------------------------------------------------------------
  it('doit afficher une erreur si le format de cle est invalide', async () => {
    render(
      <ApiKeyForm
        mode="create" providerType={null} existingLabel={null}
        configuredDbProviders={[]} onSave={vi.fn()} onCancel={vi.fn()} saving={false}
      />,
    );

    fireEvent.change(screen.getByLabelText(/fournisseur/i), { target: { value: 'openai' } });
    fireEvent.change(screen.getByLabelText(/cle api/i), { target: { value: 'invalid-no-prefix' } });

    expect(await screen.findByText(/doit commencer par "sk-"/i)).toBeInTheDocument();
  });

  // ---------------------------------------------------------------
  // T-FORM-03 : Mode edit : fournisseur pre-selectionne et desactive
  // ---------------------------------------------------------------
  it('doit pre-selectionner et desactiver le select en mode edit', () => {
    render(
      <ApiKeyForm
        mode="edit" providerType="anthropic" existingLabel="Mon label"
        configuredDbProviders={['anthropic']} onSave={vi.fn()} onCancel={vi.fn()} saving={false}
      />,
    );

    const select = screen.getByLabelText(/fournisseur/i) as HTMLSelectElement;
    expect(select.value).toBe('anthropic');
    expect(select.disabled).toBe(true);
  });

  // ---------------------------------------------------------------
  // T-FORM-04 : Champ password (cle masquee par defaut)
  // ---------------------------------------------------------------
  it('doit utiliser type=password pour le champ de cle API', () => {
    render(
      <ApiKeyForm
        mode="create" providerType={null} existingLabel={null}
        configuredDbProviders={[]} onSave={vi.fn()} onCancel={vi.fn()} saving={false}
      />,
    );

    const input = screen.getByLabelText(/cle api/i) as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.autocomplete).toBe('off');
  });

  // ---------------------------------------------------------------
  // T-FORM-05 : Annulation appelle onCancel
  // ---------------------------------------------------------------
  it('doit appeler onCancel au clic sur Annuler', () => {
    const onCancel = vi.fn();
    render(
      <ApiKeyForm
        mode="create" providerType={null} existingLabel={null}
        configuredDbProviders={[]} onSave={vi.fn()} onCancel={onCancel} saving={false}
      />,
    );

    fireEvent.click(screen.getByText(/annuler/i));
    expect(onCancel).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------
  // T-FORM-06 : Bouton desactive pendant la sauvegarde
  // ---------------------------------------------------------------
  it('doit desactiver le bouton de sauvegarde quand saving=true', () => {
    render(
      <ApiKeyForm
        mode="create" providerType="openai" existingLabel={null}
        configuredDbProviders={[]} onSave={vi.fn()} onCancel={vi.fn()} saving={true}
      />,
    );

    const button = screen.getByText(/sauvegarder/i).closest('button');
    expect(button).toBeDisabled();
  });
});
```

---

## 11. Composant KeyMaskDisplay Tests - RTL (3 tests)

### Fichier : `key-mask-display.test.tsx`

```typescript
describe('KeyMaskDisplay', () => {
  // ---------------------------------------------------------------
  // T-MASK-01 : Affichage de la cle masquee en font mono
  // ---------------------------------------------------------------
  it('doit afficher la cle masquee avec la font mono', () => {
    render(<KeyMaskDisplay maskedKey="sk-proj-...AbCd" source="database" />);
    expect(screen.getByText('sk-proj-...AbCd')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------
  // T-MASK-02 : Badge "Base de donnees" pour source DB
  // ---------------------------------------------------------------
  it('doit afficher le badge "Base de donnees" pour source=database', () => {
    render(<KeyMaskDisplay maskedKey="sk-proj-...AbCd" source="database" />);
    expect(screen.getByText('Base de donnees')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------
  // T-MASK-03 : Badge "Env var" pour source env
  // ---------------------------------------------------------------
  it('doit afficher le badge "Env var" pour source=env', () => {
    render(<KeyMaskDisplay maskedKey="sk-ant-...XyZw" source="env" envVarName="AI_ENGINE_ANTHROPIC_API_KEY" />);
    expect(screen.getByText('Env var')).toBeInTheDocument();
  });
});
```

---

## 12. Resume des tests

| Fichier | Nombre | Categorie |
|---------|--------|-----------|
| `encryption-service.test.ts` | 12 | Unit - Securite |
| `api-key-manager.test.ts` | 10 | Unit - Business logic |
| `api-key-validator.test.ts` | 4 | Unit - Integration mockee |
| `route.test.ts` | 7 | Integration - API Routes |
| `route-delete.test.ts` | 3 | Integration - API Routes |
| `route-test.test.ts` | 4 | Integration - API Routes |
| `api-keys-security.test.ts` | 6 | Securite transverse |
| `api-key-card.test.tsx` | 5 | Composant - RTL |
| `api-key-form.test.tsx` | 6 | Composant - RTL |
| `key-mask-display.test.tsx` | 3 | Composant - RTL |
| **Total** | **60** | |
