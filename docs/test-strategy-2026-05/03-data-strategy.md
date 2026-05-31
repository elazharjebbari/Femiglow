# 03 — Stratégie data : factories, fixtures, seeders

## Pourquoi des factories ?

**Avant (anti-pattern observé)** :
```ts
// Test A
const order = {
  id: 'ord_1', total: 199, items: [{sku:'X', qty:1}],
  createdAt: new Date(), status: 'pending', ...30 lignes
};
// Test B — répétition de 30 lignes ailleurs
// Test C — variante avec une seule clé différente → 30 lignes dupliquées
```

**Après** :
```ts
import { orderFactory } from '@/test/factories';
const order = orderFactory.build({ total: 199 }); // 1 ligne
const orderWithRefund = orderFactory.refunded().build(); // trait
```

## Architecture factory

### Base abstraite

```ts
// src/test/factories/base.ts
import { z } from 'zod';

export interface Factory<T> {
  build(overrides?: Partial<T>): T;
  buildMany(count: number, overrides?: Partial<T>): T[];
  buildList(overrides: Array<Partial<T>>): T[];
}

export function defineFactory<T extends Record<string, unknown>>(
  defaults: () => T,
): Factory<T> {
  return {
    build(overrides = {}) {
      return { ...defaults(), ...overrides };
    },
    buildMany(count, overrides) {
      return Array.from({ length: count }, () => this.build(overrides));
    },
    buildList(overrides) {
      return overrides.map((o) => this.build(o));
    },
  };
}
```

### Factories métier — exemples

```ts
// src/test/factories/order.factory.ts
import { defineFactory } from './base';
import type { Order } from '@/lib/schemas';

const counter = { value: 0 };

export const orderFactory = {
  ...defineFactory<Order>(() => ({
    id: `ord_${++counter.value}_${Math.random().toString(36).slice(2, 8)}`,
    total: 19900,
    currency: 'MAD',
    items: [
      {
        sku: 'FEMI-KIT-100',
        name: 'Pack FemiGlow',
        quantity: 1,
        unitPriceCents: 19900,
      },
    ],
    status: 'pending',
    createdAt: new Date('2026-05-24T10:00:00Z'),
    customerEmail: `test_${counter.value}@example.com`,
  })),

  // Traits réutilisables
  refunded(): typeof orderFactory {
    return {
      ...orderFactory,
      build(overrides = {}) {
        return orderFactory.build({ status: 'refunded', ...overrides });
      },
    };
  },

  highValue(): typeof orderFactory {
    return {
      ...orderFactory,
      build(overrides = {}) {
        return orderFactory.build({ total: 99900, ...overrides });
      },
    };
  },
};
```

### Patterns avancés

#### A. Relations (sequelize-style)
```ts
// orderItem.factory.ts
export const orderItemFactory = defineFactory<OrderItem>(() => ({
  sku: 'FEMI-KIT-100',
  quantity: 1,
  unitPriceCents: 19900,
}));

// Compose
const order = orderFactory.build({
  items: orderItemFactory.buildMany(3),
});
```

#### B. Avec persistance DB
```ts
// helpers/db-factory.ts
export async function createOrder(overrides?: Partial<Order>): Promise<Order> {
  const order = orderFactory.build(overrides);
  await db().insert(schema.orders).values(order);
  return order;
}
```

#### C. Sequence pour unicité
```ts
const userCounter = { value: 0 };
export const userFactory = defineFactory<User>(() => {
  const id = ++userCounter.value;
  return {
    id: `user_${id}`,
    email: `test_${id}@example.com`,
    name: `User ${id}`,
  };
});
```

#### D. Trait combinables
```ts
const admin = userFactory.admin().active().build();
const guest = userFactory.guest().recentlySignedUp().build();
```

## Factories à créer (priorité)

| Factory | Module | Effort | Statut |
|---|---|---|---|
| `userFactory` | auth | 30 min | ⏳ |
| `orderFactory` | checkout | 30 min | ⏳ |
| `leadFactory` | wizard | 30 min | ⏳ |
| `chatSessionFactory` | chat | 45 min | ⏳ |
| `chatMessageFactory` | chat | 30 min | ⏳ |
| `trackingEventFactory` | tracking | 45 min | ⏳ |
| `productFactory` | products | 30 min | ⏳ |
| `mediaFactory` | components | 30 min | ⏳ |
| `componentDraftFactory` | content-studio | 30 min | ⏳ |
| `publishingJobFactory` | social-publishing | 30 min | ⏳ |
| `attributionSnapshotFactory` | tracking | 30 min | ⏳ |
| `cartSnapshotFactory` | checkout | 30 min | ⏳ |

**Total** : ~6 h pour 12 factories core.

## Fixtures statiques

Pour les payloads complexes (JSON snapshots, images test) :

```
src/test/fixtures/
├── images/
│   ├── test-pack.png (mock packshot 320×400)
│   ├── test-mobile.png (375×667)
│   └── test-svg.svg
├── payloads/
│   ├── meta-capi-event.json
│   ├── postiz-publish-response.json
│   ├── openai-stream-chunks.txt (SSE format)
│   └── anthropic-stream-chunks.txt
└── responses/
    ├── google-ads-conversion-success.json
    └── tiktok-events-success.json
```

Loader helper :
```ts
// src/test/helpers/fixtures.ts
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

export function loadFixture(relativePath: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, relativePath), 'utf8');
}

export function loadJsonFixture<T>(relativePath: string): T {
  return JSON.parse(loadFixture(relativePath)) as T;
}
```

## Seeders test

### Pour vitest (memory store rapide)

```ts
// src/test/helpers/seed-test.ts
import { memoryStore } from '@/lib/db/client';
import { productFactory, orderFactory } from '../factories';

export function seedBasicProducts(): void {
  const store = memoryStore();
  const product = productFactory.build({ slug: 'le-kit', id: 'prod_1' });
  store.products.set(product.id, product);
}

export function seedFullScenario(): {
  user: User;
  product: Product;
  order: Order;
} {
  const store = memoryStore();
  const user = userFactory.build();
  const product = productFactory.build();
  const order = orderFactory.build({
    customerEmail: user.email,
    items: [{ sku: product.variants[0].sku, qty: 1, unitPriceCents: 19900 }],
  });

  store.users.set(user.id, user);
  store.products.set(product.id, product);
  store.orders.set(order.id, order);

  return { user, product, order };
}
```

### Pour E2E Playwright (DB Postgres test)

```ts
// e2e/helpers/seed-db.ts
import { execSync } from 'node:child_process';

export async function seedTestDb(): Promise<void> {
  // 1. Wipe DB
  execSync('pnpm tsx scripts/reset-test-db.ts');

  // 2. Run migrations
  execSync('pnpm --filter @femiglow/web exec drizzle-kit push:pg');

  // 3. Seed data
  execSync('pnpm tsx scripts/seed-products.ts');
  execSync('pnpm tsx scripts/seed-rituals.ts');
}
```

## Anonymisation prod → test

Pour des tests avec données réalistes sans PII :

```ts
// src/test/helpers/anonymize.ts
import crypto from 'node:crypto';

export function anonymizeEmail(email: string): string {
  const hash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 8);
  return `anon_${hash}@example.com`;
}

export function anonymizePhone(phone: string): string {
  return '+212600000000'; // fixed pour tests
}

export function anonymizeOrder(order: Order): Order {
  return {
    ...order,
    customerEmail: anonymizeEmail(order.customerEmail),
    customerPhone: anonymizePhone(order.customerPhone),
    shippingAddress: {
      ...order.shippingAddress,
      lastName: 'Anon',
      firstName: 'Test',
    },
  };
}
```

## Fixtures de date / temps

```ts
// src/test/setup.ts
import { beforeEach, afterEach, vi } from 'vitest';

// FROZEN_NOW pour tests temporels déterministes
export const FROZEN_NOW = new Date('2026-05-24T10:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});
```

## Data scenarios prédéfinis (test plans)

```ts
// src/test/helpers/scenarios.ts

/** Cas 1 : utilisateur Meta paid avec lead + order. */
export async function scenarioMetaPaidConversion() {
  const lead = leadFactory.build({ source: 'meta_paid' });
  const trackingEvents = [
    trackingEventFactory.build({ event_name: 'page_view', trafficSource: 'paid_social' }),
    trackingEventFactory.build({ event_name: 'generate_lead', trafficSource: 'paid_social' }),
    trackingEventFactory.build({ event_name: 'purchase', trafficSource: 'paid_social' }),
  ];
  const order = orderFactory.build({ leadId: lead.id });
  return { lead, trackingEvents, order };
}

/** Cas 2 : chat session avec lead capture inline. */
export async function scenarioChatLeadCapture() {
  const session = chatSessionFactory.build();
  const messages = chatMessageFactory.buildMany(5, { sessionId: session.id });
  const lead = leadFactory.build({ source: 'chat_widget', sessionId: session.id });
  return { session, messages, lead };
}

/** Cas 3 : publishing pipeline avec dead letter. */
export async function scenarioPublishingDeadLetter() {
  const post = contentPostFactory.build({ status: 'dead' });
  const deliveries = publishingDeliveryFactory.buildMany(5, {
    postId: post.id,
    attemptCount: 5, // dead letter
    status: 'failed',
  });
  return { post, deliveries };
}
```

## Garde-fous

### ❌ Anti-patterns à bannir

```ts
// ❌ Fixture inline qui se duplique
it('test', () => {
  const order = { id: '1', total: 199, items: [/* 30 lignes */] };
});

// ❌ Factory qui touche la DB sans cleanup
export async function createOrder() {
  return db().insert(schema.orders).values(...); // pas de tracking pour rollback
}

// ❌ Factory globalement mutable
let counter = 0;
export const orderFactory = {
  build: () => ({ id: counter++ }) // PROBLÈME : pas reset entre tests
};
```

### ✅ Patterns à adopter

```ts
// ✅ Factory avec defaults sensés + overrides
const order = orderFactory.build({ total: 99900 });

// ✅ Factory avec relation
const order = orderFactory.build({
  items: orderItemFactory.buildMany(3),
});

// ✅ Trait pour variantes communes
const refunded = orderFactory.refunded().build();

// ✅ Counter scoped (reset via afterEach)
const counter = { value: 0 };
afterEach(() => { counter.value = 0; });
```

## Maintenance des factories

### Quand mettre à jour ?
- Le schéma DB change → factory match obligatoire
- Un nouveau champ requis ajouté → defaults sensés
- Un trait devient courant (> 5 usages) → ajouter comme méthode

### Convention de nommage
- Singulier : `orderFactory.build()` (pas `ordersFactory`)
- Traits = présent : `refunded()`, `published()`, `pending()`
- Pas de verbe pour le build : `build()` standard, pas `make()`/`create()`

### Tests des factories
Oui, les factories ont leurs propres tests :
```ts
// orderFactory.test.ts
describe('orderFactory', () => {
  it('build avec defaults → schema Zod valide', () => {
    const order = orderFactory.build();
    expect(() => orderSchema.parse(order)).not.toThrow();
  });

  it('build avec overrides → applique correctement', () => {
    const order = orderFactory.build({ total: 99900 });
    expect(order.total).toBe(99900);
  });

  it('refunded() trait → status="refunded"', () => {
    expect(orderFactory.refunded().build().status).toBe('refunded');
  });
});
```
