# Ordre d'exécution recommandé

## Dépendances entre phases

```
Phase 0 (setup)
  │
  └─→ Phase 1 (docs) ─────────────── (parallel) ──────┐
        │                                              │
  Phase 2 (data) ────┐                                 │
                     │                                 │
  Phase 3 (lib) ─────┴─→ Phase 4 (backend) ─┐         │
                                            │         │
                                            └─→ Phase 5 (frontend)
                                                      │
                                                      └─→ Phase 6 (menu)
                                                            │
                                                            └─→ Phase 7-9 (tests)
                                                                  │
                                                                  └─→ Phase 10 (runbook prod)
                                                                        │
                                                                        └─→ Phase 11 (smoke)
```

## Ordre des commits

```
1. docs(gtm-poka-yoke): dossier complet (vision + architecture + runbook)
2. feat(gtm-poka-yoke): data layer (migration + schemas Zod)
3. feat(gtm-poka-yoke): bundle-id + pair-validator + drift-detector
4. feat(gtm-poka-yoke): routes API (sentinel + sync-status + validate-pair)
5. feat(gtm-poka-yoke): cron silence-check + export injection bundleId
6. feat(gtm-poka-yoke): pages admin + composants UI
7. feat(gtm-poka-yoke): intégration menu TrackingShell
8. test(gtm-poka-yoke): tests unit Vitest (50+)
9. test(gtm-poka-yoke): tests MSW routes
10. test(gtm-poka-yoke): tests E2E Playwright
11. docs(gtm-poka-yoke): runbook GTM avec valeurs prod
```

Chaque commit doit être indépendamment testable et déployable.

## Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Migration cause downtime | Faible | Élevé | Tester sur dev/staging d'abord |
| Faux positifs en masse | Moyen | Moyen | Hystérésis + seuils configurables env |
| Conflit migration avec branche concurrente | Moyen | Faible | Coordonner avec autres devs |
| Performance endpoint sentinel | Faible | Moyen | Index DB + sendBeacon côté client |
| GTM tags mal configurés post-import | Moyen | Élevé | Documenter précisément + screenshots |

## Définition de fait (DoD) par phase

### Phase 2 (data) — Done quand :
- [ ] Migration appliquée localement
- [ ] `SELECT * FROM gtm_drift_state` retourne 1 ligne `singleton`
- [ ] Tests des schemas Zod passent

### Phase 3 (lib) — Done quand :
- [ ] `computeBundleId({...minimal})` retourne 12 chars hex
- [ ] Tests pair-validator : tous les cas R-001 à R-009 verts
- [ ] Tests drift-detector : matrice 10 cas verte

### Phase 4 (backend) — Done quand :
- [ ] `curl -X POST /api/track/sentinel ... → 204`
- [ ] `curl /api/admin/tracking/gtm/sync-status` (avec auth) → 200 JSON valide
- [ ] `curl -X POST /api/admin/tracking/gtm/validate-pair` (avec auth) → 200 résultat

### Phase 5 (frontend) — Done quand :
- [ ] Page sync-status SSR rendue (testid présent dans HTML brut)
- [ ] Auto-refresh 30s fonctionne (testé manuellement)
- [ ] Wizard validate-pair complète son cycle
- [ ] DriftBanner injecté dans TrackingShell

### Phase 11 (smoke) — Done quand :
- [ ] Cf. checklist 01-plan-action.md
