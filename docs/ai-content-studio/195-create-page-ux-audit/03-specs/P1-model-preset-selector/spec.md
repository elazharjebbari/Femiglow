# P1 -- Model Preset Selector

## Composant

**Nom:** `ModelPresetSelector`
**Fichier:** `apps/web/src/components/admin/content-studio-v2/ai-engine/ModelPresetSelector.tsx`
**But:** Permettre a l'operateur de choisir un modele LLM via 4 presets intelligents (Auto, Rapide, Premium, Personnalise) au lieu de naviguer dans une liste brute de modeles.

---

## Props Interface

```typescript
type PresetKey = 'auto' | 'fast' | 'premium' | 'custom';

interface PresetMapping {
  fast: Record<string, string>;    // providerType -> model id
  premium: Record<string, string>; // providerType -> model id
}

interface ModelPresetSelectorProps {
  capability: string;                       // 'text' | 'image' | 'video'
  selectedModel: string;                    // resolved model name (e.g. "gpt-4o-mini")
  onModelChange: (model: string) => void;   // callback quand le modele change
  disabled?: boolean;                       // desactive l'ensemble
  defaultProvider?: string;                 // provider par defaut pour la resolution auto (defaut: 'openai')
}
```

---

## Les 4 Presets

| Preset        | Icone (lucide) | Label       | Description                            | Modele Resolu                    |
|---------------|----------------|-------------|----------------------------------------|----------------------------------|
| `auto`        | Cpu            | Auto        | Le systeme choisit le meilleur modele  | Valeur de la config globale      |
| `fast`        | Zap            | Rapide      | Modele economique et rapide            | Voir mapping ci-dessous          |
| `premium`     | Star           | Premium     | Modele le plus performant              | Voir mapping ci-dessous          |
| `custom`      | Settings       | Personnalise| Choix libre via ModelSelector popover  | Selection manuelle de l'operateur|

---

## Preset-to-Model Mapping (Configurable)

```typescript
const DEFAULT_PRESET_MAPPING: PresetMapping = {
  fast: {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-haiku-4-20250514',
    google: 'gemini-2.5-flash',
    ollama: 'llama3.1:8b',
  },
  premium: {
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-20250514',
    google: 'gemini-2.5-pro',
    ollama: 'qwen2.5',
  },
};
```

Le mapping est passe en tant que constante exportee, facilement modifiable quand de nouveaux modeles sortent. Il est possible de le surcharger depuis la config globale dans une iteration future.

La resolution du modele suit cet algorithme:
1. **Auto:** Utilise `''` (chaine vide) -- le backend utilisera sa config (`AI_ENGINE_DEFAULT_TEXT_MODEL`)
2. **Fast/Premium:** Recherche `PRESET_MAPPING[preset][defaultProvider]`, fallback sur `openai`
3. **Custom:** Retourne le modele choisi via le `ModelSelector`

---

## Etat Interne

```typescript
const [activePreset, setActivePreset] = useState<PresetKey>('auto');
const [customModel, setCustomModel] = useState<string>('');
```

Quand `activePreset` change:
- Si `auto`: appelle `onModelChange('')`
- Si `fast`: appelle `onModelChange(resolvedFastModel)`
- Si `premium`: appelle `onModelChange(resolvedPremiumModel)`
- Si `custom`: ne declenche pas de changement immediatement; attend la selection dans le `ModelSelector`

Quand l'utilisateur selectionne un modele dans le `ModelSelector` (mode custom):
- `customModel` est mis a jour
- `onModelChange(customModel)` est appele

---

## Design Visuel -- ASCII Mockup

```
 Modele de redaction:

 +--------+----------+-----------+--------------+
 | * Auto |  Rapide  |  Premium  | Personnalise |
 +--------+----------+-----------+--------------+
   [Cpu]    [Zap]      [Star]      [Settings]

 ^ bouton selectionne: fond accent, texte blanc
   boutons non-selectionnes: fond transparent, bordure grise, texte muted


 Quand "Personnalise" est actif:

 +--------+----------+-----------+--------------+
 |  Auto  |  Rapide  |  Premium  | *Personnalise|
 +--------+----------+-----------+--------------+

 +--------------------------------------------+
 |  [ModelSelector popover inline]            |
 |  Selectionner des modeles                  |
 +--------------------------------------------+
```

---

## Layout Boutons

- Disposition: `display: flex`, pas de gap (boutons jointifs = segmented control)
- Premier bouton: `border-radius: var(--cs-radius-sm) 0 0 var(--cs-radius-sm)`
- Dernier bouton: `border-radius: 0 var(--cs-radius-sm) var(--cs-radius-sm) 0`
- Boutons du milieu: `border-radius: 0`
- Bordure partagee: `border: 1px solid var(--cs-border)`, sauf cote adjacent (`border-left: none` sauf premier)
- Taille bouton: `padding: 8px 14px`, `font-size: var(--cs-text-sm)`
- Icone: 14px, a gauche du label, gap 6px

---

## Bouton Selectionne (Actif)

```css
background: var(--cs-accent);
color: white;
border-color: var(--cs-accent);
font-weight: 600;
```

## Boutons Non-Selectionnes

```css
background: var(--cs-bg-base);
color: var(--cs-fg-secondary);
border-color: var(--cs-border);
font-weight: 400;
cursor: pointer;
```

Hover: `background: var(--cs-bg-elevated)`

---

## ModelSelector Inline (Mode Personnalise)

Quand `activePreset === 'custom'`, un composant `ModelSelector` (existant) apparait en dessous des boutons avec `margin-top: 10px`.

Props passees au `ModelSelector`:
```typescript
<ModelSelector
  providerType={defaultProvider ?? 'openai'}
  selectedModels={customModel ? [customModel] : []}
  onModelsChange={(models) => {
    const model = models[0] ?? '';
    setCustomModel(model);
    onModelChange(model);
  }}
  capabilityFilter={capability}
  disabled={disabled}
/>
```

Note: Le `ModelSelector` existant supporte la multi-selection, mais ici on ne prend que le premier modele selectionne.

---

## Valeur Passee au Parent

Le parent recoit toujours une **chaine de caracteres** representant le nom du modele:
- `''` (vide) pour Auto (le backend decide)
- `'gpt-4o-mini'` pour Rapide (provider openai)
- `'gpt-4o'` pour Premium (provider openai)
- `'claude-sonnet-4-20250514'` pour Personnalise (selon selection)

---

## Data Flow

```
BriefForm state (page.tsx)
  |
  +-- textModel: string (initialement '')
  |
  +-- <ModelPresetSelector
  |     capability="text"
  |     selectedModel={form.textModel}
  |     onModelChange={(m) => updateField('textModel', m)}
  |   />
  |
  +-- handleGenerate() envoie body.textModel au POST /generate
```

---

## API Changes

**POST `/api/admin/ai-engine/generate`** -- body enrichi:

```typescript
interface GenerateRequestBody {
  // champs existants...
  objective: string;
  platform: string;
  format: string;
  tone: string;
  keyMessage: string;
  productFocus?: string;
  trendReference?: string;
  // nouveau champ:
  textModel?: string;  // vide = auto, sinon le model ID choisi
}
```

Le backend utilise `textModel` s'il est fourni, sinon utilise `AI_ENGINE_DEFAULT_TEXT_MODEL`.

---

## Accessibilite

- Les 4 boutons forment un `role="radiogroup"` avec `aria-label="Selection du preset de modele"`
- Chaque bouton a `role="radio"` et `aria-checked="true|false"`
- Navigation clavier: fleches gauche/droite pour changer de preset
- `Tab` entre dans le groupe, fleches changent la selection, `Tab` sort du groupe
- Le `ModelSelector` inline herite de sa propre accessibilite (popover avec combobox)

---

## Edge Cases

| Cas                                              | Comportement                                              |
|--------------------------------------------------|-----------------------------------------------------------|
| Provider non dans le mapping                     | Fallback sur `openai` dans le mapping                     |
| Custom selectionne mais aucun modele choisi       | `onModelChange('')` -- meme que Auto                      |
| Changement de preset pendant generation           | Les boutons sont disabled pendant `phase === 'generating'`|
| Liste de modeles vide pour le provider            | Le ModelSelector affiche "Aucun modele trouve"            |
| Provider API timeout pour discovery               | Le ModelSelector gere deja ce cas (message erreur)        |
| Preset change de `custom` vers `fast`            | Le ModelSelector inline disparait, modele resolu change   |

---

## Fichiers Impactes

| Fichier | Modification |
|---------|-------------|
| `components/admin/content-studio-v2/ai-engine/ModelPresetSelector.tsx` | Nouveau composant |
| `app/admin/content-studio-v2/ai-engine/create/page.tsx` | Import + state `textModel` + rendu dans section avancee |
| `app/api/admin/ai-engine/generate/route.ts` | Lire `textModel` du body, passer au pipeline |
| `test/msw/ai-engine-handlers.ts` | Pas de modification requise (le champ est optionnel) |
