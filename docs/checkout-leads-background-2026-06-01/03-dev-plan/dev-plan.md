# 03 — Plan de développement

## 1. Stratégie de branche & livraison

- Branche : `feat/owbs-lead-background` depuis `master`.
- **Trunk-friendly** : tout est livré derrière `CHECKOUT_OPTIMISTIC_WIZARD_ENABLED` (OFF par défaut) → merges fréquents, code inerte tant que le flag est OFF.
- PRs petites et séquencées par phase (≤ ~400 lignes diff hors tests), chacune verte (CI : lint + tsc + vitest + e2e ciblés).
- Convention commits : `feat(checkout)/perf(checkout)/test(checkout)` (cf. historique repo). Trailer `Co-Authored-By`.

## 2. Découpage en phases (incrémental, chaque phase déployable)

| Phase | Intitulé | Contenu | Flag visible ? | Sortie |
|---|---|---|---|---|
| **P0** | Socle inerte | Migration `lead_event_outbox`, env flag, `lead-id.ts`, schémas Zod/JSON | non (rien ne l'appelle) | DB + flag prêts |
| **P1** | Idempotence serveur (upsert) | `lead-repo` create→upsert + `upsertAddress/Payment` + `lead-service` | non (API compat) | endpoints idempotents au désordre |
| **P2** | Outbox + worker | `lead-outbox-repo/processor/handlers`, `cron/lead-outbox`, timer systemd | non (enqueue derrière flag) | effets durables prêts |
| **P3** | File client + transition optimiste | `lead-sync-queue`, `wizard-store` optimiste, `use-wizard-mutations` flag ON | **oui (flag)** | UI instantanée |
| **P4** | Beacon + endpoint /sync | `beacon-flush`, `/api/checkout/lead/sync`, recovery reload | oui | zéro perte |
| **P5** | Conversion + snapshot | `order/route` snapshot complet + enqueue outbox | oui | conversion fiable |
| **P6** | Funnel chat (FR-09) | réutilisation file dans `use-chat-send` | oui | parité chat |
| **P7** | Observabilité + durcissement | logs/métriques/alertes, rate-limit /sync, FR-11 | oui | prod-ready |
| **P8** | Rollout & nettoyage | ramp flag, suppression du legacy après stabilisation | oui→défaut | GA |

Dépendances : P0 → {P1, P2}; P1 → P3; {P3} → P4 → P5 → P6; transverse P7; P8 final.

## 3. Workstreams parallélisables

- **WS-Backend** : P0(db), P1, P2, P5(serveur), P7(serveur).
- **WS-Frontend** : P3, P4(client), P5(client), P6, P7(FR-11).
- **WS-QA** : batterie Vitest/MSW/Playwright en continu (cf. `../04-tests/`).
- **WS-Ops** : timer systemd, alertes, runbook (cf. `../05-runbook/`).

## 4. Portes de qualité (quality gates) par PR

1. `pnpm lint` clean (eslint).
2. `pnpm tsc --noEmit` 0 erreur (TS strict).
3. `pnpm vitest run <scope>` vert + couverture ≥ 90 % sur les modules touchés du cœur.
4. e2e Playwright ciblés verts sur build prod local `:3100`.
5. Revue : respect ADR, pas de PII en logs, idempotence prouvée par test.
6. Doc à jour (module-map, test-matrix) si surface modifiée.

## 5. Définition de fini

Voir [`definition-of-done.md`](definition-of-done.md). Risques : [`risks.csv`](risks.csv).
Détail tâche-par-tâche avec tests : [`action-plan.md`](action-plan.md) + [`tasks.csv`](tasks.csv).
