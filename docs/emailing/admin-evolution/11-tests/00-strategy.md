# Test strategy

## Pyramide

```
                  ┌──────────────┐
                  │   Test       │
                  │  ultime      │   1 par phase
                  │  E2E         │
                  └──────────────┘
              ┌────────────────────┐
              │   Playwright E2E   │   smoke parcours
              └────────────────────┘
         ┌──────────────────────────────┐
         │   MSW integration            │   1 par endpoint
         │   (Vitest + handlers)        │
         └──────────────────────────────┘
   ┌────────────────────────────────────────┐
   │   Jest unit (RTL pour composants)      │   exhaustif
   └────────────────────────────────────────┘
```

## Outils

| Couche | Outil | Why |
|---|---|---|
| Unit logic | Vitest (déjà en place) | Cohérent avec existant |
| Unit React | Vitest + React Testing Library | Idem |
| Mock HTTP | MSW (Mock Service Worker) | Mock Listmonk / API routes côté client + serveur |
| Mock DB | `makeFakeDrizzle` (existant) | Cohérent emailing existant |
| E2E | Playwright | Existant |
| A11y | axe-playwright | Integration CI |
| Visual | Playwright snapshots (opt-in) | V2, pas en V1 |

## Conventions

- Un fichier de test = 1 module testé
- Naming : `{module}.test.ts` (Jest), `{scenario}.spec.ts` (Playwright)
- Tests indépendants — pas de partage d'état entre tests (`beforeEach` reset)
- Pas de timeout > 30s (sauf E2E job longs)
- Test isolés et **déterministes**

## Couverture cible

| Module | Couverture |
|---|---|
| Rules compiler | ≥ 95% branches |
| Snapshot engine | ≥ 90% lines |
| Automation runner | ≥ 90% lines |
| Composants UI | ≥ 80% lines |
| API endpoints | 100% des contrats happy + erreurs |

## MSW : pourquoi & comment

MSW (Mock Service Worker) permet de mocker les requêtes HTTP au niveau
réseau (intercept). Avantages :
- Tests d'intégration **réalistes** (le code de prod tourne, c'est juste
  la réponse upstream qui est mockée)
- Pas de double maintenance des mocks (handlers centralisés)
- Marche en Vitest (Node) ET dans le browser (E2E si besoin)

Handlers organisés par feature dans `mocks/handlers/` :

```
mocks/
├── handlers/
│   ├── listmonk.ts          # mock Listmonk API
│   ├── stalwart.ts          # mock SMTP webhook
│   ├── outbox.ts            # mock /api/admin/emails/transactional/*
│   ├── audiences.ts         # mock /api/admin/emails/audiences/*
│   ├── automation.ts        # mock /api/admin/emails/automation/*
│   └── user-events.ts       # mock /api/tracking/events
├── server.ts                # setup MSW server (Node, vitest)
└── browser.ts               # setup MSW worker (E2E, V2)
```

## Test ultime par phase

Chaque phase a son **test ultime** : un Playwright E2E qui couvre le
parcours utilisateur le plus important. Critère d'acceptance final.

| Phase | Test ultime |
|---|---|
| M5.1 | [01-m5.1-ultimate.spec.md](03-playwright-e2e/01-m5.1-ultimate.spec.md) |
| M5.2 | [02-m5.2-ultimate.spec.md](03-playwright-e2e/02-m5.2-ultimate.spec.md) |
| M5.3 | [03-m5.3-ultimate.spec.md](03-playwright-e2e/03-m5.3-ultimate.spec.md) |
| M5.4 | [04-m5.4-ultimate.spec.md](03-playwright-e2e/04-m5.4-ultimate.spec.md) |
| M5.5 | [05-m5.5-ultimate.spec.md](03-playwright-e2e/05-m5.5-ultimate.spec.md) |
| M5.6 | [06-m5.6-ultimate.spec.md](03-playwright-e2e/06-m5.6-ultimate.spec.md) |

Et le **test ultime global** : [00-m5-ultimate.spec.md](03-playwright-e2e/00-m5-ultimate.spec.md)

## CI integration

```yaml
# .github/workflows/test.yml (pseudocode)
jobs:
  unit:
    steps:
      - pnpm test:unit                  # Vitest unit + MSW
  
  e2e:
    steps:
      - pnpm playwright test            # E2E + a11y
      - pnpm lighthouse:ci              # perf & a11y audit
```

Tests qui doivent passer pour merger : unit + e2e + lighthouse.

## Fixtures

Pour les tests E2E, on a besoin de :
- Un user admin connecté (storage state via `global.setup.ts`)
- DB avec données prévisibles : leads, orders, email_event seed

Pattern : `apps/web/e2e/fixtures/seed-m5.ts` script idempotent qui
peuple les tables avec ~100 leads, 200 orders, 500 email_events,
1 audience pré-créée.

## Run en local

```bash
# Unit + MSW
pnpm test

# E2E
pnpm playwright test

# Test ultime d'une phase
pnpm playwright test e2e/m5.3-ultimate.spec.ts

# A11y audit
pnpm playwright test e2e/a11y-audit.spec.ts
```

## Run en CI

GitHub Actions, déclenché à chaque PR + sur master après merge.
Cache de node_modules. Postgres en service container.
