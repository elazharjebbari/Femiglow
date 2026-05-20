# Audit Codex — reprise GLM AI Content Studio

Date: 2026-05-17  
Repo audité: `/var/www/femiglow-staging`  
Source demandée: `/var/www/femiglow/draft/draft_2.txt`  
Docs GLM consultées: `docs/ai-content-studio/150-glm-resume/` et `docs/content-studio/p3-plan/`

## Synthèse exécutive

GLM a livré une grosse tranche de travail sur l'AI Content Studio: correction d'auth API, stabilisation backend/UI, refactor du client React, actions de review, calendrier, notes, UTM, analytics, budget, idempotence, pagination, CI/E2E et campagnes.

Le travail est réel et largement commité sur `master`. Les tests ciblés Content Studio annoncés par GLM passent bien: 126 tests sur 6 fichiers.

L'état n'est toutefois pas merge/release-ready tel quel. J'ai trouvé trois risques majeurs:

1. `POST /api/admin/content-studio/ideas` casse l'idempotence car deux appels async ne sont pas `await`.
2. `next build` échoue actuellement à l'étape `Collecting page data` avec `Cannot find module for page: /_document`.
3. La pagination UI "LoadMore" est un faux-semblant: le bouton ne déclenche aucun fetch et ne charge pas plus de données.

Il y a aussi des limites de couverture: plusieurs tests P3 valident une logique recopiée plutôt que les modules réels, et les E2E restent majoritairement smoke/navigation plutôt que workflow métier complet.

## Inventaire vérifié

### Commits GLM principaux

La branche `master` contient notamment:

- `3757976` — JSON 401 pour les routes API Content Studio.
- `11cf84d` à `0f2dca0` — stabilisation P1, state machine, refactor composants.
- `5bd81d6`, `29353dc` — tests unitaires composants et MSW.
- `e17073f` à `9101cb7` — P2 actions review, brief editor, calendrier, notes, UTM, analytics, budget, onglets, E2E.
- `806c78b` à `1e0f108` — plan et hardening P3: pagination, lazy loading, idempotence DB, budget, MSW, E2E, CI, campagnes.
- `aa477fc` — correction finale de 7 erreurs de build bloquantes selon GLM.

`git status --short` est vide au moment de l'audit.

### Documentation ajoutée

Deux zones documentaires existent:

- `docs/ai-content-studio/150-glm-resume/`: reprise P0/P1/P2 documentée par GLM.
- `docs/content-studio/p3-plan/`: plan P3 production readiness. Note: ce dossier n'est pas sous `docs/ai-content-studio/`, ce qui peut surprendre vu le reste de l'arborescence.

### Surfaces code créées ou modifiées

Le Content Studio couvre maintenant:

- Routes API sous `apps/web/src/app/api/admin/content-studio/`.
- Composants React sous `apps/web/src/components/admin/content-studio/`.
- Domaine/service/repository sous `apps/web/src/lib/content-studio/`.
- Migrations `0060_p2_review_actions.sql` et `0061_p3_idempotency_campaigns.sql`.
- E2E Playwright `apps/web/e2e/content-studio.spec.ts`.
- Workflow CI modifié par P3.7.

## Validations exécutées

### Git

Résultat: propre.

```txt
git status --short
# aucune sortie
```

### Runtime local

Le health endpoint répond hors sandbox, sans session, avec un JSON 401:

```txt
GET http://127.0.0.1:3001/api/admin/content-studio/health
HTTP 401
{"error":{"code":"unauthorized","message":"Session expirée. Veuillez vous reconnecter."}}
```

C'est cohérent avec la correction P0: l'API renvoie du JSON au lieu d'une page HTML.

### Tests ciblés Content Studio

Commande:

```bash
pnpm --dir /var/www/femiglow-staging/apps/web exec vitest run \
  src/lib/content-studio/schemas.test.ts \
  src/lib/content-studio/budget.test.ts \
  src/lib/content-studio/idempotency.test.ts \
  src/lib/content-studio/repository.test.ts \
  src/test/msw/content-studio-handlers.test.ts \
  src/components/admin/content-studio/helpers.test.ts
```

Résultat:

```txt
Test Files  6 passed (6)
Tests       126 passed (126)
```

### TypeScript

Commande:

```bash
pnpm --dir /var/www/femiglow-staging/apps/web exec tsc --noEmit
```

Résultat: échec.

```txt
src/lib/content-studio/postiz.test.ts(62,19): error TS2532: Object is possibly 'undefined'.
src/lib/content-studio/postiz.test.ts(82,12): error TS2532: Object is possibly 'undefined'.
src/lib/content-studio/postiz.test.ts(106,12): error TS2532: Object is possibly 'undefined'.
```

GLM avait déjà noté ces erreurs comme préexistantes, mais elles restent un signal rouge pour toute déclaration "tout est vert".

### Build Next

Commande:

```bash
pnpm --dir /var/www/femiglow-staging/apps/web exec next build
```

Résultat: échec.

Compilation réussie avec warnings Handlebars, puis:

```txt
Collecting page data ...
unhandledRejection Error [PageNotFoundError]: Cannot find module for page: /_document
```

Ce point bloque une validation release propre.

## Constats détaillés

### 1. Critique — Idempotence cassée sur `POST /ideas`

Fichier: `apps/web/src/app/api/admin/content-studio/ideas/route.ts`

Lignes observées:

```ts
const existing = getExistingResponse(idempotencyKey);
if (existing) return NextResponse.json(existing, { status: 201 });
...
if (idempotencyKey) storeIdempotentResponse(idempotencyKey, responseBody);
```

`getExistingResponse()` et `storeIdempotentResponse()` sont async. Sans `await`:

- `existing` est une Promise truthy, donc le handler peut retourner une Promise sérialisée au lieu d'une réponse idempotente.
- le stockage n'est pas garanti avant la réponse.
- les erreurs DB d'idempotence peuvent devenir des unhandled rejections.

Correction attendue:

```ts
const existing = await getExistingResponse(idempotencyKey);
if (existing) return NextResponse.json(existing, { status: 200 });
...
if (idempotencyKey) await storeIdempotentResponse(idempotencyKey, responseBody);
```

Ajouter un test API/route réel qui couvre deux POST successifs avec la même clé.

### 2. Critique — Build Next non validé

Le build échoue sur `/_document`. Le fichier `.next/server/pages/_document.js` existe après tentative, donc il faut investiguer plus précisément:

- état de `.next` avant build;
- interaction App Router + pages manifest;
- exécution depuis workspace monorepo;
- éventuel artefact stale ou config Next.

Tant que ce point n'est pas résolu, il ne faut pas considérer P3 comme déployable.

### 3. Élevé — `LoadMore` ne charge rien

Fichier: `apps/web/src/components/admin/content-studio/ContentStudioClient.tsx`

`ideaOffset` est défini et mis à jour, mais jamais utilisé pour appeler l'API:

```ts
const [ideaOffset, setIdeaOffset] = useState(0);
...
onLoadMore={() => setIdeaOffset((o) => o + 50)}
```

Le bouton affiche aussi un `totalCount={ideas.length + 50}`, donc il annonce artificiellement 50 items restants sans total réel serveur.

Impact: la P3.2 "pagination serveur + LoadMore" est partiellement implémentée côté API, mais pas fonctionnelle côté UI.

Correction attendue:

- retourner `{ items, total, hasMore }` ou au minimum `nextOffset` depuis les APIs;
- appeler `GET /ideas?limit=50&offset=...`;
- concaténer les résultats;
- couvrir par un test MSW ou E2E qui vérifie que de nouveaux items apparaissent.

### 4. Élevé — Tests P3 trop découplés du code réel

Exemples:

- `budget.test.ts` recopie une fonction `checkBudgetLogic()` au lieu de tester `checkDailyBudget()`.
- `idempotency.test.ts` recrée un store local au lieu de tester `getExistingResponse()` / `storeIdempotentResponse()`.

Ces tests peuvent rester verts pendant que le module réel est cassé, ce qui est exactement le cas pour l'idempotence async.

Correction attendue:

- mocker proprement `db()` / `env`;
- tester les exports réels;
- ajouter un test route-level pour `POST /ideas` avec `Idempotency-Key`.

### 5. Moyen — E2E Playwright encore peu probants

Le fichier `content-studio.spec.ts` vérifie surtout navigation, présence de boutons et résilience basique. Plusieurs tests sont faibles:

- le test champ idée cherche un placeholder qui n'existe pas, puis ignore silencieusement si le champ n'est pas visible;
- le test budget attend 2 secondes sans assertion sur les données chargées;
- les routes 500/401 mockées visent `/ideas`, mais la page initiale reçoit ses données côté serveur, donc le test ne prouve pas forcément le comportement attendu.

Correction attendue:

- tester une création d'idée réelle via UI;
- tester génération ou état mocké via API;
- tester le bouton LoadMore avec changement visible;
- tester l'affichage d'erreur sur une action client réelle.

### 6. Moyen — Les migrations semblent appliquées manuellement mais pas auditées par script

Le transcript GLM montre une exécution manuelle de:

- `0060_p2_review_actions.sql`
- `0061_p3_idempotency_campaigns.sql`

Le code contient bien ces fichiers. Mais l'audit actuel n'a pas une preuve automatisée de migration type `db:migrate-safe:plan` / `db:validate` / table de migrations. Pour un go-live, il faut une commande reproductible, pas seulement un `psql -f` manuel dans un transcript.

Correction attendue:

- valider l'état migration via les scripts existants `db:validate` / `db:migrate-safe:plan`;
- documenter la procédure exacte dans le runbook actuel;
- éviter les migrations manuelles non tracées.

### 7. Moyen — Campagnes CRUD sans intégration bout-en-bout complète

Les campagnes ont:

- repository;
- schemas;
- routes GET/POST/PATCH;
- MSW;
- `CampaignSelect` dans `IdeaForm`.

Mais l'intégration produit reste minimale:

- pas de page de gestion campagnes dans l'admin;
- pas de filtre campagne dans calendrier;
- pas de visibilité campagne dans la liste d'idées;
- pas de suppression/archive UI dédiée.

Ce n'est pas bloquant si P3.8 visait seulement le socle, mais le libellé "CRUD complet" est trop fort côté produit.

## Points positifs

- La correction P0 est saine: toutes les routes API Content Studio trouvées utilisent `requireAdminApi()`, tandis que la page admin conserve `requireAdmin()`.
- Le refactor UI a réellement réduit le composant monolithique et créé des composants spécialisés.
- Les schémas Zod et la state machine donnent une base plus maintenable.
- Les handlers MSW couvrent beaucoup plus d'endpoints qu'avant.
- Le health endpoint est utile pour distinguer mode DB/memory une fois authentifié.
- Le worktree est propre, les commits sont atomisés et lisibles.

## Priorité de correction recommandée

### P0 — Bloquants avant suite produit

1. Corriger les `await` manquants dans `POST /ideas`.
2. Ajouter un test route-level d'idempotence.
3. Résoudre `next build` sur `/_document`.
4. Corriger ou isoler explicitement les 3 erreurs TypeScript de `postiz.test.ts`.

### P1 — Rendre P3 honnêtement fonctionnel

5. Implémenter réellement `LoadMore` côté client avec fetch paginé.
6. Remplacer les tests recopiés par des tests des modules réels.
7. Rendre les E2E plus transactionnels.

### P2 — Produit/admin

8. Ajouter une surface admin pour gérer les campagnes.
9. Ajouter les campagnes aux vues calendrier, idées et analytics.
10. Formaliser la validation DB/migrations dans le runbook.

## Verdict

GLM a produit une base conséquente et exploitable, mais il a aussi sur-déclaré la maturité de P3. À ce stade, je classerais le travail comme:

```txt
Implémentation substantielle: oui
Tests ciblés Content Studio: verts
Build release: rouge
Production-ready: non
Reprise Codex recommandée: corriger les bloquants avant nouvelle fonctionnalité
```

