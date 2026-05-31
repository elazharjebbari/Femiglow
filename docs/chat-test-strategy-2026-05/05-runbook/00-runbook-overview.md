# Runbook — Vue d'ensemble

Procédures opérationnelles **concrètes** pour exécuter, monitorer, corriger la batterie
de tests au jour le jour.

## Public

- **QA / SDET** : exécution quotidienne, triage flaky
- **DevOps / SRE** : pipeline CI, monitoring coverage
- **Dev** : exécution locale, debug tests
- **Tech lead** : revue gates, exceptions

## Procédures couvertes

| Procédure | Fichier | Quand |
|-----------|---------|-------|
| Exécution quotidienne (local + CI) | [01-daily-execution.md](01-daily-execution.md) | Tous les jours |
| Pipeline CI | [02-ci-pipeline.md](02-ci-pipeline.md) | Setup + maintenance |
| Incident en cours (CI rouge) | [03-incident-runbook.md](03-incident-runbook.md) | CI rouge en main |
| Monitoring coverage | [04-coverage-monitoring.md](04-coverage-monitoring.md) | Suivi continu |
| Boucle de correction | [05-correction-loop.md](05-correction-loop.md) | Flaky / bug détecté |

## Commandes "1 ligne"

```bash
# Démarrer un dev test session
pnpm test:watch

# Coverage rapide
pnpm test:coverage

# Smoke E2E avant push
pnpm test:e2e:smoke

# Full suite (avant release)
pnpm test:all

# Debug un test E2E
pnpm test:e2e:debug e2e/visitor/chat-conversation.spec.ts

# Repeat 10× (détecter flaky)
pnpm exec playwright test --repeat-each 10 e2e/visitor/chat-streaming.spec.ts

# Voir le rapport HTML après run
pnpm test:e2e:report
```

## Glossaire commande état

| État | Sens |
|------|------|
| ✅ Green | Tous les tests passent |
| 🟡 Yellow | Some tests skipped ou flaky en quarantaine (acceptable) |
| 🔴 Red | Tests failing — bloquant merge |
| ⚠️ Warning | Coverage < gate ou specs > 30 s |

## Outils maîtres

- **GitHub Actions** : orchestration CI
- **vitest UI** (`pnpm exec vitest --ui`) : debug local
- **Playwright trace viewer** : `pnpm exec playwright show-trace trace.zip`
- **Codecov** : coverage reports
- **Slack #qa-chat** : alerts auto

## Escalade

| Niveau | Symptôme | Qui escalader |
|--------|----------|---------------|
| L1 | Test fail isolé | Auteur PR |
| L2 | CI rouge sur main | Tech lead du jour |
| L3 | Coverage drop > 5 % | Tech lead + PO |
| L4 | Bug critical échappé en prod | Tech lead + PO + ops |
