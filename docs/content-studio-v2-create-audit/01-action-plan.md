# Plan d'action — Content Studio v2 Create

> **Lecture** : ce document décrit le **quoi** et le **pourquoi** des 7 phases. Pour le **comment**, voir `implementation/phase-*.md`. Pour l'**exécution**, voir `00-runbook.md`.

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1 — Foundations                                       │
│   • Mock mode env flag                                      │
│   • Model registry serveur                                  │
│   • Endpoint GET /models                                    │
├─────────────────────────────────────────────────────────────┤
│ Phase 2 — Text model selection                              │
│   • Composant ModelPicker partagé                           │
│   • Intégration IntentionForm                               │
│   • Extension API POST /ideas                               │
├─────────────────────────────────────────────────────────────┤
│ Phase 3 — Image/Video model selection                       │
│   • Toggle Image/Video selon format                         │
│   • ModelPicker dans MediaStudio                            │
│   • Extension API generate-visual                           │
├─────────────────────────────────────────────────────────────┤
│ Phase 4 — Mock video assets + service                       │
│   • Fichiers MP4 réels (lisibles HTML5)                     │
│   • Service generateMockVideo()                             │
│   • Badge Mode Mock                                         │
├─────────────────────────────────────────────────────────────┤
│ Phase 5 — Step progression                                  │
│   • Auto needs_review post sélection                        │
│   • Bouton Valider → POST /approve                          │
│   • Stepper réactif à la nouvelle logique                   │
├─────────────────────────────────────────────────────────────┤
│ Phase 6 — Publish validation                                │
│   • Vérifier 3 modes publication                            │
│   • Mocks MSW                                               │
│   • E2E golden path                                         │
├─────────────────────────────────────────────────────────────┤
│ Phase 7 — Batterie de tests                                 │
│   • Unit + composant + contract + E2E                       │
│   • Couverture ≥ 85%                                        │
│   • Boucle de correction                                    │
└─────────────────────────────────────────────────────────────┘
```

## Dépendances entre phases

```
Phase 1 ────► Phase 2 ────► Phase 5 ────► Phase 6 ────► Phase 7
   │            │              ▲              ▲
   ├─► Phase 3 ─┤              │              │
   │                           │              │
   └─► Phase 4 ────────────────┘              │
                                              │
                       (toutes phases) ───────┘
```

Phase 1 fonde le reste. Phases 2/3/4 sont parallélisables après Phase 1. Phase 5 dépend de 2 et 3 (sinon le déverrouillage déclenche sur un état incomplet). Phase 6 valide les phases précédentes. Phase 7 court en transversal mais consolide à la fin.

## Phase 1 — Foundations

### Pourquoi
Sans source de vérité centralisée des modèles disponibles et sans mock mode unifié, tout sélecteur de modèle ou mock vidéo est fragile. Phase 1 prépare le terrain.

### Quoi
1. **Env flag `CONTENT_STUDIO_V2_MOCK_MODE`** (boolean, défaut false)
   - Quand true : tous les générateurs (text, image, video) servent du mock déterministe
   - Quand false : comportement actuel (env-driven, fallback template si pas d'API key)
2. **Model registry** : nouveau module `lib/content-studio-v2/models/registry.ts`
   - Source : config statique versionnée + extensible via DB plus tard
   - API : `listChatModels()`, `listImageModels()`, `listVideoModels()`, `suggestForFormat(format)`
3. **Endpoint `GET /api/admin/content-studio/models`**
   - Query : `?role=chat|image|video&format=post|story|reel|carousel`
   - Retourne : `{ models: ModelEntry[], suggested: ModelEntry, providers: ProviderInfo[] }`

### Risques
- Aucun, code additif. Pas de breaking change.

### Validation
- Tests contract pour `/models` (3 rôles × 4 formats = 12 cas)
- Snapshot du registre

## Phase 2 — Sélecteur de modèle Texte

### Pourquoi
L'opérateur veut piloter coût vs qualité (gpt-4o-mini rapide/économique vs claude-sonnet-4 premium) et adapter au type de contenu (un reel viral vs un post éducatif).

### Quoi
1. **Composant `ModelPicker.tsx`** réutilisable
   - Combobox autocomplete (Radix Popover + cmdk)
   - 4 presets : Auto (recommandé) / Rapide / Premium / Custom
   - Affiche provider, model id, badges (capability, latency, cost)
   - Indicateur source (Live API / Cache / Static fallback)
2. **Intégration `IntentionForm`** : section "Modèle" au-dessus de `Intention` textarea
3. **Backend** : `contentIdeaCreateSchema` accepte `model?: string`
   - Si fourni : passé à `generateForIdea({ model })`
   - Si absent : `suggestForFormat(format).chat`

### Risques
- Schéma rétro-compatible (champ optionnel)
- Coût budget : log à `content_generation_run.model` pour audit

### Validation
- Test UI : sélection visible, persistance dans le payload
- Test contract : `POST /ideas` avec `model` retourne 200, sans `model` aussi
- Test E2E : choisir gpt-4o-mini → généré → vérifier `model` en DB

## Phase 3 — Sélecteur de modèle Image/Vidéo

### Pourquoi
Le format (post / story / reel / carousel) implique des modes différents (image fixe vs vidéo verticale courte). L'opérateur doit pouvoir choisir avec une suggestion intelligente.

### Quoi
1. **Toggle Image / Vidéo** dans MediaStudio
   - Activé par défaut sur la modalité pertinente au format (post=image, reel=vidéo, story=indifférent default image)
2. **ModelPicker** : prop `role={'image'|'video'}`
3. **API `POST /drafts/[id]/generate-visual`** étendue :
   - `model?: string`
   - `kind?: 'image'|'video'` (default image)
4. **Service** : si `kind='video'`, route vers `generateVisualVideoForDraft()`
   - En mock mode : retourne un asset MP4 pré-existant
   - En mode réel : appel provider (HiggsField Veo / OpenAI Sora pour le futur)

### Risques
- Le real provider vidéo n'existe pas en prod aujourd'hui → la phase ne livre **que le chemin mock** côté vidéo. Le real provider est tracé dans le backlog.
- Modèles image : DALL-E 3, gpt-image-1, gpt-image-1-mini → ok

### Validation
- Test UI : changer modèle → re-générer → payload contient model
- Test contract : 4 combinaisons (image/video × model défini ou non)
- Test E2E : reel + vidéo mock → asset MP4 lisible

## Phase 4 — Mock Video assets + service

### Pourquoi
Sans un MP4 réel servi statiquement, impossible de valider le rendu vidéo dans le PreviewPane (HTML5 `<video>` requiert un blob ou une URL valide).

### Quoi
1. **Fichiers MP4** générés via ffmpeg (5s, 1080x1920 H.264 + AAC) :
   - `/public/_media/content-studio/mock/reel-9x16.mp4`
   - `/public/_media/content-studio/mock/story-9x16.mp4`
   - `/public/_media/content-studio/mock/poster-9x16.jpg` (thumbnail)
2. **Service `generateMockVideo({ draftId, format })`** :
   - Construit `StudioMediaItem` avec `kind='video'`, `previewUrl` pointant sur le fichier
   - Crée `content_asset_binding` avec `role='primary'`
   - Loggue `content_generation_run` (provider=mock, model=mock-video-1.0, cost=0)
3. **UI** : badge "Mode mock" visible si `CONTENT_STUDIO_V2_MOCK_MODE=true`

### Risques
- Vérifier que les MP4 sont commitables (taille < 2 MB chacun via ffmpeg réglé bas)
- Mime type `video/mp4` correctement servi par Next.js Static

### Validation
- Test E2E : reel → générer vidéo → `<video>` rendu, `src` 200, élément `currentTime > 0` après lecture
- Test UI : badge présent en mock

## Phase 5 — Step Progression

### Pourquoi
Aujourd'hui, le stepper se base sur `draft.status` qui ne dépasse pas `generated` côté UI (jamais `needs_review` car aucun endpoint UI ne fait la transition). Step 3 (Visual) reste donc visuel-only via un hack `deriveActiveStep`, et Step 4 (Validate) ne s'active que si approve a été fait, ce qui n'est jamais fait par l'UI.

### Quoi
1. **Auto-transition `needs_review`** : 
   - Au moment où l'utilisateur clique "Choisir cette variante", appeler `POST /drafts/[id]/review` (déjà existant) en parallèle de `selectDraft`.
   - Le service met le draft à `needs_review` ; Stepper passe étape Visual à actif.
2. **Bouton "Valider et préparer la publication"** dans le PreviewPane (à la place du flou actuel "approuvez le draft") :
   - Appelle `POST /drafts/[id]/approve`
   - Crée le `content_post` → `postId` disponible
   - Étape Validate active, dropdown Publier débloqué
3. **Stepper UX** :
   - Navigation rétrograde toujours autorisée (revenir corriger)
   - Étapes futures non cliquables mais visiblement "à venir" plutôt que "interdit"

### Risques
- L'auto-review pourrait re-trigger des règles d'audit. Vérifier idempotence côté service.
- L'approve sans média attaché doit échouer côté backend (et l'UI doit prévenir).

### Validation
- E2E : sélection variante → step 3 actif (sans média encore)
- E2E : attacher média → bouton Valider apparaît
- E2E : Valider → step 4 actif, postId existe

## Phase 6 — Publish validation

### Pourquoi
Une fois steps 1-3 OK, vérifier que les 3 modes publication marchent bout en bout en mock.

### Quoi
1. **MSW handlers** :
   - `POST /api/admin/content-studio/posts/:id/publish-now` → 200 `{ jobs: [{ id, status: 'queued', provider: 'mock' }] }`
   - `POST /api/admin/content-studio/posts/:id/schedule` → 200 idem + `scheduledAt`
   - `POST /api/admin/content-studio/posts/:id/draft-on-provider` → 200 idem
2. **Tests E2E golden path** unique qui couvre les 3 modes
3. **Badge "Mode mock"** propagé à PublishActionGroup (toast clarifié)

### Validation
- E2E golden : passing
- Toasts : pas de rouge sur le parcours nominal

## Phase 7 — Batterie de tests

### Pourquoi
Verrouille tous les acquis et empêche les régressions futures.

### Quoi
Voir `test-battery/01-vitest-plan.md` et `test-battery/02-playwright-plan.md`. Synthèse :

| Couche | Cible | Volume estimé |
|--------|-------|---------------|
| Vitest unit | services, hooks, registre | ~80 tests |
| Vitest composant | 9 composants v2/create | ~140 tests |
| Contract API | 9 routes touchées | ~60 tests |
| MSW handlers | 9 routes mockées | ~30 handlers |
| Playwright E2E | 8 scénarios + 4 cross-cutting | ~50 tests |
| **Total** | | **~360 tests** |

### Validation
- Tous verts
- Couverture composants ≥ 85%, services ≥ 80%, lignes globales ≥ 75%
- Aucun test flaky (3 runs consécutifs identiques)

## Critères de succès du plan global

1. L'opérateur peut choisir le modèle texte (Auto par défaut)
2. L'opérateur peut choisir le modèle image/vidéo, avec suggestion par format
3. Mock vidéo lisible dans le PreviewPane
4. Stepper avance naturellement jusqu'à Validate sans hack
5. Les 3 modes de publication fonctionnent en mock
6. Couverture de tests ≥ 80% sur le périmètre touché
7. Aucune régression sur la v1 ou l'AI Engine

## Estimation effort

| Phase | Effort dev (j-h) | Effort QA (j-h) |
|-------|------------------|-----------------|
| 1 | 1.0 | 0.5 |
| 2 | 1.5 | 0.5 |
| 3 | 2.0 | 0.5 |
| 4 | 0.5 | 0.5 |
| 5 | 1.5 | 0.5 |
| 6 | 0.5 | 0.5 |
| 7 | 2.0 | 1.0 |
| **Total** | **9.0** | **4.0** |

Total ~13 jour-personne (≈ 2.5 semaines à plein temps avec relecture/PR).
