# RUNBOOK EXÉCUTABLE — Remise en état du pipeline génération + publication

> FemiGlow Content Studio v2 / AI Engine. Baseline figée **2026-05-29**, branche `feat/ai-engine-langgraph-mvp`.
>
> **Source de vérité (méthodologie §1, non négociable)** : la vérité, c'est le comportement réel de l'application exercée par un opérateur — **PAS** le rapport de la suite de tests. Toute étape de ce runbook se termine par une **vérification indépendante** dont le but est de **falsifier** le correctif. Une étape n'est « passée » que si elle survit à la réfutation.
>
> Toute affirmation est tracée à un finding confirmé Phase 1 (`BUG-xxx` / `MISS-xxx`) — cf. `../01_audit/bug-register.csv`, `../01_audit/_consolidated.json`, `../01_audit/missed-issues.csv` — et au plan `../06_action-plan/action-plan.md` (tâches `T-xxx`).

---

## 0. Contexte d'exécution réel (relevé environnement, à ne pas deviner)

Faits d'infrastructure confirmés (cf. `../01_audit/evidence/runtime-env-state.md`, vérifiés sur disque le 2026-05-29) :

| Élément | Valeur réelle | Conséquence |
|---|---|---|
| App staging | PM2 process `web`, `next start -H 127.0.0.1 -p 8012` | base URL = `http://127.0.0.1:8012` (PAS 3000) |
| Fichier d'env | `apps/web/.env` (chargé via `EnvironmentFile=` systemd + PM2) | tout changement d'env exige un **restart** du process `web` |
| Cron qui tourne réellement | `femiglow-staging-cron-tick.timer` → `OnCalendar=minutely` → `curl -X POST -H "Bearer <CRON_SECRET>" http://127.0.0.1:8012/api/cron/tick` | **seul** déclencheur cron vivant ; `vercel.json` (`apps/web/vercel.json`) **n'est pas honoré** (pas de déploiement Vercel) |
| Scheduler de publication | route `apps/web/src/app/api/cron/content-studio/social-publish-scheduler/route.ts` **existe mais n'est appelée par personne** | BUG-003 : publication programmée jamais exécutée |
| `OPENAI_API_KEY` | **présent**, valide (`sk-`, 164 chars) dans le process | mais **non déclaré dans `apps/web/src/lib/env.ts`** → invisible au flux create (BUG-001/005) |
| `CONTENT_STUDIO_OPENAI_API_KEY` | **vide** | seule variable lue par le flux create → gen OpenAI opérateur impossible |
| `AI_ENGINE_HIGGSFIELD_API_KEY` | présent (67 chars) **sans `:`** ; `_SECRET` **vide** | credential incomplet (BUG-002) ; vraie API = `platform.higgsfield.ai`, auth `Authorization: Key KEY_ID:KEY_SECRET` (mémoire `higgsfield-api-mismatch`) |
| `SOCIAL_PUBLISHING_MODE` | **vide** → défaut `dry_run` | publication simulée par défaut (mémoire `social-publishing-dry-run-default`) ; `live` → Postiz réel sur comptes clients |
| `POSTIZ_BASE_URL` / `POSTIZ_API_KEY` | présents (Postiz self-hosted joignable) | parité publication testable en **draft** read-only |

### 0.1 Pré-requis : session opérateur sanctionnée + base URL

```bash
# Toutes les commandes ci-dessous supposent ces variables. Travailler depuis apps/web.
export WEB=/var/www/femiglow-staging/apps/web
export BASE=http://127.0.0.1:8012

# Cookie admin = storageState Playwright officiel (PAS de brute-force /login)
cd "$WEB" && pnpm exec playwright test --project=setup 2>/dev/null || true   # régénère .auth/admin.json si besoin
export COOKIE=$(python3 -c "import json;d=json.load(open('$WEB/.auth/admin.json'));print('; '.join(f\"{c['name']}={c['value']}\" for c in d.get('cookies',[])))")

# Sanity : 200 avec cookie, 401 sans
curl -s -o /dev/null -w "with-cookie:%{http_code}\n"  -H "Cookie: $COOKIE" "$BASE/api/admin/content-studio/health"
curl -s -o /dev/null -w "no-cookie:%{http_code}\n"                         "$BASE/api/admin/content-studio/health"
```

### 0.2 Règles de sécurité (impératives pour tout exécutant de ce runbook)

- **Aucune publication live** tant que `T-204` + `T-301` ne sont pas verts (garde-fou doubles publications). Le mode `live` Postiz poste sur de **vrais comptes clients Instagram**.
- **Aucune génération live destructive** non maîtrisée : les probes live se limitent à 1 génération bornée par étape, jamais en boucle.
- **Aucun brute-force / scavenging de credentials**. Seule voie d'auth : storageState Playwright.
- Tout probe externe (Higgsfield, Postiz) est **read-only** sauf étape explicitement marquée « génération bornée ».

### 0.3 Convention de boucle (appliquée à CHAQUE tâche)

```
CORRECTION ──► RE-TEST (auteur) ──► VÉRIFICATION INDÉPENDANTE (réfuteur) ──► [critère de passage]
                                          │
                            tente activement de FALSIFIER le correctif ;
                            si la falsification réussit → retour CORRECTION
```

Le **réfuteur** est un second agent/relecteur qui ne fait pas confiance au premier : il rejoue le chemin opérateur réel, inspecte l'effet **backend** (DB, asset servi, run, job), et cherche un faux positif. Une tâche n'est close que si le réfuteur **échoue à la falsifier**.

---

## Vue d'ensemble des phases

```
PHASE 0  Filet de vérité            T-001 T-002 T-003 T-006 T-010 + déblocage OpenAI T-005 + garde-fous T-020 T-021
PHASE 1  Les 4 blockers            T-101 (image live) · T-102/T-103 (Higgsfield) · T-301/T-302→T-103b (publication) · T-104 (bridge média)
PHASE 2  Criticals                 T-201 (texte LLM) · T-202 (picker honnête) · T-203 (enum tone) · T-204 (idempotence)
PHASE 3  Majors                    T-303 T-304 T-305 T-306 T-307 T-308 T-309
PHASE 4  Dette/minors              T-410..T-415
PHASE 5  Harnais de parité + DoD   parité mock↔live à l'identique, exit-0, smoke vert
```

> **Ordre non négociable** : PHASE 0 d'abord. Sans filet de vérité, un correctif faux passe pour un succès et l'on ne distingue plus un vrai correctif d'un faux. Garde-fou de séquencement : **T-103b (activation live du scheduler) ne s'active QU'APRÈS T-301 + T-204** (sinon BUG-003 inerte → incident `critical` doubles publications).

---

# PHASE 0 — Filet de vérité (débloquer la vérifiabilité)

## ÉTAPE 0.A — Fermer l'EXIT 1 : faire dire la vérité à la CI (T-001)

**Findings** : BUG-010, BUG-027, BUG-032. **But** : un run de tests qui rapporte « tout vert » mais sort en `exit 1` doit faire **échouer** la CI.

### Constat de départ (à reproduire AVANT de corriger)
```bash
cd "$WEB"
pnpm exec vitest run src/lib/content-studio/video-generation.test.ts ; echo "EXIT=$?"
# Attendu baseline : "15 passed" MAIS "Errors 1 error" et EXIT=1 (BUG-010 reproduit)
pnpm exec vitest run src/lib/content-studio src/lib/social-publishing src/lib/ai-engine src/components/admin/content-studio-v2 ; echo "SUITE_EXIT=$?"
# Attendu baseline : ~1695 passed, 0 failed, mais SUITE_EXIT=1
```

### CORRECTION
1. Dans le step CI `Tests vitest` (`pnpm -r test`) : **propager le code retour** (`set -o pipefail` ; ne jamais `| tee` sans capturer `${PIPESTATUS[0]}`). Le gate CI lit `$?`, **jamais** `numFailedTests` du JSON.
2. Interdire tout `dangerouslyIgnoreUnhandledErrors` dans la config vitest.
3. Ajouter au harnais (`apps/web/vitest.setup.ts`) : `process.on('unhandledRejection', () => { process.exitCode = 1 })`.

### RE-TEST (auteur)
```bash
cd "$WEB" && pnpm exec vitest run src/lib/content-studio/video-generation.test.ts ; echo "EXIT=$?"
```

### VÉRIFICATION INDÉPENDANTE (réfuteur)
- Le réfuteur ré-introduit volontairement une rejection non gérée dans un test bidon et vérifie que **le gate passe au rouge** (`EXIT=1`) alors que `numFailedTests=0`. Si le gate reste vert → falsification réussie → retour CORRECTION.
- Le réfuteur grep la CI : `grep -nE "PIPESTATUS|exit|set -o pipefail" .github/workflows/*.yml` et confirme qu'aucun step ne masque le code retour derrière un `| tee`.

### CRITÈRE DE PASSAGE
Sur la baseline **non encore corrigée fonctionnellement**, le gate révèle BUG-010 (rouge, `EXIT=1`). Le gate ne peut plus être trompé par la ligne de résumé.

---

## ÉTAPE 0.B — Réparer la fuite fake-timer (T-002)

**Findings** : BUG-010, BUG-027, BUG-032.

### CORRECTION
1. `src/lib/content-studio/video-generation.test.ts` test « polling status=failed » (l. ~198-224) : **drainer** la boucle de poll (`advanceTimersByTimeAsync` jusqu'au throw réel) et `await` la rejection **AVANT** `vi.useRealTimers()`.
2. `apps/web/vitest.setup.ts` : filet global
   ```ts
   afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
   ```

### RE-TEST
```bash
cd "$WEB"
pnpm exec vitest run src/lib/content-studio/video-generation.test.ts ; echo "EXIT=$?"   # attendu 0, "Errors 0"
pnpm exec vitest run src/lib/content-studio src/lib/social-publishing src/lib/ai-engine src/components/admin/content-studio-v2 ; echo "SUITE_EXIT=$?"  # attendu 0
```

### VÉRIFICATION INDÉPENDANTE
- Le réfuteur lance la suite complète **5 fois** (`for i in 1 2 3 4 5; do pnpm exec vitest run …; echo $?; done`) : aucun `EXIT=1` intermittent (la fuite timer est non déterministe ; un seul run vert ne prouve rien).
- Le réfuteur vérifie que le test « polling status=failed » **continue d'asserter** le rejet (le drain ne doit pas avoir supprimé l'assertion).

### CRITÈRE DE PASSAGE
`SUITE_EXIT=0` ET ligne `Errors 0`, **reproductible sur 5 runs consécutifs**, vérifié par re-run réel (pas par le seul JSON).

---

## ÉTAPE 0.C — Réparer les 2 E2E du parcours opérateur réel (T-003)

**Findings** : BUG-023, BUG-029, BUG-042, BUG-055, BUG-064.

### Constat de départ
```bash
cd "$WEB"
PLAYWRIGHT_BASE_URL=$BASE pnpm exec playwright test e2e/content-studio-v2/create-mock-video.spec.ts e2e/content-studio-social-publishing-draft.spec.ts ; echo "PW_EXIT=$?"
# Attendu baseline : 2 failed, PW_EXIT=1
```

### CORRECTION
1. `create-mock-video.spec.ts:8` : sélecteur du bouton conditionnel au `kind` — libellé réel « Générer une vidéo IA » (BUG-029/055).
2. `content-studio-social-publishing-draft.spec.ts:207,227` : nom de table `audit_event` → **`audit_events`** (BUG-023/042).
3. Brancher ces specs sur une **DB de test au schéma Drizzle réel** ; le seed asserte `to_regclass('audit_events') IS NOT NULL`.

### RE-TEST
```bash
cd "$WEB" && PLAYWRIGHT_BASE_URL=$BASE pnpm exec playwright test e2e/content-studio-v2/create-mock-video.spec.ts e2e/content-studio-social-publishing-draft.spec.ts ; echo "PW_EXIT=$?"
```

### VÉRIFICATION INDÉPENDANTE
- Le réfuteur exécute, contre la DB de test, `SELECT to_regclass('audit_events');` (doit être non-null) et `SELECT to_regclass('audit_event');` (doit être null) — prouve que le test pointe sur la **vraie** table, pas qu'on a recréé la fausse.
- Le réfuteur confirme que le spec « create-mock-video » échoue bien si le bouton est masqué (mute le libellé → rouge attendu), donc qu'il teste l'effet réel.

### CRITÈRE DE PASSAGE
`PW_EXIT=0` sur le parcours `create → generate → publish-draft (mock)`, les 2 specs verts **contre la vraie DB**.

---

## ÉTAPE 0.D — Déblocage OpenAI live (flux create) : source de vérité unique des clés (T-005)

**Findings** : BUG-001 (partie OpenAI), BUG-005, BUG-006, BUG-007, MISS-003, MISS-007, MISS-013.
**Correctif bon marché** : la clé `sk-…` valide (164 chars) est **déjà dans le process** ; il suffit de la rendre visible au flux create.

### CORRECTION
1. `apps/web/src/lib/env.ts` : **déclarer** `OPENAI_API_KEY` (schéma zod + mapping runtime). Aujourd'hui absente du schéma → invisible à l'objet `env` typé.
2. `image-generation.ts` ET `generation.ts` : **réutiliser `resolveApiKey('openai')`** (même chaîne que la discovery du picker) au lieu de lire `env.CONTENT_STUDIO_OPENAI_API_KEY` brut.
3. `generation.ts:70` : remplacer le `??` (qui ne neutralise pas la chaîne vide) par une garde de chaîne non vide :
   ```ts
   const apiKey = firstNonEmpty(env.CONTENT_STUDIO_OPENAI_API_KEY, env.CHAT_OPENAI_API_KEY, env.OPENAI_API_KEY);
   if (!apiKey) { /* live → throw invalid_state explicite ; mock → fallback assumé */ }
   ```

### Configurer le mode LIVE de façon SÛRE (OpenAI)
> On NE modifie PAS `OPENAI_API_KEY` (déjà présent et valide). On rend juste le flux create capable de la lire. Optionnel pour figer le comportement create explicitement :
```bash
# apps/web/.env (édition manuelle, valeurs masquées en logs) :
#   CONTENT_STUDIO_OPENAI_API_KEY=<= laisser vide ; le fallback OPENAI_API_KEY suffit après le correctif>
# Restart obligatoire (PM2 + EnvironmentFile) :
pm2 restart web && sleep 3
curl -s -H "Cookie: $COOKIE" "$BASE/api/admin/content-studio/health" | python3 -m json.tool | head
```

### RE-TEST (probe opérateur authentifiée, MOCK puis LIVE)
```bash
# 1) Créer une idée + drafts
IDEA=$(curl -s -H "Cookie: $COOKIE" -H 'Content-Type: application/json' -X POST \
  "$BASE/api/admin/content-studio/ideas" \
  -d '{"pillar":"produit","objective":"conversion","platform":"instagram","format":"post","prompt":"sérum vitamine C peau mixte"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['idea']['id'])")
echo "IDEA=$IDEA"

# 2) MOCK : génération texte (doit produire l'asset déterministe — inchangé)
curl -s -H "Cookie: $COOKIE; cs_generation_mode=mock" -H 'Content-Type: application/json' -X POST \
  "$BASE/api/admin/content-studio/ideas/$IDEA/generate" -d '{"model":"gpt-4o-mini"}' | python3 -m json.tool | head -40

# 3) LIVE : génération texte + visuel (doit produire un run provider=openai)
curl -s -H "Cookie: $COOKIE; cs_generation_mode=live" -H 'Content-Type: application/json' -X POST \
  "$BASE/api/admin/content-studio/ideas/$IDEA/generate" -d '{"model":"gpt-4o-mini"}' | python3 -m json.tool | head -40

# 4) Vérifier le generation_run réel
curl -s -H "Cookie: $COOKIE" "$BASE/api/admin/content-studio/generation-runs?ideaId=$IDEA" | python3 -m json.tool | head -40
```

### VÉRIFICATION INDÉPENDANTE
- Le réfuteur compare le run **mock** et le run **live** : en live, `provider=openai`, `model=gpt-4o-mini`, `status=succeeded|completed`, `cost>0` ; en mock, `provider=fallback`/déterministe, `cost=0`. **Si le live retombe en `provider=fallback`, falsification réussie** (la clé n'est toujours pas lue) → retour CORRECTION.
- Le réfuteur ouvre `/admin/content-studio-v2/create` en mode Live, clique « Générer un visuel IA » avec `gpt-image-1-mini` et confirme que l'asset est **servi en HTTP 200** (pas un toast 409 « CONTENT_STUDIO_OPENAI_API_KEY manquant »).
- Le réfuteur grep le code : `grep -rn "CONTENT_STUDIO_OPENAI_API_KEY" src/lib/content-studio/` ne doit plus montrer de **lecture directe sans fallback** dans le chemin de génération.

### CRITÈRE DE PASSAGE
Le même chemin opérateur produit : en **mock** un asset déterministe (inchangé) ; en **live** un asset OpenAI réel 200 + `generation_run provider=openai cost>0`. Le toggle mock/live **change réellement** le comportement.

---

## ÉTAPE 0.E — Harnais de parité MOCK/LIVE : MSW global + contract-tests fournisseurs (T-006)

**Findings** : BUG-041, BUG-045, BUG-046, BUG-037, BUG-011, BUG-018, MISS-008, MISS-009.
**But** : garantir qu'une doublure suit le **contrat réel** du fournisseur, et qu'un test devient **rouge** dès que le code appelle un faux endpoint.

### Constat de départ
```bash
cd "$WEB"
grep -n msw vitest.setup.ts || echo "AUCUN serveur MSW global monté (BUG-046)"
ls src/test/msw/   # handlers par feature, non montés globalement
```

### CORRECTION
1. `apps/web/vitest.setup.ts` : monter `setupServer(...)` MSW **global** avec `server.listen({ onUnhandledRequest: 'error' })`. Tout `fetch` non déclaré dans MSW fait **échouer** le test.
2. Écrire des **contract-tests** calqués sur l'API **réelle** :
   - **OpenAI** : images (`/v1/images/generations`) + chat (`/v1/chat/completions`).
   - **Higgsfield** : `platform.higgsfield.ai`, pattern **async** `submit /v1/image2video/<model>` (ou `/v1/text2image/<model>`) **+ poll** `/v1/requests/{id}/status`, auth `Authorization: Key KEY_ID:KEY_SECRET`. Un test devient **rouge** si le code appelle un endpoint **synchrone faux** (`/v1/videos/generate`, `/v1/images/generate`).
   - **Postiz** : `/api/public/v1/integrations`, `/posts`, upload média.
3. Test de **parité dry_run ↔ PostizAdapter** sur le **même contrat** (shape de permalien, statuts, codes d'erreur).
4. Couvrir le chemin LLM **réel** des nœuds (`generate-script` / `generate-caption` / `generate-variants`) avec un mock LLM qui **réussit** (pas seulement en rejet).
5. `vitest.config.ts` : `coverage.include` **étendu à `src/lib/ai-engine/**`**.

### RE-TEST
```bash
cd "$WEB"
pnpm exec vitest run src/lib/social-publishing src/lib/content-studio src/lib/ai-engine ; echo "EXIT=$?"
```

### VÉRIFICATION INDÉPENDANTE
- Le réfuteur **réintroduit** un appel à un endpoint synchrone faux Higgsfield (`/v1/videos/generate`) dans le code et vérifie qu'**au moins un contract-test passe au rouge**. S'il reste vert → falsification réussie (le contrat ne mord pas) → CORRECTION.
- Le réfuteur ajoute un `fetch('https://exemple-non-declare')` dans un test et confirme l'échec `onUnhandledRequest:'error'`.
- Le réfuteur confirme que le test de parité dry_run↔live partage **les mêmes assertions** (diff des assertions = ∅), sinon ce n'est pas de la parité.

### CRITÈRE DE PASSAGE
Tout `fetch` non déclaré échoue ; un faux endpoint synchrone rend un test rouge ; ≥1 test de parité dry_run↔live passe **à l'identique** sur le même contrat.

---

## ÉTAPE 0.F — Smoke « parcours opérateur » en CI (mock), assertant l'effet backend (T-010)

**Findings** : BUG-047, BUG-046, BUG-005, BUG-001.

### CORRECTION
Smoke exécuté à chaque PR (mode mock, session Playwright officielle) couvrant
`idea → variants → generate-visual → approve → publish-draft (dry_run)`, **assertant l'effet backend** :
- asset servi **200**,
- `generation_run` **créé**,
- `social_publish_job` **daté** et statut **transité**.
Câbler dans `ci.yml`. Périmètre vitest **inclut `src/lib/ai-engine/**`**.

### RE-TEST
```bash
cd "$WEB" && pnpm run smoke:content-studio ; echo "EXIT=$?"   # ou la commande câblée dans ci.yml
```

### VÉRIFICATION INDÉPENDANTE
- Le réfuteur **casse** volontairement la route generate-visual (renvoie 500) et confirme que le smoke **échoue** (asset non servi 200). Si le smoke reste vert → il n'asserte pas l'effet backend → CORRECTION.
- Le réfuteur vérifie que la couverture vitest liste désormais les 16 nœuds AI-Engine.

### CRITÈRE DE PASSAGE
Le smoke échoue si l'asset n'est pas servi 200 ou si le job n'est pas créé ; il est vert sur la baseline corrigée.

---

## ÉTAPE 0.G — Garde-fous sécurité (T-020, T-021)

**T-020 — neutraliser le contournement legacy `/postiz-draft`** (BUG-040).
- CORRECTION : renvoyer **`410 Gone`** sur `/api/admin/content-studio/posts/[id]/postiz-draft`, OU router via `resolveDefaultAccount` + respect strict de `SOCIAL_PUBLISHING_MODE`.
- VÉRIF INDÉPENDANTE :
  ```bash
  # AVANT le POST, relever l'état Postiz (read-only)
  curl -s "$POSTIZ_BASE_URL/api/public/v1/integrations" -H "Authorization: $POSTIZ_API_KEY" | python3 -c "import sys,json;print('drafts_before=',len(json.load(sys.stdin)))"
  curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: $COOKIE" -X POST "$BASE/api/admin/content-studio/posts/SOME_ID/postiz-draft"
  # APRÈS : aucun nouveau draft réel sur Postiz (en dry_run) ; OU 410
  ```
- CRITÈRE : `drafts_before == drafts_after` (aucun draft réel créé en staging dry_run), ou `410`.

**T-021 — contrôle d'accès `/_media`** (MISS-010).
- CORRECTION : exiger session/jeton pour servir `.media-storage/ai-engine/*`.
- VÉRIF INDÉPENDANTE :
  ```bash
  curl -s -o /dev/null -w "no-cookie:%{http_code}\n"                "$BASE/_media/ai-engine/subtitles-EXAMPLE.srt"   # attendu 401/403
  curl -s -o /dev/null -w "cookie:%{http_code}\n" -H "Cookie: $COOKIE" "$BASE/_media/ai-engine/subtitles-EXAMPLE.srt"  # attendu 200 (si fichier existe)
  ```
- CRITÈRE : 401/403 sans cookie, 200 avec cookie admin.

### Porte de sortie de PHASE 0 (obligatoire avant PHASE 1)
- [ ] `SUITE_EXIT=0` sur 5 runs (0.B) — [ ] CI rouge sur exit≠0 (0.A) — [ ] 2 E2E verts vraie DB (0.C)
- [ ] OpenAI live exerçable mock+live (0.D) — [ ] MSW global + parité ≥1 (0.E) — [ ] smoke backend (0.F) — [ ] garde-fous (0.G)

---

# PHASE 1 — Les 4 blockers

> Un blocker n'est « fini » que **prouvé bout-en-bout depuis `/admin/content-studio-v2/create`**, jamais via `/api/admin/ai-engine/generate` ni un test vert.

## ÉTAPE 1.A — BUG-001 : Génération image LIVE depuis le flux create (T-101)

**Findings** : BUG-001 (blocker), BUG-006, BUG-007, BUG-028. **Dépend de** : 0.D (T-005).

### CORRECTION
Aligner le routing de `image-generation.ts` pour reconnaître les modèles servis par le picker ; refuser **proprement** (message métier `409`) un modèle non routable au lieu de retomber sur OpenAI clé vide.

### RE-TEST (mock + live)
```bash
# LIVE : générer avec gpt-image-1-mini ET dall-e-3 (génération bornée, 1 chacun)
DRAFT_ID=...   # draft issu de l'idée 0.D
for M in gpt-image-1-mini dall-e-3; do
  curl -s -H "Cookie: $COOKIE; cs_generation_mode=live" -H 'Content-Type: application/json' -X POST \
    "$BASE/api/admin/content-studio/drafts/$DRAFT_ID/generate-visual" -d "{\"model\":\"$M\"}" | python3 -m json.tool | head -20
done
# Modèle non routable → 409 message clair
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: $COOKIE; cs_generation_mode=live" -H 'Content-Type: application/json' -X POST \
  "$BASE/api/admin/content-studio/drafts/$DRAFT_ID/generate-visual" -d '{"model":"modele-bidon-xyz"}'
```

### VÉRIFICATION INDÉPENDANTE
- Le réfuteur récupère l'URL de l'asset live et `curl -I` → **200** + content-type image ; inspecte `generation_run provider=openai succeeded`.
- Le réfuteur confirme que le modèle non routable renvoie **409 au message explicite** (PAS « CONTENT_STUDIO_OPENAI_API_KEY manquant », PAS 500).
- Le réfuteur rejoue en **mock** : l'asset SVG/PNG déterministe est toujours produit (non-régression).

### CRITÈRE DE PASSAGE
Live `gpt-image-1-mini` + `dall-e-3` → asset 200 + run openai ; non routable → 409 explicite ; mock inchangé. Prouvé dans les deux modes.

---

## ÉTAPE 1.B — BUG-002 : Génération Higgsfield LIVE — credential + auth + endpoints async (T-102, T-103)

**Findings** : BUG-002 (blocker), BUG-001 (partie Higgsfield), BUG-008, BUG-009, BUG-025, MISS-009, MISS-019, MISS-022.

### CORRECTION (T-102 : credential + auth)
- Fournir le credential **à deux parties** : `AI_ENGINE_HIGGSFIELD_API_KEY=KEY_ID:KEY_SECRET` (ou paire `_KEY`/`_SECRET`).
- `higgsfieldAuthHeader()` produit `Authorization: Key KEY_ID:KEY_SECRET`, host `platform.higgsfield.ai` (mémoire `higgsfield-api-mismatch`).
- Validation **au boot** : si mono-partie (pas de `:` et pas de `_SECRET`) → **avertissement explicite + badge « non générable »**, jamais un `throw 409` au 1er clic.

### Configurer le mode LIVE de façon SÛRE (Higgsfield)
```bash
# apps/web/.env :
#   AI_ENGINE_HIGGSFIELD_API_KEY=<KEY_ID>:<KEY_SECRET>     # format à deux parties
# (ou la paire séparée _KEY / _SECRET selon l'implémentation retenue)
pm2 restart web && sleep 3
# Probe config (read-only)
curl -s -H "Cookie: $COOKIE" "$BASE/api/admin/ai-engine/config/providers" | python3 -m json.tool | grep -iA2 higgsfield
```

### CORRECTION (T-103 : endpoints async submit+poll)
- Remplacer les endpoints synchrones faux (`/v1/videos/generate`, `/v1/images/generate`) par le pattern **réel async** : `submit /v1/image2video/<model>` (ou `/v1/text2image/<model>`) **+ poll** `/v1/requests/{id}/status`.
- Mapper les IDs natifs du catalogue (`veo3_1`, `kling3_0`…) vers le routeur, router par **`provider==='higgsfield'`** (PAS `startsWith('hf-')`, MISS-022).
- **Sortir** le polling 5 min du handler (job de poll resumable ou borne au timeout runtime réel).

### RE-TEST
```bash
cd "$WEB"
# Contract-test (T-006) doit être ROUGE si un endpoint synchrone est appelé :
pnpm exec vitest run src/lib/content-studio/video-generation.test.ts src/lib/content-studio/image-generation.test.ts ; echo "EXIT=$?"
# Config providers : Higgsfield configured:true
curl -s -H "Cookie: $COOKIE" "$BASE/api/admin/ai-engine/config/providers" | python3 -m json.tool | grep -iA2 higgsfield
```
> **Sécurité** : la génération live destructive Higgsfield **n'est PAS exécutée** dans ce runbook (cf. méthodologie §5). Le critère porte sur **l'auth + la config + le contrat**, pas sur une vidéo réelle.

### VÉRIFICATION INDÉPENDANTE
- Le réfuteur fait un appel **d'auth read-only** (sans génération) et confirme **2xx** (auth conforme). Avec credential mono-partie → **avertissement + badge non générable**, pas un throw au 1er clic.
- Le réfuteur sélectionne `veo3_1` dans le picker et confirme l'absence de `invalid_state 'aucun modèle vidéo live disponible'`.
- Le réfuteur prouve que le handler **ne bloque plus 5 min** (test de timeout). Mock inchangé.

### CRITÈRE DE PASSAGE
`configured:true` + auth 2xx ; contract-test rouge sur endpoint synchrone ; modèle live-découvert routé sans erreur ; handler non bloquant ; mock inchangé.

---

## ÉTAPE 1.C — BUG-003 : Brancher le scheduler de publication programmée (T-103b)

**Findings** : BUG-003 (blocker). **GARDE-FOU CRITIQUE** : l'**activation live** de cette étape exige **T-301 (ÉTAPE 3.A) + T-204 (ÉTAPE 2.D) déjà verts** (sinon doubles publications). Le branchement + test **mock** peut précéder.

### CORRECTION
Appeler `runScheduledPublishJobs({ limit })` depuis `apps/web/src/app/api/cron/tick/route.ts` (déjà déclenché **chaque minute** par `femiglow-staging-cron-tick.timer`). OU créer un systemd timer/crontab POSTant `/api/cron/content-studio/social-publish-scheduler` avec `Bearer CRON_SECRET`. Ajouter aussi l'entrée à `apps/web/vercel.json` (futur Vercel). Ajouter un contrôle CI « toute route `/api/cron/*` a un déclencheur sur la cible de déploiement effective ».

### RE-TEST (mode mock/dry_run, staging)
```bash
# 1) Programmer un post approuvé à T+2 min (dry_run par défaut)
POST_ID=...   # post approuvé
WHEN=$(python3 -c "import datetime;print((datetime.datetime.utcnow()+datetime.timedelta(minutes=2)).isoformat()+'Z')")
curl -s -H "Cookie: $COOKIE" -H 'Content-Type: application/json' -X POST \
  "$BASE/api/admin/content-studio/posts/$POST_ID/schedule" -d "{\"scheduledAt\":\"$WHEN\"}" | python3 -m json.tool

# 2) Observer l'état initial : job queued daté
curl -s -H "Cookie: $COOKIE" "$BASE/api/admin/content-studio/publish-jobs?status=queued" | python3 -m json.tool | head -30

# 3) Laisser le cron tick tourner (minutely). Vérifier après échéance via une boucle d'attente bornée
#    (NE PAS utiliser sleep en avant-plan ; surveiller l'état)
for i in $(seq 1 6); do
  curl -s -H "Cookie: $COOKIE" "$BASE/api/admin/content-studio/publish-jobs?publishMode=schedule" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print([ (j.get('status')) for j in d.get('jobs',d) ][:5])"
  systemctl start femiglow-staging-cron-tick.service   # déclenche un tick immédiat (sinon attendre la minute)
done
```

### VÉRIFICATION INDÉPENDANTE
- Le réfuteur confirme la transition réelle `queued → publishing → published` (dry_run) et qu'un `social_publish_job` **daté** apparaît. **Baseline = 0 job schedule exécuté** ; après correction `GET /publish-jobs?publishMode=schedule` montre **≥1** job exécuté.
- Le réfuteur exécute le contrôle CI : `grep -rn "social-publish-scheduler\|runScheduledPublishJobs" src/app/api/cron/` prouve que le scheduler est **réellement fan-out** par un cron vivant.
- **Garde-fou** : le réfuteur refuse de valider l'**activation live** tant que 3.A et 2.D ne sont pas verts.

### CRITÈRE DE PASSAGE
Un post programmé à T+2 min transite jusqu'à `published` (dry_run) ; ≥1 job schedule exécuté. Activation live **bloquée** jusqu'à T-301 + T-204.

---

## ÉTAPE 1.D — BUG-004 : Bridge média A→B (remonter composition/exports/thumbnails) (T-104)

**Findings** : BUG-004 (blocker), MISS-005, BUG-034, BUG-033.

### CORRECTION
1. **Pré-requis structurel MISS-005** : étendre `GenerationResult` + `buildResultFromState` (`orchestrator.ts:109-131`) pour propager `voiceover`, `music`, `subtitles`, `composition`, `exports`, `thumbnails` (présents dans le `finalState` interne mais jamais remontés). **Sans cette remontée, le bridge lit `undefined`.**
2. Étendre `content-studio-bridge.ts` pour **persister** ces assets en table `media` (mapping `assetId` AI-Engine → row `media`) ; lier la vidéo composée/exportée comme **asset primaire**.
3. Étendre `GenerationResult.tsx` (`GenerationResultData`, `normalizeResultData`) : rendu lecteur audio / lien SRT / vidéo composée.

### RE-TEST (mock)
```bash
# Lancer un job AI-Engine format reel via le pont opérateur (mock), puis vérifier l'asset persisté
curl -s -H "Cookie: $COOKIE" -H 'Content-Type: application/json' -X POST "$BASE/api/admin/ai-engine/generate" \
  -d '{"format":"reel","tone":"<ton valide>", ...}' | python3 -m json.tool | head -60
# Vérifier la présence des clés composition/exports/thumbnails dans la réponse (absentes en baseline)
```

### VÉRIFICATION INDÉPENDANTE
- Le réfuteur inspecte la réponse API : présence des clés `composition`/`exports`/`thumbnails` (en baseline : **absentes**, BUG-004). Si absentes → falsification.
- Le réfuteur ouvre la **bibliothèque média** : le draft créé possède une **row `media`** dont le fichier est **servi 200** (pas un stub <100 octets). L'UI rend la composition.
- En **live**, dépend de 1.A/1.B (documenté comme tel).

### CRITÈRE DE PASSAGE
Un job AI-Engine (reel) → composition propagée → bridge → draft avec asset média réel (row `media`, fichier 200) visible et rendu dans l'UI. Vérifié en mock.

### Porte de sortie PHASE 1
- [ ] 1.A image live mock+live — [ ] 1.B Higgsfield auth/config/contrat — [ ] 1.C scheduler (mock, live gardé) — [ ] 1.D bridge média mock

---

# PHASE 2 — Criticals

## ÉTAPE 2.A — BUG-005 : Texte opérateur réellement LLM (T-201)
- CORRECTION : `generation.ts` via `resolveApiKey('openai')` (suite 0.D) ; `ideas/[id]/generate/route.ts` **lit le cookie `cs_generation_mode`** ; live sans clé → `throw invalid_state` explicite (jamais dégradation silencieuse en template) ; **persister/honorer le `model` choisi** dans le `generation_run` (MISS-012).
- RE-TEST : rejouer 0.D étapes 2-4 ; comparer mock vs live.
- VÉRIF INDÉPENDANTE : le réfuteur prouve que **les deux runs diffèrent** (texte live ≠ template figé) et que `provider=openai model=<choisi>`. MISS-001 fermé : le cookie a un **effet** sur le texte (si même texte mock/live → falsification).
- CRITÈRE : live → variantes LLM `provider=openai model=<choisi> succeeded` ; mock → déterministe assumé ; toggle change réellement le comportement.

## ÉTAPE 2.B — BUG-006/007 : Picker honnête (badges « Live ») (T-202)
- CORRECTION : `materialiseDiscoveredModel` **propage `r.source`** (`fallback`/`cache`/`live`) au lieu de forcer `live` (BUG-024) ; ne badger « Live » qu'un modèle dont la clé est **réellement lue** par le chemin de génération ; liste blanche par rôle (exclure whisper-1/STT, davinci/babbage de `role=chat` — MISS-018 ; exclure non routables de image/video) ; désactiver `allowCustom` non validé (MISS-015) ; ne plus auto-sélectionner un suggested live au montage (MISS-002) ; court-circuiter le host Higgsfield mort (MISS-019).
- RE-TEST :
  ```bash
  curl -s -H "Cookie: $COOKIE" "$BASE/api/admin/content-studio/models?role=image" | python3 -c "import sys,json;d=json.load(sys.stdin);print([(m['id'],m.get('source')) for m in d.get('models',d)])"
  curl -s -H "Cookie: $COOKIE" "$BASE/api/admin/content-studio/models?role=chat"  | python3 -c "import sys,json;d=json.load(sys.stdin);print([m['id'] for m in d.get('models',d)])"
  ```
- VÉRIF INDÉPENDANTE : le réfuteur confirme que `role=image` ne renvoie `source:'live'` **que** pour les générables ; un Higgsfield issu du fallback porte `source:'fallback'` ; `role=chat` **sans** whisper-1 ni davinci-002 ; **sélectionner un modèle badgé Live et générer réussit** (ne throw plus).
- CRITÈRE : badges Live honnêtes, prouvé par probe + smoke.

## ÉTAPE 2.C — BUG-014 : Enum `tone` (UI ↔ parse-brief) (T-203)
- CORRECTION : aligner l'enum `tone` entre `ai-engine/create/page.tsx` (TONES), le DTO `generate/route.ts` et `parse-brief.ts` ; valider au DTO.
- RE-TEST :
  ```bash
  for T in $(echo ton1 ton2 ton3 ton4 ton5 ton6); do
    curl -s -o /dev/null -w "$T:%{http_code}\n" -H "Cookie: $COOKIE" -H 'Content-Type: application/json' -X POST \
      "$BASE/api/admin/ai-engine/generate" -d "{\"tone\":\"$T\", ...}"
  done
  ```
- VÉRIF INDÉPENDANTE : chaque ton de l'UI → `status ≠ failed/invalid_enum_value` ; un ton hors-liste → rejet DTO message clair.
- CRITÈRE : tous les tons UI acceptés ; hors-liste rejeté proprement.

## ÉTAPE 2.D — Idempotence / anti-double-publication (T-204) — **GARDE-FOU de 1.C live**
- Findings : MISS-006, MISS-028.
- CORRECTION : clé d'idempotence **indépendante du `scheduledAt`** (par post+compte, mutée en place) ; avant tout `publish-now`/`schedule`, invalider/réutiliser le job `queued` existant ; `reschedule` **mute** le job existant.
- RE-TEST (mock, scheduler actif) : publish-now sur un post déjà programmé ; reschedule deux fois.
- VÉRIF INDÉPENDANTE : le réfuteur compte les `social_publish_job` : **un seul** envoi après publish-now ; **un seul** job `queued` après double reschedule. Si 2 jobs → falsification.
- CRITÈRE : jamais plus d'un envoi/job par post+compte. **Vert obligatoire avant activation live de 1.C.**

---

# PHASE 3 — Majors

| Étape | Tâche | Findings | Critère de passage (prouvé par probe) | Vérif indépendante |
|---|---|---|---|---|
| 3.A | **T-301** sync `content_post`↔job sur cancel/reschedule (**garde-fou 1.C live**) | BUG-038 | annuler un post programmé → job `cancelled` ; scheduler actif → post annulé **jamais** publié | réfuteur annule puis force un tick : aucun `published` |
| 3.B | T-302 retry auto jobs `failed` retryables | F7, BUG-038 | 5xx transitoire simulé → repris → `published` ; après N échecs → `failed` + `lastError` visible UI | réfuteur injecte 5xx puis 200, compte les tentatives |
| 3.C | **T-303** sélection explicite compte Postiz en live | BUG-039 | publish sans `accountId` + >1 compte → **409 invalid_state** ; avec `accountId` → ciblé | réfuteur retire `accountId` → doit voir 409, jamais un compte deviné |
| 3.D | T-304 fallbacks audibles (jamais de faux succès) | MISS-020/026/011/021, BUG-022/049/050 | échec variantes → **toast erreur** ; job média manquant → `failed/degraded` (plus `quality 0.91`) ; aucun `<video src=''>` | réfuteur provoque un échec et vérifie qu'il **remonte** à l'opérateur |
| 3.E | T-305 variation de draft régénère le texte | BUG-017 | `/drafts/<id>/variation {promptOverride}` → caption/hook **≠** parent | réfuteur diff parent/variante : si identiques → falsification |
| 3.F | T-306 isoler stockage tests + purger stubs | BUG-031, MISS-004/024/032, BUG-035 | `vitest run` n'écrit **rien** dans `.media-storage/ai-engine` ; `find … -size -100c \| wc -l` = 0 | réfuteur lance la suite et `find` les stubs ; toute row `media`→fichier <100o = échec |
| 3.G | T-307 tests d'intégration média réels (ffmpeg/sharp) | BUG-035/036, MISS-025/026/027 | compose → MP4 dont `ffprobe` confirme durée/codec + piste sous-titre si SRT ; aucun artefact 10-14 octets | réfuteur `ffprobe`/`file` sur la sortie réelle |
| 3.H | T-308 dry_run honnête (permaliens dérivés du mode) | BUG-045/065, MISS-029 | dry_run → `metadata.dryRun=true` ; live → `false` ; `/publishability` non stale | réfuteur compare contrat dry_run↔Postiz (même shape) |
| 3.I | T-309 re-gen idée `generated` → 409 métier | BUG-051 | re-POST `/ideas/<id>/generate` sur idée `generated` → **409** clair (pas 500) | réfuteur rejoue, exige 409 |

> **Ordre de PHASE 3** : 3.A (T-301) **avant** l'activation live de 1.C. 3.F (T-306) avant 3.G (T-307). 3.D (T-304) après 1.D.

---

# PHASE 4 — Dette / minors / info

| Étape | Tâche | Findings | Critère de passage |
|---|---|---|---|
| 4.A | T-410 invalidation des caches process sur changement env | MISS-030/033, BUG-043 | changer la clé puis ré-interroger `/models` reflète l'état réel < TTL documenté ; aucun `source:'live'` servi depuis cache après disparition de la clé |
| 4.B | T-411 `MEDIA_DIR` absolu indépendant du cwd | MISS-024/032 | node média lancé depuis un cwd ≠ `apps/web` écrit/serve au bon emplacement |
| 4.C | T-412 taxonomies objectifs/piliers + libellés humains | BUG-052, MISS-014 | chaque combinaison pillar×objective×format → texte adapté ; aucun label brut à tirets |
| 4.D | T-413 cohérence du toggle de mode (3 sources) | BUG-021, MISS-016/017/034 | toggle=badge=comportement serveur ; sans cookie respecte `CONTENT_STUDIO_V2_MOCK_MODE` |
| 4.E | T-414 `formatError` ne masque pas le message serveur | BUG-054 | approuver draft sans média → message serveur précis (pas « État de draft invalide ») |
| 4.F | T-415 garde `kind=video` sur formats non-vidéo | MISS-023 | `kind=video` désactivé sur post/carousel ; POST forcé → message clair (pas 500) |

Chaque étape PHASE 4 suit la même boucle CORRECTION → RE-TEST → VÉRIF INDÉPENDANTE (probe ciblé), avec réfuteur cherchant le faux positif.

---

# PHASE 5 — Harnais de parité MOCK/LIVE & DÉFINITION DE FIN

## 5.1 Lancer le harnais de parité (mock ↔ live)

```bash
cd "$WEB"
# (a) Tests de contrat + parité (issus de 0.E / T-006) : doublures suivent le contrat réel
pnpm exec vitest run src/test/contract src/lib/social-publishing src/lib/content-studio src/lib/ai-engine ; echo "EXIT=$?"

# (b) Smoke opérateur en MOCK (effet backend assuré — 0.F)
CONTENT_STUDIO_V2_MOCK_MODE=true PLAYWRIGHT_BASE_URL=$BASE pnpm exec playwright test e2e/content-studio-v2 e2e/content-studio-social-publishing-draft.spec.ts ; echo "MOCK_EXIT=$?"

# (c) Même smoke opérateur en LIVE (OpenAI débloqué 0.D ; Higgsfield config 1.B ; publication dry_run)
#     -> DOIT passer À L'IDENTIQUE (mêmes assertions orientées effet backend)
CONTENT_STUDIO_V2_MOCK_MODE=false PLAYWRIGHT_BASE_URL=$BASE pnpm exec playwright test e2e/content-studio-v2 e2e/content-studio-social-publishing-draft.spec.ts ; echo "LIVE_EXIT=$?"
```

## 5.2 Fermer définitivement l'EXIT 1

```bash
cd "$WEB"
for i in 1 2 3 4 5; do pnpm exec vitest run src/lib/content-studio src/lib/social-publishing src/lib/ai-engine src/components/admin/content-studio-v2 >/dev/null 2>&1; echo "run$i EXIT=$?"; done
# Critère : 5/5 runs EXIT=0, ligne "Errors 0". Le gate CI échoue sur tout exit≠0 (0.A).
```

## 5.3 Vérification indépendante GLOBALE (réfuteur final)

Le réfuteur final, qui n'a écrit aucun correctif, doit **échouer à falsifier** chacun de ces points :
1. Couper la clé OpenAI (vider `OPENAI_API_KEY`) + restart → le live **échoue proprement** (`invalid_state` explicite), il ne **dégrade pas silencieusement** en template (BUG-005) et le picker **n'affiche plus** ces modèles « Live » (BUG-007).
2. Programmer un post à T+2 min puis l'**annuler** → il n'est **jamais** publié (T-301) ; le re-programmer deux fois → **un seul** job (T-204).
3. Casser une route de génération (500) → le **smoke échoue** (pas de faux vert, T-010).
4. Le smoke opérateur passe **à l'identique** en `MOCK_EXIT` et `LIVE_EXIT` (mêmes assertions backend). Si un mode passe et l'autre non → la parité n'est pas atteinte → **non clos**.
5. `git grep` : plus aucun endpoint Higgsfield synchrone faux ; plus aucune lecture de clé sans fallback dans le chemin de génération ; toute route `/api/cron/*` a un déclencheur vivant.

## 5.4 DÉFINITION DE FIN GLOBALE (DoD — méthodologie §4, non négociable)

> **Système 100 % fonctionnel, prouvé par des tests orientés opérateur qui passent À L'IDENTIQUE en mode MOCK ET en mode LIVE.**

Conditions cumulatives, toutes prouvées par **exécution réelle** (jamais « fait ») :

- [ ] **Vérité** : suite vitest `EXIT=0` sur 5 runs ; CI échoue sur tout `exit≠0` / `Errors N` (BUG-010 fermé). MSW global `onUnhandledRequest:'error'` ; ≥1 test de parité dry_run↔live aux **mêmes assertions** (T-006).
- [ ] **Génération** : depuis `/admin/content-studio-v2/create`, texte + image produisent un résultat réel **en mock ET en live** (OpenAI débloqué) ; Higgsfield `configured:true` + auth conforme + endpoints async (génération live destructive non exécutée, documentée comme telle) ; picker n'annonce « Live » que le **réellement générable**.
- [ ] **Publication** : un post programmé transite jusqu'à `published` (dry_run) via un cron **vivant** (BUG-003 fermé) ; aucune double-publication (T-204) ; cancel/reschedule synchronisés (T-301) ; activation live **seulement** après ces garde-fous, avec compte Postiz explicite (T-303).
- [ ] **Montage** : composition/voix-off/musique/sous-titres/exports **atteignables** depuis le flux opérateur (bridge A→B, BUG-004 fermé) ; compose réel prouvé par `ffprobe` (T-307).
- [ ] **Parité** : le **même** smoke orienté opérateur passe **identiquement** en MOCK et en LIVE (`MOCK_EXIT == LIVE_EXIT == 0`).

> **Tant qu'un chemin n'est pas prouvé dans les DEUX modes, il reste `broken by default`.** Le live destructif de génération Higgsfield et le live réel de publication Postiz (comptes clients) restent hors périmètre de preuve automatisée et sont documentés comme limites (méthodologie §5), validés par config + contrat + auth read-only.

---

## Annexe — Index tâches → étapes → findings

| Étape | Tâche | Findings principaux |
|---|---|---|
| 0.A | T-001 | BUG-010, 027, 032 |
| 0.B | T-002 | BUG-010, 027, 032 |
| 0.C | T-003 | BUG-023, 029, 042, 055, 064 |
| 0.D | T-005 | BUG-001(openai), 005, 006, 007 ; MISS-003/007/013 |
| 0.E | T-006 | BUG-041, 045, 046, 037, 011, 018 ; MISS-008/009 |
| 0.F | T-010 | BUG-047, 046, 005, 001 |
| 0.G | T-020, T-021 | BUG-040 ; MISS-010 |
| 1.A | T-101 | BUG-001, 006, 007, 028 |
| 1.B | T-102, T-103 | BUG-002, 001(hf), 008, 009, 025 ; MISS-009/019/022 |
| 1.C | T-103b | BUG-003 |
| 1.D | T-104 | BUG-004, 034, 033 ; MISS-005 |
| 2.A | T-201 | BUG-005, 020 ; MISS-001/012/013 |
| 2.B | T-202 | BUG-006, 007, 024, 019, 043, 016 ; MISS-002/015/018/019 |
| 2.C | T-203 | BUG-014 |
| 2.D | T-204 | MISS-006/028 |
| 3.A–3.I | T-301..T-309 | BUG-038, F7, BUG-039, MISS-020/026/011/021, BUG-022/049/050, BUG-017, BUG-031/035/036, BUG-045/065, BUG-051 |
| 4.A–4.F | T-410..T-415 | MISS-030/033, BUG-043/052/021/054 ; MISS-014/016/017/023/024/032/034 |
