# 07 — Tests, qualité & CI/CD

> **Vue d'ensemble** : 394 tests unitaires Vitest, 59 specs Playwright e2e, k6 load testing, axe-core a11y, gitleaks, lint-staged, Husky. CI GitHub Actions (lint + typecheck + test + Lighthouse). Trois faiblesses : couverture fragmentée (analytics admin, mail, crypto non testés), pas de gating obligatoire (branch protection invisible), `commit-msg` hook absent (Conventional Commits non *enforced*).

---

## 1. Tests automatisés — état des lieux

### 1.1 Volumétrie

| Type | Volume | Outil |
|---|---|---|
| Tests unitaires + intégration | ≈ 394 fichiers `*.test.ts` | Vitest |
| Tests e2e | 59 specs `apps/web/e2e/*.spec.ts` | Playwright |
| Tests a11y | inclus dans e2e | axe-core via `@axe-core/playwright` |
| Tests charge | dossier `apps/web/k6/` | k6 |

≈ 572 fichiers de tests recensés au total (mix unit + integration + e2e + a11y).

### 1.2 Couverture par domaine

| Domaine | Couverture | Détail |
|---|---|---|
| Webhooks engine | ✅ 7 scénarios | `engine.test.ts` (229 LOC) |
| Checkout schemas | ✅ 8 tests | `lead.test.ts`, `order.test.ts`, schemas common |
| Stock CAS | ✅ inclus dans order tests | |
| Idempotency middleware | ✅ | `idempotency-middleware.test.ts` |
| Tracking CAPI Meta | ✅ 13 tests | `meta-capi-adapter.test.ts` |
| Tracking attribution | ✅ | `client.attribution.test.ts` |
| Consent | ✅ | `consent.test.ts` |
| Tracking plan exporter | ✅ 17 commits récents | `exporter.test.ts` |
| Lead dedup | ✅ 7 scénarios | `lead-dedup.test.ts` |
| Cron tick | ✅ | `cron-tick.test.ts` |
| Snap CAPI | ✅ + script live | `snap-pixel-test-plan.md` |
| Auth crypto (Argon2, HMAC, AES-GCM) | ❌ aucun | `lib/auth/`, `lib/crypto/` |
| Mail transactional (`lib/mail/send.ts`) | ❌ | |
| Media processing (Sharp, FFmpeg) | ❌ | |
| Analytics admin (~40 routes) | ❌ | `app/api/admin/analytics/*` |
| Admin pages (124 pages) | ❌ majoritairement | |
| Components UI / godzilla | ⚠ partiel | `CheckoutFlow`, `RitualsWizard` peu testés |

### 1.3 Tests e2e Playwright

Couverture observée (59 specs) :
- `product-feed.spec.ts`
- `tracking-*.spec.ts` (~6 specs tracking)
- `auth-*.spec.ts`
- `admin-*.spec.ts`
- `legal-a11y.spec.ts` (axe-core)
- ... reste à inventorier précisément

### 1.4 k6 load testing

`apps/web/k6/` — scénarios de charge non audités en détail. À vérifier : couvrent-ils le checkout sous charge ?

---

## 2. Tests skip / xit / disabled

`grep -rE "it\.skip|xit\(|describe\.skip" apps/web/src` → **0 occurrence** ✅

Discipline parfaite. Aucun test "désactivé temporairement" oublié.

---

## 3. CI/CD

### 3.1 Workflows GitHub Actions

`.github/workflows/` :

| Workflow | Trigger | Étapes |
|---|---|---|
| `ci.yml` | push / PR sur `master` ou `main` | lint, typecheck, Vitest, migration validator (`--strict`) |
| `lighthouse.yml` | push / PR | 5 URLs (`/`, `/rituel`, `/journal`, `/contact`, `/admin/login`), thresholds perf 0.8 / a11y 1.0 / SEO 0.9 |
| `security.yml` | push / PR | gitleaks, audit deps |

### 3.2 Husky pre-commit

`.husky/pre-commit` :
- ✅ `gitleaks detect --verbose`
- ✅ Migration validator `_check-migrations.ts`
- ✅ `lint-staged` :
  ```json
  {
    "apps/web/src/**/*.{ts,tsx}": ["eslint --fix"],
    "apps/web/src/**/*.{ts,tsx,css,md}": ["prettier --write"]
  }
  ```

### 3.3 Husky commit-msg

❌ **Absent**. Conventional Commits n'est **pas enforced** par git. Repose sur la discipline (97,8 % de respect → excellent, mais 6 anti-patterns observés sur 271 commits).

→ **Reco** : ajouter `@commitlint/config-conventional` + `.husky/commit-msg`.

### 3.4 Lighthouse CI

`.lighthouserc.json` :
```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/", ".../rituel", ".../journal", ".../contact", ".../admin/login"],
      "numberOfRuns": 1,
      "settings": { "preset": "desktop" }
    },
    "assert": {
      "assertions": {
        "categories:accessibility": ["error", { "minScore": 1.0 }],
        "color-contrast": "error",
        "html-has-lang": "error",
        "label": "error",
        "meta-viewport": "error"
      }
    }
  }
}
```

✅ A11y **non négociable** à 1.0. Discipline rare.

---

## 4. Process git

### 4.1 Métriques

| Métrique | Valeur |
|---|---|
| Total commits | 304 (271 hors merge + 33 merges) |
| Période | 7 mai → 18 mai 2026 (11 jours) |
| Cadence moyenne | ~24,6 commits/jour |
| Pic | 108 commits le 13 mai |
| Contributeurs | Agent (170 / 62,7 %), ElAzhar-Jebbari (100 / 37,3 %) |

### 4.2 Conventional Commits

| Type | Volume | % |
|---|---|---|
| feat | 136 | 50,2 % |
| fix | 75 | 27,7 % |
| test | 24 | 8,9 % |
| docs | 11 | 4,1 % |
| chore | 8 | 3,0 % |
| refactor | 2 | 0,7 % |
| autres | 6 | 2,2 % |

**Conformité CC : 97,8 %**. **Scope explicite : 95,2 %**.

### 4.3 Top scopes

- `tracking` 48
- `legal-pages` 34
- `emailing` 32
- `admin` 11
- `chat` 6
- `leads` 5
- `webhooks` 5
- `delivery-cities` 3

### 4.4 Branches actives

- `master` (HEAD = `3f27b00`)
- `worktree-webhook` (feat tracking Snapchat)
- `leads-webhook-multi-step` (fix chat lead form trigger)
- `origin/master` 7 commits derrière → divergence à intégrer.

### 4.5 Politique de merge

Merge commits visibles (`--no-ff` apparent). Pas de squash. Historique non linéaire → moins lisible pour `git bisect`.

### 4.6 Anti-patterns repérés

6 commits sur 271 :
1. `chore: snapshot current repository state`
2. `chore: add webhook API routes from master` (× 2)
3. `fix: update test fixtures for identityHash multi-identity dedup` (scope manquant)
4. `test: fix invalid eslint directives` (scope manquant)
5. `docs+feat(tracking/attribution): ...` (type hybride)

Mineur.

---

## 5. Hotspots de modification

Top 15 fichiers touchés sur 304 commits :

| Rang | Fichier | Touchdowns |
|---|---|---|
| 1 | `drizzle/migrations/meta/_journal.json` | 25 |
| 2 | `src/lib/tracking/plan/exporter.test.ts` | 17 |
| 3 | `src/lib/tracking/plan/exporter.ts` | 15 |
| 4 | `src/lib/db/schema.ts` | 14 |
| 5 | `src/lib/db/types.ts` | 12 |
| 6 | `src/lib/tracking/mappings/gtm-export.ts` | 11 |
| 7 | `src/lib/tracking/providers/event-mapping.ts` | 10 |
| 8 | `package.json` | 10 |
| 9 | `src/components/admin/tracking/plans/wizard/StepEnvProfiles.tsx` | 9 |
| 10 | `pnpm-lock.yaml` | 9 |
| 11 | `src/lib/tracking/providers/snap.ts` | 8 |
| 12 | `src/lib/tracking/providers/event-mapping.test.ts` | 8 |
| 13 | `src/lib/chat/db/schema.ts` | 8 |
| 14 | `src/app/layout.tsx` | 8 |
| 15 | `src/app/admin/legal/page.tsx` | 8 |

**Lecture** :
- `drizzle/migrations/meta/_journal.json` = 25 → normal (touché à chaque migration).
- Tout le top 10 *hors* journal est sur **tracking** → zone à plus haut risque de régression.
- `schema.ts` 14 touches → modèle qui bouge ; bonne discipline migrations limite la casse.

---

## 6. Process PR / code review

### 6.1 Observations

- ❌ **Pas de PR template** (`.github/pull_request_template.md` absent).
- ❌ **Pas de branch protection visible** (pas d'évidence "require PR review", "require status checks", "block force push").
- ❌ **Commits direct sur `master`** possibles (à vérifier dans la config GitHub).
- ✅ CI lance lint + typecheck + test sur PR.
- 🟡 Pas de **CODEOWNERS** pour assigner les reviews.

### 6.2 Conséquence

Le projet est tenu par **discipline humaine** plutôt que par enforcement technique. Cela tient tant que :
- 1 dev + 1 agent.
- Pas de release publique majeure.

Mais dès qu'un 2ᵉ humain rejoint, sans branch protection + PR review → risque élevé de régression.

---

## 7. Observabilité production

(Cf. doc `05-securite-conformite.md` §11.)

- ✅ Logger structuré JSON + PII redaction.
- ❌ Sentry non actif (`instrumentation.ts` vide).
- ❌ Pas de métriques (Prometheus, Datadog).
- ❌ Pas d'alertes.
- ✅ Health checks `/api/health` + `/api/health/full`.
- ❌ Pas de tracing distribué.

---

## 8. Forces qualité & process

1. **97,8 % de Conventional Commits**, 95,2 % avec scope explicite.
2. **Cadence soutenue** : 24,6 commits/jour, atomicité globale respectée.
3. **CI complet** : lint + typecheck + test + Lighthouse (a11y strict 1.0).
4. **Husky pre-commit** : gitleaks + migration validator + lint-staged.
5. **0 test `skip`/`xit`** → discipline.
6. **394 tests unitaires** sur les chemins critiques + 59 e2e Playwright.
7. **k6 load testing** (à vérifier).
8. **a11y automatisée** via axe-core dans e2e.
9. **Migrations safety-net** (`_validate-migrations.mjs` hash-based).
10. **Pas de commit secrets détecté** (gitleaks pré + CI).

---

## 9. Faiblesses qualité & process

| # | Constat | Sévérité |
|---|---|---|
| F1 | Pas de `commit-msg` hook (CC non *enforced*) | 🟠 P1 |
| F2 | Pas de PR template | 🟠 P1 |
| F3 | Branch protection invisible (push direct possible ?) | 🔴 P0 si plusieurs devs |
| F4 | Pas de CODEOWNERS | 🟡 P2 |
| F5 | Pas de squash-merge → historique non linéaire | 🟡 P2 |
| F6 | Pas de CHANGELOG.md généré (malgré CC parfait → low-hanging fruit) | 🟡 P2 |
| F7 | Pas de tagging sémantique de release | 🟡 P2 |
| F8 | Couverture analytics admin / mail / crypto / media absente | 🟠 P1 |
| F9 | Pas de monitoring prod (Sentry, alertes) | 🔴 P0 |
| F10 | Pas de dashboard CI Lighthouse persisté (Lighthouse CI server ou storage) | 🟡 P2 |
| F11 | Pas d'OpenAPI / contract test | 🟡 P2 |
| F12 | Divergence local/remote (7 commits d'avance) | 🟡 P2 |
| F13 | `chore: snapshot current repository state` type d'anti-pattern à éviter | 🟢 |

---

## 10. Recommandations

### P0 — sous 2 semaines

1. **Activer branch protection** sur `master` (require PR review + CI required).
2. **Activer Sentry** (cf. doc 05).

### P1 — sous 1 mois

3. **Hook `commit-msg`** + commitlint :
   ```bash
   pnpm add -D @commitlint/config-conventional @commitlint/cli
   ```
   ```
   # .husky/commit-msg
   pnpm exec commitlint --edit "$1"
   ```

4. **PR template** `.github/pull_request_template.md` :
   ```markdown
   ## Description

   ## Type
   - [ ] feat / fix / test / docs / chore / refactor

   ## Checklist
   - [ ] Tests added/updated
   - [ ] Migration validated (`pnpm db:validate:strict`)
   - [ ] Lighthouse a11y still 1.0
   - [ ] Docs updated (`docs/`)
   - [ ] No secrets in diff

   ## Risk
   - [ ] Low / Medium / High
   ```

5. **Couvrir crypto + mail + analytics admin** (cf. doc 02).

6. **Squash-merge policy** : configurer GitHub repo settings → "Allow squash merging" uniquement.

### P2 — sous 3 mois

7. **CHANGELOG automatique** via `semantic-release` ou `release-please`.
8. **Tags sémantiques** : `v1.0.0` etc.
9. **CODEOWNERS** : `tracking/*` → @lead-tracking, `admin/*` → @lead-admin.
10. **OpenAPI export** + contract tests (Pact ou similaire).
11. **Lighthouse CI server** (ou Vercel Speed Insights) pour historiser les scores.

### P3

12. **Tracing distribué** OpenTelemetry → Honeycomb / Tempo.
13. **Performance budgets** automatisés.

---

## 11. Scorecard qualité & process

| Critère | Score |
|---|---|
| Conventional Commits | 9 / 10 (mais non enforced) |
| Atomicité commits | 9 / 10 |
| Couverture tests core | 8 / 10 |
| Couverture tests périphérie | 5 / 10 |
| CI/CD | 8 / 10 |
| Pre-commit hooks | 9 / 10 |
| PR process | 5 / 10 (pas de gating) |
| Branch protection | 4 / 10 |
| Observabilité prod | 3 / 10 |
| Documentation API | 4 / 10 (pas d'OpenAPI) |
| Releases & changelog | 4 / 10 |
| **Global** | **6,2 / 10** |

→ Le code est *fait* avec qualité ; mais la *gouvernance* qui devrait la verrouiller est partielle. C'est le gap principal entre "projet solo discipliné" et "projet d'agence prête à scaler".
