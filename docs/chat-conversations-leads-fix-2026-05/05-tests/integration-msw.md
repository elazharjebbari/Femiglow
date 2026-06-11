# Tests intégration MSW + Drizzle in-memory

> 6 tests qui exécutent le code admin avec faux network + vraie DB en mémoire.

## 1. Setup MSW

Le projet a déjà un setup MSW (`src/test/msw/`). On ajoute les handlers pour ce sprint.

**Fichier nouveau** : `apps/web/src/test/msw/chat-admin-handlers.ts`

```ts
/**
 * CHA-LEAD-V2 — Handlers MSW pour tester les routes admin chat.
 *
 * Utilisés par les tests d'intégration pour simuler les flows :
 *  - GET /admin/chat/conversations (HTML SSR)
 *  - GET /admin/chat/leads (HTML SSR)
 *  - GET /admin/leads (HTML SSR — vue globale)
 *  - POST /api/admin/chat/cleanup-ghosts
 */
import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:3001';

export const chatAdminHandlers = [
  http.post(`${BASE}/api/admin/chat/cleanup-ghosts`, async ({ request }) => {
    const body = (await request.json()) as { dryRun: boolean };
    return HttpResponse.json({
      candidates: 5,
      archived: body.dryRun ? 0 : 5,
      dryRun: body.dryRun,
      criteria: {
        olderThanDays: 30,
        kinds: ['wizard_pivot'],
        withoutLead: true,
      },
    });
  }),

  http.get(`${BASE}/api/admin/chat/audit-pollution`, () => {
    return HttpResponse.json({
      timestamp: new Date().toISOString(),
      distributions: {
        session_kind: [
          { kind: 'chat', n: 50 },
          { kind: 'wizard_pivot', n: 30 },
          { kind: 'system', n: 0 },
        ],
        lead_source: [
          { source: 'chat_widget', n: 20 },
          { source: 'inline', n: 5 },
          { source: 'wizard_kit', n: 15 },
        ],
      },
      coherence: [
        { kind: 'chat', source: 'chat_widget', n: 20 },
        { kind: 'wizard_pivot', source: 'wizard_kit', n: 15 },
      ],
    });
  }),
];
```

## 2. Test `chat-admin.integration.test.ts`

**Fichier nouveau** : `apps/web/src/test/integration/chat-admin.integration.test.ts`

```ts
/**
 * CHA-LEAD-V2 — Tests d'intégration admin chat avec MSW + DB in-memory.
 *
 * On simule la stack complète :
 *  - Insert chat_session via les vrais repos
 *  - Insert chat_lead via les vrais repos
 *  - Lecture via adminQueries
 *  - Validation que les filtres marchent
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupMemoryDb, resetMemoryDb } from '@/test/helpers/db-helpers';
import { adminQueries } from '@/lib/chat/admin/queries';
import { sessionRepo } from '@/lib/chat/repos/session';
import { wizardSessionRepo } from '@/lib/checkout/repos/session-repo';
import { messageRepo } from '@/lib/chat/repos/message';
import { wizardLeadRepo } from '@/lib/checkout/repos/lead-repo';

// Active feature flag pour tous les tests
vi.mock('@/lib/chat/feature-flag', () => ({
  isChatAdminFiltersV2Enabled: () => true,
  isChatEnabled: () => true,
}));

beforeEach(async () => {
  await setupMemoryDb();
});

afterEach(async () => {
  await resetMemoryDb();
});

describe('@chat-purity intégration — adminQueries après fix V2', () => {
  it('listConversations exclut les sessions wizard_pivot', async () => {
    // Setup : 2 chat sessions avec messages + 3 wizard ghosts
    const chat1 = await sessionRepo.create({
      visitorId: 'v_chat_1',
      language: 'fr',
      page: '/kit',
      instructionVersionId: 'iv_test',
      status: 'open',
    });
    await messageRepo.append({
      sessionId: chat1.id,
      role: 'user',
      content: 'Bonjour',
      status: 'sent',
    });

    const chat2 = await sessionRepo.create({
      visitorId: 'v_chat_2',
      language: 'fr',
      page: '/',
      instructionVersionId: 'iv_test',
      status: 'open',
    });
    await messageRepo.append({
      sessionId: chat2.id,
      role: 'user',
      content: 'Prix ?',
      status: 'sent',
    });

    // 3 wizard ghosts
    for (let i = 1; i <= 3; i++) {
      await wizardSessionRepo.ensureForWizard({
        sessionId: `s_ghost_${i}`,
        visitorId: `v_ghost_${i}`,
        language: 'fr',
        page: '/kit',
      });
    }

    // Action
    const rows = await adminQueries.listConversations({});

    // Assert : seules les 2 chat sessions remontent
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === 'chat')).toBe(true);
  });

  it('listConversations debug mode inclut tout', async () => {
    // Setup : 2 chat (avec msg) + 2 wizard (sans msg)
    await sessionRepo.create({
      visitorId: 'v_1',
      language: 'fr',
      page: '/kit',
      instructionVersionId: 'iv_test',
      status: 'open',
    });
    await wizardSessionRepo.ensureForWizard({
      sessionId: 's_1',
      visitorId: 'v_w1',
      language: 'fr',
      page: '/kit',
    });

    const rows = await adminQueries.listConversations({
      withMessagesOnly: false,
      kinds: ['chat', 'wizard_pivot', 'system'],
    });

    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('listChatLeads exclut les leads source=wizard_*', async () => {
    // Setup : 2 chat sessions
    const chatSess = await sessionRepo.create({
      visitorId: 'v_chat',
      language: 'fr',
      page: '/',
      instructionVersionId: 'iv_test',
      status: 'open',
    });

    // Chat lead via le repo chat (source=chat_widget)
    // ... insertion d'un chat_lead avec source='chat_widget' ...

    // Wizard lead (source=wizard_kit)
    const wizSess = await wizardSessionRepo.ensureForWizard({
      sessionId: 's_w_1',
      visitorId: 'v_w_1',
      language: 'fr',
      page: '/kit',
    });
    await wizardLeadRepo.createWizardLead({
      sessionId: wizSess.id,
      visitorId: 'v_w_1',
      phone: '+212600000000',
      firstName: 'TestWizard',
      consentVersion: 'v1',
      language: 'fr',
      formId: 'kit_wizard',
      formMode: 'wizard_embed',
      source: 'wizard_kit',
      cartSnapshot: null,
      // ... autres champs ...
    });

    const rows = await adminQueries.listChatLeads({});

    // Assert : 0 lead wizard
    expect(rows.find((r) => r.source === 'wizard_kit')).toBeUndefined();
    expect(rows.every((r) => ['chat_widget', 'inline'].includes(r.source))).toBe(true);
  });

  it('listChatLeads override sources inclut wizard', async () => {
    // Setup similar
    const rows = await adminQueries.listChatLeads({
      sources: ['chat_widget', 'inline', 'wizard_kit'],
    });
    expect(rows.some((r) => r.source === 'wizard_kit')).toBe(true);
  });

  it('convertedSessionIds dédoublonne entre converted_at et lead converted', async () => {
    // Setup
    const sess1 = await sessionRepo.create({
      visitorId: 'v_1',
      language: 'fr',
      page: '/kit',
      instructionVersionId: 'iv_test',
      status: 'open',
    });
    await sessionRepo.update(sess1.id, { convertedAt: new Date(), convertedOrderId: 'ord_1' });

    // ... ajouter un chat_lead lié avec outcome=converted ...

    const ids = await adminQueries.convertedSessionIds();

    expect(ids).toContain(sess1.id);
    // Dédupliqué : pas de double entry
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('overviewKpis ne compte que kind=chat', async () => {
    // Setup : 5 chat sessions, 10 wizard ghosts
    for (let i = 0; i < 5; i++) {
      await sessionRepo.create({
        visitorId: `v_c_${i}`,
        language: 'fr',
        page: '/',
        instructionVersionId: 'iv_test',
        status: 'open',
      });
    }
    for (let i = 0; i < 10; i++) {
      await wizardSessionRepo.ensureForWizard({
        sessionId: `s_w_${i}`,
        visitorId: `v_w_${i}`,
        language: 'fr',
        page: '/kit',
      });
    }

    const kpis = await adminQueries.overviewKpis('30d');

    // Doit compter 5, pas 15
    expect(kpis.sessions).toBe(5);
  });
});
```

## 3. Helper `db-helpers.ts`

**Fichier nouveau** : `apps/web/src/test/helpers/db-helpers.ts`

```ts
/**
 * Helper pour démarrer / reset une DB Postgres in-memory pour tests.
 *
 * Utilise pglite ou pg-mem selon dispo. Initialise les tables via
 * `drizzle-kit push:pg` ou via SQL manuel.
 */
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const TEST_DB_URL = 'postgres://test@localhost:5433/femiglow_test';

export async function setupMemoryDb(): Promise<void> {
  process.env.DATABASE_URL = TEST_DB_URL;
  // Démarrer pglite ou similar — implémentation dépend du projet
  // Exemple avec pg-mem :
  // const { newDb } = await import('pg-mem');
  // const db = newDb();
  // (process as any).__testDb = db;
  // db.public.none(`<full DDL>`);
  // ...
}

export async function resetMemoryDb(): Promise<void> {
  // Truncate toutes les tables sauf migrations
  // ...
}
```

## 4. Variante simplifiée — sans pglite

Si le projet n'a pas pglite/pg-mem configuré, simuler via mocks Drizzle directement (comme dans `unit-vitest.md`). C'est moins puissant mais ça marche pour valider la composition des queries.

## 5. Exécution

```bash
# Tests d'intégration uniquement
pnpm vitest run src/test/integration/chat-admin.integration.test.ts

# Avec watch (dev)
pnpm vitest watch src/test/integration/chat-admin.integration.test.ts
```

## 6. Critères d'acceptation

- [ ] 6 tests verts
- [ ] Pas de fuite entre tests (chaque test setup + reset DB)
- [ ] Coverage > 80% sur les paths intégrés
- [ ] Exécution en < 10s (tests rapides)

## 7. Notes de design

- Tests d'intégration **lents** par nature (vraie DB). Si > 30s, à scinder.
- Préférer **petites factories** isolées (`buildChatSession({ ... })`) plutôt que setup global.
- **Pas de tests UI** ici — c'est le rôle des tests Playwright (cf. `e2e-playwright.md`).
