# 04 — Tests : résultats réels, qualité, trous de couverture, CI

**Exécution réelle le 2026-06-10** sur master `c55add4b` (vitest, mode mémoire — log `[db] Aucune connexion DATABASE_URL`). Leçon historique du projet appliquée : on rapporte le **code de sortie**, pas seulement le compte de passes (une suite a déjà affiché « 1695 passed » en sortant EXIT 1).

## 1. Résultats d'exécution

| Run | Périmètre | Résultat | EXIT |
|---|---|---|---|
| 1 | `src/lib/content-studio` + `src/lib/social-publishing` + `src/components/admin/content-studio-v2` + `src/lib/content-studio-v2` | **41 fichiers, 413 tests, 100 % pass** (30 s) | **0** |
| 2 | `src/app/api/admin/content-studio` (routes) | **4 fichiers, 15 tests, 100 % pass** (4 s) | **0** |

Total périmètre studio : **45 fichiers, 428 tests verts, EXIT 0** (vérifié via `PIPESTATUS`). Aucune unhandled rejection. Point de lenteur : `service.approval.test.ts` = 18 s à lui seul (optimisation image réelle via sharp).

Répartition : content-studio 14 fichiers · social-publishing 14 · content-studio-v2 (lib) 5 · composants v2 8 · routes API 4 (`ideas`, `publish-now`, `draft-on-provider`, `postiz-draft`).

## 2. Couverture par domaine

| Domaine | Vitest | E2E | Verdict |
|---|---|---|---|
| Génération texte (OpenAI) | ❌ `generation.ts` importé par **aucun** test | ✅ `content-studio.spec.ts:94` (3 drafts, 200) | **Trou critique** — 429/5xx/JSON malformé jamais testés ; le live OpenAI a déjà cassé silencieusement dans l'histoire du projet |
| Génération image | ⚠️ 1 seul test, provider `mock` | ✅ visuel mock | Branche OpenAI live non testée |
| Génération vidéo | ⚠️ `platform-caps.test.ts` seulement | ❌ | **Payload vidéo jamais asserté** dans publish/adapter (tests adapter = images .webp uniquement) |
| Approve / reject | ✅ `service.approval.test.ts` (auto-bind, gate, chaîne complète) | ✅ `approval-gate.spec.ts` (409) | Bon ; routes `reject`, `variation`, `review(s)` sans test |
| Publish dry_run | ✅ `publish-now/route.test.ts` (idempotence, 401) | ✅ avec **assertions Postgres réelles** | Solide |
| Publish live (Postiz réel) | ❌ | ❌ (`live-publishing.spec.ts` ne publie rien malgré son nom) | **Trou critique** |
| Draft Postiz | ✅ adapter + MSW wire-format + route | ✅ assertion DB `publishMode='draft'` | Le mieux couvert |
| Schedule / reschedule / cancel | ✅ schedule + cancel de job ; ❌ routes `reschedule`, `posts/[id]/cancel` | ❌ | Partiel |
| Publish-jobs | ✅ list/get/cancel ; ❌ **route `retry` : aucun test** | ❌ | Partiel |
| Worker / scheduler | ✅ `worker.test.ts` (lock, limite, ordre) ; ❌ handler cron | e2e = 401 only | Logique OK, handler non |
| Adapter/client Postiz | ✅ excellent : 401/403/409/422/429/503 → codes + `retryable`, redaction | — | Référence du repo |
| Budget | ❌ **le test valide une COPIE** de la logique (fonction redéclarée dans le fichier de test, `budget.test.ts:15-27`) — `budget.ts` réel jamais importé | UI seulement | **Auto-validant** |
| Automation / retry-policy / digest / alerts | ✅ lib bien testée (backoff, dead-letter) | ❌ | OK niveau lib |
| UI v2 | ✅ lib state/library ; ❌ composants du flux create→publish | ⚠️ `shell.spec.ts` = nav/thème/⌘K seulement | Shell only |

## 3. Qualité des tests

**Forces**
- **Aucun `vi.stubGlobal(fetch)` dans le périmètre** : adapters testés par injection de dépendances, payload réel asserté (`adapters/postiz.test.ts:94-100`).
- Vrai test d'intégration MSW : `draft.integration.test.ts:70-92` exerce les helpers HTTP réels contre MSW et capture le body wire (`type:'draft'`).
- Effets réels assertés : `publish-now/route.test.ts` construit un post via le vrai pipeline (idea→brief→draft→media→approve) et vérifie l'état persistant (job `published`, idempotence 2 appels = 1 job, audit events). Les e2e social-publishing assertent directement les lignes Postgres (`social_publish_job`, `social_publication`).
- Erreurs provider très bien couvertes côté adapter Postiz (8 codes HTTP mappés).

**Faiblesses**
- `budget.test.ts` auto-validant (voir tableau) ; `service.test.ts` mal nommé (ne teste que `state-machine.ts`, doublon) ; `src/test/msw/content-studio-handlers.test.ts` teste les mocks eux-mêmes.
- Tout tourne sur le store mémoire : les divergences SQL réelles (ex. le bug `desc()` dans le WHERE, `repository.ts:669`) sont **invisibles** hors e2e — et précisément les e2e DB-assertives ne tournent pas en CI.

## 4. E2E Playwright (inventaire — non exécutés : aucun serveur ne tourne)

| Spec | Couvre | Ne couvre pas |
|---|---|---|
| `content-studio.spec.ts` (207 l) — **seule spec studio en CI** | Onglets, idée persistée après reload, génération 3 drafts, visuel mock, résilience API 500/401 | Approve, schedule, publish depuis l'UI |
| `content-studio-approval-gate.spec.ts` | Auto-bind visuel→approve ; gate 409 + message UI | — |
| `content-studio-social-publishing.spec.ts` | Seed SQL → publish-now dry_run via UI → **assertions Postgres** | Postiz réel, vidéo, schedule UI |
| `content-studio-social-publishing-draft.spec.ts` | Mode brouillon Postiz, assertion DB `publishMode='draft'` | Appel Postiz réel |
| `content-studio-v2/shell.spec.ts` | Nav sidebar, thème, breadcrumb, ⌘K | **Tout le flow Create/Plan/Library v2** |
| `live-publishing.spec.ts` | Dashboards health, crons → 401 | **Aucune publication live** ; skip silencieux si non-auth |
| `cron-tick.spec.ts` | 401 sans/avec mauvais bearer | Exécution authentifiée (aucune assertion sur le travail) |

Sur la branche backup uniquement : `content-studio-v2/media-studio-tracks.spec.ts` (golden path voix-off/sous-titres/compose, 3 passed le 30/05 contre staging vivant), `social-publishing/video-publish-end-to-end.spec.ts`, ~40 specs `ai-engine-*.spec.ts`, 19 tests de contrat API.

## 5. CI (`.github/workflows/ci.yml`)

- ✅ `pnpm -r typecheck` (`tsc --noEmit`) **gaté** (job quality, l.38) — la recommandation issue de l'incident « build surfaçait des erreurs que vitest ne voit pas » a été appliquée.
- ✅ `pnpm -r test` complet gaté (l.41) — tout le périmètre vitest studio passe en CI.
- ⚠️ Step redondant « Content Studio unit tests » (l.52) : scope v1 obsolète (n'inclut ni social-publishing ni v2).
- ❌ E2E : **seul `content-studio.spec.ts`** tourne en CI (l.122). `approval-gate`, les 2 specs social-publishing (les seules à vérifier Postgres), `shell v2`, `live-publishing`, `cron-tick` ne tournent **jamais** → rot garanti.

## 6. Top 10 des trous les plus risqués

1. `generation.ts` (texte OpenAI) : **zéro test** — cœur du studio.
2. `budget.ts` réel non testé (copie dans le test) — le garde-fou de coût peut régresser sans signal.
3. Mode live de publication jamais testé — la bascule dry_run→live est le changement le plus risqué du système.
4. `publish-jobs/[id]/retry` : aucun test — chemin de récupération manuelle des échecs.
5. Payload vidéo (reel mp4) jamais asserté dans publish-now/adapter.
6. 7 routes `api/cron/content-studio/*` non testées au niveau handler (auth, locking, limites).
7. Routes de curation sans test : `reject`, `variation`, `review`/`reviews`, `archive`.
8. `posts/[id]/reschedule` et `posts/[id]/cancel` sans test — précisément là où vit le bug bloquant « cancel ne purge pas les jobs ».
9. E2E DB-assertives hors CI — peuvent casser sans bloquer un merge.
10. Routes annexes orphelines : `campaigns`, `briefs/[id]`, `generation-runs`, `learning-notes`, `media`, `utm`, `health`, `postiz/integrations/sync`, `ideas/[id]/archive`.
