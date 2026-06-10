# 08 — Le delta `master` ↔ `backup-staging-2026-06-01`

Base commune `6e23d4f4` (2026-05-22). **77 commits** uniquement sur backup, **146** uniquement sur master. Delta backup vs base : **1 200 fichiers, +209 464 / −622 lignes** (quasi intégralement additif). Sur les seuls chemins studio : **236 fichiers, +39 215 / −255**.

## 1. Les 77 commits par thème

| Thème | ~Commits | Contenu clé |
|---|---|---|
| AI-Engine LangGraph | 12 | MVP → V1 (RAG, trends, config) → V2 (Postiz publish, jobs) → HITL checkpointing + graph viewer ; bridge Content Studio ; durcissement `state.errors`, transcode degraded |
| Média P0→P4 (BUG-004) | 8 | Plan → P0 backbone (DTO+bridge+repo+**migrations 0064/0065**) → P1 voix-off → P2 sous-titres → P3 compose → P4 **MediaStudioTracks UI** → e2e golden path → VO éditable |
| Plan d'action audit (ACT-*/BUG-*) | ~16 | **Déblocage OpenAI live image** (`83e55146`, credential unifiée), picker honnête, fixes publish dry_run, capabilities, upload 400, gardes 409/regen |
| Batteries de tests ai-engine | ~14 | 678 tests unit, 622 unit + 27 E2E, contrats API, perf, sécurité |
| Migration MSW (ARC-004) | 11 | fetch-stubs → MSW sur ai-engine/content-studio/social-publishing |
| Tests + bugfixes v2 | 10 | 433 Vitest + 52 E2E, 7 bugs preview, 4 bugs produit |
| UI Config / sidebar / CRUD | 5 | dont fix du lien 404 |
| Build/consolidation | 4 | dont consolidation WIP `5730b514` et merge `deecc53e` |
| Ops | 1 | `media-optimize-tick.sh` (le script du cron 03:15) |

## 2. Ce qui existe UNIQUEMENT sur backup (perdu si la branche disparaît)

- **Tout `apps/web/src/lib/ai-engine/`** (~240 fichiers : graph, 16 nœuds, providers anthropic/openai/google/higgsfield, knowledge RAG, trends, jobs, subtitles/SRT, orchestrator) + `schema-ai-engine.ts`
- ~25 routes `app/api/admin/ai-engine/**` + pages admin `content-studio-v2/ai-engine/**` (dashboard, create, config, knowledge, graph, analytics, trends)
- Routes drafts `compose | generate-subtitles | generate-voiceover | subtitles | voiceover-script`
- `components/.../media/VideoPlayer.tsx` (+ test) — le player vidéo avec contrôles du plan « ergonomie vidéo » : **il existe, sur backup**
- `components/.../create/MediaStudioTracks.tsx` (+ test)
- `e2e/content-studio-v2/media-studio-tracks.spec.ts`, `e2e/social-publishing/video-publish-end-to-end.spec.ts`, ~40 specs `ai-engine-*.spec.ts`, 19 tests de contrat API
- `lib/content-studio` côté backup : `video-generation.ts` (+265 l.), `provider-credentials.ts`, `higgsfield-auth.ts`, `pricing.ts`, `service.ts` +808 l.
- **Les sources SQL des migrations 0063/0064/0065** (déjà appliquées à la DB staging — sans la branche, la base resterait altérée sans aucune trace dans le repo)
- `apps/web/scripts/media-optimize-tick.sh` (le crontab actif pointe dessus — échoue chaque nuit depuis le 02/06)
- Fixes hors-studio : recalcul capabilities publish, garde-fou dry_run legacy, `metadata.dryRun` dérivé de l'adapter, 400 propre sur upload non-multipart, stabilisation de 163 specs Playwright

## 3. Dérive base de données (vérifiée le 2026-06-10 — voir `01-etat-des-lieux.md` §3)

La DB staging porte les migrations du backup : enum `media_kind` avec `subtitles`, colonne `meta_json`, et surtout le **backfill `role` : 63 `primary_image` + 47 `primary_video`, zéro `primary`** — alors que le code master requête `role === 'primary'` (`repository.ts:453,465,509,522`). **Régression active** : relancer master sur cette base = tous les assets invisibles + nouveaux bindings en `primary` = état mixte.

## 4. Coût du merge backup→master : FAIBLE (mesuré)

`git merge-tree --write-tree master backup-staging-2026-06-01` → **5 conflits de contenu seulement, aucun dans le code applicatif studio** :

1. `.github/workflows/ci.yml` (les deux ont étendu la CI)
2. `apps/web/.env.example` (vars ajoutées des deux côtés)
3. `apps/web/drizzle/migrations/meta/_journal.json` (à reconstruire : insérer 0063-0065 avant 0073-0078 — pas de collision de numéros)
4. `apps/web/src/test/msw/openai-handlers.ts`
5. `apps/web/vitest.setup.ts`

Tout `lib/ai-engine`, pages, routes API, e2e auto-mergent (additifs) ; `schema.ts`, `package.json`, `pnpm-lock.yaml`, `env.ts` auto-mergent aussi. **Le vrai coût n'est pas le merge mais la revalidation** : build TS, suites complètes, cohérence drizzle↔DB, et la ré-application des 146 commits master (tracking/chat/i18n) sur le comportement du studio (à priori orthogonaux).

## 5. Recommandations immédiates (indépendantes de toute autre décision)

1. **Pousser `backup-staging-2026-06-01` sur origin** — c'est aujourd'hui un point de défaillance unique (la branche n'existe que sur ce disque). ⚠️ Nécessite l'accord explicite du propriétaire (règle du projet : pas de push sans OK).
2. Restaurer `apps/web/scripts/media-optimize-tick.sh` dans le working tree (`git checkout backup-staging-2026-06-01 -- apps/web/scripts/media-optimize-tick.sh`) ou retirer l'entrée crontab.
3. Trancher le merge backup→master **avant** tout redémarrage de l'app staging (sinon régression assets immédiate, cf. §3).
