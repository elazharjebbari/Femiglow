# Action plan

## Vue d'ensemble

Le projet "Unified Tracking Plan v2" suit **5 phases d'exécution** + 1 phase de cleanup.

```
Phase 0    Phase 1    Phase 2    Phase 3    Phase 4    Phase 5
Discovery  Build      Validate   Migrate    Release    Cleanup
1 sem      6 sem      1 sem      1 sem      1 sem      ~90 jours
```

Chaque phase a une **gate de sortie** : critères mesurables qui doivent être validés avant de passer à la suivante. Le passage est explicite (réunion de sortie ou approbation écrite).

## Phase 0 — Discovery (1 semaine)

### Objectif
Aligner la vision, valider le périmètre et le budget.

### Actions
1. Lecture critique du document conceptuel (`docs/gtm/18-unified-tracking-system-conceptual.md`) par Lead + Amal + Aïcha.
2. Réunion de validation : périmètre confirmé.
3. Lecture critique du dossier technique par Lead + Younes.
4. Confirmation du budget : 6 sprints, Younes solo.
5. Décision GO / NO-GO sur le projet global.

### Gate de sortie
- [ ] Document conceptuel approuvé (Amal + Lead + Aïcha).
- [ ] Dossier technique reviewé sans bloquant majeur.
- [ ] Décision GO actée et communiquée.
- [ ] Calendrier sprints 1-6 publié.

### Responsable
Lead dev (orchestration), Younes (rédaction docs).

### Livrables
- Document conceptuel finalisé.
- Dossier technique complet (cette folder).
- Decision record GO.

---

## Phase 1 — Build (6 semaines)

### Objectif
Implémenter tout le code : backend, frontend, tests, migrations.

### Sub-phases (= sprints, cf. timeline.txt)

#### Sprint 1 — Data + Backend foundations
- Schéma Postgres + migrations Drizzle.
- Types Zod canoniques.
- Repository CRUD + tests unitaires.

#### Sprint 2 — Backend API + Export
- Validator + Exporter + Differ.
- TrackingPlanService.
- 9 endpoints API + OpenAPI.
- Integration tests.

#### Sprint 3 — Frontend primitives + Home
- Store Zustand + TanStack hooks.
- Composants partagés (StatusCard, IdInput, etc.).
- Page Home.
- Storybook.

#### Sprint 4 — Wizard
- Wizard 5 steps.
- E2E happy path.
- a11y audit + fixes.

#### Sprint 5 — Expert + Sync + History + i18n
- Expert mode 3 colonnes.
- Sync dashboard.
- History page.
- i18n fr + structure ar.
- 302 redirects legacy routes.

#### Sprint 6 — Tests + Migration + Release prep
- Suite Jest complète.
- Suite Playwright complète.
- MSW handlers.
- Migration script + dry-run.
- Runbook.

### Gate de sortie
- [ ] Tous tickets TP2-001 à TP2-049 fermés (TP2-050 = release).
- [ ] CI verte sur `release/tracking-plan-v2`.
- [ ] Tests : Jest ≥ 80% couverture, Playwright tous verts.
- [ ] a11y : axe-core 0 violation, Lighthouse ≥ 95.
- [ ] Documentation à jour.

### Responsable
Younes (exécution), Lead dev (review).

### Livrables
- Code mergé dans `release/tracking-plan-v2`.
- Tests passants en CI.
- Runbook draft.

---

## Phase 2 — Validate (1 semaine)

### Objectif
Vérifier que le système fonctionne en bout-en-bout avant migration prod.

### Actions

#### Jour 1 — Smoke tests sur staging
- Déploiement de `release/tracking-plan-v2` sur staging.
- Smoke tests manuels (parcours wizard complet, activation, export).
- Vérification des métriques (Grafana dashboard).

#### Jour 2-3 — User acceptance testing (Amal)
- Onboarding live d'Amal sur staging.
- Amal réalise les 5 journeys (cf. user-journeys.md).
- Feedback collecté + bugs reportés.
- Bugs P0/P1 fixés en J+1.

#### Jour 4 — Test ultime d'intégration
- Exécution du test ultime (cf. 14-tests/integration/ultimate-test.md).
- 100% des assertions passent.

#### Jour 5 — Rehearsal migration + rollback
- Dry-run migration sur copie de prod.
- Diff legacy vs migrated : 0 différence sémantique.
- Rehearsal du rollback : tester le feature flag flip.

### Gate de sortie
- [ ] Smoke tests passent sur staging.
- [ ] Amal feedback positif (score ≥ 4/5).
- [ ] Test ultime d'intégration validé.
- [ ] Migration dry-run sans diff sémantique.
- [ ] Rollback testé.
- [ ] Aucun bug P0 ouvert.

### Responsable
Lead dev (orchestration), Younes (correctifs), Amal (UAT).

### Livrables
- Rapport UAT.
- Rapport migration dry-run.
- Décision GO / NO-GO release.

---

## Phase 3 — Migrate (1 semaine, parallèle Phase 2 fin)

### Objectif
Migrer les données de production sans interruption de service.

### Actions

#### J-3 (3 jours avant release)
- Communication aux stakeholders : "Migration tracking prévue le {date}, 14h-15h."
- Préparation de l'environnement (DBA review).

#### J-1 (veille)
- Backup complet de la DB de prod.
- Vérification que le feature flag `TRACKING_PLAN_V2_ENABLED=false` est bien sur false en prod.
- Vérification des accès et permissions.

#### Jour J — Migration (fenêtre 1h)
1. **T-0:00** : Annonce "Migration en cours" (Slack interne, banner admin temporaire).
2. **T-0:05** : Vérification finale backup OK.
3. **T-0:10** : Lancement du script `migrate-tracking-plan.ts` en mode prod.
4. **T-0:30** : Vérification : `trackingPlans` table contient X enregistrements, `_legacy_v1` tables intactes.
5. **T-0:40** : Test smoke sur les routes nouvelles (avec `TRACKING_PLAN_V2_ENABLED=true` sur 1 session admin seulement).
6. **T-0:55** : Communication "Migration terminée. Feature flag toujours OFF en prod, activation J+1."

### Gate de sortie
- [ ] Migration prod exécutée sans erreur.
- [ ] Toutes les tables `_legacy_v1` intactes (rollback possible).
- [ ] Test smoke admin nouvelle UI passant (sur session test seulement).
- [ ] Aucune alerte SRE pendant la fenêtre.

### Responsable
Younes (exécution), Lead dev + DBA (supervision).

### Livrables
- Log de migration archivé.
- Rapport de fin de migration.

---

## Phase 4 — Release (1 semaine — rollout progressif)

### Objectif
Activer le nouveau système pour tous les admins, en mode progressif pour limiter le blast radius.

### Sub-phases

#### J+0 — Activation interne (Younes seul)
- Feature flag `TRACKING_PLAN_V2_ENABLED=true` pour user `younes@`.
- Younes utilise le nouveau système pour 24h.
- Monitoring actif.

#### J+1 — Activation Amal
- Onboarding live Amal (30 min).
- Feature flag enabled pour `amal@`.
- Amal opère normalement avec le nouveau système.
- Support actif (Younes répond < 5 min).

#### J+2 — Activation full
- Feature flag global `TRACKING_PLAN_V2_ENABLED=true` pour tous admins.
- Comm interne : "Le nouveau tracking est en ligne pour tous. Lien tutoriel : …"

#### J+3 à J+7 — Surveillance
- Métriques temps réel.
- Drift status surveillé toutes les heures.
- Bugs reportés : triage quotidien.

### Gate de sortie
- [ ] Tous admins migrés vers nouveau système.
- [ ] 0 drift critique non résolu < 1h.
- [ ] 0 régression observée (events GA4 reçus stable).
- [ ] Feedback Amal score ≥ 4/5.

### Responsable
Lead dev (orchestration), Younes (support).

### Livrables
- Métriques 7 jours.
- Feedback users.
- Décision : OK pour Phase 5.

---

## Phase 5 — Cleanup (T+30 à T+90)

### Objectif
Supprimer le legacy, finaliser la transition.

### Actions

#### T+30 jours
- Audit : 0 trafic sur routes legacy (uniquement 302).
- Suppression du code legacy frontend (composants, routes).
- Garde uniquement le redirect middleware.

#### T+60 jours
- Audit DB : aucun usage des tables `_legacy_v1` (logs query monitoring).
- Communication finale : "Migration terminée. Nettoyage final J+90."

#### T+90 jours
- Drop des tables `_legacy_v1`.
- Suppression du feature flag (ne sert plus rien).
- Tag git `tracking-plan-v2-cleanup-complete`.

### Gate de sortie
- [ ] Code legacy supprimé.
- [ ] Tables legacy droppées.
- [ ] Feature flag retiré.
- [ ] Documentation finale archivée.

### Responsable
Younes.

### Livrables
- PR de cleanup.
- Tag final.

---

## Décisions clés (Decision points)

### D1 — GO/NO-GO projet (fin Phase 0)
- Conditions : doc validé, budget confirmé.
- Si NO-GO : retour au constat actuel, projet reporté ou redéfini.

### D2 — GO/NO-GO release (fin Phase 2)
- Conditions : UAT positif, tests verts, migration dry-run réussit.
- Si NO-GO : extension de phase 2, retour en build pour fixes.

### D3 — GO rollout full (J+2)
- Conditions : J+0 et J+1 sans incident.
- Si NO-GO : rollback feature flag, investigation, replanification.

### D4 — Drop legacy (T+90)
- Conditions : 0 trafic legacy depuis 30j, métriques stables.
- Si NO-GO : extension de la transition, audit pourquoi du trafic legacy persiste.

---

## Risques et plans B

### Si Phase 1 dérive (sprint en retard)
- Réévaluation sprint 6 : possibilité de descope (e.g. mode expert reportée).
- Communication immédiate aux stakeholders.

### Si UAT Phase 2 échoue
- Identification précise des points bloquants.
- 1-2 sprints additionnels pour rework.

### Si migration Phase 3 échoue
- Rollback immédiat via `_legacy_v1` (tables intactes).
- Investigation root cause.
- Re-attempt après fix.

### Si rollout Phase 4 montre régression
- Feature flag revert.
- Hotfix.
- Re-attempt rollout après validation.

### Si Phase 5 cleanup révèle trafic legacy résiduel
- Investiguer (bot ? Script externe ?).
- Garder legacy un sprint de plus.
- Communication ciblée.

---

## Synthèse

Le plan d'action prévoit un **chemin progressif** avec :
- Validation continue à chaque phase.
- Rollback possible jusqu'à T+90 (tables legacy intactes).
- Communication régulière (cf. `communication-plan.md`).
- Critères mesurables à chaque gate.

Si tout va bien : Go-live J+45 (6 sprints + 1 validation + 1 migration).

Si imprévu : marge de 2 sprints buffer disponible.
