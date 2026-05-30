# Gaps & Issues — Content Studio v2 Create

> **Lecture** : matrice exhaustive des manques, classés par gravité, avec impact, racine et action de remédiation.

## Légende gravité

| Niveau | Définition |
|--------|------------|
| 🔴 P0 | Bloquant fonctionnel ou qualité — empêche le parcours nominal |
| 🟠 P1 | Élevé — dégrade fortement l'UX ou la maintenabilité |
| 🟡 P2 | Moyen — amélioration UX ou robustesse |
| 🟢 P3 | Faible — polish, cohérence visuelle |

---

## G01 🔴 Step 4 (Validate) inaccessible — pas d'approbation explicite

### Symptômes
- Bouton Publier toujours désactivé
- Tooltip "Approuvez le draft pour activer la publication" sans bouton dédié
- L'opérateur n'a aucun moyen UI de créer le `content_post`

### Racine
- `PublishActionGroup` lit `postId` depuis `posts.find((p) => p.draftId === draft.id)` (CreateWorkspace.tsx:66-69)
- Le post n'est créé que par `POST /drafts/[id]/approve` (service.ts:363-391)
- Cet endpoint n'est appelé nulle part dans l'UI

### Impact
- L'opérateur ne peut JAMAIS publier sans contournement DB direct ou appel curl
- Toute démo/staging est inutilisable bout en bout

### Remédiation (voir Phase 5)
- Ajouter un bouton "Valider et préparer la publication" dans `PreviewPane` ou en footer (variant=primary)
- Appel POST /drafts/[id]/approve avec gestion d'erreur (média manquant, brand review blocked)
- Sur succès : `upsertPost(post)` dans le context → débloque `PublishActionGroup`

---

## G02 🔴 Format `reel` non opérable — aucune génération vidéo

### Symptômes
- Sélectionner format `reel` puis tenter de générer un visuel produit une image, pas une vidéo
- L'aperçu reel attend du `kind=video` mais reçoit `kind=image`

### Racine
- `MediaStudio.generateVisual()` (MediaStudio.tsx:48) appelle uniquement `/generate-visual`
- Le service `generateStudioImage` (image-generation.ts:19-62) ne génère que des images
- Pas de chemin code video, pas de provider video configuré

### Impact
- Format reel inutilisable bout en bout en réel ou en mock
- Le code mort de support `<video>` dans PreviewPane induit en erreur

### Remédiation (voir Phase 3+4)
- Phase 3 : étendre `generate-visual` avec `kind: 'image'|'video'` et `model`
- Phase 4 : `generateMockVideo()` retourne un MP4 réel
- Phase 7 : E2E couvre le format reel intégral

---

## G03 🔴 Pas de sélection de modèle (texte + image + vidéo)

### Symptômes
- L'utilisateur ne peut pas choisir gpt-4o vs gpt-4o-mini vs claude-sonnet-4
- L'utilisateur ne peut pas choisir DALL-E vs gpt-image-1
- Le `content_generation_run.model` reflète l'env, pas un choix

### Racine
- Les routes API n'acceptent pas de paramètre `model`
- Les composants UI ne le proposent pas
- Pas de "model registry" centralisé côté serveur

### Impact
- Coût/qualité non pilotables → factures imprévisibles
- Pas de différenciation A/B "fast vs premium"

### Remédiation (Phase 1 + 2 + 3)
- Phase 1 : registry + endpoint GET /models
- Phase 2 : ModelPicker dans IntentionForm
- Phase 3 : ModelPicker dans MediaStudio (image + video)

---

## G04 🔴 Tests E2E Playwright absents pour v2 `/create`

### Symptômes
- 0 spec dans `e2e/content-studio-v2/`
- Régressions UI non détectées avant prod

### Racine
- Tests historiquement écrits pour v1
- Migration vers v2 non assortie d'une mise à jour test plan

### Impact
- Refactor risqué
- Toute amélioration du présent plan doit s'accompagner d'une couverture E2E

### Remédiation (Phase 7)
- 8 scénarios principaux (S01-S08)
- ≥ 4 cross-cutting (a11y, dark mode, responsive, keyboard)

---

## G05 🟠 Step 3 (Visual) déverrouillage via hack visuel

### Symptômes
- `draft.status` reste `generated` mais le Stepper montre étape Visual active
- Si l'utilisateur recharge la page, l'étape Visual peut redevenir inactive

### Racine
- `deriveActiveStep` (Stepper.tsx:40-52) :
  ```
  if (base === 'visual' && hasMedia && caption.trim()) return 'validate'
  ```
- Aucune transition de statut en DB

### Impact
- L'UX semble fluide mais la source de vérité (status) est incohérente
- Audit/reporting backend ne reflète pas le parcours réel

### Remédiation (Phase 5)
- Auto-appel `POST /drafts/[id]/review` à la sélection de variante
- Service met à jour draft.status → `needs_review`
- Stepper lit la vraie source

---

## G06 🟠 Pas de mock mode global

### Symptômes
- Le mock est par-provider (image only)
- Aucun badge "Mock" visible
- Risque de confusion en démo / staging

### Racine
- `CONTENT_STUDIO_IMAGE_PROVIDER=mock` est local au service image
- Pas de `CONTENT_STUDIO_V2_MOCK_MODE` global qui pilote texte + image + vidéo + publication

### Impact
- Démo ambigüe (l'opérateur croit publier réellement)
- Test E2E doit configurer 3 env vars distinctes

### Remédiation (Phase 1)
- Nouvelle env `CONTENT_STUDIO_V2_MOCK_MODE`
- Si true : forcer mock sur tous les générateurs et publish-jobs
- Badge "Mode mock" visible dans Stepper et PublishActionGroup

---

## G07 🟠 Pas de feedback sur le modèle utilisé

### Symptômes
- Après génération, l'utilisateur ne voit pas quel modèle a été appelé
- Si fallback, aucun indicateur visuel

### Racine
- `VariantsCompare` ne lit pas `content_generation_run`
- L'API `/ideas/:id/generate` retourne `drafts` mais pas la métadonnée de génération

### Impact
- Confiance opérateur affaiblie
- Imputation des coûts opaque

### Remédiation (Phase 2)
- Étendre la réponse `/ideas/:id/generate` avec `runs: [{ model, provider, status, costCents }]`
- Badge inline dans VariantsCompare : "Généré par gpt-4o-mini · 0.6¢"

---

## G08 🟠 Autocomplete modèle non adapté au format

### Symptômes
- Aucune suggestion contextuelle ("pour un reel viral, suggérer gpt-4o + sora-mock")
- L'opérateur choisit aveuglément ou rate le bon preset

### Racine
- Pas de logique `suggestForFormat()` côté serveur ou client

### Impact
- Friction cognitive
- Erreurs de configuration (DALL-E 1024×1024 pour un reel 9:16)

### Remédiation (Phase 1 + voir P04)
- Registry côté serveur expose `suggestForFormat(format) → { chat, image, video }`
- ModelPicker met en avant la suggestion ("Recommandé pour reel")

---

## G09 🟠 Pas de versioning des drafts

### Symptômes
- Modifier une caption détruit silencieusement la version précédente
- Aucun "Annuler la modification" autre que `Cmd+Z` du textarea (volatil)

### Racine
- `content_drafts` n'a pas de table associée `content_draft_versions`
- L'autosave PATCH écrase

### Impact
- Perte accidentelle non récupérable
- Pas de comparaison historique

### Remédiation (Phase 5 ou backlog futur)
- Recommandation : table `content_draft_versions` avec snapshot JSONB
- Trigger à chaque PATCH créant une nouvelle version
- UI : timeline + bouton "Restaurer cette version"

**Note** : hors scope du plan d'action P0-P2, à traiter dans un sprint dédié. Voir `features/F12-autosave-versions/`.

---

## G10 🟡 Stepper navigation rétrograde limitée

### Symptômes
- Steps futurs disabled (cursor:not-allowed, opacity 0.5)
- Pas de tooltip explicatif

### Racine
- Stepper.tsx:101 : `cursor: isFuture ? 'not-allowed' : 'pointer'`
- Aucun handler conditionnel

### Impact
- UX rigide
- Opérateur expérimenté frustré

### Remédiation (Phase 5)
- Step rétrograde : toujours cliquable (revenir corriger)
- Step futur : disabled mais tooltip "Complétez l'étape X pour continuer"

---

## G11 🟡 PreviewPane n'a pas d'état "vide"

### Symptômes
- Avant génération, la zone preview est vide ou affiche un placeholder neutre
- Pas d'invitation explicite à compléter l'étape précédente

### Racine
- Pas de prop `emptyState` ou bandeau guidance

### Impact
- Friction au premier usage

### Remédiation (Phase 6)
- État vide : illustration + "Décrivez votre intention pour générer un aperçu"

---

## G12 🟡 Pas de prévisualisation publish

### Symptômes
- Au clic "Publier maintenant", pas de récap final avant envoi
- Le Dialog actuel est texte-only ("Vérifie l'aperçu une dernière fois.")

### Racine
- Dialog volontairement minimal

### Impact
- Risque d'erreur de dernière minute

### Remédiation (Phase 6)
- Dialog enrichi : thumbnail média + caption tronquée + plateforme + horaire si schedule

---

## G13 🟡 Erreurs publish opaques

### Symptômes
- Toast rouge "Publication : HTTP 500" sans détail
- Logs serveur seuls

### Racine
- `executePublish` capture `err.message` uniquement (PublishActionGroup.tsx:71)

### Impact
- Diagnostic difficile

### Remédiation (Phase 6)
- Mapper erreurs serveur connues (budget, brand_review_blocked, no_account_connected) en messages clairs

---

## G14 🟡 A11y partielle

### Symptômes
- Pas d'audit axe en CI
- Focus visible inconsistant sur Stepper et PublishOption
- Aria-labels présents mais inégaux

### Racine
- Pas de pipeline a11y

### Impact
- Risque conformité, exclusion utilisateurs

### Remédiation (Phase 7 cross-cutting)
- Intégrer axe-core dans Playwright
- Spec dédié `e2e/content-studio-v2/a11y.spec.ts`

---

## G15 🟢 Responsive < 1024px

### Symptômes
- Grille 3 colonnes ne se replie pas
- Scroll horizontal possible sur tablette portrait

### Racine
- Grid template hardcodée en CSS inline

### Impact
- Usage tablette dégradé

### Remédiation (Phase 7 cross-cutting)
- Media query : empile en 1 colonne en dessous de 1024px

---

## G16 🟢 Dark mode non vérifié

### Symptômes
- Couleurs CSS vars var(--cs-*) supposées dark-aware mais pas testées

### Remédiation (Phase 7 cross-cutting)
- Snapshot Playwright avec `prefers-color-scheme: dark`

---

## Matrice gravité × phase

| Gap | Niveau | Adressée par |
|-----|--------|--------------|
| G01 Validate inaccessible | 🔴 P0 | Phase 5 |
| G02 Pas de vidéo | 🔴 P0 | Phase 3+4 |
| G03 Pas de model picker | 🔴 P0 | Phase 1+2+3 |
| G04 E2E absent | 🔴 P0 | Phase 7 |
| G05 Step visual hack | 🟠 P1 | Phase 5 |
| G06 Mock global | 🟠 P1 | Phase 1 |
| G07 Feedback modèle | 🟠 P1 | Phase 2 |
| G08 Autocomplete par format | 🟠 P1 | Phase 1+P04 |
| G09 Versioning drafts | 🟠 P1 | **Backlog** (hors scope) |
| G10 Stepper retro | 🟡 P2 | Phase 5 |
| G11 Empty state preview | 🟡 P2 | Phase 6 |
| G12 Publish preview | 🟡 P2 | Phase 6 |
| G13 Erreurs publish | 🟡 P2 | Phase 6 |
| G14 A11y | 🟡 P2 | Phase 7 |
| G15 Responsive | 🟢 P3 | Phase 7 |
| G16 Dark mode | 🟢 P3 | Phase 7 |
