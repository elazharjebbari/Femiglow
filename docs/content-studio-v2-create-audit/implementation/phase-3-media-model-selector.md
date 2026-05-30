# Phase 3 — Media Model Selector (MediaStudio)

## Objectif
Permettre le choix du modèle image et vidéo dans MediaStudio, avec toggle Image/Vidéo et suggestion par format.

## Durée estimée
2 j-p (dev) + 0.5 j (tests)

## Dépendances
- Phase 1 (registry)

## Refactor MediaStudio

### Avant (actuel)
```
[Title + Budget + Décrocher + Générer]
[MediaPicker]
```

### Après (cible)
```
[Title + Budget]
[Tabs: Bibliothèque | Générer IA]
  Bibliothèque: [MediaPicker]
  Générer IA:
    [Toggle Image | Vidéo] (selon format)
    [ModelPicker role=image|video]
    [Prompt textarea]
    [Size + Quality] (image only)
    [Bouton Générer]
```

## Fichiers à modifier

### 1. `MediaStudio.tsx`

```tsx
import { useState, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { ModelPicker } from './ModelPicker';

type GenKind = 'image' | 'video';

export function MediaStudio({ draft, ...props }: MediaStudioProps) {
  const [tab, setTab] = useState<'library' | 'generate'>('library');
  const [kind, setKind] = useState<GenKind>(
    draft?.format === 'reel' || draft?.format === 'story' ? 'video' : 'image'
  );
  const [model, setModel] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(defaultVisualPrompt ?? '');
  const [size, setSize] = useState<string>('1024x1024');
  const [quality, setQuality] = useState<'low'|'medium'|'high'>('low');

  // … existing budget + generate logic, étendre :

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/content-studio/drafts/${draftId}/generate-visual`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt,
          kind,
          model: model ?? undefined,
          size: kind === 'image' ? size : undefined,
          quality: kind === 'image' ? quality : undefined,
        }),
      });
      // … rest
    }
  }

  return (
    <section ...>
      <Header />
      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List>
          <Tabs.Trigger value="library">Bibliothèque</Tabs.Trigger>
          <Tabs.Trigger value="generate">Générer IA</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="library">
          <MediaPicker ... />
        </Tabs.Content>
        <Tabs.Content value="generate">
          <KindToggle value={kind} onChange={setKind} format={draft?.format} />
          <ModelPicker role={kind} format={draft?.format} value={model} onChange={setModel} />
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} />
          {kind === 'image' && (
            <>
              <SizeSelect value={size} onChange={setSize} />
              <QualitySelect value={quality} onChange={setQuality} />
            </>
          )}
          <Button onClick={handleGenerate} loading={generating}>Générer</Button>
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}
```

### 2. Composant `KindToggle.tsx`
```tsx
function KindToggle({ value, onChange, format }: { value: GenKind; onChange: (v: GenKind) => void; format?: string }) {
  const videoSupported = format === 'reel' || format === 'story';
  if (!videoSupported) return null;  // ou afficher seulement Image
  return (
    <div role="radiogroup" aria-label="Type de média à générer">
      <button role="radio" aria-checked={value === 'image'} onClick={() => onChange('image')}>Image</button>
      <button role="radio" aria-checked={value === 'video'} onClick={() => onChange('video')}>Vidéo</button>
    </div>
  );
}
```

### 3. Étendre route `generate-visual`

```ts
// apps/web/src/app/api/admin/content-studio/drafts/[id]/generate-visual/route.ts
const visualGenerationSchema = z.object({
  prompt: z.string().min(12).max(1800),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024']).optional(),
  quality: z.enum(['low', 'medium', 'high']).optional(),
  kind: z.enum(['image', 'video']).optional().default('image'),  // NEW
  model: z.string().optional(),                                  // NEW
});

// In handler, route to generateVisualForDraft :
const result = await generateVisualForDraft({
  draftId, prompt, size, quality, kind, model, actorId,
});
```

### 4. Créer `lib/content-studio/services/visual-generation.ts`

```ts
import { generateStudioImage } from './image-generation';
import { generateStudioVideo } from './video-generation';

export async function generateVisualForDraft(args: {
  draftId: string; prompt: string; size?: string; quality?: string;
  kind: 'image' | 'video'; model?: string; actorId: string;
}) {
  if (args.kind === 'video') {
    return generateStudioVideo(args);
  }
  return generateStudioImage(args);
}
```

### 5. Étendre `image-generation.ts` pour accepter `model`

```ts
export async function generateStudioImage(args: { ..., model?: string }) {
  const imageModel = args.model ?? suggestForFormat(draft.format).image?.id ?? env.CONTENT_STUDIO_IMAGE_MODEL;
  // … existing
  await insertGenerationRun({ provider, model: imageModel, ... });
}
```

### 6. Créer `lib/content-studio/services/video-generation.ts`

Voir Phase 4 pour les détails du mock video.

## Tests

### Component
- `MediaStudio.test.tsx` étendu : tabs, kind toggle, model propagation
- `ModelPicker` testé en role=image / role=video

### Contract
- `drafts-generate-visual.contract.test.ts` : kind=image, kind=video, model
- 4 nouveaux cas (combinaisons kind × model présent/absent)

### E2E
- `create-model-switching.spec.ts` couvre aussi image + video

## Acceptance
- [ ] Tabs Bibliothèque + Générer IA visibles
- [ ] Kind toggle visible quand format ∈ {reel, story}
- [ ] ModelPicker change selon kind
- [ ] Génération propage kind + model au backend
- [ ] 0 fail tests Phase 3
