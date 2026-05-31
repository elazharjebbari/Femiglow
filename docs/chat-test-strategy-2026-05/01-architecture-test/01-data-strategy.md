# Stratégie de données — factories, seeds, fixtures

Système unifié pour générer des données de test **réalistes**, **déterministes**,
**composables**, **type-safe**.

## 1. Pattern `defineFactory`

Inspiré de Fishery / Factory Bot avec adaptations TS / Drizzle.

### 1.1 Implémentation

```typescript
// src/test/factories/base.ts
import { faker } from '@faker-js/faker';

export type Factory<T> = {
  build: (overrides?: Partial<T>) => T;
  buildMany: (count: number, overrides?: Partial<T>) => T[];
  buildList: <K extends keyof T>(count: number, fn: (i: number) => Partial<T>) => T[];
};

export function defineFactory<T>(
  defaults: () => T,
  traits?: Record<string, (base: T) => Partial<T>>,
): Factory<T> & Record<string, (overrides?: Partial<T>) => T> {
  const build = (overrides: Partial<T> = {}): T => ({ ...defaults(), ...overrides });
  const buildMany = (count: number, overrides: Partial<T> = {}): T[] =>
    Array.from({ length: count }, () => build(overrides));
  const buildList = <K extends keyof T>(count: number, fn: (i: number) => Partial<T>): T[] =>
    Array.from({ length: count }, (_, i) => build(fn(i)));

  const traitFns: Record<string, (overrides?: Partial<T>) => T> = {};
  for (const [name, mod] of Object.entries(traits ?? {})) {
    traitFns[name] = (overrides: Partial<T> = {}) => {
      const base = build();
      return { ...base, ...mod(base), ...overrides };
    };
  }
  return Object.assign({ build, buildMany, buildList }, traitFns);
}

export function testId(prefix = 'tst'): string {
  return `${prefix}_${faker.string.alphanumeric(16)}`;
}

export function createCounter(): () => number {
  let n = 0;
  return () => ++n;
}
```

### 1.2 Exemple — `chatSessionFactory`

```typescript
// src/test/factories/chat-session.factory.ts
import { defineFactory, testId } from './base';
import { faker } from '@faker-js/faker';
import type { ChatSession } from '@/lib/db/schema';

export const chatSessionFactory = defineFactory<ChatSession>(
  () => ({
    id: testId('cs'),
    visitorId: testId('vis'),
    fingerprint: faker.string.alphanumeric(32),
    language: 'fr-MA',
    status: 'active',
    pageUrl: 'http://localhost:3001/kit',
    pageTitle: 'Pack FemiGlow',
    userAgent: faker.internet.userAgent(),
    ipHash: faker.string.alphanumeric(64),
    experimentVariantId: null,
    convertedAt: null,
    convertedOrderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    forgottenAt: null,
  }),
  {
    arabic: (base) => ({ language: 'ar' }),
    darija: (base) => ({ language: 'ar-MA' }),
    converted: (base) => ({
      status: 'closed',
      convertedAt: new Date(),
      convertedOrderId: testId('ord'),
      closedAt: new Date(),
    }),
    forgotten: (base) => ({
      status: 'forgotten',
      forgottenAt: new Date(),
    }),
    onPath: (base) => ({}), // surcharge à utiliser avec override pageUrl
  },
);

// Usage :
// const session = chatSessionFactory.build({ language: 'ar' });
// const arSession = chatSessionFactory.arabic();
// const converted = chatSessionFactory.converted({ visitorId: 'vis_known' });
```

## 2. Catalogue des factories

### 2.1 Liste complète

| Factory | Entité ciblée | Traits clés |
|---------|---------------|-------------|
| `chatSessionFactory` | `ChatSession` | `arabic`, `darija`, `converted`, `forgotten` |
| `chatMessageFactory` | `ChatMessage` | `userMsg`, `assistantMsg`, `flagged`, `withFeedback` |
| `chatLeadFactory` | `ChatLead` | `pending`, `contacted`, `converted`, `dismissed` |
| `chatInstructionFactory` | `ChatInstructionVersion` | `active`, `archived`, `fr`, `ar`, `arMa` |
| `chatProviderFactory` | `ChatProviderConfig` | `openai`, `anthropic`, `gemini`, `disabled`, `quotaExceeded` |
| `intentExampleFactory` | `ChatIntentExample` | `pricing`, `shipping`, `purchaseIntent`, `greeting` |
| `intentCentroidFactory` | `ChatIntentCentroid` | par intent + langue |
| `cannedPairFactory` | `ChatCannedPair` | `pricing`, `shipping`, `kit-page`, `archived` |
| `cannedPairVersionFactory` | `ChatCannedPairVersion` | history snapshot |
| `faqEntryFactory` | `ChatFaqEntry` | `fr`, `ar`, `arMa`, `highThreshold` |
| `knowledgeSourceFactory` | `ChatKnowledgeSource` | `url`, `md`, `faq`, `volatile` |
| `knowledgeChunkFactory` | `ChatKnowledgeChunk` | `withEmbedding`, `stale` |
| `conversationEventFactory` | `ChatConversationEvent` | `messageSent`, `leadCaptured`, `frustration` |
| `feedbackFactory` | `ChatFeedback` | `up`, `down`, `withComment` |
| `themeFactory` | `ChatThemePreset` | `default`, `darkMode`, `rtl` |
| `runtimeSettingFactory` | `ChatRuntimeSetting` | `chatEnabled`, `disabled` |

### 2.2 Conventions de prénoms / villes (MA-aligned)

Pour réalisme marché Maroc, utiliser :

```typescript
// src/test/factories/helpers/ma-aligned.ts
const FIRST_NAMES_MA = ['Leila', 'Yasmine', 'Salma', 'Imane', 'Houda', 'Khadija', 'Aicha', 'Souad'];
const LAST_NAMES_MA = ['El Amrani', 'Benani', 'Tazi', 'Bennani', 'Alaoui', 'Cherkaoui'];
const CITIES_MA = ['Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir', 'Meknès', 'Oujda'];

export function maName() {
  return {
    firstName: faker.helpers.arrayElement(FIRST_NAMES_MA),
    lastName: faker.helpers.arrayElement(LAST_NAMES_MA),
  };
}

export function maPhone() {
  // Format Maroc : 06XXXXXXXX ou +212 6XXXXXXXX
  return '06' + faker.string.numeric(8);
}

export function maCity() {
  return faker.helpers.arrayElement(CITIES_MA);
}
```

### 2.3 Embeddings — génération stable

Pour les tests RAG / FAQ, on a besoin d'embeddings 1536-dim. Trois stratégies :

| Stratégie | Quand | Implémentation |
|-----------|-------|----------------|
| Random seeded | Test indépendant de la similarité | `Array.from({ length: 1536 }, () => Math.random())` avec faker seed |
| Vecteurs proches | Test FAQ match positif | Petites perturbations autour d'un centre seeded |
| Vecteurs orthogonaux | Test FAQ no-match | Vecteurs choisis pour cosine ≈ 0 |

```typescript
// src/test/factories/helpers/embeddings.ts
export function embeddingNear(center: number[], sigma = 0.05): number[] {
  return center.map((v) => v + (Math.random() - 0.5) * sigma * 2);
}

export function embeddingOrthogonalTo(v: number[]): number[] {
  // approche simple : vecteur aléatoire puis Gram-Schmidt
  const u = Array.from({ length: v.length }, () => Math.random() - 0.5);
  const dot = u.reduce((s, x, i) => s + x * v[i], 0);
  const norm = v.reduce((s, x) => s + x * x, 0);
  return u.map((x, i) => x - (dot / norm) * v[i]);
}

export const CENTER_PRICING_FR = (() => {
  const seed = 'pricing-fr';
  faker.seed([...seed].reduce((a, c) => a + c.charCodeAt(0), 0));
  return Array.from({ length: 1536 }, () => faker.number.float({ min: -1, max: 1 }));
})();
```

## 3. Seeds DB (pour E2E + dev local)

### 3.1 Helper `seedHelpers.ts`

```typescript
// src/test/db/seed-helpers.ts
import { db } from '@/lib/db/client';
import { chatSessionFactory, chatProviderFactory, /* ... */ } from '@/test/factories';

export async function seedBasicChat(): Promise<{
  sessionId: string;
  visitorId: string;
  providerId: string;
}> {
  const provider = chatProviderFactory.openai();
  await db.insert(chatProviderConfig).values(provider);

  const session = chatSessionFactory.build();
  await db.insert(chatSession).values(session);

  return {
    sessionId: session.id,
    visitorId: session.visitorId,
    providerId: provider.id,
  };
}

export async function seedConversation(messages: number = 5): Promise<{ sessionId: string }> {
  const { sessionId } = await seedBasicChat();
  const msgs = Array.from({ length: messages }, (_, i) =>
    chatMessageFactory[i % 2 === 0 ? 'userMsg' : 'assistantMsg']({ sessionId, ordinal: i + 1 }),
  );
  await db.insert(chatMessage).values(msgs);
  return { sessionId };
}

export async function seedFaqDataset(): Promise<void> {
  const entries = [
    faqEntryFactory.build({ key: 'price', questionCanonical: 'C\'est combien le pack ?' }),
    faqEntryFactory.build({ key: 'delivery', questionCanonical: 'Comment livrez-vous ?' }),
    // ...
  ];
  await db.insert(chatFaqEntry).values(entries);
}
```

### 3.2 Seeds réutilisés en E2E

```typescript
// e2e/helpers/seed-conversation.ts
import { seedBasicChat, seedConversation } from '@/test/db/seed-helpers';

export async function setupVisitorWithConversation() {
  const { sessionId, visitorId } = await seedConversation(3);
  return { sessionId, visitorId };
}
```

## 4. Fixtures statiques (JSON / texte)

Pour des cas où la génération random ne convient pas (snapshots de SSE, audits, etc.) :

```
src/test/msw/fixtures/
├── openai-chat-stream.txt         // Payload SSE OpenAI réel anonymisé
├── openai-embedding-1536.json     // Embedding réel anonymisé
├── anthropic-stream.txt
├── moderation-flagged.json
├── moderation-safe.json
├── faq-fr-canonical.json          // Liste de FAQ FR réalistes
├── faq-ar-canonical.json
├── slack-webhook-ok.json
└── lead-webhook-payload.json
```

## 5. Anti-patterns

### 5.1 ❌ Données hardcodées dans le test

```typescript
// MAUVAIS
const session = { id: 'cs_123', visitorId: 'vis_456', language: 'fr-MA', /* 20 autres champs… */ };
```

```typescript
// BON
const session = chatSessionFactory.build({ language: 'fr-MA' }); // seul l'override matter
```

### 5.2 ❌ Faker sans seed

```typescript
// MAUVAIS — tests flaky selon le run
const name = faker.person.firstName();
```

```typescript
// BON — seed global dans vitest.setup.ts : faker.seed(42);
const name = faker.person.firstName(); // toujours reproductible
```

### 5.3 ❌ Mutation de fixtures globales

```typescript
// MAUVAIS — pollute les autres tests
const session = chatSessionFactory.build();
session.status = 'closed'; // mutation

// BON
const session = chatSessionFactory.build({ status: 'closed' });
```

## 6. Tests des factories (méta-tests)

Les factories elles-mêmes doivent être testées :

```typescript
// src/test/factories/chat-session.factory.test.ts
describe('chatSessionFactory', () => {
  it('produces a valid ChatSession respecting Zod schema', () => {
    const session = chatSessionFactory.build();
    expect(() => ChatSessionSchema.parse(session)).not.toThrow();
  });

  it('produces distinct ids on consecutive builds', () => {
    const a = chatSessionFactory.build();
    const b = chatSessionFactory.build();
    expect(a.id).not.toBe(b.id);
  });

  it('respects override', () => {
    const s = chatSessionFactory.build({ language: 'ar' });
    expect(s.language).toBe('ar');
  });

  describe('traits', () => {
    test('arabic trait sets language to ar', () => {
      expect(chatSessionFactory.arabic().language).toBe('ar');
    });
    test('converted trait populates converted fields', () => {
      const s = chatSessionFactory.converted();
      expect(s.convertedAt).toBeInstanceOf(Date);
      expect(s.convertedOrderId).toMatch(/^ord_/);
    });
  });
});
```

## 7. Maintenance

- **Nouvelle colonne DB** → mettre à jour la factory associée (CI fail sinon via type check)
- **Nouvelle table chat_*** → créer une factory + l'ajouter à `index.ts`
- **Nouveau trait métier** → discuter avec product, ajouter au catalogue ci-dessus
- **Audit trimestriel** : passer en revue les factories pour éliminer les overrides
  redondants
