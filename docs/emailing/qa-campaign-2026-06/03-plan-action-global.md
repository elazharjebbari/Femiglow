# Plan d'action global — campagne QA emailing

> Exécution pilotée par `04-runbook.md`. Chaque phase a des **critères d'entrée**,
> des **livrables**, des **critères de sortie** mesurables, et une **boucle de
> correction** intégrée. Aucune phase ne démarre si la précédente n'a pas atteint
> ses critères de sortie.

## Vue d'ensemble

| Phase | Nom | Durée estimée | Dépend de |
|---|---|---|---|
| 0 | Fondations harnais | 0,5–1 j | — |
| 1 | Stabilisation P0 (fix + tests rouges d'abord) | 1–2 j | 0 |
| 2 | Couche unit dense | 1 j | 0 |
| 3 | Couche composant+MSW (la masse) | 3–4 j | 0 |
| 4 | Couche intégration API+DB | 2 j | 0, 1 |
| 5 | Contract tests webhooks | 1 j | 4 |
| 6 | E2E Playwright opérateur | 2–3 j | 1, 3, 4 |
| 7 | Scénarios métier complexes (cross-modules) | 2 j | 6 |
| 8 | Boucle de durcissement + gate CI | 1 j | toutes |

---

## Phase 0 — Fondations harnais

**Objectif** : tout ce dont les phases suivantes ont besoin, mutualisé une fois.

Étapes :
1. **0.1** Créer `src/test/msw/` : `server.ts` (setupServer), `handlers/emails.ts`
   (handlers par défaut alignés sur les routes réelles), helpers d'override par test.
2. **0.2** Créer `src/test/factories/emails.ts` : factories typées
   (`makeOutboxRow`, `makeAutomation`, `makeAudience`, `makeCampaignLink`,
   `makeSuppression`, `makeStalwartEvent`, `makeListmonkEvent`).
3. **0.3** Harnais DB de test : `src/test/db/setup.ts` — création `femiglow_test`,
   exécution des migrations drizzle, `truncateEmailTables()`.
4. **0.4** Fixtures contract : capturer depuis les logs/DB prod 10+ payloads
   Stalwart et Listmonk réels, anonymiser, déposer dans
   `src/test/fixtures/{stalwart,listmonk}/`.
5. **0.5** Faux SMTP pour E2E : service Mailpit local (ou transport stub
   activé par env `SMTP_TEST_CAPTURE=1`) + helper Playwright `readLastEmail()`.
6. **0.6** Scripts npm : `test:emails:unit`, `test:emails:component`,
   `test:emails:integration`, `test:emails:e2e`, `test:emails:all`.

**Test de la phase elle-même** : un test « canari » par couche prouve que le
harnais fonctionne (1 composant MSW, 1 route+DB, 1 e2e login admin).

**Critères de sortie** : les 4 canaris verts en local ET en CI; `pnpm tsc` propre.

---

## Phase 1 — Stabilisation P0 : tests rouges → fix → verts

**Doctrine** : pour chaque bug P0 de l'audit, écrire D'ABORD le test qui le
reproduit (rouge), PUIS corriger, PUIS vérifier (vert). Le test reste comme
non-régression.

| # | Bug (réf. audit) | Test rouge à écrire | Fix |
|---|---|---|---|
| 1.1 | Drift `lead_tag` uuid/text | intégration : PATCH `/api/checkout/order/[id]/email` contre vraie DB → 200 attendu | migration d'alignement + code |
| 1.2 | Webhook Stalwart URL morte | contract : fixture delivered → outbox passe `delivered` | reconfig Stalwart (infra, hors code) + test santé qui le détecte |
| 1.3 | Lignes `sending` orphelines | intégration : ligne `sending` vieille de 10 min → le cron la requalifie | implémenter reaper |
| 1.4 | Runs automation orphelins | intégration : run `running`+`nextActionAt=NULL` ancien → repris ou erré proprement | implémenter sweep |
| 1.5 | Bulk actions faux succès | composant MSW : 401/500 sur bulk-retry → message d'erreur visible | gérer `res.ok` + toast |
| 1.6 | Render avant INSERT (email perdu) | intégration : payload Zod invalide → ligne outbox `failed` EXISTE avec lastError | inverser l'ordre |
| 1.7 | Triggers automation non câblés | intégration : automation event active + user_event → un run créé | câbler le moteur de triggers |
| 1.8 | Quiet hours/cooldown/cap morts | unit+intégration : réglages → effet (différé/bloqué) | brancher frequency.ts (et corriger ses bugs tz) |

**Boucle de correction** : chaque item suit rouge → fix → vert → `pnpm tsc` →
suite complète du module → commit atomique `fix(emails): … + test non-régression`.

**Critères de sortie** : les 8 tests de non-régression verts; aucun test
préexistant cassé; build OK.

---

## Phase 2 — Couche unit dense

Dérouler les `test-matrix.csv` des modules, lignes `type=unit` :
parsers webhooks (toutes variantes DSN), backoff (bornes, jitter), filters-parser
(grammaire complète + entrées hostiles), rules-compiler (SQL généré inspecté par
règle + injections), unsub-token (expiration, falsification), frequency
(minuit, DST Casablanca), step-path (profondeur, branches), schémas Zod catalogue.

**Critères de sortie** : 100 % des lignes unit de la matrice implémentées ou
explicitement reportées (avec raison dans la matrice, colonne statut).

## Phase 3 — Couche composant + MSW (la masse)

Pour CHAQUE composant des modules 01→06 : grille d'échecs 5 points sur chaque
action + tests d'affichage (états vide/chargement/erreur/gros volume) + a11y de
base (roles, labels). Ordre : cockpit (02) → automations (05) → audiences (04) →
campagnes (03) → templates (06) → dashboard (01).

**Boucle** : module par module — implémenter, exécuter, corriger les bugs UI
découverts (en les loggant dans `06-matrice-risques.csv`), re-exécuter.

**Critères de sortie** : grille 5 points couverte pour chaque action réseau
identifiée dans les matrices; zéro `vi.mock(fetch)`.

## Phase 4 — Intégration API + vraie DB

Routes admin (auth 403 sans session, Zod 422, succès, effets DB), routes cron
(idempotence, claim concurrent SKIP LOCKED via 2 appels parallèles), pipeline
outbox complet (enqueue→drain→retry→DLQ), chaîne suppression.

**Critères de sortie** : chaque route de l'inventaire a ≥1 test d'intégration;
les scénarios de concurrence passent 20 exécutions consécutives sans flake.

## Phase 5 — Contract tests webhooks

Rejouer toutes les fixtures contre les routes; matrice de variantes (champ
manquant, type inattendu, signature invalide, rejeu, gros payload, lot).

**Critères de sortie** : 100 % fixtures couvertes; mutation d'un champ clé d'une
fixture fait échouer au moins un test (méta-test de sensibilité).

## Phase 6 — E2E Playwright opérateur

Specs `e2e/emails-*.spec.ts` par module : parcours nominaux + dégradés
(Listmonk down simulé, SMTP down). Convention helpers existants.

**Critères de sortie** : suites vertes 3 exécutions consécutives en local;
durée totale < 15 min.

## Phase 7 — Scénarios métier complexes (cross-modules)

Les scénarios « journée d'opérateur » définis dans chaque
`modules/*/scenarios-metier.md`, version automatisée Playwright quand possible,
sinon checklist manuelle exécutable. Exemples structurants :
- **S1 Campagne de A à Z** : créer audience → snapshot → campagne → envoi →
  webhooks → métriques exactes dans l'UI.
- **S2 Incident bounce** : hard bounce → suppression → vérifier que le contact
  ne reçoit plus rien nulle part → réactivation manuelle.
- **S3 Automation panier** : panier abandonné → run → quiet hours → envoi différé
  → conversion → run annulé (le client a acheté).
- **S4 Reprise après crash** : kill du process mid-batch → redémarrage → aucune
  perte ni doublon (outbox + runs).
- **S5 Opérateur sous pression** : 5 000 lignes outbox, recherche, pagination,
  bulk sur 500, session qui expire en plein milieu.

**Critères de sortie** : S1–S5 automatisés ou documentés en checklist avec
résultat consigné.

## Phase 8 — Durcissement + gate CI

1. Couverture mesurée (`vitest --coverage`) sur `src/lib/mail/**` et
   `src/components/admin/emails/**` — seuil initial 80 % lignes, ratchet ensuite.
2. Job CI dédié `emails-qa` : unit+composant+intégration sur chaque PR touchant
   `lib/mail|admin/emails|api/mail`; e2e nightly.
3. Revue de flakiness (quarantaine vidée ou justifiée).
4. Mise à jour finale de `06-matrice-risques.csv` : risques résiduels acceptés.

**Critères de sortie** : CI verte, seuils en place, zéro test quarantainé non justifié.

---

## Boucle de correction transversale (s'applique à toutes les phases)

```
┌─> Exécuter la suite de l'étape courante
│     ├─ ÉCHEC test : bug code → corriger le CODE (jamais affaiblir l'oracle),
│     │   logger dans 06-matrice-risques.csv, re-exécuter
│     ├─ ÉCHEC test : bug test → corriger le TEST, noter la cause (flake? oracle faux?)
│     └─ VERT : `pnpm tsc` + suite régression du module + commit atomique
└── 3 verts consécutifs sur la suite complète du module → étape suivante
```

**Règles** :
- Un fix de code sans test de non-régression associé = interdit.
- Un oracle affaibli pour « faire passer » = interdit (escalader à l'humain).
- Commits : `test(emails/<module>): <portée>` ou `fix(emails/<module>): <bug> + non-régression`.
- Jamais d'exécution de tests destructifs contre la prod (mémoire projet :
  une seule instance, pas d'isolation DB).
