# F07 — Sélection du modèle Image

## Objectif
Permettre à l'opérateur de choisir le modèle de génération d'image (DALL-E 3, gpt-image-1, gpt-image-1-mini, ou custom) dans MediaStudio, avec suggestion adaptée au format.

## Importance
🔴 **P0** — gap critique mentionné par l'opérateur.

## Comportement attendu
Identique à F03 mais pour image :
- `<ModelPicker role="image" format={format} value={imageModel} onChange={setImageModel} />`
- Suggestion : DALL-E 3 (post/carousel), gpt-image-1 (reel), gpt-image-1-mini (story)
- Pricing visible : "$0.04 par image", "$0.08 par image", etc.
- Cohérence du format demandé : `size` adapté à `format` (1080x1080 pour post, 1024x1536 pour story/reel)

## Comportement actuel
Aucun. Modèle = `env.CONTENT_STUDIO_IMAGE_MODEL`.

## Gaps
- G03 : pas de sélecteur (adressé ici)
- F07-LOCAL-1 : pas de validation que le modèle supporte le ratio demandé (DALL-E 3 ne fait pas 1080x1920)

## Propositions

### A — Popover combobox (cf P01-B)
Identique à F03 mais pour image. **Recommandé**.

### B — Pre-set par tier (fast/balanced/premium)
3 boutons explicites au lieu d'un combobox. Plus simple mais moins flexible.

### C — Recommended only (pas de choix)
Le modèle est automatiquement choisi selon format. Pas de sélection utilisateur.

## Recommandation
**A** — cohérent avec F03 (un seul composant `ModelPicker` réutilisable).

## Implementation

### Fichiers à modifier
1. `MediaStudio.tsx` : intégrer ModelPicker(role=image)
2. `app/api/admin/content-studio/drafts/[id]/generate-visual/route.ts` : accepter `model` optionnel
3. `lib/content-studio/services/image-generation.ts` : `generateStudioImage(prompt, size, quality, model?)` → utilise `model ?? env.CONTENT_STUDIO_IMAGE_MODEL`

### Schéma Zod étendu
```ts
const visualGenerationSchema = z.object({
  prompt: z.string().min(12).max(1800),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024']).optional(),
  quality: z.enum(['low', 'medium', 'high']).optional(),
  kind: z.enum(['image', 'video']).optional().default('image'),
  model: z.string().optional(),   // NEW
});
```

### Validation taille selon modèle
```ts
const supportedSizes: Record<string, string[]> = {
  'dall-e-3': ['1024x1024', '1024x1792', '1792x1024'],
  'gpt-image-1': ['1024x1024', '1024x1536', '1536x1024'],
  'gpt-image-1-mini': ['1024x1024'],
};

if (model && supportedSizes[model] && !supportedSizes[model].includes(size)) {
  // Coerce to nearest supported, log warning
}
```

## Tests
Voir `test-scenarios.yaml`.
