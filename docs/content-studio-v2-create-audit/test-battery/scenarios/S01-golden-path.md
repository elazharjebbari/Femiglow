# S01 — Golden Path (parcours nominal)

> Parcours opérateur de bout en bout en mock mode, validant tous les composants du chemin nominal.

## Acteur
Opérateur admin connecté

## Pré-conditions
- Env `CONTENT_STUDIO_V2_MOCK_MODE=true`
- Mocks vidéo présents dans `/public/_media/content-studio/mock/`
- Budget quotidien non épuisé

## Étapes

### 1. Accès page
- Visite `/admin/content-studio-v2/create`
- **Attendu** : page charge, sidebar visible, AppShell rendu, Stepper avec étape "Cadrer" active

### 2. Cadrer
- Sélectionne format "Reel"
- Sélectionne pilier "Rituel", objectif "Considération", plateforme "Instagram"
- Ouvre ModelPicker (chat), vérifie "Recommandé pour reel" en haut → sélectionne "GPT-4o"
- Remplit Intention : "Présenter le rituel du soir FemiGlow"
- Click "Enregistrer l'idée"
- **Attendu** :
  - Loader visible
  - POST /ideas envoyé avec body.model='gpt-4o'
  - POST /ideas/:id/generate envoyé automatiquement
  - 3 variantes visibles après ~2s (mock)
  - Stepper passe à "Générer"

### 3. Sélectionner variante
- Click "Choisir cette variante" sur la première carte
- **Attendu** :
  - Carte sélectionnée (border accent)
  - POST /drafts/:id/review envoyé en arrière-plan
  - Stepper passe à "Visuel"

### 4. Générer vidéo mock
- Dans MediaStudio, tab "Générer IA"
- Vérifie que toggle "Vidéo" est ON par défaut (format=reel)
- Vérifie que ModelPicker affiche "Mock vidéo"
- Click "Générer"
- **Attendu** :
  - POST /drafts/:id/generate-visual avec body.kind='video' envoyé
  - Vidéo apparaît dans PreviewPane après ~1s
  - `<video controls>` avec src vers `/_media/.../reel-9x16.mp4`

### 5. Éditer caption (optionnel)
- Modifier caption dans CaptionEditor
- Attendre 2s
- **Attendu** : autosave indicator passe par saving → saved

### 6. Valider
- Click "Valider et préparer la publication" sous PreviewPane
- **Attendu** :
  - POST /drafts/:id/approve envoyé
  - Toast "Draft validé, prêt à publier"
  - Stepper passe à "Valider"
  - Dropdown Publier débloqué

### 7. Publier maintenant
- Click "Publier" → "Publier maintenant"
- Dialog confirmation affiche thumbnail + caption
- Click "Confirmer"
- **Attendu** :
  - POST /posts/:id/publish-now envoyé
  - Toast "Publication lancée"
  - En mock : statut 'published' immédiat

## Critères de succès
- Aucune erreur console
- Aucun toast rouge
- Toutes les transitions de statut respectées (idea → generated → needs_review → approved → published)
- 5 appels API minimum dans la timeline

## Spec Playwright
`e2e/content-studio-v2/create-golden-path.spec.ts`
