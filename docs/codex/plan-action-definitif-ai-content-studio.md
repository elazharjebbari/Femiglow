# Plan d'action définitif — AI Content Studio staging

Date: 2026-05-18  
Scope obligatoire: `/var/www/femiglow-staging` uniquement  
Service cible: `femiglow-staging.service` sur `127.0.0.1:8012`  
Objectif: rendre l'AI Content Studio robuste, fiable, maintenable, non régressif, modulaire, observable et réellement fonctionnel en staging avant toute décision de production.

## Règles de cadrage

Tout ce plan doit être exécuté sur le serveur de staging, dans le checkout `/var/www/femiglow-staging`. Aucune action ne doit viser la production, aucune migration ne doit être appliquée hors staging, et toute vérification runtime doit utiliser le vrai service staging `femiglow-staging.service` ou le port local `127.0.0.1:8012`.

Les changements doivent rester compatibles avec le design existant de l'admin FemiGlow. Le but n'est pas de refaire le produit, mais de stabiliser et compléter l'expérience déjà livrée par GLM.

Chaque phase doit se terminer par des preuves: typecheck, tests ciblés, build, restart staging, curl local, Playwright authentifié, et lecture des logs récents. Une phase n'est pas terminée tant que ses tests et critères de sortie ne sont pas verts ou documentés avec une décision explicite.

## Etat actuel validé

Déjà corrigé et vérifié:

- Idempotence `POST /api/admin/content-studio/ideas`: appels async désormais attendus.
- Pagination idées: l'API retourne `pagination.nextOffset` et le bouton `LoadMore` fetch réellement la suite.
- Mapping DB `content_draft.parentDraftId`: aligné avec la migration existante.
- Smoke Playwright Content Studio: login admin + 18 scénarios UI passent sur staging.
- TypeScript: `tsc --noEmit` vert.
- Tests ciblés Content Studio: `136 passed`.
- Build production Next: vert.
- Service staging: actif sur `127.0.0.1:8012`.

Risques restants:

- Warnings build Handlebars et routes dynamiques à clarifier.
- Ownership `.next` staging à rendre propre, sans workaround `chmod -R a+rwX`.
- Tests métier profonds insuffisants: création idée, génération, review, planification, Postiz dry-run.
- Observabilité admin encore insuffisante pour OpenAI/Postiz/runs/erreurs.
- Documentation runbook encore à consolider en procédure finale.

## Principes qualité obligatoires

### Backend

- Routes API typées, validées par schemas Zod, avec erreurs JSON stables.
- Idempotence sur les actions créatrices ou coûteuses.
- Transactions DB quand une action écrit plusieurs entités liées.
- Aucun fallback silencieux qui masque une erreur externe critique.
- Journalisation structurée pour les actions métier: create idea, generate brief, generate draft, approve, reject, schedule, Postiz sync.
- Pas de logique métier dupliquée dans les tests: tester les exports réels.

### Frontend

- Composants admin modulaires, sans état caché incohérent.
- Chargement, erreur, succès et état vide visibles pour chaque action asynchrone.
- Boutons désactivés pendant pending state, sans double submit.
- Pagination réelle, sans total artificiel.
- UI accessible: headings, labels, roles, aria-live si message important.
- Aucune régression des onglets Pipeline, Calendrier, Analytics, Budget.

### UI/UX/design

- Conserver le langage visuel admin existant: sobre, dense, orienté opération.
- Les actions critiques doivent être explicites: générer, approuver, rejeter, archiver, planifier.
- Les erreurs doivent être formulées pour un admin, pas pour un développeur uniquement.
- Les états externes doivent être compréhensibles: OpenAI absent, Postiz dry-run, Postiz connecté, budget dépassé.
- Ne pas ajouter de landing, hero décoratif ou refonte marketing dans l'admin.

### Data

- Schéma Drizzle aligné avec les migrations réelles.
- Migrations idempotentes et traçables.
- Vérification DB des colonnes critiques avant restart.
- Données de test staging isolées et reconnaissables.
- Aucun secret imprimé dans les logs ou rapports de test.

### Tests

- Vitest pour logique domaine, repository, schemas, budget, idempotence, clients externes.
- MSW pour contrats API côté UI et erreurs réseau.
- Playwright pour les parcours admin authentifiés sur le vrai staging.
- Tests de non-régression ciblés avant chaque restart.
- Les tests ne doivent pas valider une copie de la logique; ils doivent exercer le code réel.

## Phase 0 — Baseline et verrouillage staging

Objectif: figer un point de départ fiable avant de continuer.

Actions:

1. Confirmer l'environnement.
   - `pwd` doit être `/var/www/femiglow-staging` ou les commandes doivent utiliser `--dir /var/www/femiglow-staging/apps/web`.
   - `git status --short` doit lister uniquement les changements attendus.
   - `systemctl status femiglow-staging.service` doit pointer vers `127.0.0.1:8012`.

2. Capturer l'état runtime.
   - `curl -s -o /tmp/fg_home.html -w '%{http_code}' http://127.0.0.1:8012/`
   - `curl -s -o /tmp/fg_admin.html -w '%{http_code}' http://127.0.0.1:8012/admin/content-studio`
   - `curl -s -L -o /tmp/fg_admin_login.html -w '%{http_code}' http://127.0.0.1:8012/admin/content-studio`
   - `journalctl -u femiglow-staging.service -n 120 --no-pager`

3. Commit de stabilisation.
   - Inclure les corrections déjà faites et les docs `docs/codex/`.
   - Message recommandé: `Stabilize staging content studio`.

Critères de sortie:

- Working tree compris et propre après commit, ou changements restants explicitement justifiés.
- Staging actif.
- Les logs récents ne contiennent pas de nouvelle erreur Content Studio.

Tests:

```bash
pnpm --dir /var/www/femiglow-staging/apps/web exec tsc --noEmit
pnpm --dir /var/www/femiglow-staging/apps/web exec vitest run \
  src/lib/content-studio/postiz.test.ts \
  src/lib/content-studio/schemas.test.ts \
  src/lib/content-studio/budget.test.ts \
  src/lib/content-studio/idempotency.test.ts \
  src/lib/content-studio/repository.test.ts \
  src/test/msw/content-studio-handlers.test.ts \
  src/components/admin/content-studio/helpers.test.ts
```

## Phase 1 — Backend définitif

Objectif: rendre les APIs Content Studio fiables, testées et observables.

Actions backend:

1. Auditer toutes les routes `apps/web/src/app/api/admin/content-studio/**/route.ts`.
   - Auth admin systématique via helper existant.
   - Réponses erreurs via `formatErrorResponse`.
   - Validation input via schemas partagés.
   - Statuts HTTP cohérents: `201` création, `200` lecture/update, `400/401/403/404/409/422/500`.

2. Idempotence.
   - Couvrir route-level `POST /ideas` avec deux requêtes même `Idempotency-Key`.
   - Etendre si nécessaire aux actions coûteuses: génération brief, génération drafts, visual generation, schedule Postiz.
   - TTL/cleanup documenté.

3. Génération.
   - Vérifier contrats OpenAI ou provider interne: input normalisé, model configurable, coûts calculés.
   - Retourner un message exploitable si provider absent.
   - Journaliser `generation_run` même en échec.

4. Review.
   - Vérifier reject/archive/variation/approve.
   - Garantir que `parentDraftId` fonctionne sur staging.
   - Eviter les transitions invalides.

5. Postiz.
   - Séparer clairement dry-run et publication réelle.
   - Surface API pour sync integrations, retry deliveries, import status/performance.
   - Les erreurs Postiz doivent remonter dans une table ou un endpoint admin.

Tests Vitest backend:

- `repository.test.ts`: CRUD réel sur memory store + mappings DB quand testable.
- `idempotency.test.ts`: exports réels `getExistingResponse` / `storeIdempotentResponse`.
- `service.test.ts`: transitions métier et génération.
- `postiz.test.ts`: payloads, retries, erreurs, dry-run.
- `schemas.test.ts`: inputs invalides, limites, enums.
- Nouveau test route-level pour `/api/admin/content-studio/ideas`.

Critères de sortie:

- Toutes les routes critiques ont au moins un test succès et un test erreur.
- Aucune Promise oubliée sur les appels async critiques.
- Logs runtime lisibles après exécution d'un parcours Playwright.

## Phase 2 — Data et migrations

Objectif: supprimer les désalignements code/schema/DB.

Actions data:

1. Comparer Drizzle schema et migrations.
   - `schema-content-studio.ts`
   - `0050_ai_content_studio.sql`
   - `0060_p2_review_actions.sql`
   - `0061_p3_idempotency_campaigns.sql`

2. Vérifier la base staging.
   - Colonnes: `content_draft."parentDraftId"`, `content_idea."rejectionReason"`, `content_post."cancelledBy"`, `content_brand_review."reviewerId"`, table idempotence.
   - Index utiles: status, brief, parent, campaign, idempotency key.

3. Créer une commande de validation.
   - Soit script existant `db:validate`, soit script SQL documenté.
   - La validation doit échouer si une colonne attendue manque.

4. Nettoyer les conventions.
   - Décider si les nouvelles colonnes gardent camelCase historique ou migrent vers snake_case.
   - Ne pas renommer en staging sans migration explicite.

Tests:

```bash
pnpm --dir /var/www/femiglow-staging/apps/web exec tsc --noEmit
pnpm --dir /var/www/femiglow-staging/apps/web exec vitest run src/lib/content-studio/repository.test.ts
```

Critères de sortie:

- Plus aucune erreur PostgreSQL `42703` dans les logs Content Studio.
- Schéma applicatif et DB staging alignés.
- Procédure migration documentée.

## Phase 3 — Frontend fonctionnel

Objectif: rendre le Pipeline utilisable de bout en bout.

Actions frontend:

1. Pipeline idées.
   - Créer idée.
   - Afficher pending/success/error.
   - Pagination réelle avec `LoadMore`.
   - Dédoublonnage côté client.

2. Briefs.
   - Générer un brief depuis une idée.
   - Afficher contraintes, angle, preuve, CTA.
   - Gérer erreur provider/budget.

3. Drafts.
   - Générer plusieurs drafts.
   - Editer et sauvegarder.
   - Variation depuis un draft existant.
   - Reject/archive/approve visibles.

4. Media/visual.
   - Afficher état provider image.
   - Mode mock/dry-run clairement indiqué.
   - Aucune action image ne doit laisser l'UI bloquée.

5. Onglets.
   - Calendrier: navigation semaine/mois, planification visible.
   - Analytics: état vide, chargement, erreurs.
   - Budget: refresh réel, seuils, coûts visibles.

Tests React/Vitest:

- `ContentStudioClient` helpers: pagination, merge, états.
- `IdeaForm`: validation, submit pending, erreurs API.
- `DraftEditor`: edit/reject/archive/approve.
- `BudgetPanel`: refresh et erreur.

Tests MSW:

- `/ideas` success/pagination/500/401.
- `/ideas/:id/generate` success/provider error/budget error.
- `/drafts/:id/approve`, `/reject`, `/archive`, `/variation`.
- `/postiz/*` dry-run success et failure.

Critères de sortie:

- Les états vides et erreurs sont testés.
- Aucun bouton critique ne double-submit.
- UI admin reste lisible et cohérente avec le design existant.

## Phase 4 — UI/UX/design review

Objectif: rendre l'outil confortable pour un admin réel.

Checklist UX:

- Le premier écran explique l'état opérationnel sans texte inutile.
- Les actions primaires sont visibles dans le Pipeline.
- Les badges d'état sont cohérents entre idées, briefs, drafts, posts.
- Les erreurs OpenAI/Postiz/Budget sont distinguées.
- Les transitions ne provoquent pas de layout shift majeur.
- Les onglets restent rapides et scannables.
- Les textes longs ne débordent pas sur mobile et desktop.

Actions design:

1. Harmoniser les composants avec l'admin existant.
2. Ajouter ou corriger les labels accessibles.
3. Ajouter les états skeleton/loading seulement là où ils aident.
4. Vérifier desktop et mobile via Playwright screenshots si changement visuel important.

Critères de sortie:

- Screenshot desktop de `/admin/content-studio` propre.
- Screenshot mobile sans chevauchement.
- Aucun texte bouton/card ne déborde.

## Phase 5 — Observabilité et opérations

Objectif: diagnostiquer vite les problèmes en staging.

Actions:

1. Ajouter un panneau santé dans l'admin Content Studio.
   - Content Studio enabled.
   - OpenAI key/config présente, sans afficher le secret.
   - Postiz base URL/key présente, sans afficher le secret.
   - Mode dry-run actif/inactif.
   - Dernier import status/performance.
   - Derniers generation runs.
   - Dernières deliveries Postiz failed.

2. Logs structurés.
   - `content_studio.idea.created`
   - `content_studio.brief.generated`
   - `content_studio.draft.generated`
   - `content_studio.draft.approved`
   - `content_studio.postiz.delivery.failed`
   - `content_studio.budget.blocked`

3. Runbook incident.
   - Provider absent.
   - DB colonne manquante.
   - Postiz down.
   - Build Next warning/error.
   - Service inactive.

Critères de sortie:

- Un admin peut voir pourquoi la génération ne marche pas sans lire `journalctl`.
- Les logs récents donnent l'action, l'acteur si disponible, et la cause.

## Phase 6 — Tests E2E Playwright définitifs

Objectif: prouver que l'admin fonctionne sur le vrai staging.

Smoke actuel à conserver:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 \
PLAYWRIGHT_HTML_REPORT=/tmp/femiglow-playwright-report \
pnpm --dir /var/www/femiglow-staging/apps/web exec playwright test \
  e2e/content-studio.spec.ts \
  --project=chromium \
  --workers=1 \
  --reporter=list \
  --output=/tmp/femiglow-playwright-results
```

Nouveaux scénarios Playwright:

1. `content-studio-idea-flow.spec.ts`
   - login admin.
   - créer une idée staging reconnaissable.
   - vérifier présence dans la liste.
   - recharger et vérifier persistance.

2. `content-studio-generation-flow.spec.ts`
   - créer idée.
   - générer brief en mode mock/dry-run si provider absent.
   - générer drafts.
   - approuver un draft.

3. `content-studio-review-flow.spec.ts`
   - rejeter un draft avec raison.
   - créer variation.
   - archiver.
   - vérifier badges/états.

4. `content-studio-postiz-dry-run.spec.ts`
   - planifier un post.
   - déclencher dry-run.
   - vérifier delivery ou message d'état.

5. `content-studio-resilience.spec.ts`
   - API 500.
   - API 401.
   - provider unavailable.
   - budget exceeded.

Règles Playwright:

- Utiliser des sélecteurs robustes: role, label, heading, test id si nécessaire.
- Eviter `waitForTimeout` sauf dernier recours.
- Les données créées doivent être préfixées `codex-staging-YYYYMMDD`.
- Les tests ne doivent pas dépendre de l'ordre global des données existantes.

Critères de sortie:

- Login admin OK.
- Tous les scénarios critiques passent sur `127.0.0.1:8012`.
- Les artefacts de test vont dans `/tmp`, pas dans le repo.

## Phase 7 — Build, service et dette staging

Objectif: rendre le déploiement staging répétable.

Actions:

1. Build propre.
   - Supprimer les artefacts stale seulement si nécessaire.
   - Lancer `next build`.
   - Traiter les warnings bloquants ou documenter ceux qui sont acceptés.

2. Ownership `.next`.
   - Le build doit produire des fichiers lisibles par `nodeapp`.
   - Remplacer le workaround `chmod -R a+rwX` par une procédure correcte:
     - build avec le bon user, ou
     - `chown -R nodeapp:nodeapp apps/web/.next`, ou
     - ajustement systemd/build pipeline.

3. Service.
   - Démarrer/restart hors sandbox quand c'est nécessaire.
   - Vérifier que le service reste actif après 2 minutes.
   - Confirmer `ss -ltnp` sur `127.0.0.1:8012`.

4. Warnings Next.
   - Handlebars `require.extensions`: isoler le rendu email preview côté serveur ou adapter import.
   - `/api/delivery-cities/search`: forcer dynamic si attendu.
   - `/feed.xml`: forcer dynamic si headers requis.

Critères de sortie:

- `next build` vert.
- `femiglow-staging.service` actif et stable.
- Plus de workaround permissions non maîtrisé.
- Warnings restants documentés avec justification.

## Phase 8 — Documentation finale

Objectif: rendre la reprise maintenable par n'importe quel prochain agent ou développeur.

Docs à produire dans `docs/codex/`:

- `runbook-ai-content-studio-staging.md`
- `test-matrix-ai-content-studio.md`
- `release-checklist-ai-content-studio.md`
- mise à jour de `README.md`

Contenu minimal:

- état actuel;
- commandes exactes;
- critères de sortie;
- erreurs connues;
- rollback staging;
- vérification DB;
- vérification Playwright;
- procédure de restart.

Critères de sortie:

- Le runbook permet d'exécuter la validation sans relire le transcript.
- La matrice de tests lie chaque risque à une preuve.

## Runbook d'exécution

### 1. Préparer

```bash
cd /var/www/femiglow-staging
git status --short
systemctl status femiglow-staging.service
```

### 2. Vérifier le port staging

```bash
ss -ltnp
curl -s -o /tmp/fg_home.html -w '%{http_code}\n' http://127.0.0.1:8012/
curl -s -o /tmp/fg_admin_redirect.html -w '%{http_code}\n' http://127.0.0.1:8012/admin/content-studio
curl -s -L -o /tmp/fg_admin_login.html -w '%{http_code}\n' http://127.0.0.1:8012/admin/content-studio
curl -s -o /tmp/fg_content_health.html -w '%{http_code}\n' http://127.0.0.1:8012/api/admin/content-studio/health
```

Attendu sans session:

- `/`: `200`
- `/admin/content-studio`: `307`
- `/admin/content-studio` avec `-L`: `200`
- `/api/admin/content-studio/health`: `401` JSON

### 3. Lancer la validation code

```bash
pnpm --dir /var/www/femiglow-staging/apps/web exec tsc --noEmit
pnpm --dir /var/www/femiglow-staging/apps/web exec vitest run \
  src/lib/content-studio/postiz.test.ts \
  src/lib/content-studio/schemas.test.ts \
  src/lib/content-studio/budget.test.ts \
  src/lib/content-studio/idempotency.test.ts \
  src/lib/content-studio/repository.test.ts \
  src/test/msw/content-studio-handlers.test.ts \
  src/components/admin/content-studio/helpers.test.ts
```

### 4. Builder

```bash
pnpm --dir /var/www/femiglow-staging/apps/web exec next build
```

Si erreurs `.next` ou permission:

```bash
stat -c '%U:%G %a %n' /var/www/femiglow-staging/apps/web/.next
stat -c '%U:%G %a %n' /var/www/femiglow-staging/apps/web/.next/server/app/admin/content-studio/page.js
```

Correction durable à privilégier:

```bash
chown -R nodeapp:nodeapp /var/www/femiglow-staging/apps/web/.next
```

Le `chmod -R a+rwX` ne doit être utilisé qu'en dépannage temporaire staging, avec note dans le compte rendu.

### 5. Redémarrer staging

```bash
systemctl restart femiglow-staging.service
sleep 2
systemctl status femiglow-staging.service
```

Si le service est démarré depuis un environnement qui l'arrête automatiquement, refaire le start hors sandbox:

```bash
systemctl start femiglow-staging.service
```

### 6. Vérifier logs

```bash
journalctl -u femiglow-staging.service -n 120 --no-pager
```

Bloquants:

- `column ... does not exist`
- `Failed query` sur Content Studio
- `EACCES` dans `.next`
- `Cannot find module for page`
- erreur auth admin inattendue

Non bloquants temporaires mais à suivre:

- warning Handlebars `require.extensions`
- dynamic server usage sur routes explicitement dynamiques, si documenté

### 7. Playwright authentifié

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 \
PLAYWRIGHT_HTML_REPORT=/tmp/femiglow-playwright-report \
pnpm --dir /var/www/femiglow-staging/apps/web exec playwright test \
  e2e/content-studio.spec.ts \
  --project=chromium \
  --workers=1 \
  --reporter=list \
  --output=/tmp/femiglow-playwright-results
```

Attendu actuel:

```txt
19 passed
```

### 8. Contrôle final

```bash
systemctl status femiglow-staging.service
curl -s -o /tmp/fg_final_home.html -w '%{http_code}\n' http://127.0.0.1:8012/
curl -s -L -o /tmp/fg_final_admin.html -w '%{http_code}\n' http://127.0.0.1:8012/admin/content-studio
git status --short
```

### 9. Compte rendu obligatoire

Le compte rendu de chaque phase doit inclure:

- fichiers modifiés;
- commandes exécutées;
- résultats tests;
- état service staging;
- risques restants;
- prochaine étape recommandée.

## Ordre recommandé d'exécution

1. Phase 0 — commit baseline.
2. Phase 1 — backend routes/idempotence/génération/review.
3. Phase 2 — data/migrations/schema.
4. Phase 3 — frontend pipeline complet.
5. Phase 6 — Playwright métiers profonds, en parallèle des tests MSW.
6. Phase 5 — observabilité admin.
7. Phase 7 — dette build/service/ownership.
8. Phase 8 — docs finales et checklist release.

## Définition du "done"

Le plan est terminé uniquement quand:

- `tsc --noEmit` est vert.
- Vitest ciblé Content Studio est vert.
- MSW couvre les contrats critiques.
- Playwright authentifié couvre au moins création idée, génération, review, planning/dry-run, erreurs.
- `next build` est vert.
- `femiglow-staging.service` reste actif après restart et après tests.
- `/admin/content-studio` est utilisable avec login admin sur staging.
- Les logs récents ne montrent aucune erreur Content Studio bloquante.
- Le runbook final est à jour dans `docs/codex/`.

