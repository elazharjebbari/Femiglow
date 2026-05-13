# Runbook maître — M5 admin emailing evolution

> **Ce fichier pilote l'exécution.** Chaque phase liste : objectifs,
> fichiers de référence à lire, ordre des tâches, tests à passer, gate
> de sortie. Suis-le linéairement — quand une checkbox est cochée, tu
> peux passer à la suivante.

## 🚦 Macro-vue

| Phase | Objectif | Durée cible | Gate de sortie |
|---|---|---|---|
| **M5.1** | Inbox transactionnelle cockpit | 1-2 sem | Test E2E `cockpit-cmdk-search.spec.ts` ✓ |
| **M5.2** | Table `user_event` unifiée + bridges | 1-2 sem | 80% des events historiques ingérés + dashboard count |
| **M5.3** | Audience builder + snapshots | 2-3 sem | Audience "VIP" créée, snapshot 1k+ rows en < 30s |
| **M5.4** | Campaigns wizard avec audiences | 1 sem | Campagne envoyée à une audience native, stats reçues |
| **M5.5** | Automation studio V1 (step-list typée) | 2-3 sem | Nouvelle automation créée par UI, run executée |
| **M5.6** | Polish ergonomie (Cmd-K universel, a11y) | 1 sem | A11y audit Lighthouse ≥ 95 + raccourcis testés |
| **M5.7** | Éditeur templates HTML + preview + variables auto + CTA library | 1.5-2.5 sem | Test E2E template-editor (create from default, edit, preview real lead, test send, rollback) ✓ |

Avant de démarrer : **lire le [concept doc](../../14-admin-ui-evolution-concept.md)**, **lire [architecture/00-overview.md](../00-architecture/00-overview.md)**.

---

## ▶ Phase M5.1 — Inbox transactionnelle

### Objectif
Transformer la page `/admin/emails/transactional` d'un tableau pagine en
**cockpit** : KPI header, Cmd-K palette, saved views, bulk actions.

### Fichiers de référence
- [09-plan-developpement/01-phase-m5.1-transactional.yaml](../09-plan-developpement/01-phase-m5.1-transactional.yaml) — découpage tickets
- [00-architecture/00-overview.md §M5.1](../00-architecture/00-overview.md#m51-inbox-transactionnelle) — architecture
- [01-data/01-tables.md §admin_email_view](../01-data/01-tables.md#admin_email_view) — nouvelle table saved views
- [02-backend/01-api-endpoints.md §transactional](../02-backend/01-api-endpoints.md#transactional-cockpit) — endpoints
- [02-backend/03-rules-compiler.md](../02-backend/03-rules-compiler.md) — parser Cmd-K (réutilisé en M5.3)
- [03-frontend/02-components-catalog.md §cockpit](../03-frontend/02-components-catalog.md#cockpit-transactional) — composants
- [03-frontend/04-cmd-k-palette.md](../03-frontend/04-cmd-k-palette.md) — spec Cmd-K
- [04-ui-ux/01-wizard-spec-master.md §inbox](../04-ui-ux/01-wizard-spec-master.md#1-cockpit-transactionnel) — UX
- [04-ui-ux/02-mockups/transactional-inbox.txt](../04-ui-ux/02-mockups/transactional-inbox.txt) — mockup ASCII
- [06-ergonomie/00-keyboard-shortcuts.md](../06-ergonomie/00-keyboard-shortcuts.md) — raccourcis
- [11-tests/](../11-tests/) — scénarios de tests

### Ordre d'exécution
1. **Data** — créer migration `admin_email_view` (voir [01-data/03-migrations-plan.md §M5.1](../01-data/03-migrations-plan.md#m51))
   - Tests Jest : `admin-email-view-schema.test.ts`
2. **Backend queries** — `listOutboxFiltered(filters, pagination)`, `summarizeOutbox(window)`, `bulkRetry(ids[])`
   - Tests Jest : `outbox-queries.test.ts` (filter parser, edge cases vides)
3. **Backend endpoints** — `/api/admin/emails/transactional/search`, `/summary`, `/bulk-retry`, `/views` (CRUD)
   - Tests Jest + MSW : couvrir 5 scénarios par endpoint (cf [11-tests/02-msw-integration](../11-tests/02-msw-integration/))
4. **Frontend composants** — `CommandPalette`, `KpiHeader`, `SavedViewsSidebar`, `BulkActionsBar`, `FilteredTable`
   - Tests Jest RTL pour chaque composant (cf [11-tests/01-jest-unit](../11-tests/01-jest-unit/))
5. **Frontend intégration** — page `/admin/emails/transactional` refonte
6. **Tests E2E** — `cockpit-cmdk-search.spec.ts`, `bulk-retry.spec.ts`, `saved-views.spec.ts`

### Gate de sortie M5.1 (tous obligatoires)
- [ ] Lighthouse perf ≥ 90 sur la page (mobile + desktop)
- [ ] A11y Lighthouse ≥ 95
- [ ] Tous les tests Jest passent (unit + integration MSW)
- [ ] Tous les tests Playwright passent
- [ ] Le **test ultime M5.1** (`11-tests/03-playwright-e2e/01-m5.1-ultimate.spec.md`) passe : un admin connecté peut, en moins de 60s, retrouver un email d'un destinataire précis, le retry, sauvegarder la vue, et exporter en CSV.

---

## ▶ Phase M5.2 — Events utilisateur unifiés

### Objectif
Créer la table `user_event` qui unifie les sources d'événements
(emailing, tracking web, server, admin) et brancher les bridges existants
pour l'alimenter en continu.

### Fichiers de référence
- [09-plan-developpement/02-phase-m5.2-user-events.yaml](../09-plan-developpement/02-phase-m5.2-user-events.yaml)
- [00-architecture/02-data-flow.puml](../00-architecture/02-data-flow.puml) — diagramme d'ingestion
- [01-data/01-tables.md §user_event](../01-data/01-tables.md#user_event)
- [02-backend/00-overview.md §event-bridges](../02-backend/00-overview.md#event-bridges)
- [11-tests/](../11-tests/)

### Ordre d'exécution
1. **Data** — migration `user_event` + indexes `(email, ts)`, `(event_name, ts)`
   - Tests : intégrité contraintes, perfs INSERT en bulk
2. **Bridge tracking web** — middleware GTM → INSERT
3. **Bridge email webhooks** — listmonk-dispatcher écrit aussi dans `user_event`
4. **Bridge orders/leads** — hook serveur sur création commande / lead
5. **Bridge admin** — wrapper sur lead_events
6. **Backfill** (optionnel mais recommandé) — script one-shot pour
   peupler 90 jours d'historique depuis sources actuelles
7. **Tests E2E** — vérifier qu'un click sur "Add to cart" crée un row
   `user_event` avec `event_name='cart.added'`

### Gate de sortie M5.2
- [ ] Tous les events emailing arrivent en `user_event` (vérifié sur 24h)
- [ ] Tous les events tracking web arrivent (vérifié sur 24h)
- [ ] Dashboard count par event_name (admin debug) fonctionne
- [ ] Tests : 100% des sources d'events couvertes par un test
- [ ] **Test ultime M5.2** : envoyer 1 email → constater 3 rows
  (`email.queued`, `email.sent`, `email.delivered`) avec le bon email
  dans `user_event`.

---

## ▶ Phase M5.3 — Audience builder

### Objectif
Permettre la création d'audiences natives FemiGlow avec UI form-based
+ preview live de taille + snapshot mécanique.

### Fichiers de référence
- [09-plan-developpement/03-phase-m5.3-audiences.yaml](../09-plan-developpement/03-phase-m5.3-audiences.yaml)
- [00-architecture/03-sequence-audience-snapshot.puml](../00-architecture/03-sequence-audience-snapshot.puml)
- [01-data/01-tables.md §email_audience](../01-data/01-tables.md#email_audience)
- [02-backend/03-rules-compiler.md](../02-backend/03-rules-compiler.md) — compileur règles → SQL
- [02-backend/04-snapshot-engine.md](../02-backend/04-snapshot-engine.md)
- [02-backend/05-listmonk-sync.md](../02-backend/05-listmonk-sync.md) — push éphémère
- [04-ui-ux/01-wizard-spec-master.md §audience-builder](../04-ui-ux/01-wizard-spec-master.md#2-audience-builder)
- [04-ui-ux/02-mockups/audience-builder.txt](../04-ui-ux/02-mockups/audience-builder.txt)
- [11-tests/](../11-tests/)

### Ordre d'exécution
1. **Data** — migrations `email_audience`, `email_audience_snapshot`,
   `email_audience_snapshot_member` (cf [01-data/01-tables.md](../01-data/01-tables.md))
   - Tests : contraintes uniques, FK
2. **Rules compiler** — `compileRules(rulesJson) → Drizzle SQL`
   - Tests Jest **exhaustifs** : chaque type de critère, AND/OR, edge
     cases (audiences vides, dates futures, opérateurs invalides)
3. **Audience CRUD** — `createAudience`, `updateAudience`,
   `deleteAudience`, `getAudience`, `listAudiences`
4. **Preview engine** — `previewAudienceSize(rules)` (COUNT),
   `previewAudienceSample(rules, limit=10)`
   - Tests perf : < 3s sur DB de prod-like
5. **Snapshot engine** — `snapshotAudience(audienceId)`, status async
   - Tests : idempotency, rollback on error
6. **Listmonk sync** — `pushSnapshotToListmonkList(snapshotId)`,
   `cleanupExpiredLists()`
   - Tests MSW : mock Listmonk API, scénarios de succès/échec/retry
7. **Frontend** — `AudienceRulesBuilder`, `AudiencePreview`,
   `AudienceListPage`, `AudienceEditPage`
   - Tests RTL + MSW pour chaque composant
8. **E2E** — création audience VIP → preview → snapshot

### Gate de sortie M5.3
- [ ] Audience "VIP" (≥3 commandes) créée par l'UI
- [ ] Preview retourne le bon count en < 3s
- [ ] Snapshot 10k+ rows en < 30s
- [ ] Tests rules-compiler couvrent ≥ 95% branches
- [ ] **Test ultime M5.3** : admin crée audience "Cart abandoners 7d",
  l'UI affiche le count + sample 10, l'admin clique "Snapshot now", la
  snapshot apparaît dans la liste, audience reste éditable.

---

## ▶ Phase M5.4 — Wizard campagne avec audiences natives

### Objectif
Câbler le wizard campaign existant pour utiliser les audiences M5.3 + le
push Listmonk éphémère au send.

### Fichiers de référence
- [09-plan-developpement/04-phase-m5.4-campaigns.yaml](../09-plan-developpement/04-phase-m5.4-campaigns.yaml)
- [02-backend/05-listmonk-sync.md](../02-backend/05-listmonk-sync.md)
- [04-ui-ux/01-wizard-spec-master.md §campaign-wizard](../04-ui-ux/01-wizard-spec-master.md#3-campaign-wizard-v2)

### Ordre d'exécution
1. **Wizard étape "Audience"** — remplacer le multi-select Listmonk
   par `AudienceSelector` (créer nouvelle audience inline OU choisir
   sauvée)
2. **Finalize campaign** — au moment de `finalizeCampaign()` :
   snapshot l'audience → push Listmonk liste éphémère →
   créer campagne Listmonk pointant cette liste → cleanup planifié
3. **Detail page** — afficher l'audience snapshot ID + bouton "voir les
   destinataires"
4. **E2E** — créer campagne, audience, send, vérifier que les bonnes
   personnes reçoivent

### Gate de sortie M5.4
- [ ] Wizard campaign refuse de continuer si pas d'audience
- [ ] L'envoi à 100 contacts test passe sans erreur (env staging)
- [ ] Stats Listmonk remontent en email_campaign_link
- [ ] **Test ultime M5.4** : créer audience de 50 emails test → créer
  campagne → schedule pour now+1min → vérifier que les 50 reçoivent
  effectivement (via webhook listmonk).

---

## ▶ Phase M5.5 — Automation studio V1

### Objectif
UI de création/édition pour les automations. Step-list typée (wait, send,
branch, tag, update_lead, webhook, wait_for_event).

### Fichiers de référence
- [09-plan-developpement/05-phase-m5.5-automation.yaml](../09-plan-developpement/05-phase-m5.5-automation.yaml)
- [00-architecture/04-sequence-automation-run.puml](../00-architecture/04-sequence-automation-run.puml)
- [02-backend/06-automation-runner-v2.md](../02-backend/06-automation-runner-v2.md)
- [04-ui-ux/01-wizard-spec-master.md §automation-studio](../04-ui-ux/01-wizard-spec-master.md#4-automation-studio)
- [04-ui-ux/02-mockups/automation-studio.txt](../04-ui-ux/02-mockups/automation-studio.txt)

### Ordre d'exécution
1. **Data** — extension `email_automation.steps` (jsonb) avec nouveaux
   kinds : `branch`, `tag`, `update_lead`, `webhook`, `wait_for_event`
2. **Catalogue events** — endpoint `/api/admin/emails/automation/events-catalog` (liste depuis `tracking_event_definitions`)
3. **Runner V2** — gérer les nouveaux step types
   - Tests exhaustifs par step type (cf [11-tests/01-jest-unit/automation-runner.test.spec.md](../11-tests/01-jest-unit/))
4. **Conditions DSL** — réutiliser le rules-compiler de M5.3 pour
   les conditions sur trigger ET sur step `branch`
5. **Frontend** — `AutomationWizard`, `StepEditor`, `ConditionBuilder`,
   `EventCatalogPicker`
6. **Page edit** — `/admin/emails/automation/[id]/edit`
7. **E2E** — créer automation cart-abandoned V2 avec branch

### Gate de sortie M5.5
- [ ] Nouvelle automation créable via UI (sans toucher au seed SQL)
- [ ] Branch step évalue correctement la condition
- [ ] Run d'une automation déclenchée par event → bon comportement
- [ ] **Test ultime M5.5** : créer automation "post-purchase upsell"
  (trigger order.placed, wait 7d, branch if opened welcome → send X,
  else send Y), enqueue une commande de test, attendre 7j (ou patch
  durée test), vérifier le bon mail arrive.

---

## ▶ Phase M5.6 — Polish ergonomie globale

### Objectif
Uniformiser raccourcis clavier, empty states, micro-copy, a11y, motion.

### Fichiers de référence
- [09-plan-developpement/06-phase-m5.6-polish.yaml](../09-plan-developpement/06-phase-m5.6-polish.yaml)
- [04-ui-ux/03-empty-states.md](../04-ui-ux/03-empty-states.md)
- [04-ui-ux/04-error-states.md](../04-ui-ux/04-error-states.md)
- [04-ui-ux/05-microcopy.md](../04-ui-ux/05-microcopy.md)
- [05-design/](../05-design/) (tous)
- [06-ergonomie/](../06-ergonomie/) (tous)

### Ordre d'exécution
1. Cmd-K palette unifiée sur les 3 sections
2. Empty states normalisés (illustrations + CTA)
3. Toast feedback uniforme avec undo
4. Audit a11y avec axe-core (CI)
5. Audit micro-copy (français cohérent, ton de marque)
6. Motion : transitions sobres, respect `prefers-reduced-motion`
7. Tests E2E raccourcis clavier (j/k navigation, e edit, / search)

### Gate de sortie M5.6
- [ ] axe-core : 0 violation critique sur les 3 sections
- [ ] Lighthouse a11y ≥ 95 partout
- [ ] **Test ultime M5.6** : un admin réalise au clavier (sans souris)
  un parcours complet : ouvrir transactional, chercher email, retry,
  créer audience, lancer campagne. Tout au clavier.

---

---

## ▶ Phase M5.7 — Éditeur de templates HTML

### Objectif
Permettre la création de templates HTML personnalisés depuis l'admin :
éditeur source + visuel, preview live, variables auto-mappées sur les
clients (firstName/city/address…), bibliothèque de composants (CTA,
dividers), test send, versionning + rollback. Inclut un **template par
défaut conforme à la charte FemiGlow** (Pinyon Script wordmark,
Cormorant titres, Inter body, palette sauge/crème/encre).

### Fichiers de référence
- [09-plan-developpement/07-phase-m5.7-templates.yaml](../09-plan-developpement/07-phase-m5.7-templates.yaml)
- [04-ui-ux/06-template-editor.md](../04-ui-ux/06-template-editor.md) — Spec UX éditeur
- [04-ui-ux/07-default-template-femiglow.html](../04-ui-ux/07-default-template-femiglow.html) — Template par défaut prêt à l'emploi
- [02-backend/07-templates-engine.md](../02-backend/07-templates-engine.md) — Resolver context + render + sanitize + versioning
- [11-tests/03-playwright-e2e/07-m5.7-ultimate.spec.md](../11-tests/03-playwright-e2e/07-m5.7-ultimate.spec.md)

### Ordre d'exécution
1. **Data** — migrations `email_template_custom` + `email_template_custom_version`
2. **Resolver** — `buildEmailContext(email, opts)` : pull lead + orders + URLs
3. **Renderer** — Handlebars + cache + sanitize DOMPurify + inline CSS
4. **Default template** — installer le `default-femiglow.html` + 5 starters
5. **CRUD + versioning endpoints** — list, create, update (new version), activate (rollback), test-send, preview
6. **Composants UI** — Editor source (Monaco) + Editor sections + Preview iframe + Variables panel + Components library
7. **Pages** — `/admin/emails/templates`, `[slug]/edit`, `[slug]/versions`
8. **Intégration** — wizard campaign & automation utilisent les custom templates

### Gate de sortie M5.7
- [ ] Default FemiGlow rendu visuellement validé sur Gmail / Apple Mail / Outlook
- [ ] Variables auto-résolues (firstName, city, address, orderId, …) en mock ET real
- [ ] Sanitization rejette script / iframe (test XSS)
- [ ] Versionning + rollback testés
- [ ] CTA library insère du HTML conforme charte
- [ ] **Test ultime M5.7** : créer template depuis default, modifier titre, ajouter CTA secondaire, preview avec real lead, test send, save v2, rollback v1, vérifier rollback OK

---

## 🚨 Déploiement par phase

Chaque phase est déployable indépendamment. Stratégie :

1. **Worktree dev** : `git worktree add /var/www/femiglow-m5 master` →
   nouvelle branche `m5/phase-x`
2. **Tests verts** localement (Jest + MSW + Playwright)
3. **Merge → master** quand le test ultime de la phase passe
4. **Build + deploy** prod (`pnpm build`, `systemctl restart femiglow.service`)
5. **Smoke test prod** : un parcours critique sur la phase
6. **Monitoring** : checker [12-runbook/02-monitoring.md](../12-runbook/02-monitoring.md) — pas d'alerte 24h

## 🔄 Rollback par phase

Voir [12-runbook/01-rollback.md](../12-runbook/01-rollback.md). Principe :
chaque migration data est rollback-able (DROP TABLE / DROP COLUMN), chaque
phase code est revertable par git.

## 📊 Tracking de progression

Tickets dans [10-plan-action/02-tickets.csv](02-tickets.csv) — un
ticket = une journée de dev maximale. Statuts : `pending`,
`in_progress`, `review`, `done`.

## 🆘 Si tu es bloqué

1. Re-lire le concept doc
2. Lire l'ADR correspondant (s'il existe) dans
   [00-architecture/05-adr.md](../00-architecture/05-adr.md)
3. Ouvrir un nouveau ADR si décision archi importante
4. Demander review

---

_Runbook vivant. Toute exception déboucle ici par mise à jour._
