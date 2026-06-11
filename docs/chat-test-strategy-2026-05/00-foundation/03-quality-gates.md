# Quality gates — seuils bloquants

Gates **bloquants** en CI. Toute PR ne peut merger que si **tous les gates sont verts**.

## 1. Coverage par couche

### 1.1 Seuils statement / branch / function / line

| Couche | Statement | Branch | Function | Line |
|--------|-----------|--------|----------|------|
| Services orchestrator | 95 % | 95 % | 100 % | 95 % |
| Services intent / charter / sanitize / lead-decision | 95 % | 95 % | 100 % | 95 % |
| Services autres | 85 % | 80 % | 90 % | 85 % |
| Repos | 85 % | 80 % | 90 % | 85 % |
| Providers LLM (adapters) | 75 % | 70 % | 80 % | 75 % |
| Components visiteur | 80 % | 75 % | 85 % | 80 % |
| Components admin | 70 % | 65 % | 75 % | 70 % |
| Hooks | 85 % | 80 % | 90 % | 85 % |
| API routes | 90 % | 85 % | 95 % | 90 % |

### 1.2 Configuration vitest

```typescript
// vitest.config.ts
coverage: {
  reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
  thresholds: {
    'src/lib/chat/services/orchestrator.ts': { lines: 95, branches: 95 },
    'src/lib/chat/services/intent*.ts': { lines: 95, branches: 95 },
    'src/lib/chat/services/charter*.ts': { lines: 98, branches: 95 },
    'src/lib/chat/services/sanitize.ts': { lines: 98, branches: 95 },
    'src/lib/chat/services/lead-decision.ts': { lines: 98, branches: 95 },
    'src/lib/chat/services/**': { lines: 85, branches: 80 },
    'src/lib/chat/repos/**': { lines: 85, branches: 80 },
    'src/lib/chat/providers/**': { lines: 75, branches: 70 },
    'src/components/chat/**': { lines: 80, branches: 75 },
    'src/app/admin/chat/**': { lines: 70, branches: 65 },
    'src/app/api/chat/**': { lines: 90, branches: 85 },
  },
  exclude: [
    '**/*.config.ts', '**/__tests__/**', '**/types.ts',
    'src/lib/db/migrations/**', '**/node_modules/**',
  ],
}
```

### 1.3 Hard rule

Si une ligne **critique** (orchestrator, intent, charter, sanitize, lead-decision) descend
sous le seuil → **PR rejetée immédiatement**. Pas de "on règlera ça plus tard".

## 2. Tests pass rate

| Couche | Pass rate CI requis |
|--------|---------------------|
| Unit | 100 % |
| Integration | 100 % |
| Component | 100 % |
| E2E `@critical` | 100 % |
| E2E full | ≥ 98 % (les 2 % restants en quarantaine documentée) |

**Zéro flaky** : un test qui rouge → re-vert sans changement est immédiatement en
quarantaine + ticket assigné.

## 3. Accessibilité

| Métrique | Seuil |
|----------|-------|
| Violations axe-core **critique** | 0 |
| Violations axe-core **sérieuses** | 0 |
| Violations axe-core **modérées** | ≤ 2 (avec ticket et plan) |
| Tab order cohérent | Validé manuellement P0 features |
| Contraste WCAG AA | 100 % textes (visiteur + admin) |
| Screen reader (VoiceOver/NVDA) | Smoke test ad-hoc 1× / semaine |

CI gate : `axe-playwright` + `jest-axe` sur features P0/P1.

## 4. Performance (load + frontend)

### 4.1 Backend — load test (k6)

| Endpoint | P50 | P95 | P99 | Throughput min |
|----------|-----|-----|-----|----------------|
| `POST /api/chat/session` | < 100 ms | < 300 ms | < 500 ms | 100 req/s |
| `POST /api/chat/message` (first chunk) | < 800 ms | < 2 s | < 3 s | 50 req/s |
| `POST /api/chat/message` (full reply) | < 3 s | < 5 s | < 8 s | 50 req/s |
| `GET /api/chat/health` | < 50 ms | < 150 ms | < 300 ms | 200 req/s |
| `POST /api/chat/feedback` | < 100 ms | < 300 ms | < 500 ms | 50 req/s |
| `POST /api/chat/lead/contact` | < 200 ms | < 500 ms | < 1 s | 30 req/s |

### 4.2 Frontend — Core Web Vitals (widget)

| Métrique | Seuil |
|----------|-------|
| LCP (Largest Contentful Paint) | < 2,5 s (P75) |
| INP (Interaction to Next Paint) | < 200 ms |
| CLS (Cumulative Layout Shift) | < 0,1 |
| TTI widget (visible → interactive) | < 1 s sur mobile 4G simulé |
| Bundle size widget (gzip) | < 80 KB |

Measured via Lighthouse CI + Playwright synthetic timing API.

## 5. Sécurité

| Gate | Outil | Threshold |
|------|-------|-----------|
| Dependencies vulnerabilities | `pnpm audit` | 0 high, 0 critical |
| Secrets in code | gitleaks (déjà configuré) | 0 detected |
| XSS test fixtures | Tests dédiés `sanitize.test.ts` | 100 % patterns mitigés |
| CSRF protection | Tests intégration | Tokens présents |
| Rate limit | Tests F36 | 429 retourné quand seuil dépassé |
| PII redaction coverage | F23 — patterns phone/email/IBAN/CNI MA | 95 % détection sur dataset 200 cas |

## 6. Contrat API

| Gate | Mécanisme |
|------|-----------|
| Schéma Zod **non breaking** vs `main` | Diff schema + tests contract |
| MSW handlers à jour | Auto-régénération depuis Zod, CI fail si drift |
| OpenAPI / contract publié | Documenté pour partenaires (webhook) |

## 7. Multilinguisme

| Gate | Cible |
|------|-------|
| FR string coverage (i18n dictionary) | 100 % |
| AR string coverage | 100 % |
| AR-MA (darija) string coverage | 100 % |
| Fallback strings (clé inconnue) | Helper retourne clé + log warning |
| RTL layout (AR) | E2E spec dédié visuel snapshot |
| Locale-aware date / number / currency | Tests unit dédiés |

## 8. Données de test

| Gate | Critère |
|------|---------|
| Factories couvrent toutes les tables `chat_*` | Audit régulier |
| Seeds déterministes | Tests reproductibles `faker.seed(42)` |
| Données réalistes | Pas de "John Doe", utiliser prénoms MA-aligned |
| Cleanup post-test | Aucune donnée résiduelle DB entre specs |

## 9. Documentation

| Gate | Critère |
|------|---------|
| Nouveau test = update test-matrix.csv | Vérifié en PR |
| Bug fix = test régression cité par ID | `// Regression test for CHA-AUD-NN` |
| Skip / quarantaine = ticket linké | Lint rule rejette si ticket manquant |
| README features à jour | Diff vs code à chaque release |

## 10. Métriques de santé sur 30 jours

Reporté quotidiennement, alerte si dérive (cf. [05-runbook/04-coverage-monitoring.md](../05-runbook/04-coverage-monitoring.md)) :

| Métrique | Cible | Seuil alerte |
|----------|-------|--------------|
| Coverage moyen | ≥ 85 % | < 80 % |
| Pass rate moyen | 100 % | < 99 % |
| Specs en quarantaine | ≤ 2 % du total | > 5 % |
| Specs slowest top-10 | aucune > 30 s en avg | 1 > 30 s en avg |
| Temps total CI moyen | < 20 min | > 25 min |

## 11. Exceptions

Tout dépassement de gate nécessite :

1. **Ticket d'exception** ouvert (linké à la PR)
2. **Plan de retour à la conformité** documenté (date, owner)
3. **Validation tech lead + product** explicite
4. **Revue mensuelle** des exceptions actives

Aucun gate n'est désactivé **silencieusement**.
