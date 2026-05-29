# Périmètre de l'audit

## Dans le périmètre (in-scope)

L'audit couvre **toute la fonctionnalité de génération + publication de contenu média**, du déclenchement UI jusqu'au post publié via Postiz.

### Pipelines de génération (les deux)
- **(A) AI-Engine LangGraph** — `src/lib/ai-engine/**` (16 nœuds : `parse-brief`, `enrich-knowledge`, `enrich-trends`, `generate-script`, `generate-caption`, `generate-variants`, `generate-images`, `generate-video`, `generate-voiceover`, `generate-music`, `generate-subtitles`, `compose`, `transcode-export`, `moderate`, `quality-check`, `human-review`), graphe (`graph/builder.ts`, `routing.ts`, `state.ts`), bridge (`bridge/content-studio-bridge.ts`), config & providers, RAG/knowledge (pgvector). Pages `/admin/content-studio-v2/ai-engine/*`, API `/api/admin/ai-engine/*`.
- **(B) Content-Studio create flow** — `src/lib/content-studio/{image-generation,video-generation,generation,service,higgsfield-auth}.ts`. UI `src/components/admin/content-studio-v2/create/*`. API `/api/admin/content-studio/*` (ideas, drafts, generate-visual, variation, posts, media…).

### Briques média (domaines)
`generation-image`, `generation-video`, `voix-off` (voiceover + music + subtitles), `copywriting` (texte/script/caption/variants), `montage-composition` (compose + transcode-export + crop/trim), `publication-postiz`.

### Publication
`src/lib/social-publishing/**` (service, worker, repository, state-machine, retry, alerts, adapters `dry-run`/`postiz`, `admin-service`), routes `posts/[id]/{publish-now,postiz-draft,schedule,reschedule,cancel,publishability,draft-on-provider}`, `publish-jobs/*`, crons `social-publish-scheduler`, `postiz-sync`, `retry-deliveries`, `weekly-failure-digest`, `import-*`. UI `PublishActionGroup`, `SocialPublishingPanel`.

### Transverse
- Parcours opérateur UI complet (`/admin/content-studio-v2/create`) et désynchronisation UI/état réel.
- Infrastructure de test & mocks (vitest, Playwright, fixtures, MSW, dry-run adapter) — **source du décalage test↔réalité**.
- Mode MOCK vs LIVE : cookie `cs_generation_mode`, env `CONTENT_STUDIO_V2_MOCK_MODE`, `SOCIAL_PUBLISHING_MODE`.

## Hors périmètre (out-of-scope)

- Site marketing public, checkout/funnel, catalogue produits, villes de livraison.
- Assistant chat (sauf là où il partage les clés OpenAI / l'infra d'embeddings).
- Tracking/GTM/pixels, emailing, pages légales, analytics-insights (sauf ingestion de performance des posts publiés, mentionnée pour mémoire).
- Authentification admin / iron-session (utilisée mais non auditée en tant que telle).

## Surface mesurée

| Élément | Compte |
|---|---|
| Fichiers source (non-test) `content-studio*`/`social-publishing`/`ai-engine` | 309 |
| Tests unitaires (`*.test.ts(x)`) du périmètre | 202 |
| Specs E2E Playwright (total repo) | 162 |
| Nœuds du graphe AI-Engine | 16 |
| Routes API `content-studio` + `ai-engine` | ~60 |
| Tables DB social-publishing | 6 |
| Crons content-studio | 7 |

## Environnement

Next.js 14 App Router · PM2 process `web` :8012 (build prod) · proxy LiteSpeed → `staging.femiglow-maroc.com` · PostgreSQL + pgvector · LangGraph 0.2.74 · `@langchain/*` · `msw` 2.14.2 · Drizzle 0.45 · sharp 0.34.5 · ffmpeg/ffprobe présents.
