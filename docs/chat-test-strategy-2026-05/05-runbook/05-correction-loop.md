# Runbook — Boucle de correction

Procédures concrètes pour corriger les problèmes détectés par la batterie.

## Flux global

```
                  ┌──────────────────────────────────────────┐
                  │  Détection (CI / monitoring / incident)    │
                  └─────────────────┬───────────────────────┘
                                    ▼
                  ┌──────────────────────────────────────────┐
                  │  Classification                            │
                  │  - Flaky / Bug / Regression / Drift        │
                  └─────────────────┬───────────────────────┘
                                    ▼
              ┌─────────────────────┼──────────────────────┐
              ▼                     ▼                      ▼
      ┌────────────┐         ┌───────────┐           ┌───────────┐
      │ Quarantine │         │  Fix code │           │ Fix tests │
      │ (flaky)    │         │  (bug)    │           │ (gap)     │
      └─────┬──────┘         └─────┬─────┘           └─────┬─────┘
            │                       │                      │
            ▼                       ▼                      ▼
      ┌────────────┐         ┌───────────────┐    ┌─────────────────┐
      │ Ticket DD  │         │ Test régression│   │ Coverage update │
      │ (2 sem max)│         │ PR + Review    │   │ Code review     │
      └────────────┘         └───────────────┘    └─────────────────┘
                                    │
                                    ▼
                              ┌───────────┐
                              │ Vérifier  │
                              │ vert      │
                              └───────────┘
```

## A. Bug détecté par test

### Procédure (TDD-fix)

```bash
# 1. Test révèle bug → BLOC
pnpm test:e2e e2e/visitor/chat-conversation.spec.ts

# 2. Reproduire en isolation
pnpm test:e2e:debug e2e/visitor/chat-conversation.spec.ts

# 3. Créer branche fix
git checkout -b fix/CHA-XXX-bug-name

# 4. PRINCIPE TDD :
#    a. Renommer test en `.failing` (vitest) ou `test.fail` (playwright) si pas déjà
#    b. Confirmer qu'il échoue : confirme reproduction
#    c. Fix code
#    d. Test vert
#    e. Retirer `.failing`

# 5. Coverage check
pnpm test:coverage

# 6. PR avec :
#    - Commit message "fix: <description> (closes CHA-XXX)"
#    - Description liant audit finding (C1, C2, etc.)
#    - Tag "regression-test" si applicable
```

### Bugs prioritaires (audit findings)

| Finding | Test associé | Workflow |
|---------|--------------|----------|
| C1 Tools framework absent | F58, F60 (`.fails`) | Tests activés post-implémentation |
| C2 Outbound moderation advisory | F27 (`.failing`) | Test passe une fois fix livré |
| C3 Fallback 5 niveaux | F31, BS04, BS09 | Tests `.fails` activés post-impl |
| C4 Budget guard | F35 régression | Test vert après ajout `assertBudget` |
| C5 SSE event hors enum | F08 régression | Test vert après rename |
| C6 Race breaker | F31 concurrent | Test passe après unification truth |
| I1 attributeConversion | F34 test négatif | Test devient positif post-câblage |
| I3 FAQ threshold | F47 régression | Test passe après harmonisation |
| I4 Visitor rate-limit | F36 régression | Test passe après ajout consume |
| I7 PII regex order | F23 régression | Test passe après réordre |

## B. Flaky test

### Détection

Triggers :
- CI passe rouge, rerun passe vert → flaky possible
- Spec marquée `retry` qui a retry > 0 sur > 5 runs
- Pareto detection : top 10 specs avec ratio fail/total > 5 %

### Procédure

```bash
# 1. Confirmer flaky (10× run)
pnpm exec playwright test --repeat-each 10 <spec-file>

# Si 9/10 ou 10/10 passent → était une glitch isolée
# Si < 9/10 → vraiment flaky → quarantaine

# 2. Tagger comme @flaky-quarantine
# Dans le spec : test.skip ou ajouter tag @flaky-quarantine
# Créer ticket FLAKY-XXX avec :
#   - Cause hypothétique (timing, race, network)
#   - Owner
#   - Deadline (2 semaines max)

# 3. Quarantine n'est PAS permanente
# Si pas fixé en 2 semaines : escalade tech-lead, décision :
#   a. Étendre deadline 1× (justification)
#   b. Supprimer le test (si pas critique)
#   c. Promouvoir en bug et investiguer fond
```

### Causes communes & remèdes

| Cause | Symptôme | Remède |
|-------|----------|--------|
| Timing race | Passe local, fail CI | `findBy*` + `expect.poll` |
| Animation interfere | Fail intermittent | Mock `humanize`, désactiver transitions |
| Network real | Fail si MSW miss | `onUnhandledRequest: 'error'` |
| State partagé | Passe seul, fail en suite | `beforeEach` reset |
| `waitForTimeout` | Toujours mauvais | Remplacer par network/state wait |
| DB pollute | Fail si ordre random | TRUNCATE explicite |

## C. Coverage drop

### Détection

CI gate fail : coverage < seuil. Codecov diff sur PR.

### Procédure

```bash
# 1. Voir lignes non couvertes
open apps/web/coverage/index.html
# Click sur fichier qui drop → voir lignes en rouge

# 2. Décider :
#    a. Test manquant → écrire test
#    b. Code mort → supprimer
#    c. Branche impossible → annoter `/* c8 ignore next */`

# 3. Si exception légitime :
#    - Ticket exception
#    - Plan retour conformité daté
#    - Review tech-lead
```

## D. Test obsolète (drift)

Quand le code évolue, certains tests deviennent obsolètes :

```bash
# Procédure
1. Identifier (review audit ou stand-up)
2. Vérifier que le comportement n'est plus pertinent
3. SOIT supprimer test (avec justification PR), SOIT le mettre à jour
4. CI doit toujours passer
5. Documenter dans changelog
```

## E. Audit + retro

À chaque sprint (1× / 2 semaines) :

```markdown
## Sprint review tests

### Statistiques
- Tests ajoutés : X
- Tests modifiés : Y
- Tests supprimés : Z (justifications attachées)
- Coverage début/fin : A → B
- Pass rate : 100 %

### Quarantaine
- 0 → 0 : ✅
- 2 → 1 : ✅ (1 fixé)
- 1 → 2 : ⚠️ (à surveiller)

### Backlog tests à écrire
- F50 admin themes (P2) — non commencé
- F52 admin lang-stats (P2) — non commencé

### Top problèmes
- Specs slowest : <list>
- Flaky : <list>

### Décisions
- ...
```

## F. Ouverture d'un test pour une fonctionnalité nouvelle

Quand un dev ajoute une feature :

```bash
1. Update test-matrix.csv de la feature (lignes test à venir)
2. Update README.md de la feature (description, acceptance criteria)
3. Écrire tests AVANT ou EN MÊME TEMPS que le code (TDD)
4. PR contient code + tests + doc
5. Review : assurer que tests couvrent le scope, pas plus
6. Merge si CI green + coverage stable / progresse
```

## G. Lien avec audit chat

À chaque ticket audit (CHA-AUD-*) :
- Test associé dans la matrice
- Test prouve le bug (state actuel)
- Test passe après fix
- Ticket fermé QUE quand test passe

Voir [chat-audit-2026-05/04-recommandations.md](../../chat-audit-2026-05/04-recommandations.md)
pour la liste exhaustive des 32 tickets.
