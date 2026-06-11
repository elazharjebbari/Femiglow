# 01 — Inventaire de l'existant

## Tests en place (vitest)

Total recensé : **~4 678 tests** (au 24 mai 2026, branche master).

### Par catégorie

| Catégorie | Fichiers | Tests | Coverage estimée |
|---|---|---|---|
| **Tracking** | 25+ | ~700 | ≥ 90% (sprints attribution + live) |
| **Chat** | 30+ | ~500 | ~80% (orchestrator + providers + repos) |
| **Checkout / wizard** | 40+ | ~600 | ≥ 85% (refonte W0-W4 + L-1) |
| **Content Studio** | 25+ | ~400 | ~75% |
| **Social Publishing** | 15+ | ~250 | ~70% |
| **Admin (analytics, components, legal, SEO)** | 50+ | ~800 | ~75% |
| **Lib (taxonomy, redis, schemas, validators)** | 60+ | ~900 | ≥ 85% |
| **Components UI** | 80+ | ~500 | ~60% (gap identifié) |
| **Total** | **325+** | **~4 678** | **~75% global** |

### Top fichiers de tests (taille)

```bash
$ find apps/web/src -name "*.test.ts*" -exec wc -l {} \; | sort -rn | head -10
1245  apps/web/src/lib/tracking/server/dispatcher.test.ts
987   apps/web/src/lib/checkout/state/wizard-store.test.ts
856   apps/web/src/lib/social-publishing/admin-service.test.ts
743   apps/web/src/lib/chat/services/orchestrator.test.ts
689   apps/web/src/lib/products/feed/merchant-xml-fuzz.test.ts
```

## Tests Playwright créés mais NON exécutés

| Spec file | Sprint origine | Specs | Statut |
|---|---|---|---|
| `e2e/kit-layout-v2.spec.ts` | Landing reorder | 8 | jamais run |
| `e2e/attribution-end-to-end.spec.ts` | Attribution fix | 8 | jamais run |
| `e2e/attribution-multi-touch.spec.ts` | Attribution fix | 9 | jamais run |
| `e2e/live-chat.spec.ts` | Live systems S7 | 5 | jamais run |
| `e2e/live-publishing.spec.ts` | Live systems S7 | 5 | jamais run |
| `e2e/live-tracking.spec.ts` | Live systems S7 | 6 | jamais run |
| **Total créés** | — | **41 specs** | **0 validés** |

Specs Playwright existants (anciens) : `~80 fichiers e2e/*.spec.ts`.

## Outillage MSW existant

Handlers déjà en place :
```
apps/web/src/test/msw/
├── attribution-handlers.ts (12 tests intégration)
├── tracking-providers-handlers.ts
├── postiz-handlers.ts (étendable)
├── event-mappings-handlers.ts
├── rituals-admin-handlers.ts
├── legal-handlers.ts
├── content-studio-handlers.ts
├── component-fields-handlers.ts
└── social-publishing-handlers.ts
```

**Manquant** :
- ❌ OpenAI handlers (chat streaming SSE)
- ❌ Anthropic handlers (fallback chat)
- ❌ Meta CAPI handlers (batch dispatch)
- ❌ TikTok / Snap / Pinterest CAPI

## Outillage existant

| Outil | Statut | Notes |
|---|---|---|
| Vitest | ✅ Configuré | `vitest.config.ts` + setup files |
| Playwright | ✅ Configuré | `playwright.config.ts` existe, mais **specs non câblés CI** |
| MSW | ✅ Configuré | `msw/node` + handlers modulaires |
| Drizzle | ✅ Configuré | Test DB via `memoryStore()` fallback |
| Axe-core/playwright | ⚠️ Partiel | Utilisé dans `legal-a11y.spec.ts` uniquement |
| Lighthouse CI | ❌ Manquant | À ajouter |
| k6 | ❌ Manquant | À ajouter |
| Snapshot visual | ❌ Manquant | Pas d'infra |
| Coverage report | ⚠️ Partiel | `vitest --coverage` jamais run en CI |

## Gaps identifiés

### Backend (P1)
- ❌ Tests pour helpers Redis (✅ ajouté Sprint live-systems)
- ❌ Tests pour scripts (backfill, smoke)
- ❌ Tests pour cron handlers (`/api/cron/*`)
- ❌ Tests pour middleware Next.js (auth + CSP)
- ❌ Tests pour webhooks outbound (signatures, retries)

### Frontend (P0)
- ❌ Tests pour beaucoup de composants UI (~40% sans test)
- ❌ Tests a11y axe (jamais étendu après legal)
- ❌ Tests responsive (breakpoints sm/md/lg)
- ❌ Tests stories Storybook (pas de Storybook actuellement)

### Data (P2)
- ⚠️ Pas de factories typées partagées
- ⚠️ Fixtures inline répétées dans 100+ fichiers
- ❌ Pas de seed test isolé (juste seeders prod)

### E2E (P0)
- ❌ Aucune E2E Playwright passe actuellement en CI
- ❌ Pas de smoke runner intégré CI/CD
- ❌ Pas de tests parcours utilisateur métier (conversion funnel)

### Performance (P1)
- ❌ Pas de budget Lighthouse
- ❌ Pas de load tests
- ❌ Pas de mesure web vitals en CI

### Sécurité (P1)
- ❌ Pas de scan XSS / SQLi automatique
- ❌ Pas de tests OWASP top-10
- ⚠️ Audit deps (`pnpm audit`) jamais en CI
- ❌ Pas de pentest dossier (manuel)

## Anti-patterns observés

1. **Fixtures injectées à la main qui masquent les bugs** — cf. audit `attribution-fix-2026-05` où `overview.test.ts` injectait `trafficSource` à la main, masquant le bug de 100% direct en prod.
2. **Tests E2E créés mais non exécutés** — 41 specs Playwright dormants.
3. **Mocks dupliqués entre tests** — chaque test refait son mock OpenAI/Meta.
4. **Tests qui dépendent du timing réel** — `Date.now()` sans `vi.useFakeTimers()`.
5. **Tests sans assertion explicite** — vérifient juste qu'il n'y a pas de throw.
6. **Tests qui pollutent le state global** — pas de `beforeEach()` reset propre.

## Inventaire infrastructure de tests

### Configuration vitest existante
- `apps/web/vitest.config.ts` : setup, alias, env
- `apps/web/src/test/setup.ts` : globals (server-only stub, etc.)
- Workers parallel : configuré
- Watch mode : `pnpm vitest --watch`

### Configuration Playwright existante
- `apps/web/playwright.config.ts` : projets (chromium, mobile), retries=2, fullyParallel=false
- `apps/web/e2e/global.setup.ts` : auth admin seed
- Vidéos/screenshots on failure : oui
- HTML report : oui

### Variables d'env de test
| Variable | Usage |
|---|---|
| `DATABASE_URL` | Test DB (peut être absent → memory store) |
| `NEXT_PUBLIC_CHAT_ENABLED` | Active chat widget |
| `OPENAI_API_KEY` | Test/mock |
| `CRON_SECRET` | Auth crons |

## Conclusion inventaire

**Forces** :
- Vitest très bien établi (4 678 tests verts)
- MSW patterns mature
- Drizzle memory fallback excellent pour tests

**Faiblesses** :
- E2E Playwright "fantôme" (créés non runned)
- Frontend UI coverage ~60% seulement
- Pas de Lighthouse / k6
- Factories non centralisées
- Pas de heartbeat post-deploy automatique

**Action prioritaire** : Sprint 7 phases (T0→T7) pour combler les gaps prioritisés.
