# Plan de développement (delivery)

> Modèle d'exécution type ESN/grande agence adapté à ce repo : petits lots,
> qualité par construction, traçabilité, CI bloquante. Le séquencement métier
> vit dans `07-plan-action-global.yaml` ; ici on définit COMMENT on travaille.

## 1. Rôles (peuvent être portés par la même personne/un agent, mais les
casquettes sont distinctes à chaque étape)

| Rôle | Responsabilité | Artefacts |
|---|---|---|
| Tech lead | architecture, arbitrages, revues de PR | 01-architecture, ADR inline |
| Dev fonctionnalité | implémentation TDD du chantier | code + tests du Fxx |
| QA lead | batteries, oracles, triage des échecs, anti-flakiness | 03-batterie-tests.csv, rapports |
| Ops | migrations, déploiements, runbook | 08-runbook journal |

## 2. Cycle par fonctionnalité (Fxx) — « test-first par lot »

```
1. Lire fonctionnalites/Fxx/01-description.md + 02-spec-technique.yaml
2. Écrire/adapter les handlers MSW & factories du contrat   ──┐ commit A (test infra)
3. Écrire les tests composant ROUGES du lot courant          ──┘
4. Implémenter jusqu'au VERT (sans toucher les oracles)        commit B (feature)
5. Grille d'échecs réseau (401/422/500/hang/network) verte     (inclus commit B)
6. Boucle de correction : triage → fix → re-run (runbook §4)
7. Intégration + E2E du lot ; axe ; next build                 commit C (e2e/a11y)
8. Mise à jour 03-batterie-tests.csv (statut) + docs           commit D (docs)
```

Taille de lot : 1 lot = 1 sous-fonctionnalité de la spec (ex. « ConfirmDialog »
est un lot de F01 ; « export serveur » un lot de F04). Un lot = 1 PR.

## 3. Branches, commits, PR

- Branche par chantier : `feat/emails-ux-f01-socle`, …, depuis `master`.
- Commits conventionnels : `feat(emails-ux): F04 export CSV serveur (CKPT-01)`
  — l'ID matrice DANS le message (greppabilité bug→fix→test).
- PR : description = lien spec + IDs résolus + sortie de batterie collée.
- Interdits en revue : `.skip`/`.only` ; baisse de coverage du périmètre ;
  `window.confirm`/`alert` ; nouveau `toLocaleString` hors `ui/` ;
  champ `event` dans un payload logger (collision documentée).

## 4. Definition of Done (par lot)

- [ ] Spec à jour (YAML) si le contrat a bougé
- [ ] Tests du lot verts + grille réseau complète
- [ ] Batterie COMPLÈTE du Fxx verte (pas seulement le lot)
- [ ] Suite emails GLOBALE verte (`pnpm vitest run src/components/admin/emails src/app/api/admin/emails src/lib/mail`)
- [ ] `pnpm tsc --noEmit` + `pnpm lint` + **`pnpm next build`** OK
- [ ] axe : 0 violation serious/critical sur les écrans touchés
- [ ] Lignes `03-batterie-tests.csv` du lot passées à `implemente`
- [ ] Entrée au journal du runbook

## 5. CI (extension de `.github/workflows/emails-qa.yml`)

```yaml
jobs:
  emails-ux:
    steps:
      - lint + tsc
      - vitest (unit + composant MSW) --shard 4        # la masse
      - vitest integration (service postgres femiglow_test)
      - next build                                     # attrape les violations RSC
      - playwright (chromium, projets emails-*)        # E2E + a11y
      - gate coverage : >= 85% lignes sur src/components/admin/emails/ui/
                        >= 80% sur les écrans refondus
```
Anti-flakiness CI : `retries: 1` Playwright (un test qui ne passe qu'au retry
est ouvert comme bug de flakiness, pas ignoré) ; horloge gelée dans les tests
composant (`vi.setSystemTime`) ; AUCUN `waitForTimeout` (waits sémantiques).

## 6. Environnements

| Env | Usage | Données |
|---|---|---|
| jsdom (vitest) | unit + composant MSW | factories uniquement |
| `femiglow_test` | intégration routes (DB tronquée entre tests) | seeds dédiés |
| worktree + `femiglow_emailqa` (clone prod, port 8013, SMTP→Mailpit 1025, Listmonk→port mort) | E2E Playwright | baseline restaurable `/root/femiglow-emailqa-baseline-*.dump` |
| staging (8006) | démo de fin de chantier | — |
| prod (8011) | smoke lecture seule UNIQUEMENT (`-H "Host: femiglow-maroc.com"`) | JAMAIS d'E2E |

## 7. Estimation & jalons (cohérent avec ../04-backlog-ameliorations.yaml)

| Phase | Chantiers | Charge estimée | Jalon de sortie |
|---|---|---|---|
| 1 | F01 socle + F02 navigation | ~2 sem | socle adopté par 1 écran pilote (suppression) + batteries F01/F02 vertes |
| 2 | F03 dashboard + F04 cockpit + F08 audiences | ~2,5 sem | parcours « pilotage quotidien » E2E vert |
| 3 | F05 campagnes + F07 templates | ~2,5 sem | scénario métier « campagne de A à Z » vert |
| 4 | F06 automations | ~2-3 sem | scénario « automation panier abandonné debuggée » vert |
| 5 | F09 + F10 + passe a11y/i18n (C10) | ~1,5 sem | batterie GLOBALE + E2E complets verts |

Chaque fin de phase = exécution du runbook §5 (batterie globale + boucle de
correction + commit/tag `emails-ux-phase-N`).
