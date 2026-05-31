# Risk register

## Échelle

- **Probabilité** : Faible (F) — Moyenne (M) — Élevée (E)
- **Impact** : Faible (1) — Moyen (2) — Élevé (3) — Critique (4)
- **Score** : P × I (max 12)

## Risques techniques

### R-T1 — Migration data corrompt les events existants
- **Probabilité** : M
- **Impact** : 4 (critique : perte de tracking en prod)
- **Score** : 8
- **Description** : Le mapping legacy → unified TrackingPlan inverse des relations ou perd des events.
- **Mitigation** :
  - Migration **non destructive** : tables legacy renommées `_legacy_v1`, jamais supprimées dans le même déploiement.
  - Dry-run obligatoire sur copie de prod, avec diff complet legacy vs migrated.
  - Feature flag `TRACKING_PLAN_V2_ENABLED` : rollback instant en flippant à false.
  - Test snapshot : `legacy_export.json` doit être identique à `migrated_export.json` (pas de différence sémantique).
- **Owner** : Younes
- **Trigger remediation** : Si > 0 différence sémantique → bloquer go-live.

### R-T2 — Performance dégradée sur lecture de plan actif
- **Probabilité** : F
- **Impact** : 2
- **Score** : 2
- **Description** : Lecture du plan actif (`status='active'`) en JSONB pourrait être lente sans index.
- **Mitigation** :
  - Index partiel sur `status='active'` (unique).
  - Cache mémoire 30s TTL (`PlanCache`).
  - Benchmark : < 50ms p95 sur table à 1000 plans.

### R-T3 — JSONB corruption (write concurrent)
- **Probabilité** : F
- **Impact** : 3
- **Score** : 3
- **Description** : Race condition lors d'update concurrent du JSONB.
- **Mitigation** :
  - Optimistic concurrency : champ `version` int, increment à chaque update.
  - Transaction Drizzle avec `SELECT ... FOR UPDATE`.
  - Test multi-threadé.

### R-T4 — Drift detector False Positive
- **Probabilité** : M
- **Impact** : 1
- **Score** : 2
- **Description** : Hash mismatch dû à un timing client (cache navigateur) plutôt qu'un vrai drift.
- **Mitigation** :
  - Hysteresis : 3 pings successifs mismatch avant d'alerter.
  - Différencier "client outdated" (warning) de "client différent" (critical).
  - Mute manuelle possible (admin) pendant déploiement annoncé.

### R-T5 — Bug placeholder validator
- **Probabilité** : F
- **Impact** : 3
- **Score** : 3
- **Description** : Regex `PLACEHOLDER_PATTERNS` laisse passer un placeholder inconnu.
- **Mitigation** :
  - Tests exhaustifs (cf. 14-tests/jest/validator.test.ts).
  - Audit human : tout placeholder doit suivre la convention `<PROVIDER>-<ENV>0000`.
  - Logguer tout ID matchant un pattern de doute (`PROD000`, `TEST`, `PLACEHOLDER`, etc.) pour review humaine.

## Risques produit

### R-P1 — Amal trouve le wizard "lent"
- **Probabilité** : M
- **Impact** : 3
- **Score** : 6
- **Description** : Le wizard a 5 steps, plus long qu'avant (1 page).
- **Mitigation** :
  - Auto-prefill agressif : Amal ne saisit que les champs qui ont changé.
  - "Continuer" disponible dès qu'un step est complet (pas besoin de lire les helpers).
  - User testing Amal AVANT release : si > 5 min sur le journey 1, redesign.
  - Mode expert disponible pour Amal aussi (toggle).

### R-P2 — Younes préfère l'ancien système
- **Probabilité** : F
- **Impact** : 2
- **Score** : 2
- **Description** : Dev habitué peut résister.
- **Mitigation** :
  - Mode expert ressemble à un éditeur JSON avec validation.
  - Diff legacy → nouveau accessible pour comparer.
  - Documentation technique complète (cette folder).

### R-P3 — Régression UX vs système actuel
- **Probabilité** : F
- **Impact** : 3
- **Score** : 3
- **Description** : Cas d'usage qu'on n'a pas vu et que l'ancien système supportait.
- **Mitigation** :
  - Inventaire exhaustif des fonctionnalités existantes (audit avant dev).
  - Tests E2E sur les flows actuels avant migration.
  - Période de cohabitation : ancien admin accessible via URL legacy pendant 30j.

## Risques opérationnels

### R-O1 — Migration de prod prend trop longtemps
- **Probabilité** : F
- **Impact** : 2
- **Score** : 2
- **Description** : Lock table pendant migration → downtime.
- **Mitigation** :
  - Migration online : Drizzle migrations sans lock global.
  - Volumes faibles (< 50 plans existants) → < 5s migration.
  - Backup avant migration.

### R-O2 — Rollback impossible
- **Probabilité** : F
- **Impact** : 4
- **Score** : 4
- **Description** : Mauvais design qui empêche un rollback propre.
- **Mitigation** :
  - Feature flag → désactivation route nouvelles, retour ancien admin instantané.
  - Tables legacy intactes pendant 90 jours.
  - Runbook rollback testé en staging avant prod.

### R-O3 — Adoption faible (Amal continue d'utiliser legacy)
- **Probabilité** : M
- **Impact** : 2
- **Score** : 4
- **Description** : Si on garde l'ancien admin accessible, risque que Amal n'apprenne pas.
- **Mitigation** :
  - 302 redirect de toutes les routes legacy vers nouvelles à T+15j.
  - Onboarding session live Amal + tutoriel intégré.
  - Métriques d'usage : tracker quel admin est utilisé.

### R-O4 — Pas de bandwidth équipe pour tests E2E
- **Probabilité** : M
- **Impact** : 3
- **Score** : 6
- **Description** : Younes seul, 6 sprints, tests E2E souvent négligés.
- **Mitigation** :
  - Tests E2E écrits **en parallèle** du code (TDD-like).
  - 1 sprint dédié exclusivement aux tests (sprint 6).
  - Pipeline CI bloque sans test E2E pour les flows critiques.

## Risques de conformité

### R-C1 — Consent mode non respecté
- **Probabilité** : F
- **Impact** : 4
- **Score** : 4
- **Description** : Events partent sans le consent → violation Loi 09-08 + RGPD si UE.
- **Mitigation** :
  - Tests Playwright : event sans consent → tag GA4 doit pas fire.
  - Audit avec DPO avant release.
  - Code review focus sur le pattern consent.

### R-C2 — Données personnelles dans audit log
- **Probabilité** : M
- **Impact** : 3
- **Score** : 6
- **Description** : Audit log contient changements de Pixel ID, peut-être considéré comme donnée perso.
- **Mitigation** :
  - Audit log accessible uniquement aux admins authentifiés.
  - Rétention 90 jours (suffisant pour debug, conforme principe de minimisation).
  - Pas de stockage de PII (emails clients) dans le tracking plan (uniquement IDs techniques de providers).

## Risques de sécurité

### R-S1 — Secrets dans frontend
- **Probabilité** : F
- **Impact** : 4
- **Score** : 4
- **Description** : Tokens (Meta access token, Ads dev token) leakés dans le store Zustand.
- **Mitigation** :
  - `stripSecrets()` côté frontend : secrets jamais dans le state.
  - Server-side only pour secrets, frontend reçoit `***masked***`.
  - Tests unit : assert `JSON.stringify(state)` ne contient aucun secret.

### R-S2 — CSRF sur endpoints admin
- **Probabilité** : F
- **Impact** : 3
- **Score** : 3
- **Description** : Endpoint `activate` peut être déclenché par CSRF.
- **Mitigation** :
  - Next.js Server Actions avec CSRF token built-in.
  - Vérification de session côté serveur.
  - Tests pen-testing avant release.

## Synthèse top risques (score ≥ 6)

| Rang | Risque | Score |
|---|---|---|
| 1 | R-T1 Migration corrompt events | 8 |
| 2 | R-P1 Wizard trop lent | 6 |
| 3 | R-O4 Pas de bandwidth tests E2E | 6 |
| 4 | R-C2 PII dans audit log | 6 |

Ces 4 doivent être mitigated avant go-live.
