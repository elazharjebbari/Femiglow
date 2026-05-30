# P2 -- Parametres Avances (Section Pliable)

## Composant

**Nom:** `AdvancedParams`
**Fichier:** `apps/web/src/components/admin/content-studio-v2/ai-engine/AdvancedParams.tsx`
**But:** Regrouper tous les parametres techniques (modeles texte, image, video, toggles) dans une section pliable en bas du brief form, accessible aux operateurs avances sans surcharger l'interface principale.

---

## Props Interface

```typescript
interface AdvancedParamsProps {
  format: string;                          // format du brief (reel, carousel, story, single_image, text_post, infographic)
  textModel: string;                       // modele texte selectionne (vide = auto)
  onTextModelChange: (model: string) => void;
  imageModel: string;                      // modele image selectionne
  onImageModelChange: (model: string) => void;
  videoModel: string;                      // modele video selectionne
  onVideoModelChange: (model: string) => void;
  generateVisuals: boolean;                // toggle generation visuels
  onGenerateVisualsChange: (v: boolean) => void;
  humanReviewRequired: boolean;            // toggle review humaine
  onHumanReviewChange: (v: boolean) => void;
  disabled?: boolean;                      // tout desactiver pendant generation
  defaultProvider?: string;                // provider par defaut pour les presets
}
```

---

## Structure Interne

La section utilise le pattern `CollapsibleSection` existant (deja dans `GenerationResult.tsx` lignes 96-147). On reutilise le meme composant ou on le duplique en tant que composant partage.

```
<CollapsibleSection
  title="Parametres avances"
  icon={<Settings size={14} />}
  defaultOpen={false}
>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {/* 1. ModelPresetSelector pour texte */}
    {/* 2. ModelSelector pour image */}
    {/* 3. ModelSelector pour video (conditionnel) */}
    {/* 4. Toggle: Generer les visuels */}
    {/* 5. Toggle: Review humaine */}
  </div>
</CollapsibleSection>
```

---

## Contenu de la Section

### 1. Modele de Redaction (texte)

- **Label:** "Modele de redaction"
- **Composant:** `<ModelPresetSelector>` (P1)
- **Props:** `capability="text"`, `selectedModel={textModel}`, `onModelChange={onTextModelChange}`
- **Toujours visible**

### 2. Modele d'Image

- **Label:** "Modele d'image"
- **Composant:** `<ModelSelector>` (existant)
- **Props:** `providerType={defaultProvider ?? 'openai'}`, `capabilityFilter="image"`, `selectedModels={imageModel ? [imageModel] : []}`, `onModelsChange={(m) => onImageModelChange(m[0] ?? '')}`
- **Toujours visible** (meme si format est text_post -- car l'operateur peut vouloir generer des visuels supplementaires)

### 3. Modele Video

- **Label:** "Modele video"
- **Composant:** `<ModelSelector>` (existant)
- **Props:** `providerType="higgsfield"`, `capabilityFilter="video"`, `selectedModels={videoModel ? [videoModel] : []}`, `onModelsChange={(m) => onVideoModelChange(m[0] ?? '')}`
- **Visibilite conditionnelle:** Visible uniquement quand `format` est `'reel'`, `'story'`, ou `'carousel'`

```typescript
const VIDEO_FORMATS = ['reel', 'story', 'carousel'];
const showVideoModel = VIDEO_FORMATS.includes(format);
```

### 4. Toggle "Generer les visuels"

- **Label:** "Generer les visuels"
- **Description:** "Produire des images et/ou videos avec le contenu texte"
- **Composant:** Toggle custom inline (pas de dependance externe)
- **Etat par defaut:** `true`
- **Quand desactive:** Les ModelSelectors image et video sont masques (ou grises)

### 5. Toggle "Review humaine avant publication"

- **Label:** "Review humaine avant publication"
- **Description:** "Forcer une etape de validation humaine avant la mise en ligne"
- **Composant:** Toggle custom inline
- **Etat par defaut:** Valeur de la config globale (`MOCK_HEALTH.quality.humanReviewRequired`, actuellement `false`)
- **Impact:** Envoye dans le body POST /generate comme `humanReviewRequired: true/false`

---

## Design Visuel -- ASCII Mockup

```
+----------------------------------------------------------+
| [v] Parametres avances                         [Settings] |
+----------------------------------------------------------+
|                                                          |
|  Modele de redaction                                     |
|  +--------+----------+-----------+--------------+        |
|  | * Auto |  Rapide  |  Premium  | Personnalise |        |
|  +--------+----------+-----------+--------------+        |
|                                                          |
|  Modele d'image                                          |
|  +--------------------------------------------------+   |
|  | Selectionner des modeles              [ChevDown] |   |
|  +--------------------------------------------------+   |
|                                                          |
|  Modele video                    (visible si reel/story) |
|  +--------------------------------------------------+   |
|  | Selectionner des modeles              [ChevDown] |   |
|  +--------------------------------------------------+   |
|                                                          |
|  +----+  Generer les visuels                             |
|  |[ON]|  Produire des images et/ou videos                |
|  +----+                                                  |
|                                                          |
|  +-----+  Review humaine avant publication               |
|  |[OFF]|  Forcer une etape de validation humaine         |
|  +-----+                                                 |
|                                                          |
+----------------------------------------------------------+
```

---

## Toggle Component (Inline)

Un toggle switch simple inline (pas de librairie externe):

```typescript
function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  // ...renders a toggle switch with label and optional description
}
```

Styles du toggle:
- **Track:** 36px x 20px, `border-radius: 10px`
- **Thumb:** 16px x 16px, translate-x quand actif
- **Actif:** bg `var(--cs-accent)`, thumb blanc
- **Inactif:** bg `var(--cs-border)`, thumb `var(--cs-bg-base)`
- **Disabled:** opacity 0.5

---

## Layout

- Section pliable positionnee en bas du formulaire brief, juste avant le bouton "Generer"
- `margin-top: 18px` par rapport au dernier champ du formulaire
- Contenu interne: `display: flex`, `flexDirection: column`, `gap: 16px`
- Chaque controle est un bloc vertical: label en haut, composant en bas
- Labels: classe `cs-eyebrow`, `font-size: var(--cs-text-xs)`

---

## Etat par Defaut

Quand la section est montee pour la premiere fois:
- **Etat ferme** (collapsed)
- `textModel`: `''` (Auto)
- `imageModel`: `''` (defaut systeme)
- `videoModel`: `''` (defaut systeme)
- `generateVisuals`: `true`
- `humanReviewRequired`: `false` (ou valeur de la config)

---

## Data Flow

```
AIEngineCreatePage (state)
  |
  +-- textModel, imageModel, videoModel, generateVisuals, humanReviewRequired
  |
  +-- <AdvancedParams
  |     format={form.format}
  |     textModel={textModel}
  |     onTextModelChange={setTextModel}
  |     imageModel={imageModel}
  |     onImageModelChange={setImageModel}
  |     videoModel={videoModel}
  |     onVideoModelChange={setVideoModel}
  |     generateVisuals={generateVisuals}
  |     onGenerateVisualsChange={setGenerateVisuals}
  |     humanReviewRequired={humanReviewRequired}
  |     onHumanReviewChange={setHumanReviewRequired}
  |     disabled={phase !== 'brief'}
  |   />
  |
  +-- handleGenerate() body:
        {
          ...briefFields,
          textModel,
          imageModel,
          videoModel,
          generateVisuals,
          humanReviewRequired,
        }
```

---

## API Changes

**POST `/api/admin/ai-engine/generate`** -- body enrichi:

```typescript
interface GenerateRequestBody {
  // existants:
  objective: string;
  platform: string;
  format: string;
  tone: string;
  keyMessage: string;
  productFocus?: string;
  trendReference?: string;
  // nouveaux:
  textModel?: string;          // modele LLM pour le texte
  imageModel?: string;         // modele pour les images
  videoModel?: string;         // modele pour les videos
  generateVisuals?: boolean;   // generer images/videos (defaut: true)
  humanReviewRequired?: boolean; // forcer la review humaine
}
```

Tous les nouveaux champs sont **optionnels** avec des valeurs par defaut cote backend. Aucune migration de base de donnees requise.

---

## Accessibilite

- La section CollapsibleSection a `aria-expanded="true|false"` sur le bouton toggle
- Le bouton a `aria-controls` pointant vers l'ID du contenu
- Chaque toggle a `role="switch"` et `aria-checked="true|false"`
- Labels associes via `aria-labelledby`
- Les descriptions sont liees via `aria-describedby`
- Quand `disabled`, `aria-disabled="true"` sur chaque controle

---

## Interaction avec le Toggle "Generer les visuels"

Quand `generateVisuals === false`:
- Les `ModelSelector` image et video sont masques (ne pas render)
- Les valeurs `imageModel` et `videoModel` sont ignorees dans le body POST
- Le `handleGenerate` envoie `generateVisuals: false` au backend
- Le backend skip les nodes `generate_images` et `generate_video` dans le pipeline

---

## Edge Cases

| Cas                                           | Comportement                                            |
|-----------------------------------------------|---------------------------------------------------------|
| Format change de `reel` a `text_post`         | Le ModelSelector video disparait, videoModel reset a '' |
| generateVisuals desactive puis reactive       | Les ModelSelectors reapparaissent avec leurs valeurs    |
| Section ouverte pendant generation            | Tous les controles sont disabled                        |
| handleReset appele                            | Section se replie, tous les champs reviennent au defaut |
| Operateur ne touche pas la section            | Valeurs par defaut utilisees (Auto, true, false)        |
| Section fermee, valeurs modifiees a l'interieur| Les valeurs persistent meme quand la section est fermee|
| Tous les providers offline                    | Les ModelSelectors affichent leur message d'erreur      |

---

## Fichiers Impactes

| Fichier | Modification |
|---------|-------------|
| `components/admin/content-studio-v2/ai-engine/AdvancedParams.tsx` | Nouveau composant |
| `app/admin/content-studio-v2/ai-engine/create/page.tsx` | Import + state (5 champs) + rendu dans le brief form + body enrichi |
| `app/api/admin/ai-engine/generate/route.ts` | Lire les nouveaux champs du body |
| `components/admin/content-studio-v2/ai-engine/GenerationResult.tsx` | Extraire `CollapsibleSection` en composant partage (optionnel) |
