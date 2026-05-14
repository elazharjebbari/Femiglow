# Success metrics

## 1. Métriques techniques

### Performance

| Métrique | Cible | Mesure |
|---|---|---|
| Lecture plan actif (p95) | < 50ms | Drizzle + index, mesuré via APM |
| Export JSON (p95) | < 200ms | Fonction `exportPlan`, instrumenté |
| Validation server (p95) | < 500ms | Fonction `validatePlan` |
| Activation plan (p95) | < 2s | Endpoint `POST /activate` complet |
| Drift status fetch (p95) | < 100ms | Lecture `gtmDriftState` |
| Frontend FCP wizard step | < 1s | Lighthouse |
| Frontend TTI wizard step | < 2.5s | Lighthouse |
| Bundle size tracking module | < 80kb gzipped | Bundle analyzer |

### Fiabilité

| Métrique | Cible | Mesure |
|---|---|---|
| Taux de succès activation | > 99.9% | Logs API |
| Taux d'export sans erreur | 100% | Logs |
| Hash bundleId reproducible | 100% (déterminisme) | Test snapshot |
| Drift false positives | < 1% | Audit hebdo des alertes |

### Qualité code

| Métrique | Cible | Mesure |
|---|---|---|
| Couverture tests `lib/tracking/plan/` | > 80% | Jest coverage |
| Couverture tests `components/tracking/` | > 70% | Idem |
| Tests E2E happy paths | 100% pass | Playwright |
| ESLint warnings | 0 | CI |
| TypeScript strict | 100% (no `any`) | tsc |
| axe-core violations | 0 (serious/critical) | CI a11y |

## 2. Métriques UX (Amal)

### Quantitatives

| Métrique | Baseline (actuel) | Cible (post-release) | Mesure |
|---|---|---|---|
| Temps "changer un Pixel ID" | 15-20 min | < 5 min | User testing chronométré |
| Temps "ajouter un provider" | N/A (impossible cleanly) | < 10 min | User testing |
| Temps "vérifier statut tracking" | 5 min | < 1 min | User testing |
| Nombre de routes visitées pour 1 changement | 5+ | 1 | Analytics admin |
| Taux de plans avec placeholder en prod | inconnu (réel cas) | 0% | Audit DB hebdo |
| Taux d'activations avec validation errors | inconnu | 0% | Logs server |

### Qualitatives

Sondage post-release à Amal :
- "Comment t'es-tu sentie en utilisant le nouveau tracking ?" (1-5)
- "Combien de fois as-tu dû demander de l'aide ?" (chiffre)
- "Qu'est-ce qui manque encore ?"
- "Recommanderais-tu cet outil à un collègue ?" (NPS-like)

Cibles :
- Score ≥ 4/5 sur "facilité d'usage".
- 0 demande d'aide après les premiers 7 jours.

## 3. Métriques produit (adoption)

| Métrique | Cible | Mesure |
|---|---|---|
| % d'admins ayant créé ≥ 1 plan via nouveau système | 100% à 30j | Analytics admin |
| % d'admins en mode wizard (vs expert) | > 80% (Amal pattern) | Analytics |
| Nombre moyen de plans actifs simultanés | 1 (sain) | DB query |
| Temps moyen entre 2 modifications de plan | > 7j (signe de stabilité) | DB |
| Taux d'erreur (action user → error) | < 1% | Logs |

## 4. Métriques business

| Métrique | Cible | Mesure |
|---|---|---|
| 0 incident drift critique non résolu < 1h | 100% | Incident log |
| 0 perte de tracking détectée | 100% | Audit hebdo : compare events GA4 reçus vs attendus |
| Conversion ads attribution | Stable ou améliore | Google Ads reports |

## 5. Métriques de migration

Mesurer pendant la transition legacy → nouveau :

| Métrique | Cible | Mesure |
|---|---|---|
| Taux de plans migrés successfully | 100% | Migration script logs |
| Diff sémantique legacy vs migrated export JSON | 0 | Snapshot tests |
| Routes legacy 404 dans 30j post-migration | 0% (toutes 302) | CDN logs |

## 6. Dashboard de suivi

À créer dans Grafana (ou équivalent interne) :

```
┌──────────────────────────────────────────────────────────┐
│  Tracking Plan — Health Dashboard                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [Activation latency p95]   [Export latency p95]         │
│   245ms                       128ms                       │
│   ↓ (good)                    ↓                           │
│                                                          │
│  [Drift status]               [Active plan id]           │
│   ✓ OK                         Production v8             │
│                                Bundle 4dc5...            │
│                                                          │
│  [Activations (24h)]          [Failed activations (24h)] │
│   3                            0                          │
│                                                          │
│  [Drift incidents (24h)]      [Mean time to resolve]     │
│   0                            N/A                        │
│                                                          │
│  [Events/min (24h)]           [Top errors]               │
│   125                          (empty)                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Mise à jour temps réel ou polling 30s.

## 7. SLO (Service Level Objectives)

| SLO | Cible | Window |
|---|---|---|
| Disponibilité endpoints admin tracking | 99.9% | 30 jours roulants |
| p95 read plan | < 100ms | 7 jours roulants |
| p99 activate plan | < 5s | 7 jours roulants |
| 0 erreur 500 sur prod | 100% | Daily |

Si SLO breach : alerte oncall + retro post-mortem dans 48h.

## 8. Critères de release (Definition of Done global)

Le projet est "ready to ship" quand :

- [ ] Tous tests automatisés passent (Jest 80%, Playwright 100% happy paths).
- [ ] Test ultime d'intégration validé (cf. 14-tests/integration/ultimate-test.md).
- [ ] Migration dry-run sur copie prod réussit sans diff sémantique.
- [ ] Lighthouse a11y ≥ 95, axe-core CI : 0 violation.
- [ ] Runbook deploy + rollback rehearsés en staging.
- [ ] Documentation à jour et reviewée.
- [ ] Onboarding Amal complété + feedback positif (score ≥ 4/5).
- [ ] Lead dev sign-off.
- [ ] Pas de risque score ≥ 8 non mitigé.

## 9. Suivi post-release (7 jours)

J+1 :
- 0 erreur 500.
- 0 drift critique non résolu.
- Amal a pu compléter un workflow sans assistance.

J+7 :
- Migration de plans : 100% successful.
- Routes legacy : 0 trafic en direct (uniquement 302).
- Feedback Amal collecté.
- 1ère analyse rétrospective.

J+30 :
- Adoption mode wizard : > 80%.
- 0 régression vs baseline (events GA4 reçus).
- Décision : drop legacy à T+90.

## 10. Métriques d'échec (early warning)

À surveiller spécifiquement :

| Signal | Action |
|---|---|
| Drift critique > 1h non résolu | Alerte rouge → rollback feature flag |
| 3 activations failed dans la journée | Investigation immédiate |
| Diff sémantique export migrated vs legacy | Bloquer migration prod |
| User feedback Amal < 3/5 | UX retravail majeur |
| Pull request CI fail rate > 30% | Pause dev, retro tests |
