# F08 — Sélection du modèle Vidéo

## Objectif
Permettre à l'opérateur de générer une vidéo verticale 9:16 (pour reel ou story) via un modèle vidéo. En v1 seul le **mock-video-1.0** est disponible (cf F09). Provider réel (Veo, Sora, HiggsField) en backlog.

## Importance
🔴 **P0** — gap critique mentionné par l'opérateur ; format reel inutilisable sans ce chemin.

## Comportement attendu
- Toggle Vidéo activé par défaut quand format ∈ {reel, story}
- ModelPicker(role=video) montre les modèles vidéo disponibles + suggéré
- Si seul mock disponible : option pré-cochée, label "Mock vidéo (1.0)", badge Mock
- Génération crée un `media` kind=video avec MP4 lisible

## Comportement actuel
Aucun chemin code vidéo. Toutes les générations passent par image.

## Gaps
- G02 : pas de pipeline vidéo (adressé ici + F09)
- G03 : pas de sélection (adressé ici)

## Propositions

### A — Endpoint séparé `/drafts/:id/generate-video`
Route dédiée pour clarté.

### B — Unifier sous `/generate-visual` avec `kind=video`
Une seule route, switch côté service.

### C — Polymorphe avec discriminator dans body
`{ type: 'image'|'video', ...props }`.

## Recommandation
**B** — `kind` discriminator. Cohérent avec l'API existante, moins de routes à maintenir.

## Implementation

### Backend
1. `app/api/admin/content-studio/drafts/[id]/generate-visual/route.ts` :
   - Étendre schéma : `kind: z.enum(['image', 'video']).optional().default('image')`
   - Switch service selon kind

2. `lib/content-studio/services/visual-generation.ts` (nouveau ou étendu) :
   ```ts
   export async function generateVisualForDraft({ draftId, prompt, kind, model, size, quality }) {
     if (kind === 'video') {
       return generateStudioVideo({ draftId, prompt, model });
     }
     return generateStudioImage({ draftId, prompt, size, quality, model });
   }
   ```

3. `lib/content-studio/services/video-generation.ts` (nouveau) :
   ```ts
   export async function generateStudioVideo({ draftId, prompt, model }: Args) {
     const isMock = env.CONTENT_STUDIO_V2_MOCK_MODE || env.CONTENT_STUDIO_VIDEO_PROVIDER === 'mock' || model === 'mock-video-1.0';
     if (isMock) {
       return generateMockVideo({ draftId, format });
     }
     // future: Veo, Sora adapters
     throw new Error('Real video provider not implemented');
   }

   export async function generateMockVideo({ draftId, format }: Args) {
     const draft = await fetchDraft(draftId);
     const f = draft.format;
     const mockAsset = f === 'reel'
       ? { url: '/_media/content-studio/mock/reel-9x16.mp4', width: 1080, height: 1920, duration: 5000 }
       : f === 'story'
         ? { url: '/_media/content-studio/mock/story-9x16.mp4', width: 1080, height: 1920, duration: 3000 }
         : null;
     if (!mockAsset) throw new Error('Video not applicable for format ' + f);

     // Persist media + binding + run
     const media = await insertMedia({
       kind: 'video',
       source: 'ai_generated',
       originalUrl: mockAsset.url,
       originalMime: 'video/mp4',
       originalWidth: mockAsset.width,
       originalHeight: mockAsset.height,
       originalDurationMs: mockAsset.duration,
       alt: 'Mock vidéo générée',
     });
     await insertAssetBinding({ draftId, mediaId: media.id, role: 'primary' });
     await insertGenerationRun({ provider: 'mock', model: 'mock-video-1.0', costCents: 0, status: 'succeeded' });

     return { media, run: { model: 'mock-video-1.0', provider: 'mock', costCents: 0 } };
   }
   ```

### Frontend
- MediaStudio toggle "Vidéo" + ModelPicker(role=video)
- PreviewPane joue déjà `<video>` quand `media.kind='video'`

### Variables d'env
```
CONTENT_STUDIO_VIDEO_PROVIDER=mock        # default mock
CONTENT_STUDIO_VIDEO_MODEL=mock-video-1.0 # default
```

## Tests
Voir `test-scenarios.yaml`.
