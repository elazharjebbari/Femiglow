# Audit de l'état actuel — Content Studio v2 Create

> **Lecture** : décrit objectivement ce qui fonctionne et ce qui ne fonctionne pas dans la page **telle qu'elle est aujourd'hui** (mai 2026).

## Méthode d'audit

1. Lecture statique : tous les composants `components/admin/content-studio-v2/create/*`, routes API `app/api/admin/content-studio/**`, services `lib/content-studio/*`, contexte `lib/content-studio-v2/state/StudioContext.tsx`
2. Recherche transverse : env flags, mock paths, tests existants
3. Réf. de transitions : `lib/content-studio/state-machine.ts`
4. Réf. de schéma : `lib/db/schema-content-studio.ts`

## Ce qui fonctionne ✅

### Étape 1 — Cadrer (Frame)
- `IntentionForm` rend correctement les 4 formats (post/story/reel/carousel) en radio cards
- Pilier / Objectif / Plateforme via `SelectField`
- Textarea intention avec validation côté Zod (`contentIdeaCreateSchema`)
- POST `/ideas` → création idéale (idempotent via Idempotency-Key)
- Erreurs serveur affichées en banner rouge
- Validation côté client `aria-invalid` correct

### Étape 2 — Générer (Generate)
- `POST /ideas/:id/generate` appelle `generateForIdea()` :
  - Tente OpenAI si `CONTENT_STUDIO_OPENAI_API_KEY` présent
  - Sinon retourne un template déterministe (provider='fallback', cost=0)
- Crée 1 brief + 3 drafts, lance `runBrandReview()` sur chacun
- `content_generation_run` loggué avec model + cost + status
- Daily budget contrôlé (2 cents préalable, échoue si épuisé)
- `VariantsCompare` rend les 3 cartes avec score, violations, toggle diff
- Sélection variante : `selectDraft + upsertDraft` (local state)

### Étape 3 — Visuel (Visual) — *partiellement*
- `MediaStudio` rend correctement avec MediaPicker
- Bouton "Générer un visuel IA" envoie `POST /drafts/:id/generate-visual`
- En `CONTENT_STUDIO_IMAGE_PROVIDER=mock` : retourne un SVG gradient (0 cost)
- En real : appelle DALL-E 3 / gpt-image-1 selon `CONTENT_STUDIO_IMAGE_MODEL`
- Auto-bind sur `content_asset_binding` côté service
- Budget visible (`/generation-runs`) en haut à droite

### Édition continue
- `CaptionEditor` lié à `useDraftAutosave` (debounce 1500ms)
- PATCH `/drafts/:id` → re-brand-review automatique
- `AutosaveIndicator` montre saving/saved/error/session_expired
- Caption + hook + cta + hashtags + altText tous éditables

### Aperçu
- `PreviewPane` rend selon plateforme/format avec ratio correct (1:1, 4:5, 9:16)
- Support images (rendu `<img>`) et vidéos (rendu `<video>`)

### Étape 4 — Valider (Validate) — *partiellement*
- `PublishActionGroup` rend le dropdown Radix avec 3 modes :
  - Publier maintenant → POST /posts/:id/publish-now
  - Programmer → POST /posts/:id/schedule (avec datepicker)
  - Brouillon Postiz → POST /posts/:id/draft-on-provider
- Dialogs de confirmation
- `executePublish` appelle l'endpoint puis re-fetch
- AutosaveIndicator inline

### API
- Routes idempotentes (Idempotency-Key)
- Validation Zod systématique
- Auth admin gate (server)
- `generation_runs` logue tout (texte + image)
- Brand review distinct des drafts (réutilisable)

### DB
- Schéma normalisé, cascade FK correcte
- Versioning brief (`version` int)
- Asset binding 1:n via `content_asset_binding` (clean)
- `media` table générique (kind, source, slug, urls, dimensions)

## Ce qui ne fonctionne pas ou est manquant ❌

### Sélection de modèle texte
- **Aucun sélecteur** dans `IntentionForm`
- Modèle entièrement défini par `env.CONTENT_STUDIO_TEXT_MODEL`
- L'opérateur ne peut pas piloter coût vs qualité
- Pas de feedback du modèle utilisé après génération

### Sélection de modèle image / vidéo
- **Aucun sélecteur** dans `MediaStudio`
- Modèle image fixé par `env.CONTENT_STUDIO_IMAGE_MODEL`
- **Aucun chemin vidéo** côté backend (la route `/generate-visual` traite uniquement les images)
- Pas de suggestion adaptée au format (reel devrait pousser vers vidéo verticale)

### Mock vidéo
- **Inexistant**. Le mode mock image existe (SVG → PNG) mais pas son équivalent vidéo
- Le PreviewPane sait afficher `<video>` mais aucun chemin code ne fournit d'URL MP4 mock
- Conséquence : impossible de valider le flux `reel` sans média uploadé manuellement

### Step 3 (Visual) déverrouillage
- `Stepper.STATUS_TO_STEP` mappe `needs_review → visual`
- Mais **aucun chemin UI ne fait passer un draft de `generated` → `needs_review`**
- Le hack `deriveActiveStep` avance visuellement mais `draft.status` reste à `generated`
- Conséquence : la mécanique de déverrouillage repose sur un effet visuel, pas sur l'état métier

### Step 4 (Validate) postId
- `PublishActionGroup` n'est actif que si `postId` existe
- `postId` est créé par `POST /drafts/:id/approve` côté backend
- **Mais cet endpoint n'est jamais appelé depuis l'UI** sur le parcours nominal
- L'utilisateur voit "Approuvez le draft pour activer la publication" sans bouton dédié
- Le seul moyen actuel : `publish-now` qui assume un postId déjà existant → 404

### Versions intermédiaires / historique
- Pas de table `draft_versions` ni d'audit log
- Seul `content_brief.version` existe (versioning brief, pas draft)
- Pas de "Annuler" / "Restaurer version précédente" dans l'UI

### Brouillons côté provider
- `POST /posts/:id/draft-on-provider` existe mais sa réussite dépend de l'intégration Postiz
- En mock pure, le job est créé mais l'effet visuel UI est minimal (juste un toast)

### Planification (schedule)
- `POST /posts/:id/schedule` fonctionne mais :
  - Pas d'UI pour visualiser un calendrier complet
  - Pas de modification facile post-scheduling (il faut passer par `reschedule`)
  - Pas de fuseau horaire explicite dans l'UI (DTL → naive)

### Tests E2E
- **Aucun spec Playwright** pour `/admin/content-studio-v2/create`
- Specs v1 existent mais ne couvrent pas v2
- Régressions visuelles non détectables automatiquement

### Mock mode global
- Le mock est par-provider (`CONTENT_STUDIO_IMAGE_PROVIDER=mock`), pas global
- Pas de badge "Mode mock" en UI
- Risque de confusion : un opérateur croit publier réellement alors qu'il est en mock

### Validations cross-cutting non testées
- A11y : pas d'audit axe
- Dark mode : non vérifié
- Responsive < 1024px : la mise en page 3 colonnes ne se replie pas
- Keyboard : Tab order non testé

## Synthèse risque

| Aire | Gravité | Impact opérateur |
|------|---------|-------------------|
| Step Validate inaccessible | 🔴 Bloquant | Ne peut jamais publier sans contournement DB |
| Pas de modèle vidéo | 🔴 Bloquant | format `reel` inutilisable sans upload manuel |
| Pas de mock vidéo | 🟠 Élevé | Démo / staging inutilisable pour reel |
| Pas de modèle texte choisi | 🟠 Élevé | Coûts non pilotables |
| Pas de modèle image choisi | 🟠 Élevé | Coûts/qualité non pilotables |
| Step Visual lock visuel-only | 🟡 Moyen | UX trompeuse mais fonctionnellement OK |
| Pas d'historique | 🟡 Moyen | Modification = destruction silencieuse |
| Tests E2E v2 absents | 🔴 Bloquant qualité | Régressions invisibles |

## Mesures à prendre

Voir `04-gaps-and-issues.md` pour la cartographie complète des manques et `01-action-plan.md` pour le plan d'action priorisé.
