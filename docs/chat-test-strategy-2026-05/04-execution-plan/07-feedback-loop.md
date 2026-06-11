# Boucle de correction & vérifications continue

Une fois la batterie en place, le **vrai travail** est la maintenance + amélioration
continue. Boucle quotidienne / hebdo / mensuelle.

## Boucle quotidienne (15 min en équipe stand-up)

1. **CI status** : tous les jobs verts ? Si rouge → identifier owner immédiatement
2. **Specs slowest top-10** : check d'une commande automatique
3. **Quarantaine** : tests en quarantaine → owner assigné ? Deadline tenable ?
4. **Coverage delta** : drop > 1 % depuis hier → investigate
5. **New TODOs / `.skip` / `it.fails`** : revue rapide ; ticket si nouveau

## Boucle hebdo (revue 30 min)

1. **Pareto des bugs détectés** : par feature, par type
2. **Specs flaky détectés** : analyse cause + plan
3. **Coverage trend** : graph 7 jours
4. **Test execution time trend** : si dérive > 10 %, profilage requis
5. **Audit gates** : tous les gates respectés ? Si exception → ticket + plan
6. **Backlog tests à écrire** : priorisation P0/P1/P2

## Boucle mensuelle (revue 1h)

1. **Audit dette technique tests** :
   - Mocks trop larges (anti-pattern Mi1)
   - Specs > 200 lignes (probable mauvais découpage)
   - POM avec méthodes orphelines
   - Factories non utilisées
2. **Revue exceptions gates** : aucune ne doit traîner > 3 mois
3. **Mise à jour TEMPLATE.md** si patterns nouveaux découverts
4. **Onboarding test** : nouveau dev arrive → suit le runbook → temps mesuré

## Boucle trimestrielle (workshop 2h)

1. Audit complet du dossier `02-functional-areas/` : tous les README à jour ?
2. Renouvellement scénarios métier : encore représentatifs ?
3. Tooling : upgrades majeurs vitest / Playwright à considérer
4. Refactor opportunistique
5. **Réécriture** : tests les plus vieux / les plus fragiles

## Mécaniques de correction

### Tests qui échouent en CI

```
1. Owner du PR notifié (assignee)
2. Triage : flaky vs bug réel
3. Si flaky :
   a. Tag @flaky-quarantine + ticket FLAKY-XXX
   b. Investigate dans la semaine
4. Si bug réel :
   a. Si bug regression : rollback + fix
   b. Si bug feature : ticket + fix dans cycle
```

### Coverage drop

```
1. CI block PR
2. Author voit les lignes non couvertes (lcov report)
3. Author écrit tests manquants ou justifie (exception ticket)
4. Review obligatoire si exception
```

### Bug découvert en prod (post-tests)

```
1. Ticket prio P0
2. Test régression écrit AVANT fix (TDD)
3. Test FAIL → confirme reproduction
4. Fix → test PASS
5. Post-mortem : pourquoi tests ne l'avaient pas attrapé ? Update couverture.
```

## Métriques de santé suivies

| Métrique | Cible | Source | Fréquence |
|----------|-------|--------|-----------|
| Coverage moyen | ≥ 85 % | codecov | quotidien |
| Coverage P0 critique | ≥ 95 % | codecov | quotidien |
| Pass rate CI | 100 % | GH Actions | quotidien |
| Flaky rate | < 1 % | CI metrics | hebdo |
| Specs slowest top-10 avg | < 10 s | vitest reporter | quotidien |
| Total CI time | < 20 min | GH Actions | quotidien |
| Bug escaped to prod | 0 (ideal) | incident tracker | mensuel |
| Time to detect | < 1 j (post-deploy) | logs + alerts | mensuel |
| Time to fix flaky | < 7 j | quarantine tickets | hebdo |

## Outils de monitoring

- **Codecov** : coverage trend + PR comments
- **GitHub Actions metrics** : durée build, jobs success rate
- **Lighthouse CI** : perf trend on `/kit`
- **Sentry** ou équivalent : erreurs runtime non capturées par tests
- **Slack #qa-chat** : alerts CI rouge, flaky detected

## Anti-patterns à corriger en boucle

| Symptôme | Cause | Correction |
|----------|-------|------------|
| Tests "verts" mais bug en prod | Mocks trop larges, scénarios incomplets | Audit tests vs incident → renforcer |
| CI lent | Spécs non parallèles, fixtures lourds | Profiler + diviser fixtures + parallel |
| Beaucoup de `it.fails(...)` | Implémentations en retard | Roadmap clarifier |
| Tests dupliqués entre couches | Mauvais sense de "haute couche" | Réviser distribution pyramid |

## Lien avec audit (corrective loop)

Cf. [chat-audit-2026-05/04-recommandations.md](../../chat-audit-2026-05/04-recommandations.md) :

- Quick wins → Phase 1 régression tests verts
- Sprint Sécurité éditoriale → Tests C2/M4/R2 passent
- Sprint Observabilité → Tests M1/M2/I5 passent
- Sprint ADR-004 → Tests `it.fails(...)` activés
- Sprint Cascade intent → Tests sur dataset
- Sprint Tools → Tests C1 activés

Chaque ticket de l'audit a un test associé. Le ticket n'est **fermé** que quand son test
passe.
