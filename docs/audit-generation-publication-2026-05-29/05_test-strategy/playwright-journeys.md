# Parcours opérateur Playwright — nominal, erreur, récupération (mock ET live)

> Baseline figée **2026-05-29**. Point d'entrée opérateur réel : `/admin/content-studio-v2/create` (pipeline B). L'opérateur n'utilise **jamais** `/ai-engine/create` (pipeline A) — cf. BUG-015/047/048.
> Tout parcours est défini **une fois** et exécuté en **mock** (à chaque PR) et en **live-gated** (`E2E_LIVE=1` + credentials ; sinon `skip` tracé — `strategy.md` §8.3, §9.3).
> Règle anti-M6 : **asserter l'effet observable** (asset servi 200, job transité en DB, toast d'erreur visible), pas seulement le rendu. Préférer les `data-testid` stables.

---

## 0. Pré-requis communs

- **Session** : réutiliser `apps/web/.auth/admin.json` (`e2e/global.setup.ts`). Jamais de login brute-force.
- **DB** : schéma réel migré. Seed/cleanup sur la table **`audit_events`** (pluriel) — corriger `audit_event` (BUG-023, BUG-042, BUG-064).
- **Base URL** : `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012`.
- **Mode** : le toggle `GenerationModeToggle` pose le cookie `cs_generation_mode` ; testids `generation-mode-mock` / `generation-mode-live`.

### Sélecteurs/testids de référence (vérifiés dans le code au gel)

| Étape | Sélecteur |
|---|---|
| Onglets média | `media-tab-generate`, `media-tab-library` |
| Type de média | `media-kind-image`, `media-kind-video` |
| Picker modèle | `model-picker-image`, `model-picker-video`, `model-picker-chat`, `model-picker-search`, `model-picker-item-<id>`, `model-picker-custom-add` |
| Bouton générer (conditionnel au kind) | `getByRole('button', { name: /Générer une vidéo IA|Générer un visuel IA/i })` (BUG-029/055) |
| Régénérer | `getByRole('button', { name: /Régénérer/i })` |
| Choisir variante | `getByRole('button', { name: /Choisir cette variante/i })` |
| Badge provenance | `generated-by-badge` |
| Approuver | `approve-draft-button` |
| Mode génération | `generation-mode-mock`, `generation-mode-live` |
| Publier / options | `aria-label="Publier"`, `aria-label="Options de publication"` |
| Programmer | `schedule-preset-1h`, `schedule-preset-tomorrow-9`, `schedule-timezone-label` |
| Confirmation publication | `publish-confirm-preview`, `publish-confirm-thumbnail-img`, `publish-confirm-platform`, `publish-confirm-format` |
| Rejet variante | `confirm-reject` |

---

## J1 — Génération de texte / variantes (idea → variants)

### J1.nominal (mock + live)
1. Aller sur `/admin/content-studio-v2/create`.
2. Renseigner l'Intention (pilier, objectif, plateforme, format, prompt) dans `IntentionForm`.
3. (live) basculer `generation-mode-live`.
4. Cliquer `Enregistrer l'idée` → l'idée est créée et la génération de variantes se déclenche.
5. **Assertions d'effet** :
   - 3 variantes affichées ;
   - `generated-by-badge` : en **live**, doit indiquer un **provider LLM réel** (`openai`), PAS `deterministic-template` (rouge au gel — BUG-005, BUG-020) ;
   - en **mock** : provenance mock/template cohérente ;
   - **parité** : le résultat live ≠ template figé (MISS-001).
6. Sélectionner une variante (`Choisir cette variante`).

### J1.erreur (mock + live)
- Forcer un échec de génération (budget épuisé / provider 503 via MSW en mock ; clé absente en live).
- **Assertion** : un **toast d'erreur** est visible et l'opérateur peut **réessayer** — rouge au gel (catch vide, idée créée sans variantes ni feedback — BUG-022).

### J1.récupération
- Après l'erreur, cliquer `Réessayer`/`Régénérer` → variantes produites. Asserter l'absence d'état bloqué.

---

## J2 — Génération d'un visuel image (média)

### J2.nominal
1. Sélectionner un draft → onglet `media-tab-generate` → `media-kind-image`.
2. Ouvrir `model-picker-image`. **Assertion picker (BUG-006/007/024/043)** : tout modèle badgé « Live » doit être générable ; en mock, le modèle auto-suggéré ne doit pas armer un throw au 1er clic (MISS-002).
3. (live) basculer `generation-mode-live`, choisir `gpt-image-1-mini`.
4. Cliquer `Générer un visuel IA`.
5. **Assertions d'effet** :
   - **mock** : média rendu, vignette servie **HTTP 200** ; `run.provider=mock` ;
   - **live** : asset OpenAI réel servi **HTTP 200**, `run.provider=openai` — **rouge au gel** (409 `CONTENT_STUDIO_OPENAI_API_KEY manquant`, BUG-001/006/011) ; vert après mapping `OPENAI_API_KEY`.

### J2.erreur (mock + live)
- Sélectionner un modèle Higgsfield (`hf-flux-pro`) en live → **assertion** : message d'erreur **typé et actionnable** (« credential Higgsfield incomplet »), pas un 500 opaque (BUG-002, BUG-028).
- Variante MSW : OpenAI 429/`content_policy_violation` → toast d'erreur lisible.

### J2.récupération
- Après échec, rebasculer en mock ou changer de modèle → génération aboutit. Vérifier que `Régénérer` envoie le bon modèle (pas un id live hérité non-fonctionnel — MISS-017).

---

## J3 — Génération vidéo (reel / story)

### J3.nominal (mock — works ; live — gated)
1. Draft format `reel` → `media-kind-video`.
2. **Assertion libellé** : le bouton est `Générer une vidéo IA` (BUG-029/055).
3. Cliquer → **mock** : MP4 servi **HTTP 200**, lisible dans la PreviewPane, `durationMs=5000` (BUG-067, regression guard).
4. **live (gated)** : `veo3_1`/`hf-video-*` → asset vidéo réel OU `skip` tracé si credential absent (BUG-002/008/009).

### J3.erreur
- Modèle vidéo live-découvert (`veo3_1`) en live → message d'erreur **correct** (pas « aucun modèle vidéo live disponible » trompeur — BUG-009).
- `media-kind-video` sur un format `post`/`carousel` → l'UI **désactive** l'option ou affiche une erreur typée (pas 500 — MISS-023).

---

## J4 — Approbation puis publication immédiate (publish-now)

### J4.nominal (mock — dry_run ; live — gated)
1. Draft avec média attaché → `approve-draft-button`.
2. Cliquer `Publier` (`aria-label="Publier"`) → confirmation (`publish-confirm-preview`, `publish-confirm-platform`, `publish-confirm-format`).
3. Confirmer.
4. **Assertions d'effet** :
   - **mock/dry_run** : `social_publish_job` créé, `content_post → published`, événement `audit_events` émis, permalien de **forme** cohérente avec Postiz (BUG-045) ;
   - **live (gated, compte de test)** : publication réelle, permalien `instagram.com/p/<id>` ; sinon `skip` tracé (BUG-037).
   - **parité** : la forme de réponse mock = forme live (comparateur — BUG-045/065).

### J4.erreur
- Approuver un draft **sans média** → message serveur **précis**, pas « État de draft invalide » générique (BUG-054).
- En live + plusieurs comptes sans pin → l'UI **impose** un `accountId` ou refuse (`invalid_state`), jamais deviner le compte client (BUG-039).

---

## J5 — Brouillon sur provider (draft-on-provider)

1. Draft approuvé → option `draft-on-provider`.
2. **Assertions** : `social_publish_job` `publishMode=draft`, `content_post.status` **inchangé**, audit `social.draft_created` (BUG-023/042/064 corrigés → ce parcours devient un E2E vert fiable).
3. **live (gated)** : draft visible dans la file Postiz du compte de test ; sinon `skip` tracé.

---

## J6 — Programmation (schedule) — le blocker BUG-003

### J6.nominal (mock + live, T+court)
1. Draft approuvé → `Options de publication` → `schedule-preset-1h` (ou T+2 min en test).
2. Confirmer → l'UI accuse « Publication programmée ».
3. **Assertions d'effet (cœur du test, rouge au gel)** :
   - le `social_publish_job` est créé `queued` avec `scheduledAt` ;
   - **après l'échéance, le job DOIT transiter `queued → publishing → published`** — rouge au gel car **aucun cron ne déclenche** `runScheduledPublishJobs` (BUG-003, blocker, mock ET live).
4. Le test invoque le scheduler de la même façon que le déclencheur de prod (PM2/systemd) — pas un appel direct à la fonction (qui masquerait BUG-003, cf. `fiabilite/state.md` §1).

### J6.erreur / armés-latents (à couvrir avant d'activer le live)
- **Double-publication** : `publish-now` puis `schedule` sur le même post → un **seul** envoi (MISS-006).
- **Reschedule** : reprogrammer ne crée pas un **second** job `queued` (MISS-028) ; il mute l'existant.
- **Cancel** : annuler un post programmé annule le `social_publish_job` (pas d'orphelin `queued` — BUG-038).

---

## J7 — Smoke opérateur de bout en bout (CI, mock)

Parcours unique exécuté à **chaque PR** en mock, assertant l'effet backend à chaque étape (ferme M6/P6) :

```
idea -> variants (provider attendu) -> generate-visual (asset 200) -> approve -> draft-on-provider (job draft + audit_events)
```
Critère : `PLAYWRIGHT_EXIT=0` sur ce parcours (aujourd'hui 2 specs rouges — BUG-029/055/023/042/064).

---

## 8. Matrice mode × parcours (statut au gel)

| Parcours | mock (gel) | live (gel) | Devient vert après |
|---|---|---|---|
| J1 texte | works (template, pas LLM) | broken | BUG-005/020 (lire cookie + résoudre clé) |
| J2 image | works | broken (409) | BUG-001 (mapper `OPENAI_API_KEY`) |
| J3 vidéo | works (BUG-067) | broken/gated | BUG-002/008/009 (credential + async + mapping) |
| J4 publish-now | works (dry_run) | untested/gated | BUG-037 (compte test + contrat écriture) |
| J5 draft-on-provider | works | untested/gated | BUG-037 |
| J6 schedule | broken (inerte) | broken (inerte) | BUG-003 (brancher scheduler) + BUG-038/MISS-006/028 |
| J7 smoke | broken (specs rouges) | n/a | BUG-023/029/042/055/064 |

> Tout `skip` live est **tracé avec sa raison** (« génération/publication live non configurable au gel »), jamais transformé en faux vert (`untested ≠ works`).
