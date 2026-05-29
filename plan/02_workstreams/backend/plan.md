# Workstream BACKEND — Plan d'action

> FemiGlow Content Studio v2 / AI Engine — pipeline génération + publication.
> Préfixe d'action : **ACT-BE-###**. Statut : **plan de conception** (aucune modification de code applicatif).
> Cible d'architecture : **ADR-0007 Option 1 — converger vers A (LangGraph = moteur unique ; le create-flow B devient une UI au-dessus de A ; pont bidirectionnel)**. Bascule **incrémentale et réversible par flag**.
> Baseline figée : `docs/audit-generation-publication-2026-05-29/`. Routage : `plan/01_coverage/_routing.json`.
> Principe transverse non négociable : **vérité = comportement réel vérifié en MOCK ET LIVE (parité)**. Toute DoD inclut une preuve mock **et** live (chemin opérateur + commande). « Fait » est interdit ; on exige « prouvé en exerçant X en mock ET live ».

---

## 1. Objectifs du workstream

Le workstream backend porte le **cœur fonctionnel** des deux blockers de génération provider (BUG-001 image live, BUG-002 vidéo live), du blocker de publication programmée (BUG-003), et de la dette backend qui empêche que ces correctifs soient *prouvables*. Trois sous-lots :

1. **Providers de génération** — débloquer OpenAI live, réécrire Higgsfield en async submit+poll (image **et** vidéo), câbler/gérer des providers réels vs mock pour voix-off / musique / sous-titres, et rendre le **gating honnête** (jamais de faux succès silencieux : `degraded` + `state.errors`).
2. **Orchestration de la publication** — brancher le scheduler à un **déclencheur réel self-hosted**, garantir **idempotence/dédup indépendante de `scheduledAt`**, **sync d'état** `content_post ↔ social_publish_job`, et neutraliser le contournement legacy `/postiz-draft`. Le scheduler live est **gardé** par l'idempotence + la sync d'état (sinon doubles publications sur de vrais comptes IG clients — le seul risque irréversible).
3. **Hygiène des tests backend** — fermer la fuite fake-timer qui masque un `EXIT 1` (BUG-010), arrêter la pollution du stockage média de prod par les tests, et stabiliser le couplage `cwd`/cache process qui rend le runtime non déterministe.

> **Ce que le workstream NE fait pas** : le harnais MSW global / contract-tests de parité (T-006), la frontière A/B et `resolveProviderCredential()` (architecture), le câblage UI du picker honnête et des affordances (ui-ux/frontend), la migration de schéma DB et la cohérence `content_post`/job côté data (BUG-038/T-301). Ces points sont **référencés en dépendance** mais pilotés ailleurs.

---

## 2. État cible (aligné convergence A)

| Domaine | État actuel (audit) | État cible (post-actions BE) |
|---|---|---|
| **OpenAI image/texte live** | `image-generation.ts`/`generation.ts` lisent **uniquement** `env.CONTENT_STUDIO_OPENAI_API_KEY` (vide) ; `??` ne neutralise pas la chaîne vide → throw 409 avant tout appel réseau (BUG-001/005, MISS-013). | Les deux flux consomment **`resolveProviderCredential('openai')`** (fourni par ACT-ARC, chaîne incluant `OPENAI_API_KEY` déjà valide). Chaîne vide neutralisée par `if (val)`. La génération est faite **dans A** (moteur unique) à terme ; à court terme dans B avec la **même** résolution de clé. |
| **Higgsfield image/vidéo live** | Endpoints **synchrones inventés** (`/v1/images/generate`, `/v1/videos/generate` + poll `/v1/videos/status/:id`) ; credential mono-partie sans secret → `higgsfieldAuthHeader()` null (BUG-002/008/025). | Réécriture **async submit+poll** conforme : `POST /v1/text2image/<model>` ou `/v1/image2video/<model>` → poll `GET /v1/requests/{id}/status`, auth `Key KEY_ID:KEY_SECRET`, host `platform.higgsfield.ai`. Polling **sorti du handler HTTP** (job resumable). Routing par `provider==='higgsfield'`, pas `startsWith('hf-')`. Credential complet validé au boot ; gating clair sinon. |
| **Voix-off / musique / sous-titres** | TTS provider = `mock` ; ElevenLabs non configuré ; OpenAI TTS configurable mais jamais sélectionné ; musique = stub silencieux (aucun provider) ; SRT généré mais jamais exposé ni muxé, tronqué à 117 chars (BUG-049/050/036/066). | Providers **réels gatés explicitement** : OpenAI TTS activable (clé déjà présente), ElevenLabs si clé, musique documentée/câblée ou explicitement « silence optionnel fiable ». Sous-titres muxés/incrustés par `compose` + exposés. **Ces capacités deviennent atteignables par l'opérateur via A** (la matérialisation UI est ui-ux/frontend ; le backend garantit qu'elles *produisent* un asset réel). |
| **Honnêteté des fallbacks** | Échec provider avalé en image/audio mock cost=0, jamais poussé dans `state.errors` ; job `completed quality 0.91` trompeur ; `<video src=''>` (MISS-011/020/021). | Tout asset dégradé porte `degraded` + raison ; les nodes média **poussent dans `state.errors`** ; le quality-gate dégrade le statut ; aucun asset non servable (404 / 10 octets) présenté comme succès. |
| **Publication programmée** | `runScheduledPublishJobs` n'est **appelé par aucun cron** (absent de `vercel.json`, non relayé par `/api/cron/tick`, app en PM2 self-hosted) → un job `queued` reste indéfiniment (BUG-003). | `runScheduledPublishJobs({ limit })` **fan-out depuis `/api/cron/tick`** (déjà déclenché chaque minute par le timer systemd self-hosted), borné en temps. Heartbeat `social_publish_event`. Activation live **gardée** par idempotence + sync d'état. |
| **Idempotence / dédup** | Clé d'idempotence inclut `scheduledAt.toISOString()` → reprogrammer crée un **second** job `queued` ; publish-now n'invalide pas le job programmé (MISS-006/028). | Clé d'idempotence **indépendante de `scheduledAt`** (par post+compte+intent) ; `reschedule` **mute** le job existant ; `publish-now` invalide/réutilise le `queued`. **Un seul** envoi par post+compte. |
| **Legacy / dry_run / capabilities** | `/postiz-draft` appelle l'API Postiz réelle en ignorant `SOCIAL_PUBLISHING_MODE` (BUG-040) ; `metadata.dryRun=true` codé en dur même en live (BUG-065) ; capabilities persistées stale (BUG-063, MISS-029). | `/postiz-draft` → **410 Gone** (ou routé via le mode résolu) ; `metadata.dryRun` **dérivé du mode réellement résolu** ; capabilities **recalculées à la volée** depuis l'adapter (source unique = code). |
| **Hygiène tests** | `vitest` : 1695 passed mais `EXIT 1` (rejet de poll Higgsfield hors `await` sous fake timers) ; tests écrivent dans le `.media-storage` de prod ; `MEDIA_DIR` relatif au `cwd` ; config en singleton non invalidé (BUG-010/031, MISS-004/024/032/033). | Drain global des timers + `EXIT 0` honnête ; `MEDIA_DIR` **absolu** injecté par env, tmpdir isolé en test, purge des 977 stubs ; config invalidable (TTL/restart documenté). |

**Règle de convergence (architecture-first appliquée au backend) :** on **répare dans A** (les nodes `src/lib/ai-engine/*`) dès que la frontière le permet, et on **ne réinvestit pas** dans le moteur B condamné au-delà du strict débloquage court terme (OpenAI). Concrètement : Higgsfield async, voix-off/musique/sous-titres, compose/transcode sont corrigés **dans A** ; le flux B y accède via le pont bidirectionnel (piloté par ACT-ARC). Les correctifs B (idempotence, cancel/reschedule, dry_run) restent dans B car ils concernent la couche publication, commune aux deux.

---

## 3. Approche & séquençage

L'ordre suit le séquencement macro (P0 vérité → P1 moteur+blockers → P2 honnêteté → P3 robustesse → P4 compose/montage → P5 dette). Le backend contribue à chaque lot :

- **P0** : fermer la fuite fake-timer (ACT-BE-001, support de BUG-010) — pré-condition de tout : sans `EXIT` honnête on ne distingue pas un vrai correctif d'un faux succès. Neutraliser le contournement `/postiz-draft` (ACT-BE-020) avant tout déclenchement live. Le déblocage OpenAI (ACT-BE-010) **dépend** de `resolveProviderCredential()` (ACT-ARC) mais se prouve dès que la fonction existe.
- **P1** : Higgsfield async (ACT-BE-011/012), branchement scheduler (ACT-BE-021) **gardé** par idempotence (ACT-BE-022). Higgsfield et compose sont réparés **dans A**.
- **P2/P3** : honnêteté du texte (ACT-BE-013), variation réelle (ACT-BE-014), fallbacks audibles + `state.errors` (ACT-BE-015), dry_run/capabilities honnêtes (ACT-BE-023), erreur métier 409 sur re-génération (ACT-BE-016).
- **P4** : voix-off/musique/sous-titres réels + mux (ACT-BE-030/031), transcode conforme spec (ACT-BE-032), garde formats vidéo (ACT-BE-033), upload robuste (ACT-BE-034).
- **P5** : isolation/`MEDIA_DIR` absolu + purge stubs (ACT-BE-002), caches invalidables (ACT-BE-003), **re-vérification BUG-012/013 sous PM2** une fois A câblé (ACT-BE-004), accès `/_media` (ACT-BE-024 — coordonné), pricing centralisé (ACT-BE-035).

### Garde-fou de séquencement critique (dur, non négociable)
`ACT-BE-021` (brancher le scheduler) **ne doit pas être activé en mode live** avant que `ACT-BE-022` (idempotence/dédup indépendante de `scheduledAt`) **ET** `T-301`/`ACT-DATA-*` (sync `content_post↔job` sur cancel/reschedule, BUG-038) soient prouvés. Le branchement + test mock/staging peut précéder ; **l'activation live est gardée**. Sans cela, BUG-003 passe d'un blocker inerte à un incident `critical` à impact client (doubles publications, publication d'un post annulé) sur de vrais comptes Instagram.

### Note BUG-012 / BUG-013 (cause racine RÉFUTÉE)
La cause « lavfi indisponible » est **réfutée** par contre-vérification (`evidence/ffmpeg-binary-verification.md` : le binaire `ffmpeg-static` supporte lavfi, exit 0). L'action n'est **pas** un correctif ffmpeg : c'est une **re-vérification sous le runtime PM2** une fois le pipeline A câblé et atteignable (ACT-BE-004), + l'épinglage explicite du binaire `ffmpeg-static` dans le bundle prod, + le refus de retourner `completed` quand voiceover/music ont `url=''` (rejoint ACT-BE-015 honnêteté). On ne « corrige » que ce qui est réellement cassé : l'invisibilité de l'échec (status trompeur), pas lavfi.

---

## 4. Dépendances inter-workstreams

| Dépendance | Fournie par | Consommée par (ACT-BE) | Nature |
|---|---|---|---|
| `resolveProviderCredential('openai'\|'higgsfield')` + déclaration `env.ts` (ADR-0004) | **architecture (ACT-ARC)** | ACT-BE-010, ACT-BE-011, ACT-BE-013 | Source unique de clé ; sans elle on ré-introduit le split d'env. **Bloquant** pour le déblocage live. |
| Harnais MSW global + contract-tests providers (T-006) | **architecture (ACT-ARC)** | ACT-BE-011, ACT-BE-012, ACT-BE-023 (parité dry_run↔live) | Permet de figer le contrat async Higgsfield et la parité Postiz ; rend les DoD live mockables fidèlement. |
| Pont bidirectionnel B→A + remontée `composition/exports/thumbnails` dans `buildResult` (T-104, BUG-004/MISS-005) | **architecture (ACT-ARC)** | ACT-BE-015 (nodes atteignables), ACT-BE-030/031 (voix-off/mux atteignables par l'opérateur), ACT-BE-004 | Sans la frontière/pont, les correctifs des nodes A restent inatteignables par l'opérateur. |
| Sync `content_post ↔ social_publish_job` sur cancel/reschedule (BUG-038, T-301) | **data (ACT-DATA)** | ACT-BE-021 (garde-fou d'activation live), ACT-BE-022 | Co-garde-fou anti-incident avec l'idempotence. |
| Picker honnête / affordances UI / toggle de mode | **ui-ux / frontend** | ACT-BE-013 (cookie `cs_generation_mode` lu côté route), ACT-BE-033 | Le backend lit/valide ; l'UI affiche. Coordination sur le contrat de modèle/mode. |
| Contrôle d'accès `/_media` (T-021, MISS-010) | partagé backend/infra | ACT-BE-024 | Le backend porte l'auth de la route ; coordination infra (LiteSpeed). |
| Déclencheur cron systemd self-hosted (ADR-0005) | **infra/ops** | ACT-BE-021 | Le timer `femiglow-staging-cron-tick.service` existe déjà (chaque minute) ; ACT-BE-021 ajoute le fan-out applicatif. |

---

## 5. ADR proposés par ce workstream

- **ADR-0008 — Gating honnête des providers média & propagation des échecs dans `state.errors`** (voix-off, musique, sous-titres, images, vidéo). Décision structurante : aucun node média ne retourne un asset `url=''`/404/10-octets en `completed` ; tout échec dégrade le statut et est poussé dans `state.errors`, avec flag `degraded` + raison. *Couvre BUG-049/050/066, MISS-011/020/021.*
- **ADR-0009 — Idempotence de publication indépendante de `scheduledAt`** (clé par post+compte+intent ; reschedule mute, publish-now invalide le queued). Garde-fou dur d'activation du scheduler. *Couvre MISS-006/028, en appui de BUG-003.*
- **ADR-0010 — Résolution absolue de `MEDIA_DIR` + isolation stockage des tests** (env absolu, tmpdir en test, purge des stubs). *Couvre BUG-031/MISS-004/024/032.*

> Les décisions « résolution de clé » (ADR-0004), « cron self-hosted » (ADR-0005), « Higgsfield async » (ADR-0006) et « frontière A/B » (ADR-0007) existent déjà et sont **réutilisées**, pas redébattues.

---

## 6. Tableau de couverture audit (45 IDs → action(s))

Chaque ID assigné apparaît dans le champ `audit_lie` d'au moins une action de `tasks.csv`.

| ID | Sévérité | Action(s) ACT-BE | t_ref réutilisée |
|---|---|---|---|
| BUG-001 | blocker | ACT-BE-010 (OpenAI), ACT-BE-011 (Higgsfield img) | T-005, T-101, T-102 |
| BUG-002 | blocker | ACT-BE-011, ACT-BE-012 | T-102, T-103 |
| BUG-003 | blocker | ACT-BE-021 | T-103b |
| BUG-005 | critical | ACT-BE-010, ACT-BE-013 | T-005, T-201 |
| BUG-008 | critical | ACT-BE-012 | T-103 |
| BUG-010 | critical | ACT-BE-001 | T-001, T-002 |
| BUG-012 | minor (root réfutée) | ACT-BE-004 | T-902 |
| BUG-013 | minor (root réfutée) | ACT-BE-004 | T-902 |
| BUG-014 | critical | ACT-BE-017 | T-203 |
| BUG-017 | major | ACT-BE-014 | T-305 |
| BUG-022 | major | ACT-BE-015 | T-304 |
| BUG-025 | major | ACT-BE-011, ACT-BE-012 | T-102, T-103 |
| BUG-030 | major | ACT-BE-012, ACT-BE-031 | T-901 |
| BUG-036 | major | ACT-BE-031 | T-307 |
| BUG-040 | major | ACT-BE-020 | T-020 |
| BUG-049 | major | ACT-BE-030 | T-304 |
| BUG-050 | major | ACT-BE-030 | T-304 |
| BUG-051 | minor | ACT-BE-016 | T-309 |
| BUG-057 | minor | ACT-BE-035 | T-902 |
| BUG-058 | minor | ACT-BE-032 | T-902 |
| BUG-059 | minor | ACT-BE-031, ACT-BE-032 | T-902 |
| BUG-060 | minor | ACT-BE-034 | T-902 |
| BUG-063 | minor | ACT-BE-023 | T-902 |
| BUG-065 | minor | ACT-BE-023 | T-308 |
| BUG-066 | minor | ACT-BE-031 | T-902 |
| BUG-067 | info | ACT-BE-033 | T-902 |
| BUG-068 | info | ACT-BE-031, ACT-BE-034 | T-902 |
| MISS-004 | major | ACT-BE-002 | T-306 |
| MISS-010 | major | ACT-BE-024 | T-021 |
| MISS-011 | major | ACT-BE-015, ACT-BE-030 | T-304 |
| MISS-013 | minor | ACT-BE-010, ACT-BE-013 | T-005, T-201 |
| MISS-014 | minor | ACT-BE-013 | T-412 |
| MISS-017 | minor | ACT-BE-014 | T-413 |
| MISS-018 | minor | ACT-BE-013 | T-202 |
| MISS-020 | minor | ACT-BE-015 | T-304 |
| MISS-021 | minor | ACT-BE-015 | T-304 |
| MISS-023 | minor | ACT-BE-033 | T-415 |
| MISS-024 | minor | ACT-BE-002 | T-306, T-411 |
| MISS-025 | minor | ACT-BE-031 | T-307 |
| MISS-026 | minor | ACT-BE-031, ACT-BE-032 | T-307 |
| MISS-027 | minor | ACT-BE-034 | T-307 |
| MISS-028 | minor | ACT-BE-022 | T-204 |
| MISS-029 | minor | ACT-BE-023 | T-308 |
| MISS-032 | minor | ACT-BE-002 | T-306, T-411 |
| MISS-033 | minor | ACT-BE-003 | T-410 |

**45/45 IDs couverts.** Aucun ID non couvert.

---

## 7. Definition of Done globale du workstream

Le workstream backend est « prouvé » quand, sur la baseline corrigée :
1. `vitest run ; echo $?` renvoie **0** honnête (fuite fake-timer fermée, drain global) — et un vrai défaut redevient **1**.
2. Depuis `/admin/content-studio-v2/create` en **Live** : OpenAI image+texte produisent un asset réel servi 200 + `generation_run provider=openai status=succeeded cost>0` ; en **Mock**, le même chemin produit l'asset déterministe. Comparaison des deux runs prouvée.
3. Un contract-test **échoue** si un endpoint Higgsfield synchrone faux est appelé ; le polling n'est plus dans le handler HTTP.
4. Un post programmé à **T+2 min** en staging transite `queued → publishing → published` (dry_run) ; reprogrammer/publier-maintenant ne produit **jamais** un double envoi (idempotence + sync vérifiées) ; un post annulé n'est jamais publié.
5. Aucun node média ne retourne `completed` avec un asset `url=''`/404 ; tout échec dégrade le statut et apparaît dans `state.errors`.
6. `find .media-storage/ai-engine -size -100c | wc -l` = 0 ; `vitest run` n'écrit **aucun** fichier runtime dans `.media-storage`.

Tant qu'un chemin n'est pas prouvé en **mock ET live**, il reste `broken by default`.
