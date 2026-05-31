# 11 — Exécution de la batterie de tests i18n

> Sous-dossier dédié à **l'exécution opérationnelle** de la batterie de tests dense décrite dans `07-tests/`.
> Audience : **dev qui pilote la batterie**, **QA qui constate les résultats**, **lead technique qui valide les gates**.
> Pendant : Phase 6 du plan d'action (semaines 8-9) et phase de stabilisation (semaine 11).

## TL;DR — philosophie en 6 phrases

1. **Robustesse > volume** : 50 tests qui catch tous les bugs critiques valent mieux que 500 tests redondants qui dorment.
2. **Vagues séquentielles** : on exécute la batterie en 8 waves successives, chacune avec un exit criterion strict avant la suivante.
3. **Boucle correction-vérification** courte : detect → triage → fix → verify → regress → document, et on recommence.
4. **Runbook copy-pastable** : chaque commande, chaque flag, chaque variable d'env est documentée. Zéro tribal knowledge.
5. **Reporting cadencé** : daily standup pendant la batterie, weekly à la founder, post-deploy final, post-mortem si incident.
6. **Exit criteria explicites** : 0 P0 ouvert, < 5 P1 ouverts, < 20 P2 ouverts, 0 flaky test sur 3 runs consécutifs.

## Sommaire du dossier

| # | Fichier | Aspect | Lecture |
|---|---|---|---|
| 1 | [`plan-batterie-tests.md`](./plan-batterie-tests.md) | Plan d'exécution en 8 waves (Foundation → Component → Integration → E2E → Visual → A11y → Perf → Robustness) | 35 min |
| 2 | [`boucle-correction.md`](./boucle-correction.md) | Boucle correction-vérification 6 phases + SLA + templates | 25 min |
| 3 | [`runbook-tests.md`](./runbook-tests.md) | Runbook d'exécution pas-à-pas (setup, debug, snapshots, CI, reporting) | 30 min |
| 4 | [`verification-checklist.csv`](./verification-checklist.csv) | 100+ items de vérification post-exécution | référence |
| 5 | [`communication-templates.md`](./communication-templates.md) | 5 templates de communication (daily, weekly, synthese finale, post-mortem, exec one-pager) | 15 min |
| — | `README.md` | Ce fichier — vue d'ensemble + workflow | 5 min |

**Total lecture** : ~110 min pour absorber l'ensemble. Si lecture rapide : lire ce README + sommaire de chaque fichier (~20 min).

## Différence avec `07-tests/`

- **`07-tests/`** = stratégie + design des tests + outils (le **quoi** et le **comment écrire**)
- **`11-test-execution/`** = exécution + pilotage + correction (le **quand**, le **dans quel ordre**, le **comment piloter**)

On lit `07-tests/` quand on **écrit** un test, on lit `11-test-execution/` quand on **exécute** la batterie.

## Workflow global d'exécution

```
                  ┌──────────────────────────────────────────────────────┐
                  │  PRÉ-EXÉCUTION (J-2 à J-1)                            │
                  │  - Lire 07-tests + 11-test-execution                  │
                  │  - Vérifier env local OK (Node 20, pnpm 9, Postgres)  │
                  │  - Tag baseline `i18n-baseline-{date}` sur Git        │
                  │  - Annoncer démarrage batterie sur #dev-femiglow      │
                  └────────────────────────┬─────────────────────────────┘
                                           ▼
                  ┌──────────────────────────────────────────────────────┐
                  │  WAVE 1 — Foundation (unit helpers)                   │
                  │  pnpm test:i18n:wave1                                  │
                  │  Exit : 100% green, coverage helpers ≥ 90%             │
                  └────────────────────────┬─────────────────────────────┘
                                           ▼
                  ┌──────────────────────────────────────────────────────┐
                  │  WAVE 2 — Component (RTL + RSC)                       │
                  │  Exit : 100% green, axe 0 violation critical/serious  │
                  └────────────────────────┬─────────────────────────────┘
                                           ▼
                  ┌──────────────────────────────────────────────────────┐
                  │  WAVE 3 — Integration (MSW + API)                     │
                  │  Exit : 100% green, coverage API ≥ 90%                │
                  └────────────────────────┬─────────────────────────────┘
                                           ▼
                  ┌──────────────────────────────────────────────────────┐
                  │  WAVE 4 — E2E flows (Playwright × 3 locales)          │
                  │  Exit : 100% green sur runs × 3 (anti-flaky)          │
                  └────────────────────────┬─────────────────────────────┘
                                           ▼
                  ┌──────────────────────────────────────────────────────┐
                  │  WAVE 5 — Visual regression                           │
                  │  Exit : 0 pixel diff > threshold, ou diffs approuvés  │
                  └────────────────────────┬─────────────────────────────┘
                                           ▼
                  ┌──────────────────────────────────────────────────────┐
                  │  WAVE 6 — A11y RTL                                    │
                  │  Exit : 0 critical/serious sur axe, keyboard OK       │
                  └────────────────────────┬─────────────────────────────┘
                                           ▼
                  ┌──────────────────────────────────────────────────────┐
                  │  WAVE 7 — Performance                                 │
                  │  Exit : Lighthouse ≥ 90 perf, bundle < +5% baseline   │
                  └────────────────────────┬─────────────────────────────┘
                                           ▼
                  ┌──────────────────────────────────────────────────────┐
                  │  WAVE 8 — Robustness (fuzz + chaos + edge cases)      │
                  │  Exit : 0 crash, 0 data loss, 0 regression P0/P1      │
                  └────────────────────────┬─────────────────────────────┘
                                           ▼
                  ┌──────────────────────────────────────────────────────┐
                  │  POST-EXÉCUTION                                       │
                  │  - Run la verification-checklist.csv                  │
                  │  - Compiler le rapport final                           │
                  │  - Signoff lead + founder                              │
                  │  - Tag `i18n-batterie-passed-{date}` sur Git           │
                  └──────────────────────────────────────────────────────┘
```

À tout moment, si une wave fail, on **enclenche la boucle correction-vérification** (cf. `boucle-correction.md`) sans avancer à la suivante. On ne quitte pas une wave sans son exit criterion respecté.

## Commandes maître

### Exécution séquentielle complète (locale dev)

```bash
# Setup
cd apps/web
pnpm install
pnpm exec playwright install --with-deps

# Exécution complète vague par vague (durée totale ~50-90 min selon machine)
pnpm test:i18n:all

# Ou wave par wave (recommandé pendant phase 6, plus lisible)
pnpm test:i18n:wave1   # Foundation
pnpm test:i18n:wave2   # Component
pnpm test:i18n:wave3   # Integration
pnpm test:i18n:wave4   # E2E
pnpm test:i18n:wave5   # Visual
pnpm test:i18n:wave6   # A11y
pnpm test:i18n:wave7   # Performance
pnpm test:i18n:wave8   # Robustness
```

### Exécution parallèle (CI)

```bash
# Lance les waves indépendantes en parallèle (waves 1-3 séquentiel, puis 4-7 en parallèle)
pnpm test:i18n:parallel
```

### Exécution ciblée

```bash
# Juste un fichier précis
pnpm test:i18n:focus -- src/lib/i18n/resolveLocale.test.ts

# Seulement les tests qui ont fail au dernier run
pnpm test:i18n:retry-failed

# Update snapshots après refactor légitime
pnpm test:i18n:update-snapshots
```

Cf. `runbook-tests.md` § 3 pour la liste complète des commandes.

## Métriques de succès (definition of done batterie)

| Catégorie | Métrique | Cible | Critique ? |
|---|---|---|---|
| **Tests** | Vitest unit + integration green | 100% | Oui — bloquant merge |
| **Tests** | Playwright e2e green sur 3 runs consécutifs | 100% | Oui — bloquant merge |
| **Tests** | Visual diffs approuvés ou 0 | 0 unexpected | Oui |
| **Tests** | Axe-core critical/serious | 0 | Oui |
| **Coverage** | `lib/i18n/*` lines | ≥ 90% | Oui |
| **Coverage** | `components/i18n/*` lines | ≥ 80% | Non (warn) |
| **Coverage** | `app/api/i18n/*` lines | ≥ 90% | Oui |
| **Coverage** | Clés FR | 100% | Oui |
| **Coverage** | Clés AR | ≥ 90% | Non (warn) |
| **Coverage** | Clés EN | ≥ 90% | Non (warn) |
| **Perf** | Lighthouse perf 3 locales | ≥ 90 | Non (warn) |
| **Perf** | Bundle messages JSON par locale | < 15 KB gzipped | Non (warn) |
| **Robustness** | 0 crash sur fuzz inputs | Oui | Oui |
| **Bugs** | P0 ouverts | 0 | Oui |
| **Bugs** | P1 ouverts | < 5 | Oui |
| **Bugs** | P2 ouverts | < 20 | Non (warn) |

## Anti-patterns d'exécution

- **Lancer toutes les waves d'un coup et tout debug à la fin** : explosion combinatoire. Toujours wave par wave avec exit criterion.
- **Skip une wave parce qu'elle "n'est pas critique"** : la wave Performance ou Robustness sont les dernières à fail en prod, donc les plus dangereuses si pas testées.
- **Marquer un test `.skip` "temporairement" sans ticket** : il restera skipé pendant 6 mois. Toujours un ticket en regard.
- **Update les snapshots visuels sans review** : on légitime ainsi une vraie régression. Toujours diff review par 2 yeux.
- **Lancer la batterie sans tag Git baseline** : impossible de revenir à l'état pré-batterie en cas de pollution test data.
- **Reporter au stand-up "tout va bien" sans chiffres** : toujours coller le résultat brut (X tests, Y green, Z fail).

## Référence croisée

- Stratégie tests détaillée : [`../07-tests/strategy.md`](../07-tests/strategy.md)
- Matrice tests : [`../07-tests/test-matrix.csv`](../07-tests/test-matrix.csv)
- Phase 6 plan d'action : [`../08-plan-action/phases.md#phase-6--tests-denses-semaines-8-9`](../08-plan-action/phases.md)
- Runbook ajout de langue : [`../09-runbook/`](../09-runbook/)
- Monitoring + KPIs : [`../10-monitoring/`](../10-monitoring/)
- Rollback (si batterie échoue catastrophique) : [`../08-plan-action/rollback.md`](../08-plan-action/rollback.md)
- ESLint rules : [`../07-tests/lint-rules.md`](../07-tests/lint-rules.md)

## Checklist d'activation Phase 6 (utilise ce sous-dossier)

- [ ] Lire les 5 fichiers de `11-test-execution/` (~110 min cumulés)
- [ ] Confirmer Phase 5 closée (translation AR + EN validée native speaker)
- [ ] Vérifier coverage gates configurés dans `vitest.config.ts`
- [ ] Vérifier ESLint rules custom actives (`07-tests/lint-rules.md`)
- [ ] Tag Git baseline créé : `git tag i18n-baseline-2026-MM-DD && git push origin --tags`
- [ ] Annoncer sur #dev-femiglow : "Démarrage batterie tests i18n J0"
- [ ] Planning daily standup posé pour les 2 semaines
- [ ] Rapport hebdomadaire J5 / J10 calé avec founder
- [ ] Vagues 1-8 exécutées dans l'ordre, exit criteria respectés à chaque palier
- [ ] Checklist `verification-checklist.csv` 100% verte
- [ ] Rapport final compilé et partagé
- [ ] Tag Git "passed" créé : `git tag i18n-batterie-passed-2026-MM-DD`
- [ ] Démo équipe (15 min) pour clôturer la phase
