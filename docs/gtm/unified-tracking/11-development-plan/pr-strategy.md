# PR strategy

## 1. Découpage en PRs

Une feature branche = un PR. Cible : **PR < 600 lignes diff** (sauf migration data inévitablement large).

### Groupement de tickets par PR

| PR # | Titre | Tickets | LOC estimés |
|---|---|---|---|
| PR-01 | feat(tracking-plan): schema + migration | TP2-001 à TP2-005 | ~400 |
| PR-02 | feat(tracking-plan): types + repository | TP2-006, TP2-007, TP2-008 | ~600 |
| PR-03 | feat(tracking-plan): validator + exporter + differ | TP2-009, TP2-010, TP2-011 | ~500 |
| PR-04 | feat(tracking-plan): service + cache + audit | TP2-012, TP2-013 | ~400 |
| PR-05 | feat(tracking-plan): API endpoints + OpenAPI + tests | TP2-014, TP2-015, TP2-016 | ~700 |
| PR-06 | feat(tracking-plan): Zustand store + TanStack hooks | TP2-017, TP2-018 | ~400 |
| PR-07 | feat(tracking-plan): primitives + Storybook | TP2-019 à TP2-024 | ~800 |
| PR-08 | feat(tracking-plan): home page | TP2-023 | (inclus PR-07) |
| PR-09 | feat(tracking-plan): wizard shell + Step1 | TP2-025, TP2-026 | ~500 |
| PR-10 | feat(tracking-plan): wizard Step2-3 | TP2-027, TP2-028 | ~600 |
| PR-11 | feat(tracking-plan): wizard Step4-5 | TP2-029, TP2-030 | ~600 |
| PR-12 | feat(tracking-plan): wizard E2E + a11y | TP2-031, TP2-032 | ~400 |
| PR-13 | feat(tracking-plan): expert mode | TP2-033, TP2-034 | ~700 |
| PR-14 | feat(tracking-plan): sync page | TP2-035 | ~400 |
| PR-15 | feat(tracking-plan): history page | TP2-036 | ~400 |
| PR-16 | feat(tracking-plan): diagnostics page (expert) | TP2-037 | ~300 |
| PR-17 | feat(tracking-plan): i18n fr namespace | TP2-038 | ~200 + JSON locales |
| PR-18 | feat(tracking-plan): i18n ar structure + RTL | TP2-039 | ~200 |
| PR-19 | feat(tracking-plan): legacy routes 302 | TP2-040 | ~150 |
| PR-20 | test(tracking-plan): complete Jest unit suite | TP2-041 | ~800 (tests only) |
| PR-21 | test(tracking-plan): complete Playwright E2E | TP2-042 | ~600 |
| PR-22 | test(tracking-plan): MSW handlers + fixtures | TP2-043 | ~400 |
| PR-23 | test(tracking-plan): snapshot legacy vs migrated | TP2-044 | ~300 |
| PR-24 | test(tracking-plan): ultimate integration test | TP2-045 | ~400 |
| PR-25 | chore(tracking-plan): migration script + dry-run | TP2-046 | ~500 |
| PR-26 | docs(tracking-plan): runbook deploy + rollback | TP2-047, TP2-048 | ~600 docs |
| PR-27 | chore(tracking-plan): Grafana dashboard | TP2-049 | ~200 |
| PR-28 | release(tracking-plan): go-live preparation | TP2-050 | minimal |

Total : ~28 PRs, ~12k lignes net.

## 2. Naming convention

```
{type}({scope}): {description}

type :   feat | fix | refactor | test | docs | chore | release
scope :  tracking-plan (toujours pour ce projet)
desc  :  imperative mood, < 70 chars, kebab-case OK
```

Exemples :
- `feat(tracking-plan): add Zod schema for TrackingPlan`
- `feat(tracking-plan): implement validator with placeholder check`
- `test(tracking-plan): cover edge cases in export determinism`

## 3. Description PR

Template (à automatiser via `.github/PULL_REQUEST_TEMPLATE.md`) :

```markdown
## Résumé

<1-3 lignes : ce que le PR change et pourquoi>

## Tickets

Closes TP2-XXX, TP2-YYY

## Changements

- [bullet point sur les fichiers principaux]
- [...]

## Tests

- [ ] Tests unitaires ajoutés
- [ ] Tests E2E ajoutés (si UI)
- [ ] Manuellement testé en local

## Screenshots (si UI)

| Avant | Après |
|---|---|
| ... | ... |

## Notes pour le reviewer

<spécificités, choix techniques, points d'attention>

## Checklist

- [ ] Linter passe
- [ ] Tests passent
- [ ] Type check passe
- [ ] a11y check passe (si UI)
- [ ] Docs mises à jour
- [ ] Feature flag respecté
```

## 4. Review process

### Reviewers

| PR Type | Reviewer principal | Reviewer secondaire |
|---|---|---|
| Migration data | Lead dev | DBA |
| API endpoints | Lead dev | Younes (cross) |
| Frontend UI | Lead dev | (optionnel : designer) |
| Tests | Lead dev | - |
| Runbook / docs | Lead dev | Amal (si fonctionnel) |

### Critères d'approbation

- [ ] Code lisible (nommage clair).
- [ ] Logique métier testée.
- [ ] Pas de duplication évidente.
- [ ] Sécurité : pas de secret en clair, validation server-side.
- [ ] Performance : pas de N+1, pas de boucle imbriquée gratuite.
- [ ] Accessibilité : labels, ARIA, focus visible.
- [ ] Pas de breaking change non documenté.

### Délai de review

- PR < 200 lignes : J+1 (24h ouvrées).
- PR < 600 lignes : J+1 à J+2.
- PR > 600 lignes : J+2 à J+3 (avec demande de splitting si possible).

## 5. CI pipeline

À chaque push sur PR branch :

```yaml
jobs:
  lint:           # eslint + prettier
  typecheck:      # tsc --noEmit
  test-unit:      # jest
  test-e2e:       # playwright (only critical flows in PR)
  a11y:           # axe-core on built app
  build:          # next build (catches build errors)
  bundle-analysis: # check budget
```

Échec d'un job = bloque le merge.

## 6. Merge strategy

**Squash and merge** vers `release/tracking-plan-v2`.

Pourquoi :
- Historique git propre.
- Un PR = un commit dans `release` branch.
- Co-Authored-By preservés si commit messages incluent `Co-Authored-By:` lines.

Une fois `release` mergée dans `master` : **merge commit** (pour préserver l'histoire de la release).

## 7. Backout / hotfix

Si bug critique post-merge dans `release` branch :

```bash
# Option 1 : revert le commit
git checkout release/tracking-plan-v2
git revert <commit-sha>
git push origin release/tracking-plan-v2

# Option 2 : hotfix branche
git checkout release/tracking-plan-v2
git checkout -b fix/tp2-hotfix-{ticket}
# fix
git push -u origin fix/tp2-hotfix-{ticket}
# PR back to release branch
```

## 8. Communication

Pour chaque PR mergé :
- Notif Slack canal `#tech-tracking-plan` (auto via GitHub bot).
- Tag de version interne : `tp2-v0.{sprint}.{ticket}` (e.g. `tp2-v0.1.005`).

Pour chaque release branch mergée vers master :
- Tag git : `tracking-plan-v2.0.0` (semver).
- Release notes générées automatiquement (Conventional Commits).
- Annonce dans `#general`.

## 9. PR pour la doc

Cette folder (`docs/gtm/unified-tracking/`) :
- Modifications doc → PR séparé.
- Sauf si la doc est inhérente au ticket (e.g. mise à jour de l'OpenAPI lors d'un changement d'endpoint, inclus dans le PR du code).

## 10. Atomicité

Règle d'or : **un PR doit pouvoir être revert sans casser le suivant** (sauf si dépendance explicite documentée).

Ex : PR-02 (types + repository) avant PR-03 (validator). On peut revert PR-03 si bug. On ne peut pas revert PR-02 sans aussi revert PR-03.

→ Documenter les dépendances dans la description PR.
