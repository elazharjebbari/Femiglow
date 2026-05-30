# Runbook d'exécution — Audit & Amélioration Content Studio v2 Create

> **Objectif** : exécuter de bout en bout le plan d'amélioration de la page `/admin/content-studio-v2/create` avec validation à chaque étape et boucle de correction.
>
> **Pré-requis** : avoir lu `01-action-plan.md`, `02-architecture-overview.md`, `04-gaps-and-issues.md`.
>
> **Durée estimée** : 5 à 8 sessions de 2-3h, exécutées séquentiellement.

---

## P0 — Pré-flight

```bash
# 1. Vérifier l'environnement
cd /var/www/femiglow-staging/apps/web
node -v          # >= 18
pnpm -v          # >= 9
pm2 status web   # online sur port 8012

# 2. Vérifier la DB
PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -U femiglow -d staging_femiglow -c "\dt content_*"
# attendu : content_idea, content_brief, content_draft, content_post, content_generation_run, content_asset_binding, content_brand_review, content_postiz_delivery

# 3. Brancher git
git checkout -b feat/cs2-create-improvements

# 4. Snapshot des tests existants
pnpm vitest run src/components/admin/content-studio-v2/create --reporter=verbose 2>&1 | tee /tmp/baseline-vitest.log
pnpm vitest run src/lib/content-studio-v2/state --reporter=verbose 2>&1 | tee -a /tmp/baseline-vitest.log

# 5. Baseline build
pnpm run build 2>&1 | tee /tmp/baseline-build.log
# attendu : 0 erreur TS
```

**Critère de sortie P0** : aucun test rouge en baseline (les régressions futures partent d'un sol propre).

---

## Phase 1 — Foundations (mock mode + model registry)

Ref : `implementation/phase-1-foundations.md`

```bash
# 1.1 Ajouter le flag mock côté env
# Éditer apps/web/src/lib/env.ts → ajouter CONTENT_STUDIO_V2_MOCK_MODE (boolean, default false)
# Éditer apps/web/.env.example pour documenter

# 1.2 Créer le model registry côté serveur
# Nouveau fichier : apps/web/src/lib/content-studio-v2/models/registry.ts
# Expose : listChatModels(), listImageModels(), listVideoModels(), suggestForFormat(format)

# 1.3 Créer l'endpoint /api/admin/content-studio/models
# Méthode GET avec query params: ?role=chat|image|video, ?format=post|story|reel|carousel
# Voir : data-contracts/api-models-endpoint.yaml

# 1.4 Tests contract
pnpm vitest run src/test/api-contracts/content-studio-v2-models.contract.test.ts
```

**Critère de sortie Phase 1** :
- ✅ `GET /api/admin/content-studio/models?role=chat` retourne la liste avec suggestion par défaut
- ✅ `GET /api/admin/content-studio/models?role=video&format=reel` retourne la suggestion vidéo
- ✅ Le flag `CONTENT_STUDIO_V2_MOCK_MODE=true` active le mode mock pour text + image + video
- ✅ Aucun test régressé

---

## Phase 2 — Sélecteur de modèle Texte (IntentionForm)

Ref : `implementation/phase-2-text-model-selector.md`

```bash
# 2.1 Composant ModelPicker partagé
# apps/web/src/components/admin/content-studio-v2/create/ModelPicker.tsx
# - autocomplete combobox (Radix Popover + cmdk)
# - 4 presets : Auto (recommandé par format), Rapide, Premium, Custom
# - groupes par provider, badge cache/live/static

# 2.2 Brancher dans IntentionForm
# - Ajouter prop "model" + setter
# - Ajouter ModelPicker au-dessus du textarea "Intention"
# - Envoyer model dans le payload POST /ideas

# 2.3 Côté backend, accepter "model" dans la route POST /ideas
# - Étendre contentIdeaCreateSchema
# - Passer en aval à generateForIdea() au lieu de env.CONTENT_STUDIO_TEXT_MODEL

# 2.4 Tests
pnpm vitest run src/components/admin/content-studio-v2/create/IntentionForm.test.tsx
pnpm vitest run src/test/api-contracts/content-studio-v2-ideas.contract.test.ts
```

**Critère de sortie Phase 2** :
- ✅ Le `<select>` modèle est affiché dans IntentionForm
- ✅ Le modèle choisi est passé au backend
- ✅ Le `content_generation_run.model` reflète le modèle choisi
- ✅ Fallback : si non choisi, prend la suggestion `suggestForFormat(format).chat`

---

## Phase 3 — Sélecteur de modèle Image/Vidéo (MediaStudio)

Ref : `implementation/phase-3-media-model-selector.md`

```bash
# 3.1 Étendre MediaStudio.tsx
# - Toggle Image vs Vidéo (pertinent surtout pour format=reel/story)
# - ModelPicker par rôle (image|video)
# - Suggestion par défaut selon format

# 3.2 Étendre POST /drafts/[id]/generate-visual
# - Accepter "model", "kind" (image|video)
# - Si kind=video, déléguer à generateVisualVideoForDraft() (nouveau)

# 3.3 Créer POST /drafts/[id]/generate-video (ou unifier sous /generate-visual)
# Voir : data-contracts/api-mock-video-endpoint.yaml

# 3.4 Tests
pnpm vitest run src/components/admin/content-studio-v2/create/MediaStudio.test.tsx
```

**Critère de sortie Phase 3** :
- ✅ L'utilisateur peut choisir image ou vidéo (selon format compatible)
- ✅ Modèle image/vidéo sélectionnable avec suggestion adaptée
- ✅ `content_generation_run` log le modèle utilisé

---

## Phase 4 — Mock Video

Ref : `implementation/phase-4-mock-video.md`

```bash
# 4.1 Préparer les assets mock
# /var/www/femiglow-staging/apps/web/public/_media/content-studio/mock/reel-9x16.mp4 (5s, H.264, 1080x1920)
# /var/www/femiglow-staging/apps/web/public/_media/content-studio/mock/story-9x16.mp4 (3s, 1080x1920)
# /var/www/femiglow-staging/apps/web/public/_media/content-studio/mock/poster-9x16.jpg

# Si ffmpeg disponible :
ffmpeg -f lavfi -i color=c=0x6B5BFF:size=1080x1920:duration=5 \
  -vf "drawtext=text='FemiGlow Mock Reel':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2" \
  -c:v libx264 -pix_fmt yuv420p \
  /var/www/femiglow-staging/apps/web/public/_media/content-studio/mock/reel-9x16.mp4

# 4.2 Côté service : generateMockVideo()
# Retourne une StudioMediaItem kind=video avec previewUrl pointant sur /_media/content-studio/mock/reel-9x16.mp4

# 4.3 Côté UI : PreviewPane doit jouer la vidéo (déjà supporté kind=video)
# Ajouter un badge "Mode mock" visible quand env CONTENT_STUDIO_V2_MOCK_MODE=true

# 4.4 Tests E2E
pnpm vitest run src/components/admin/content-studio-v2/create/MediaStudio.test.tsx -t "mock video"
npx playwright test e2e/content-studio-v2/create-mock-video.spec.ts
```

**Critère de sortie Phase 4** :
- ✅ En mock mode, cliquer "Générer une vidéo" attache un MP4 lisible au draft
- ✅ Le PreviewPane affiche la vidéo avec contrôles
- ✅ Le badge "Mode mock" est visible

---

## Phase 5 — Step Progression (déverrouillage étapes 3 + 4)

Ref : `implementation/phase-5-step-progression.md`

```bash
# 5.1 Auto-transition draft vers needs_review
# Aujourd'hui : la transition n'est pas faite via UI. Solution :
# - Soit déclencher POST /drafts/[id]/review au moment où l'utilisateur sélectionne une variante
# - Soit définir needs_review comme état initial post-génération côté service

# Recommandation : voir proposals/P02-step-unlock-logic.md → "Status driven via select+review call"

# 5.2 Auto-approve OU bouton "Valider et préparer la publication" explicite
# Recommandation : bouton explicite dans le PreviewPane qui appelle POST /drafts/[id]/approve
# Cette action crée le content_post et set postId → débloque PublishActionGroup

# 5.3 Stepper : retirer disabled sur les steps futurs ET autoriser navigation rétrograde sans bloquer

# 5.4 Tests
pnpm vitest run src/components/admin/content-studio-v2/create/Stepper.test.tsx
npx playwright test e2e/content-studio-v2/create-step-progression.spec.ts
```

**Critère de sortie Phase 5** :
- ✅ Sélectionner une variante → step 3 (Visual) actif
- ✅ Attacher un média → bouton "Valider" disponible
- ✅ Cliquer "Valider" → step 4 actif, postId présent, dropdown Publier activé

---

## Phase 6 — Publication end-to-end (validation step 4)

Ref : `implementation/phase-6-publish-validation.md`

```bash
# 6.1 Vérifier que les 3 modes marchent en mock mode
# - Publier maintenant → toast succès + job mock
# - Programmer → toast succès, scheduledAt persisté
# - Brouillon Postiz → toast succès, deliveryStatus=pending

# 6.2 Hooks MSW pour /publish-now /schedule /draft-on-provider
# Ajouter dans src/test/msw/content-studio-handlers.ts

# 6.3 Tests E2E golden path
npx playwright test e2e/content-studio-v2/create-golden-path.spec.ts
```

**Critère de sortie Phase 6** :
- ✅ Parcours intégral Idea → Brief → Variants → Visual → Approve → Publish (3 modes)
- ✅ Aucun toast rouge sur parcours nominal mock
- ✅ État final : draft.status=approved, post.status ∈ {published, scheduled, approved}

---

## Phase 7 — Batterie de tests

Ref : `implementation/phase-7-tests.md` + `test-battery/`

```bash
# 7.1 Unit + composant
pnpm vitest run src/components/admin/content-studio-v2/create

# 7.2 Contract API
pnpm vitest run src/test/api-contracts/content-studio-v2-*.contract.test.ts

# 7.3 E2E
pm2 restart web && sleep 5
npx playwright test e2e/content-studio-v2/create-*.spec.ts --reporter=html

# 7.4 Couverture
pnpm vitest run --coverage src/components/admin/content-studio-v2/create src/lib/content-studio-v2

# 7.5 Boucle de correction : tant que !0 fail → corriger → re-run
```

**Critères de sortie Phase 7** :
- ✅ 0 test rouge
- ✅ Couverture composants ≥ 85%
- ✅ Couverture services ≥ 80%
- ✅ 100% des scénarios `S01..S08` passent

---

## Boucle de correction

À chaque échec :

1. **Identifier** la nature : bug code, bug test, attente du contrat, ou dérive du mock.
2. **Localiser** par stack trace ou log → fichier + ligne.
3. **Corriger** le minimum nécessaire (préférer corriger le code → fixer le test si la spec a réellement changé).
4. **Re-run** le fichier seul → puis la suite locale → puis le full.
5. **Documenter** dans `test-battery/REGRESSION_NOTES.md` (créer au besoin) les corrections significatives.

## Critères de done global

- [ ] Phases 1 à 7 toutes vertes
- [ ] `pnpm run build` à 0 erreur
- [ ] `pnpm vitest run` à 0 fail
- [ ] `playwright test` à 0 fail
- [ ] Démo manuelle : parcours nominal mock + parcours nominal real (si secrets dispo)
- [ ] PR ouverte avec lien vers `00-runbook.md` dans la description
- [ ] Changelog mis à jour

## Rollback

Voir `implementation/rollback.md`. Toutes les modifications sont feature-flag par `CONTENT_STUDIO_V2_MOCK_MODE` côté preview et par feature flags atomiques (`CS2_TEXT_MODEL_PICKER`, `CS2_MEDIA_MODEL_PICKER`, `CS2_STEP_PROGRESSION_V2`) côté UI — désactiver le flag suffit à revenir au comportement antérieur.
