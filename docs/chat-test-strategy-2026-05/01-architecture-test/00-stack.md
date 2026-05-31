# Architecture du harnais de tests — vue d'ensemble

Schéma global de l'écosystème de tests, dépendances entre composants, et points
d'extension.

## 1. Schéma de l'architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HARNAIS DE TESTS                                       │
│                                                                                 │
│   ┌─────────────────────┐    ┌─────────────────────┐    ┌──────────────────┐  │
│   │  apps/web/src/test/  │    │  apps/web/e2e/       │    │  apps/web/k6/    │  │
│   │  ┌────────────────┐  │    │  ┌────────────────┐  │    │ chat-message.js   │  │
│   │  │ factories/     │  │    │  │ pom/           │  │    │ chat-session.js   │  │
│   │  │ matchers/      │  │    │  │ helpers/       │  │    │ load-burst.js     │  │
│   │  │ msw/           │◄──────│  │ specs/         │  │    │                   │  │
│   │  │   handlers/    │  │    │  │  visitor/      │  │    └──────────────────┘  │
│   │  │   server.ts    │  │    │  │  admin/        │  │                         │
│   │  │ setup/         │  │    │  │  smoke/        │  │                         │
│   │  │ db/            │  │    │  └────────────────┘  │                         │
│   │  └────────────────┘  │    └─────────────────────┘                          │
│   └─────────────────────┘                                                     │
│              ▲                          ▲                                     │
│              │ utilisé par              │ utilisé par                          │
│   ┌──────────┴───────────┐    ┌─────────┴──────────┐                          │
│   │ vitest (unit/int/    │    │ Playwright          │                          │
│   │  component)          │    │ (E2E)               │                          │
│   └──────────────────────┘    └────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘

                       ▼                          ▼
              ┌────────────────┐         ┌──────────────────┐
              │ jsdom + RTL    │         │ Real browsers    │
              │ + MSW (node)   │         │ + axe-playwright │
              └────────────────┘         └──────────────────┘
                       ▼                          ▼
            ┌─────────────────────┐    ┌──────────────────────┐
            │ DB testcontainers   │    │ Server Next.js dev   │
            │ (pgvector pg16)     │    │ ou prod build local  │
            └─────────────────────┘    └──────────────────────┘
```

## 2. Dossier `apps/web/src/test/`

Source de vérité partagée pour TOUS les tests vitest. Pas de duplication entre unit/int/comp.

```
src/test/
├── setup/
│   ├── vitest.setup.ts            // jest-dom, faker.seed(42)
│   ├── msw.setup.ts                // server.listen / reset / close
│   └── matchers.setup.ts           // expect.extend(custom)
├── factories/
│   ├── base.ts                     // defineFactory, createCounter, testId
│   ├── chat-session.factory.ts
│   ├── chat-message.factory.ts
│   ├── chat-lead.factory.ts
│   ├── chat-instruction.factory.ts
│   ├── chat-provider.factory.ts
│   ├── intent-example.factory.ts
│   ├── canned-pair.factory.ts
│   ├── faq-entry.factory.ts
│   ├── knowledge-chunk.factory.ts
│   ├── cart-snapshot.factory.ts
│   ├── tracking-event.factory.ts
│   └── index.ts                    // re-exports
├── msw/
│   ├── server.ts                   // setupServer + base handlers
│   ├── handlers/
│   │   ├── openai.ts               // POST /v1/chat/completions, /v1/embeddings, /v1/moderations
│   │   ├── anthropic.ts
│   │   ├── gemini.ts
│   │   ├── mistral.ts
│   │   ├── ollama.ts
│   │   ├── slack-webhook.ts
│   │   ├── lead-webhook.ts
│   │   ├── tracking.ts
│   │   └── chat-internal.ts        // pour tests component qui call /api/chat/*
│   ├── fixtures/
│   │   ├── openai-chat-stream.txt  // payload SSE pour stream
│   │   ├── openai-embedding.json
│   │   └── ...
│   └── helpers/
│       ├── make-sse-stream.ts
│       ├── stub-llm-chunks.ts
│       └── slow-network.ts
├── matchers/
│   ├── chat-language.ts            // toBeFromLanguage('ar-MA')
│   ├── sse-event.ts                // toBeStreamedEventOf('chunk')
│   ├── kpi-event.ts                // toHaveBeenEmittedToChannel
│   ├── latency-budget.ts           // toRespectBudget('first-chunk')
│   ├── moderation.ts               // toBeBlockedByModeration
│   ├── lead-decision.ts            // toHaveOfferedLeadFormWithReason
│   └── index.ts                    // export customMatchers = { ... }
└── db/
    ├── test-db.ts                  // testcontainers + drizzle migrate
    └── seed-helpers.ts             // seedProvider, seedInstruction, seedFaq, etc.
```

## 3. Dossier `apps/web/e2e/`

```
e2e/
├── pom/
│   ├── chat-widget.pom.ts          // Page Object Model — widget visiteur
│   ├── lead-form.pom.ts
│   ├── admin-leads.pom.ts
│   ├── admin-faq.pom.ts
│   ├── admin-canned.pom.ts
│   ├── admin-providers.pom.ts
│   └── ...
├── helpers/
│   ├── auth-admin.ts               // login admin via API
│   ├── seed-conversation.ts        // crée session+messages via Drizzle direct
│   ├── reset-db.ts
│   ├── network-throttle.ts
│   └── wait-for-stream.ts
├── visitor/
│   ├── chat-visitor-conversation.spec.ts
│   ├── chat-visitor-canned-pill.spec.ts
│   ├── chat-visitor-lead-capture.spec.ts
│   ├── chat-visitor-frustration.spec.ts
│   ├── chat-visitor-darija.spec.ts
│   ├── chat-visitor-rtl.spec.ts
│   └── chat-visitor-offline-resilience.spec.ts
├── admin/
│   ├── chat-admin-leads-list.spec.ts
│   ├── chat-admin-leads-outcome.spec.ts
│   ├── chat-admin-faq-publish.spec.ts
│   ├── chat-admin-canned-publish.spec.ts
│   ├── chat-admin-providers-rotate.spec.ts
│   ├── chat-admin-instructions-version.spec.ts
│   └── chat-admin-system-toggle.spec.ts
├── smoke/
│   └── smoke-chat.spec.ts
└── business-scenarios/
    ├── BS01-conversion-fr.spec.ts
    ├── BS02-frustration-fr.spec.ts
    ├── BS03-conversion-darija.spec.ts
    ├── BS04-panne-provider.spec.ts
    ├── BS05-admin-publication.spec.ts
    ├── BS06-admin-provider-rotation.spec.ts
    ├── BS07-rgpd-forget.spec.ts
    ├── BS08-multilingue-handover.spec.ts
    ├── BS09-budget-exhausted.spec.ts
    └── BS10-tools-recall-stock.spec.ts
```

## 4. Dossier `apps/web/k6/`

```
k6/
├── lib/
│   ├── auth.js                     // helpers de connexion
│   ├── data.js                     // données réalistes
│   └── thresholds.js               // seuils SLO
├── chat-message.js                 // POST /api/chat/message (SSE) — scénario par défaut
├── chat-session.js
├── load-burst.js                   // pic de trafic (spike test)
├── soak-test.js                    // longévité (24 h)
└── chaos/
    ├── provider-failover.js        // tue OpenAI au milieu → vérifier failover Anthropic
    └── budget-saturation.js        // saturé budget → vérifier canned only
```

## 5. Dépendances entre couches

```
        unit ────► factories
                       ▲
                       │ utilisée par
                       │
        component ─────┤
                       │
        integration ───┤
                       │
        e2e ───────────┤
                       │
                       ▼
                  MSW handlers
                       ▲
                       │ utilisée par
        unit ──────────┤
        component ─────┤
        integration ───┤
        (e2e n'utilise pas MSW — vrais serveurs)
```

**Règle d'or** : tout test peut utiliser une factory, mais une factory ne dépend **pas**
d'un test. Les factories sont **production-grade** : import depuis le code de prod
autorisé pour les types, jamais inverse.

## 6. Stub provider LLM — pattern

Pour les tests integration qui ne veulent pas MSW (trop verbose), un stub provider :

```typescript
// apps/web/src/test/msw/helpers/stub-llm.ts
export function createFakeProvider(opts: {
  chunks?: string[];
  delayMs?: number;
  failAfter?: number;
}): ChatProvider {
  return {
    kind: 'openai',
    streamChat: async function* (req) {
      for (const [i, chunk] of (opts.chunks ?? ['Hello']).entries()) {
        if (opts.failAfter && i >= opts.failAfter) throw new Error('Stub fail');
        if (opts.delayMs) await sleep(opts.delayMs);
        yield { type: 'token', text: chunk };
      }
      yield { type: 'done' };
    },
    embed: async () => ({ vectors: [Array.from({ length: 1536 }, () => Math.random())] }),
  };
}
```

Utilisé dans `orchestrator.integration.test.ts` pour valider le pipeline sans HTTP mock.

## 7. Stratégie d'isolation

| Test type | Isolation DB | Isolation HTTP | Isolation State |
|-----------|--------------|----------------|-----------------|
| Unit | mocks | mocks | par test |
| Integration | testcontainer + TRUNCATE entre tests | MSW | per-test setup |
| Component | mocks (Drizzle non importé) | MSW | RTL cleanup |
| E2E | testcontainer (CI) ou DB locale + seed | vrai HTTP | per-spec reset |

**TRUNCATE en `beforeEach`** pour integration ; pas `DELETE FROM` ni `DROP TABLE`. Cascade
explicite des relations.

## 8. Configuration parallélisme

| Couche | Stratégie |
|--------|-----------|
| Unit | parallèle full (vitest threads) |
| Integration | parallèle limité (1 testcontainer partagé, ou 1 par worker) |
| Component | parallèle full |
| E2E | parallèle par fichier (Playwright workers = 4 en CI) |

Pour integration avec DB partagée : chaque test = transaction avec `BEGIN` / `ROLLBACK`
(évite TRUNCATE entre tests, accélère).

```typescript
beforeEach(async () => {
  await sql.unsafe('BEGIN');
});
afterEach(async () => {
  await sql.unsafe('ROLLBACK');
});
```

⚠️ Limitation : ne fonctionne **que** si le code testé n'ouvre pas ses propres transactions.
Pour orchestrator, préférer TRUNCATE.

## 9. Points d'extension

### 9.1 Ajouter un nouveau provider LLM

1. Créer `apps/web/src/lib/chat/providers/<name>.ts`
2. Ajouter MSW handler dans `src/test/msw/handlers/<name>.ts`
3. Ajouter dans `chat-provider.factory.ts` une trait `<name>`
4. Test unitaire : `<name>.test.ts`

### 9.2 Ajouter un nouveau matcher

1. Créer `src/test/matchers/<name>.ts`
2. Ajouter au `customMatchers` dans `src/test/matchers/index.ts`
3. Documenter dans [04-matchers-custom.md](04-matchers-custom.md)

### 9.3 Ajouter une nouvelle factory

1. Créer `src/test/factories/<entity>.factory.ts` selon le pattern `defineFactory`
2. Ajouter au `index.ts`
3. Tests d'invariants (que les defaults respectent les contraintes Zod)

## 10. Liens

- [01-data-strategy.md](01-data-strategy.md) — Factories en détail
- [02-msw-handlers-catalog.md](02-msw-handlers-catalog.md) — MSW handlers
- [03-page-objects-pom.md](03-page-objects-pom.md) — Page Object Model Playwright
- [04-matchers-custom.md](04-matchers-custom.md) — Matchers domain-specific
- [05-flakiness-guard.md](05-flakiness-guard.md) — Anti-flakiness
