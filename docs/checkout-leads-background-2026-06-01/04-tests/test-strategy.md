# 04 — Stratégie de tests

## 1. Pyramide & responsabilités

```
        e2e Playwright (peu, critiques)   ── prouve l'UX & le zéro-perte de bout en bout
      intégration (routes + repos + DB)   ── prouve idempotence/upsert/outbox/transaction
   unités Vitest (logique pure, isolée)   ── prouve file/backoff/validation/sérialisation
        MSW (transport client simulé)     ── prouve le comportement réseau (latence/5xx/409)
```

| Couche | Outil | Couvre | Où |
|---|---|---|---|
| Unités | Vitest 2.1 (globals) | `lead-sync-queue`, `lead-id`, schémas, `lead-service` (mocks), processor (handlers mock) | `*.test.ts(x)` co-localisés |
| Réseau client | MSW (`src/test/msw/`) | latence injectée, 503→retry, 409 ignoré, batch /sync | handlers MSW dédiés OWBS |
| Intégration | Vitest + DB de test | upsert idempotent, désordre, outbox SKIP LOCKED, transaction, cron | `*.int.test.ts` / route tests |
| e2e | Playwright (`apps/web/e2e/`) | UI avance sans réseau, 3 étapes sans gel, fermeture→persistance, reload recovery, conversion, FR-11 | `e2e/owbs-*.spec.ts` |

## 2. Principes

- **Déterminisme** : horloge et réseau **contrôlés** (faux timers Vitest pour le backoff ; MSW pour la latence ; `page.route` pour throttle/abort en e2e).
- **Idempotence prouvée explicitement** : chaque mutation a un test « rejeu ×N ⇒ 1 effet ».
- **Zéro-perte prouvé** : e2e ferme l'onglet en plein vol et vérifie la persistance via beacon (route interceptée + assertion DB/endpoint).
- **Parité legacy** : un test garde-fou `TST-R-OFF` vérifie que flag OFF == comportement actuel.
- **Pas de PII dans les fixtures réelles** : données synthétiques ([`fixtures.json`](fixtures.json)).
- **Multi-navigateur** sur les e2e critiques : Chromium + WebKit (R-07, iOS Safari/pagehide).

## 3. Cibles de couverture

| Module | Cible lignes | Cible branches |
|---|---|---|
| `lead-sync-queue` | ≥ 95 % | ≥ 90 % |
| `lead-service` / repos upsert | ≥ 90 % | ≥ 85 % |
| `lead-outbox-*` | ≥ 90 % | ≥ 85 % |
| `beacon-flush` | ≥ 85 % | — |

## 4. Données & environnements
- **DB de test** : Postgres (cf. `docs/ci-e2e-postgres-2026-05-30`) ; migrations appliquées ; reset entre suites d'intégration.
- **e2e** : build prod local `:3100` (DB seedée) ; `PLAYWRIGHT_BASE_URL` paramétrable ; flag ON via env du build de test.
- **Fixtures partagées** : [`fixtures.json`](fixtures.json) (lead, envelope, batch, outbox event).

## 5. Mapping complet test ↔ exigence
Voir [`test-matrix.csv`](test-matrix.csv). Plans détaillés : [`vitest-plan.md`](vitest-plan.md),
[`msw-plan.md`](msw-plan.md), [`playwright-plan.md`](playwright-plan.md).
