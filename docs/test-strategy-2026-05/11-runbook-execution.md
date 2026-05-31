# 11 — Runbook d'exécution

> Procédure opérationnelle pour exécuter le plan d'action sur 2 semaines.
> Chaque jour = 1 phase complète. Marquer chaque étape comme [ ] → [x].

## Pré-requis avant J-0

- [ ] Branche `feat/test-strategy-2026-05` créée depuis master
- [ ] Accès admin GitHub (workflows actions activés)
- [ ] Dépendances dev installées : `pnpm add -D -w @lhci/cli k6 @axe-core/playwright @testing-library/user-event`
- [ ] Postgres test DB disponible (Docker local OK)
- [ ] Slack webhook URL configurée (pour alertes futures)

```bash
# Setup workspace
git checkout master && git pull
git checkout -b feat/test-strategy-2026-05

# Vérifier baseline
pnpm --filter @femiglow/web test 2>&1 | tail -3
# → Tests  XXXX passed (baseline)
```

---

## J+0 — Phase T0 : Préparation (½ j)

### Matin (3h)

**T0.1 — Audit existant**
```bash
# Compte total tests vitest
pnpm --filter @femiglow/web test 2>&1 | grep -E "Tests\s+\d+" | tail -1

# Liste Playwright specs
ls apps/web/e2e/*.spec.ts | wc -l

# Coverage actuel (si déjà configuré)
pnpm --filter @femiglow/web exec vitest run --coverage --reporter=text-summary 2>&1 | tail -20
```

Documenter dans `01-context-inventory.md` les chiffres baseline.

**T0.2 — Setup global vitest**
```bash
# Éditer apps/web/src/test/setup.ts (cf. plan-action-phases.md T0.4)
```

### Après-midi (3h)

**T0.3 — Scripts package.json**
```bash
# Ajouter les scripts cf. T0.2 du plan
# Vérifier qu'ils fonctionnent :
pnpm --filter @femiglow/web test:watch # CTRL+C pour quitter
pnpm --filter @femiglow/web e2e --list
```

**T0.4 — Commit T0**
```bash
git add apps/web/package.json apps/web/src/test/setup.ts docs/test-strategy-2026-05/
git commit -m "chore(tests): T0 — préparation setup + scripts"
```

### Critères Go T1
- [ ] `pnpm test` retourne ≥ 4 600 tests verts
- [ ] Scripts package.json fonctionnels
- [ ] MSW server activé globalement

---

## J+1 — Phase T1 : Factories (1 j)

### Matin

**T1.1 — Base factory + 3 premières**

Créer dans l'ordre :
1. `src/test/factories/base.ts`
2. `src/test/factories/user.factory.ts` + test
3. `src/test/factories/order.factory.ts` + test
4. `src/test/factories/lead.factory.ts` + test

```bash
# Run tests factory
pnpm --filter @femiglow/web test -- --run factories
```

### Après-midi

**T1.2 — 3 factories restantes + helpers**

1. `chat-session.factory.ts` + test
2. `chat-message.factory.ts` + test
3. `tracking-event.factory.ts` + test
4. `helpers/render-with-providers.tsx`
5. `helpers/api-client.ts`

**T1.3 — Scénarios**
- `helpers/scenarios.ts` (5 scénarios prédéfinis)

**Commit T1**
```bash
git add apps/web/src/test/factories apps/web/src/test/helpers
git commit -m "feat(tests): T1 — factories + helpers + scénarios"
```

### Critères Go T2
- [ ] 12 factories créées + ~50 tests verts
- [ ] 5 helpers RTL + Playwright
- [ ] 5 scénarios métier dans `helpers/scenarios.ts`

---

## J+2 — Phase T2 : Backend gap-filling (1 j)

### Matin

**T2.1 — Lister gaps**
```bash
# Routes sans test
find apps/web/src/app/api -name "route.ts" | while read r; do
  test="${r%.ts}.test.ts"
  [ ! -f "$test" ] && echo "MISSING: $r"
done > /tmp/missing-routes.txt
wc -l /tmp/missing-routes.txt
```

**T2.2 — Tests routes critiques**
Prioriser top 10 :
1. `/api/track` (déjà couvert mais étendre)
2. `/api/chat/message` (test SSE)
3. `/api/checkout/order` (test idempotency)
4. `/api/checkout/lead`
5. `/api/admin/content-studio/posts/[id]/publish-now`
6. Crons : `social-publish-scheduler`, `capi-flush`
7. `/api/webhooks/outbound` (signature HMAC)

Chaque test : happy + error + edge case = ~3 tests par route.

### Après-midi

**T2.3 — Middleware tests**
- `middleware.test.ts` : click ID capture, UTM, `_fbc` reconstruction

**T2.4 — Commit T2**
```bash
pnpm --filter @femiglow/web test 2>&1 | tail -3
# Doit être ~4 700+ tests
git add apps/web/src
git commit -m "test: T2 — backend gap-filling (routes + middleware + crons)"
```

### Critères Go T3
- [ ] +200 tests vitest sur routes API
- [ ] Middleware testé (click IDs, UTM, _fbc)
- [ ] 0 régression

---

## J+3 — Phase T3 : Frontend UI + a11y (1 j)

### Matin

**T3.1 — Components prioritaires sans test**
```bash
# Lister
find apps/web/src/components -name "*.tsx" -not -name "*.test.*" -not -name "*.stories.*" | while read c; do
  test="${c%.tsx}.test.tsx"
  [ ! -f "$test" ] && echo "MISSING: $c"
done | head -30
```

Top 10 à tester :
1. `WizardShell` + steps
2. `KitCommanderSection`
3. `HeroProduit` (extension de couverture)
4. `OverviewTopSources` (admin)
5. `ChatWidget` (chat launcher + input)
6. `AdminShell` (nav + theme)
7. `PriceDisplay`
8. `SocialProofBadge`
9. `WizardCartRecap`
10. `RitualsModule`

### Après-midi

**T3.2 — A11y E2E axe**
```ts
// apps/web/e2e/a11y-comprehensive.spec.ts
const PAGES = ['/', '/kit', '/journal', '/maison', '/rituel'];
// + admin si auth dispo

for (const url of PAGES) {
  test(`@axe ${url}`, async ({ page }) => {
    await page.goto(url);
    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });
}
```

**T3.3 — Visual regression baselines**
```bash
# Generate baselines
pnpm --filter @femiglow/web e2e --grep @visual --update-snapshots
# Verify
pnpm --filter @femiglow/web e2e --grep @visual
```

**T3.4 — Commit T3**
```bash
git add apps/web/src/components apps/web/e2e/a11y-*.spec.ts apps/web/e2e/__snapshots__
git commit -m "test: T3 — frontend UI components + a11y axe + visual baselines"
```

### Critères Go T4
- [ ] +300 tests RTL composants
- [ ] 5 pages `@axe` vertes
- [ ] 5 visual snapshots baselines

---

## J+4 + J+5 — Phase T4 : E2E Playwright opérationnel (1-2 j)

### Jour 1 — Premier run + diagnostic

```bash
# 1. Setup DB test + seeds
pnpm tsx apps/web/scripts/seed-products.ts
pnpm tsx apps/web/scripts/seed-rituals.ts
pnpm tsx apps/web/scripts/seed-components.ts

# 2. Build + start prod local
pnpm --filter @femiglow/web build
pnpm --filter @femiglow/web start &
SERVER_PID=$!
pnpm exec wait-on http://localhost:3000

# 3. Run E2E créés (live + attribution + landing)
pnpm --filter @femiglow/web e2e live-chat live-publishing live-tracking attribution-end-to-end attribution-multi-touch kit-layout-v2 2>&1 | tee /tmp/e2e-results.log

# Cleanup
kill $SERVER_PID
```

### Jour 2 — Fix specs failed + CI workflow

Pour chaque spec failed dans le log :
1. Lire le rapport HTML : `apps/web/playwright-report/index.html`
2. Identifier cause (selector / timing / état DB / feature flag)
3. Fix le spec OU skip avec raison documentée

**Tag critical path**
```bash
# Identifier les 15 specs business critiques
# (chat-visit, kit-purchase, admin-login, etc.)
# Ajouter le tag dans test.describe :
# test.describe('@critical chat-visitor purchase', () => {...});
```

**Workflow CI**
Créer `.github/workflows/e2e.yml` (cf. plan T4.3).

**Commit T4**
```bash
git add apps/web/e2e .github/workflows/e2e.yml
git commit -m "test: T4 — Playwright E2E run + CI workflow + critical path tag"
```

### Critères Go T5
- [ ] 90% des specs E2E créés passent en local
- [ ] 15 specs taggés `@critical`
- [ ] Workflow CI `.github/workflows/e2e.yml` actif

---

## J+6 — Phase T5 : MSW handlers (½ j)

### Matin (4h)

**T5.1 — OpenAI streaming handler**
```ts
// apps/web/src/test/msw/openai-handlers.ts
// Cf. plan T5.1 pour template complet
```

**T5.2 — Anthropic handler**
```ts
// apps/web/src/test/msw/anthropic-handlers.ts
```

**T5.3 — Meta CAPI handler**
```ts
// apps/web/src/test/msw/meta-capi-handlers.ts
```

**T5.4 — TikTok / Snap / Pinterest handlers**
(plus simples, payloads documentés)

**T5.5 — Aggregator**
```ts
// apps/web/src/test/msw/handlers.ts
import { openaiHandlers } from './openai-handlers';
// ...
export const handlers = [...openaiHandlers, ...anthropicHandlers, ...];
```

**T5.6 — Tests intégration fallback chat**
```ts
// apps/web/src/lib/chat/services/orchestrator.integration.test.ts
test('OpenAI 503 → fallback Anthropic', async () => {...});
test('Both down → message scripté dégradé', async () => {...});
```

**Commit T5**
```bash
git add apps/web/src/test/msw
git commit -m "test: T5 — MSW handlers OpenAI/Anthropic/Meta/TikTok/Snap/Pinterest"
```

### Critères Go T6
- [ ] 6 handlers créés + aggregator
- [ ] 30+ tests intégration débloqués
- [ ] Test fallback chat Anthropic vert

---

## J+7 + J+8 — Phase T6 : Perf + sécurité (1 j)

### J+7 matin — Lighthouse CI

```bash
# Install
pnpm add -D -w @lhci/cli

# Create config
cat > apps/web/lighthouserc.json << 'EOF'
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/kit"],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:recommended"
    }
  }
}
EOF

# Run baseline
pnpm --filter @femiglow/web build
pnpm --filter @femiglow/web start &
pnpm exec lhci autorun --config apps/web/lighthouserc.json
```

### J+7 après-midi — k6 load tests

```bash
# Install k6 (macOS)
brew install k6

# Create script
cat > apps/web/scripts/loadtest-track.js << 'EOF'
// ...
EOF

# Run en local
pnpm --filter @femiglow/web start &
k6 run apps/web/scripts/loadtest-track.js
```

### J+8 — Sécurité OWASP

**T6.3 — Tests security**
```ts
// apps/web/e2e/security.spec.ts
test.describe('@security', () => {
  test('XSS chat input', async ({ page }) => {...});
  test('SQL injection /api/track', async ({ request }) => {...});
  test('CSRF /api/checkout/order', async ({ request }) => {...});
});
```

**T6.4 — `pnpm audit` automatisé**
```bash
pnpm audit --production --audit-level=high
# Si vulns → patch ou whitelist explicit
```

**Commit T6**
```bash
git add apps/web/lighthouserc.json apps/web/scripts/loadtest-track.js apps/web/e2e/security.spec.ts
git commit -m "test: T6 — Lighthouse + k6 + OWASP security tests"
```

### Critères Go T7
- [ ] Lighthouse perf `/kit` ≥ 85 mobile
- [ ] k6 P95 < 200ms `/api/track`
- [ ] 5 tests `@security` verts
- [ ] `pnpm audit` clean (0 critical)

---

## J+9 — Phase T7 : CI + monitoring (½ j)

### Matin

**T7.1 — Workflows GitHub Actions**
```bash
mkdir -p .github/workflows
# Créer les 6 workflows (cf. 12-ci-cd-workflows.md)
```

**T7.2 — Heartbeat cron**
```ts
// apps/web/src/app/api/cron/smoke-heartbeat/route.ts
```

Ajouter dans `vercel.json` :
```json
{ "path": "/api/cron/smoke-heartbeat", "schedule": "0 * * * *" }
```

**T7.3 — Slack alerts**

Setup webhook + variable d'env `SLACK_WEBHOOK_URL` dans GitHub Actions secrets.

**Commit T7 + final**
```bash
git add .github/workflows apps/web/src/app/api/cron/smoke-heartbeat apps/web/vercel.json
git commit -m "test: T7 — CI workflows + heartbeat cron + monitoring"
```

### Critères final
- [ ] 6 workflows actifs
- [ ] Heartbeat cron en prod
- [ ] Slack alerts configurées
- [ ] **Total : ~5 200 tests vitest + 150 specs Playwright**

---

## J+10 — Validation finale + PR

### Validation
```bash
# Tests complets
pnpm --filter @femiglow/web test 2>&1 | tail -3
pnpm --filter @femiglow/web e2e:critical 2>&1 | tail -3
pnpm tsx apps/web/scripts/smoke-live-systems.ts
pnpm tsx apps/web/scripts/smoke-attribution.ts

# Coverage report
pnpm --filter @femiglow/web test:coverage 2>&1 | tail -20
```

### PR
```bash
git push -u origin feat/test-strategy-2026-05
gh pr create \
  --title "test-strategy: refonte tests exhaustive (T0→T7)" \
  --body-file docs/test-strategy-2026-05/README.md
```

---

## Commandes utiles cheat sheet

### Tests
```bash
# Run all unit
pnpm --filter @femiglow/web test

# Run pattern
pnpm vitest --watch attribution
pnpm vitest --watch lib/redis

# Coverage
pnpm --filter @femiglow/web test:coverage

# E2E
pnpm --filter @femiglow/web e2e                      # tous
pnpm --filter @femiglow/web e2e:critical             # critical path
pnpm --filter @femiglow/web e2e --grep @attribution  # tag
pnpm --filter @femiglow/web e2e --headed             # voir browser
pnpm --filter @femiglow/web e2e --debug              # inspector
pnpm --filter @femiglow/web e2e --update-snapshots   # visual baselines

# Smoke
pnpm tsx apps/web/scripts/smoke-live-systems.ts
pnpm tsx apps/web/scripts/smoke-attribution.ts --url https://preview-xxx.vercel.app
```

### Debug

```bash
# Test single file en watch
pnpm vitest --watch path/to/file.test.ts

# Tests qui FAIL
pnpm vitest run --reporter=verbose 2>&1 | grep -A 5 "FAIL"

# Coverage HTML
pnpm --filter @femiglow/web test:coverage
open apps/web/coverage/index.html

# Playwright debug
PWDEBUG=1 pnpm e2e path/to/spec.ts
```

### Build / serveur local pour E2E
```bash
pnpm --filter @femiglow/web build
pnpm --filter @femiglow/web start &
pnpm exec wait-on http://localhost:3000 --timeout 60000
# Run tests
pnpm e2e
# Cleanup
pkill -f "next-server"
```

## Maintenance hebdomadaire (post-deploy)

### Lundi matin (15 min)
- [ ] Review Sentry dashboard pour alertes smoke heartbeat
- [ ] Check rapport Playwright dernière semaine (taux flaky < 1%)
- [ ] Lighthouse trend `/kit` mobile (régression > 5 points ?)

### Mercredi review tests flaky (30 min)
```bash
# Identifier tests flaky (run 10x, compter passes)
for i in {1..10}; do
  pnpm --filter @femiglow/web e2e --reporter=json | jq '.suites[].specs[].tests[] | select(.status=="failed")'
done | sort | uniq -c | sort -rn
```

Pour chaque flaky : créer ticket + quarantaine via `test.skip`.

### Vendredi audit (30 min)
- [ ] `pnpm audit` → review vulns
- [ ] Coverage trend (vitest) — descend ?
- [ ] Update test docs si patterns nouveaux

## Rollback (si tests cassent prod)

```bash
# Si les nouveaux workflows CI causent des faux positifs gênant les merges :
# 1. Désactiver le workflow problématique
gh workflow disable test-integration.yml

# 2. Push fix → réactiver
gh workflow enable test-integration.yml
```
