# Seeds

## Environnements

| Env | Seed |
|---|---|
| `production` | aucun seed automatique. Le compte admin est créé manuellement (cf. ci-dessous). |
| `preview` (Vercel) | seed minimal (compte admin + 1 webhook test) |
| `development` | seed riche (compte admin, 50 leads variés, 3 endpoints, 200 deliveries) |
| `test` | seed déterministe par scénario (chaque test pose ses fixtures) |

## Compte admin (production)

`apps/web/scripts/create-admin.ts` :

```ts
import { hash, Algorithm } from '@node-rs/argon2';
import { createId } from '@/lib/crypto/ids';
import { db } from '@/lib/db/client';
import { adminUsers } from '@/lib/db/schema';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME ?? 'Fondatrice';

if (!email || !password) {
  console.error('ADMIN_EMAIL et ADMIN_PASSWORD requis.');
  process.exit(1);
}

const hashed = await hash(password, {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

await db.insert(adminUsers).values({
  id: createId(),
  email: email.toLowerCase(),
  passwordHash: hashed,
  name,
});

console.log(`Admin créée : ${email}`);
```

Usage :

```bash
ADMIN_EMAIL=fondatrice@femiglow.ma \
ADMIN_PASSWORD=$(openssl rand -base64 24) \
pnpm tsx scripts/create-admin.ts
```

Le mot de passe est imprimé dans la commande shell **uniquement** —
ne jamais commiter, jamais loguer.

## Seed dev

`apps/web/scripts/seed-dev.ts` :

```ts
import { faker } from '@faker-js/faker/locale/fr';
import { db } from '@/lib/db/client';
import {
  adminUsers, leads, orders, orderItems, leadEvents,
  webhookEndpoints, webhookDeliveries,
} from '@/lib/db/schema';
import { hash, Algorithm } from '@node-rs/argon2';
import { createId } from '@/lib/crypto/ids';
import { encryptSecret } from '@/lib/crypto/encrypt';

await db.transaction(async (tx) => {
  // Compte admin
  const adminId = createId();
  await tx.insert(adminUsers).values({
    id: adminId,
    email: 'dev@femiglow.ma',
    passwordHash: await hash('devdevdev', { algorithm: Algorithm.Argon2id }),
    name: 'Dev Admin',
  });

  // Endpoints
  const slackId = createId();
  await tx.insert(webhookEndpoints).values({
    id: slackId,
    name: 'Slack #leads',
    url: 'https://hooks.slack.com/services/T01/B02/dev',
    events: ['lead.created', 'order.created'],
    encryptedSecret: await encryptSecret('dev_secret_slack_xxxx'),
    active: true,
  });

  // 50 leads variés
  for (let i = 0; i < 50; i++) {
    const leadId = createId();
    const type = faker.helpers.arrayElement(['contact', 'order', 'newsletter', 'b2b'] as const);
    await tx.insert(leads).values({
      id: leadId,
      type,
      status: faker.helpers.arrayElement(['new', 'in_progress', 'won', 'lost'] as const),
      fullName: faker.person.fullName(),
      email: faker.internet.email(),
      phone: faker.phone.number('+212 6 ## ## ## ##'),
      city: faker.helpers.arrayElement(['casablanca', 'rabat', 'marrakech', 'fes']),
      source: `form:${type}`,
      consentAt: faker.date.recent({ days: 30 }),
      createdAt: faker.date.recent({ days: 30 }),
    });

    if (type === 'order') {
      const orderId = createId();
      await tx.insert(orders).values({
        id: orderId,
        leadId,
        totalMinor: faker.number.int({ min: 15000, max: 60000 }),
        currency: 'MAD',
        shippingAddress: { line1: faker.location.streetAddress(), city: 'Casablanca' },
      });
      await tx.insert(orderItems).values({
        id: createId(),
        orderId,
        sku: 'SR-001',
        name: 'Sérum Anti-âge',
        quantity: 1,
        unitPriceMinor: 28000,
      });
    }

    await tx.insert(leadEvents).values({
      id: createId(),
      leadId,
      type: 'created',
      meta: { source: 'seed' },
    });
  }
});

console.log('Seed dev terminé.');
```

## Seed preview

Plus minimaliste : un seul admin (`preview@femiglow.ma` / mot de passe
choisi par l'env `PREVIEW_ADMIN_PASSWORD`) + un endpoint pointant vers
un service mock (webhook.site).

## Seed test

Les tests Vitest+integration et Playwright posent leurs propres
fixtures. Le helper `apps/web/test/utils/seed.ts` fournit :

```ts
export async function seedAdmin(overrides?: Partial<NewAdmin>): Promise<Admin>;
export async function seedLead(overrides?: Partial<NewLead>): Promise<Lead>;
export async function seedWebhookEndpoint(overrides?: Partial<NewEndpoint>): Promise<Endpoint>;
export async function resetTestDb(): Promise<void>;
```

`resetTestDb()` exécute `TRUNCATE` sur toutes les tables (sauf
`drizzle_migrations`). Appelé en `beforeEach` global.

## Idempotence

Tous les seeds doivent être idempotents : exécuter deux fois ne doit
pas dupliquer. Pour les seeds dev, un `TRUNCATE ... CASCADE` initial
nettoie avant insertion.

## Tests

| Type | Fichier |
|---|---|
| Smoke | `seed-dev.test.ts` (vérifie que le seed s'exécute sans erreur) |
