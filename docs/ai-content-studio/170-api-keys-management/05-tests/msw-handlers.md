# Handlers MSW 2.x - Gestion des Cles API

> Module : 170 - API Keys Management
> Framework : MSW 2.x (Mock Service Worker)
> Utilisation : Tests Vitest (composants RTL) + Tests Playwright (service worker navigateur)
> Date : 2026-05-25

---

## 1. Vue d'ensemble

### 1.1 Fichier de handlers

```
apps/web/test/msw/
  handlers/
    ai-engine-api-keys.ts         # Handlers pour les routes API Keys
  server.ts                        # Serveur MSW (Vitest)
  browser.ts                       # Worker MSW (Playwright)
```

### 1.2 Architecture MSW 2.x

```typescript
// test/msw/server.ts (pour Vitest)
import { setupServer } from 'msw/node';
import { apiKeysHandlers } from './handlers/ai-engine-api-keys';

export const server = setupServer(...apiKeysHandlers);

// test/setup.ts
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## 2. Donnees fictives (Fixtures)

### 2.1 Cles API mockees

```typescript
// test/msw/fixtures/api-keys-data.ts

import type { ApiKeySummary } from '@/lib/ai-engine/services/api-key-manager';

export const MOCK_API_KEYS: ApiKeySummary[] = [
  {
    id: 'key-openai-001',
    providerType: 'openai',
    providerName: 'OpenAI',
    label: 'Compte production',
    maskedKey: 'sk-proj-...MNOP',
    keyPrefix: 'sk-proj-',
    source: 'database',
    isActive: true,
    lastTestedAt: '2026-05-25T10:30:00Z',
    lastTestResult: 'success',
    lastTestError: null,
    expiresAt: null,
    envVarName: null,
    createdAt: '2026-05-20T14:00:00Z',
    updatedAt: '2026-05-25T10:30:00Z',
  },
  {
    id: null,
    providerType: 'anthropic',
    providerName: 'Anthropic',
    label: null,
    maskedKey: 'sk-ant-...XyZw',
    keyPrefix: 'sk-ant-',
    source: 'env',
    isActive: true,
    lastTestedAt: null,
    lastTestResult: 'untested',
    lastTestError: null,
    expiresAt: null,
    envVarName: 'AI_ENGINE_ANTHROPIC_API_KEY',
    createdAt: null,
    updatedAt: null,
  },
  {
    id: 'key-google-003',
    providerType: 'google',
    providerName: 'Google AI (Gemini)',
    label: 'Projet FemiGlow',
    maskedKey: 'AIza...7890',
    keyPrefix: 'AIza',
    source: 'database',
    isActive: true,
    lastTestedAt: '2026-05-24T16:00:00Z',
    lastTestResult: 'success',
    lastTestError: null,
    expiresAt: null,
    envVarName: null,
    createdAt: '2026-05-18T09:00:00Z',
    updatedAt: '2026-05-24T16:00:00Z',
  },
  {
    id: null,
    providerType: 'elevenlabs',
    providerName: 'ElevenLabs',
    label: null,
    maskedKey: null,
    keyPrefix: null,
    source: 'none',
    isActive: false,
    lastTestedAt: null,
    lastTestResult: 'untested',
    lastTestError: null,
    expiresAt: null,
    envVarName: null,
    createdAt: null,
    updatedAt: null,
  },
  {
    id: null,
    providerType: 'ollama',
    providerName: 'Ollama (local)',
    label: null,
    maskedKey: null,
    keyPrefix: null,
    source: 'none',
    isActive: false,
    lastTestedAt: null,
    lastTestResult: 'untested',
    lastTestError: null,
    expiresAt: null,
    envVarName: null,
    createdAt: null,
    updatedAt: null,
  },
];

export const MOCK_META = {
  total: 5,
  configuredCount: 3,
  dbKeyCount: 2,
  envKeyCount: 1,
};
```

---

## 3. Handlers nominaux

### 3.1 GET /api/admin/ai-engine/config/api-keys

```typescript
// test/msw/handlers/ai-engine-api-keys.ts

import { http, HttpResponse } from 'msw';
import { MOCK_API_KEYS, MOCK_META } from '../fixtures/api-keys-data';

/**
 * Handler GET : Liste les cles API masquees pour les 5 fournisseurs.
 *
 * Retourne toujours les 5 fournisseurs. Les cles ne sont jamais en clair.
 * Le champ `encryptedKey` n'est JAMAIS inclus dans la reponse.
 */
const getApiKeysHandler = http.get(
  '/api/admin/ai-engine/config/api-keys',
  () => {
    return HttpResponse.json(
      {
        keys: MOCK_API_KEYS,
        meta: MOCK_META,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
      },
    );
  },
);
```

### 3.2 POST /api/admin/ai-engine/config/api-keys (creation/mise a jour)

```typescript
/**
 * Handler POST : Cree ou met a jour une cle API.
 *
 * Simule le chiffrement et la validation.
 * La cle `apiKey` du body de requete n'est JAMAIS incluse dans la reponse.
 */
const createApiKeyHandler = http.post(
  '/api/admin/ai-engine/config/api-keys',
  async ({ request }) => {
    const body = (await request.json()) as {
      providerType: string;
      apiKey: string;
      label?: string;
      baseUrl?: string;
      skipValidation?: boolean;
    };

    // Validation Zod simulee
    const validProviders = ['openai', 'anthropic', 'google', 'elevenlabs', 'ollama'];
    if (!validProviders.includes(body.providerType)) {
      return HttpResponse.json(
        {
          error: 'Type de fournisseur invalide',
          code: 'VALIDATION_ERROR',
          details: { providerType: 'Doit etre un des : openai, anthropic, google, elevenlabs, ollama' },
        },
        { status: 400 },
      );
    }

    if (!body.apiKey || body.apiKey.length === 0) {
      return HttpResponse.json(
        {
          error: 'La cle API est requise',
          code: 'VALIDATION_ERROR',
          details: { apiKey: 'Champ requis' },
        },
        { status: 400 },
      );
    }

    // Simuler le masquage
    const last4 = body.apiKey.slice(-4);
    const prefixes = ['sk-proj-', 'sk-ant-api03-', 'sk-ant-', 'sk-', 'AIza', 'gsk_', 'http://', 'https://'];
    let maskedKey = `****${last4}`;
    for (const prefix of prefixes) {
      if (body.apiKey.startsWith(prefix)) {
        maskedKey = `${prefix}...${last4}`;
        break;
      }
    }

    const newKey: ApiKeySummary = {
      id: `key-${body.providerType}-${Date.now()}`,
      providerType: body.providerType,
      providerName: getProviderName(body.providerType),
      label: body.label ?? null,
      maskedKey,
      keyPrefix: extractPrefix(body.apiKey),
      source: 'database',
      isActive: true,
      lastTestedAt: body.skipValidation ? null : new Date().toISOString(),
      lastTestResult: body.skipValidation ? 'untested' : 'success',
      lastTestError: null,
      expiresAt: null,
      envVarName: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(
      {
        key: newKey,
        validation: body.skipValidation
          ? null
          : {
              valid: true,
              provider: body.providerType,
              latencyMs: 245,
              error: null,
              details: { modelsAvailable: 12 },
            },
      },
      { status: 200 },
    );
  },
);
```

### 3.3 DELETE /api/admin/ai-engine/config/api-keys/:id

```typescript
/**
 * Handler DELETE : Supprime une cle API par son ID.
 *
 * Retourne le statut de suppression et l'information de fallback.
 * Ne retourne JAMAIS la cle en clair ni le chiffre.
 */
const deleteApiKeyHandler = http.delete(
  '/api/admin/ai-engine/config/api-keys/:id',
  ({ params }) => {
    const { id } = params;

    // Simuler une cle introuvable
    if (id === 'nonexistent-uuid') {
      return HttpResponse.json(
        {
          error: 'Cle introuvable',
          code: 'PROVIDER_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    // Determiner si un fallback env var existe
    const providerType = id.toString().includes('openai') ? 'openai' : 'google';
    const fallbackAvailable = providerType === 'openai'; // OpenAI a une env var

    return HttpResponse.json(
      {
        deleted: true,
        fallbackAvailable,
        fallbackSource: fallbackAvailable ? 'AI_ENGINE_OPENAI_API_KEY' : null,
      },
      { status: 200 },
    );
  },
);
```

### 3.4 POST /api/admin/ai-engine/config/api-keys/test (validation)

```typescript
/**
 * Handler POST /test : Teste la validite d'une cle API.
 *
 * Simule un appel au fournisseur. La cle fournie dans le body n'est
 * JAMAIS incluse dans la reponse.
 */
const testApiKeyHandler = http.post(
  '/api/admin/ai-engine/config/api-keys/test',
  async ({ request }) => {
    const body = (await request.json()) as {
      providerType: string;
      apiKey?: string;
      baseUrl?: string;
    };

    // Simuler un test reussi par defaut
    const isInvalidKey = body.apiKey?.includes('invalid') || body.apiKey?.includes('0000');

    if (isInvalidKey) {
      return HttpResponse.json(
        {
          valid: false,
          provider: body.providerType,
          latencyMs: 180,
          error: 'Cle API invalide ou expiree',
          details: null,
        },
        { status: 200 },
      );
    }

    // Simuler une latence realiste
    await new Promise(resolve => setTimeout(resolve, 100));

    return HttpResponse.json(
      {
        valid: true,
        provider: body.providerType,
        latencyMs: 245,
        error: null,
        details: {
          modelsAvailable: body.providerType === 'openai' ? 12 : 5,
          quotaRemaining: body.providerType === 'elevenlabs' ? 50000 : undefined,
        },
      },
      { status: 200 },
    );
  },
);
```

---

## 4. Handlers d'erreur

### 4.1 Erreur 401 - Non authentifie

```typescript
/**
 * Handler pour simuler une session invalide/expiree sur toutes les routes.
 * Utilisation : server.use(unauthorizedHandlers) dans un test specifique.
 */
export const unauthorizedGetHandler = http.get(
  '/api/admin/ai-engine/config/api-keys',
  () => {
    return HttpResponse.json(
      {
        error: 'Session expiree. Veuillez vous reconnecter.',
      },
      { status: 401 },
    );
  },
);

export const unauthorizedPostHandler = http.post(
  '/api/admin/ai-engine/config/api-keys',
  () => {
    return HttpResponse.json(
      {
        error: 'Session expiree. Veuillez vous reconnecter.',
      },
      { status: 401 },
    );
  },
);

export const unauthorizedDeleteHandler = http.delete(
  '/api/admin/ai-engine/config/api-keys/:id',
  () => {
    return HttpResponse.json(
      {
        error: 'Session expiree. Veuillez vous reconnecter.',
      },
      { status: 401 },
    );
  },
);

export const unauthorizedTestHandler = http.post(
  '/api/admin/ai-engine/config/api-keys/test',
  () => {
    return HttpResponse.json(
      {
        error: 'Session expiree. Veuillez vous reconnecter.',
      },
      { status: 401 },
    );
  },
);

export const unauthorizedHandlers = [
  unauthorizedGetHandler,
  unauthorizedPostHandler,
  unauthorizedDeleteHandler,
  unauthorizedTestHandler,
];
```

### 4.2 Erreur 400 - Validation echouee

```typescript
/**
 * Handler pour simuler une erreur de validation Zod.
 */
export const validationErrorHandler = http.post(
  '/api/admin/ai-engine/config/api-keys',
  () => {
    return HttpResponse.json(
      {
        error: 'Donnees invalides',
        code: 'VALIDATION_ERROR',
        details: {
          providerType: 'Type de fournisseur requis',
          apiKey: 'Cle API requise',
        },
      },
      { status: 400 },
    );
  },
);
```

### 4.3 Erreur 500 - Erreur serveur (chiffrement)

```typescript
/**
 * Handler pour simuler l'absence de la cle de chiffrement.
 */
export const encryptionMissingHandler = http.post(
  '/api/admin/ai-engine/config/api-keys',
  () => {
    return HttpResponse.json(
      {
        error: 'Cle de chiffrement non configuree',
        code: 'ENCRYPTION_KEY_MISSING',
      },
      { status: 500 },
    );
  },
);

/**
 * Handler pour simuler une erreur serveur generique.
 */
export const serverErrorHandler = http.post(
  '/api/admin/ai-engine/config/api-keys',
  () => {
    return HttpResponse.json(
      {
        error: 'Erreur interne du serveur',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  },
);

/**
 * Handler pour simuler une erreur GET (DB indisponible).
 */
export const dbUnavailableHandler = http.get(
  '/api/admin/ai-engine/config/api-keys',
  () => {
    return HttpResponse.json(
      {
        error: 'Base de donnees non disponible',
        code: 'DB_UNAVAILABLE',
      },
      { status: 503 },
    );
  },
);
```

### 4.4 Erreur 409 - Conflit (cle existante)

```typescript
/**
 * Handler pour simuler un conflit de cle existante.
 */
export const conflictHandler = http.post(
  '/api/admin/ai-engine/config/api-keys',
  () => {
    return HttpResponse.json(
      {
        error: 'Une cle active existe deja pour ce fournisseur',
        code: 'PROVIDER_ALREADY_EXISTS',
      },
      { status: 409 },
    );
  },
);
```

### 4.5 Erreur 429 - Rate limit

```typescript
/**
 * Handler pour simuler le depassement du rate limit sur le test.
 */
export const rateLimitHandler = http.post(
  '/api/admin/ai-engine/config/api-keys/test',
  () => {
    return HttpResponse.json(
      {
        error: 'Limite de taux depassee. Reessayez dans 1 minute.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
        },
      },
    );
  },
);
```

---

## 5. Export des handlers

```typescript
// test/msw/handlers/ai-engine-api-keys.ts (export final)

/**
 * Handlers nominaux : a utiliser par defaut dans tous les tests.
 * Ces handlers simulent le comportement normal de l'API.
 */
export const apiKeysHandlers = [
  getApiKeysHandler,
  createApiKeyHandler,
  deleteApiKeyHandler,
  testApiKeyHandler,
];

/**
 * Handlers d'erreur : a utiliser via server.use() dans des tests specifiques.
 * Chaque handler remplace le handler nominal pour un scenario d'erreur.
 */
export {
  // 401 - Non authentifie
  unauthorizedHandlers,
  unauthorizedGetHandler,
  unauthorizedPostHandler,
  unauthorizedDeleteHandler,
  unauthorizedTestHandler,

  // 400 - Validation
  validationErrorHandler,

  // 409 - Conflit
  conflictHandler,

  // 429 - Rate limit
  rateLimitHandler,

  // 500 - Erreur serveur
  encryptionMissingHandler,
  serverErrorHandler,

  // 503 - DB indisponible
  dbUnavailableHandler,
};
```

---

## 6. Fonctions utilitaires des handlers

```typescript
// test/msw/handlers/ai-engine-api-keys.ts (utilitaires internes)

function getProviderName(providerType: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google AI (Gemini)',
    elevenlabs: 'ElevenLabs',
    ollama: 'Ollama (local)',
  };
  return names[providerType] ?? providerType;
}

function extractPrefix(apiKey: string): string | null {
  const prefixes = ['sk-proj-', 'sk-ant-api03-', 'sk-ant-', 'sk-', 'AIza', 'gsk_'];
  for (const prefix of prefixes) {
    if (apiKey.startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
}
```

---

## 7. Utilisation dans les tests

### 7.1 Test avec handlers nominaux (defaut)

```typescript
// Le serveur MSW est configure dans test/setup.ts avec les handlers nominaux
// Aucune configuration supplementaire necessaire

it('doit afficher les cles masquees', async () => {
  render(<ApiKeysTab />);
  await waitFor(() => {
    expect(screen.getByText('sk-proj-...MNOP')).toBeInTheDocument();
  });
});
```

### 7.2 Test avec handler d'erreur (override)

```typescript
import { server } from '@/test/msw/server';
import { unauthorizedGetHandler } from '@/test/msw/handlers/ai-engine-api-keys';

it('doit afficher une erreur si la session est expiree', async () => {
  // Remplacer le handler GET par la version 401
  server.use(unauthorizedGetHandler);

  render(<ApiKeysTab />);
  await waitFor(() => {
    expect(screen.getByText(/erreur/i)).toBeInTheDocument();
  });
});
```

### 7.3 Test avec handler personnalise inline

```typescript
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

it('doit afficher un message specifique quand la DB est lente', async () => {
  server.use(
    http.get('/api/admin/ai-engine/config/api-keys', async () => {
      // Simuler une latence de 3 secondes
      await new Promise(resolve => setTimeout(resolve, 3000));
      return HttpResponse.json({ keys: [], meta: { total: 5, configuredCount: 0, dbKeyCount: 0, envKeyCount: 0 } });
    }),
  );

  render(<ApiKeysTab />);
  // Le skeleton de chargement doit etre visible
  expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
});
```

---

## 8. Verification de securite dans les handlers

### 8.1 Principe

Les handlers MSW sont ecrits pour **ne jamais retourner de cle en clair** dans les reponses, meme dans l'environnement de test. Cela garantit que les tests de composants refletent fidelement le comportement de production.

### 8.2 Points de verification

| Regle | Implementation |
|-------|---------------|
| Pas de champ `apiKey` dans les reponses GET | Le fixture `MOCK_API_KEYS` ne contient pas `apiKey` |
| Pas de champ `encryptedKey` dans les reponses | Aucun handler ne retourne `encryptedKey` |
| Le handler POST ne renvoie pas le body `apiKey` | La reponse POST retourne uniquement `maskedKey` |
| Les reponses d'erreur ne contiennent pas de cle | Les messages d'erreur sont generiques |
| Le handler test ne renvoie pas la cle testee | La reponse test retourne `valid`, pas la cle |
