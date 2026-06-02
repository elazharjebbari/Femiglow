# 05 — Runbook d'exécution (pilote du développement & de la mise en prod)

> Ce runbook orchestre **toute** l'exécution : du setup à la GA. Il s'appuie sur
> le plan d'action ([`../03-dev-plan/action-plan.md`](../03-dev-plan/action-plan.md)),
> la matrice de tests ([`../04-tests/test-matrix.csv`](../04-tests/test-matrix.csv)) et
> le rollout ([`rollout.md`](rollout.md)). Commandes exactes : [`commands.txt`](commands.txt).

## 0. Pré-requis & setup

- [ ] Node/pnpm conformes au repo ; `pnpm install` OK.
- [ ] DB Postgres locale + DB de test (cf. `docs/ci-e2e-postgres-2026-05-30`).
- [ ] Build prod local fonctionnel sur `:3100` (cf. workflow images/fonts).
- [ ] Branche : `git switch -c feat/owbs-lead-background` depuis `master`.
- [ ] Flags d'env de dev : `CHECKOUT_OPTIMISTIC_WIZARD_ENABLED=false` (défaut).

## 1. Boucle d'exécution par tâche (invariante)

Pour **chaque** tâche `A*` (ordre = `tasks.csv`, respecter `depends_on`) :

1. **Implémenter** le livrable (cf. action-plan).
2. **Écrire les tests** listés (colonne `tests`) AVANT/AVEC le code (TDD encouragé).
3. **Gates locaux** : `pnpm lint && pnpm tsc --noEmit && pnpm vitest run <scope>`.
4. Si tâche e2e : `pnpm build` → relancer `:3100` → `playwright test e2e/owbs-*.spec.ts`.
5. **Couverture** ≥ cible (cf. test-strategy §3) sur le module touché.
6. **DoD** : cocher la checklist correspondante ([`../03-dev-plan/definition-of-done.md`](../03-dev-plan/definition-of-done.md)).
7. **Commit** (convention repo) ; PR de phase quand la phase est complète et verte.

> ⚠️ Rebuild obligatoire avant tout e2e (le serveur `:3100` sert un build figé).
> Procédure rebuild/redémarrage : voir [`commands.txt`](commands.txt) §BUILD.

## 2. Séquence des phases (gates de sortie)

| Phase | Pré-condition | Commande de validation | Gate de sortie |
|---|---|---|---|
| P0 | branche créée | `vitest run` (TST-U-00/01/02, TST-I-00) | migration up/down OK, flag par défaut OFF |
| P1 | P0 | `vitest run src/lib/checkout` (TST-I-01..04, TST-U-03, TST-R-OFF) | upsert idempotent + parité legacy |
| P2 | P0 | `vitest run src/lib/leads/outbox` (TST-I-05..11) | drain + retry + cron auth |
| P3 | P1 | `vitest`+e2e (TST-U-10..16, TST-M-*, TST-E-01/02) | **UI < 50 ms réseau throttlé** |
| P4 | P3 | e2e (TST-E-03/04, TST-I-12..14) | **zéro perte (beacon)** prouvé |
| P5 | P3,P2 | `vitest`+e2e (TST-I-15..17, TST-E-05) | conversion fiable + effets enqueués |
| P6 | P3 | `vitest`+e2e (TST-U-18, TST-E-06) | parité chat |
| P7 | P4 | `vitest`+e2e (TST-U-19, TST-I-18, TST-E-07) | observabilité + durcissement |
| P8 | P7 | full-suite + métriques prod | GA (cf. rollout) |

## 3. Déploiement (serveur, sans CDN)

1. Merger les PRs de phase dans `master` (flag OFF → inerte).
2. **Migration** : appliquer la migration `lead_event_outbox` en prod (fenêtre creuse ; `CHECK` en `NOT VALID`→`VALIDATE`).
3. **Worker** : déployer l'unit systemd `femiglow-cron-lead-outbox.timer` (60 s) + service ; vérifier l'auth `CRON_SECRET`.
4. **Vérif inerte** : flag OFF → comportement identique ; aucun enqueue ; backlog outbox = 0.
5. **Rollout** : suivre [`rollout.md`](rollout.md) (ramp du flag).

## 4. Validation post-déploiement (smoke prod)
- [ ] `POST /api/cron/lead-outbox` (avec secret) renvoie 200 + rapport ; sans secret → 401.
- [ ] Un parcours réel (canary) : étapes instantanées, lead persisté, conversion OK, effets `done` < 90 s.
- [ ] Dashboards verts (cf. [`observability.md`](observability.md)).

## 5. Rollback / kill-switch
- **Immédiat** : passer `NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED=false` (+ serveur) → retour legacy **sans redeploy** (< 1 min). La file client n'est plus instanciée ; les routes restent idempotentes.
- **Worker** : si backlog/anomalie, `systemctl stop femiglow-cron-lead-outbox.timer` (les effets restent `pending`, rejouables).
- **Données** : aucune perte (rows lead + outbox conservées) ; reprise possible après correctif.
- **Migration** : réversible (`DROP TABLE lead_event_outbox`) si abandon total — uniquement après flag OFF stabilisé.

## 6. Incidents fréquents (triage)
| Symptôme | Cause probable | Action |
|---|---|---|
| Backlog outbox `pending` qui monte | handler/origine lent | vérifier handler, augmenter cadence cron, inspecter `last_error` |
| `dead > 0` | échec persistant (payload/intégration) | inspecter row `dead`, corriger handler, rejouer (remettre `pending`) |
| Doublons CAPI/webhook | dedupe_key non unique / event_id divergent | vérifier `UNIQUE(type,leadId,dedupe_key)` + alignement event_id |
| Leads perdus signalés | beacon non émis (navigateur) | vérifier listeners pagehide+visibilitychange (R-07 WebKit), logs `owbs.beacon.sent` |
| UI gèle encore | flag OFF ou file non instanciée | vérifier flag ON client ; logs `owbs.queue.enqueue` |

## 7. Sortie GA
- Fenêtre d'observation conforme (NFR) → cocher `DOD-GA`.
- Retirer le legacy + tests obsolètes (P8).
- Mettre le statut du dossier à `RELEASED`, consigner les métriques réelles dans ce runbook (annexe).
