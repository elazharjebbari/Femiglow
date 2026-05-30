# P4 -- Video Player dans GenerationResult

## Composant

**Modification de:** `GenerationResult`
**Fichier:** `apps/web/src/components/admin/content-studio-v2/ai-engine/GenerationResult.tsx`
**But:** Afficher les videos generees (mock ou reelles) dans une section "Videos" apres la section "Images" dans le resultat de generation.

---

## Interface Enrichie

### GenerationResultData (modifiee)

```typescript
export interface VideoAsset {
  assetId: string;
  url: string;
  mimeType: string;
  width: number;
  height: number;
  durationSeconds?: number;
  provider: string;
  model?: string;
  posterUrl?: string;
  costCents: number;
}

export interface GenerationResultData {
  script?: {
    hook?: string;
    scenes?: ScriptScene[];
    cta?: string;
  };
  caption?: string;
  hashtags?: string[];
  images?: string[];
  videos?: VideoAsset[];          // NOUVEAU -- liste de videos generees
  qualityScores?: Record<string, number>;
  costBreakdown?: { label: string; amountCents: number }[];
  totalCostCents?: number;
}
```

---

## Condition d'Affichage

La section "Videos" est rendue **uniquement** quand `result.videos` existe et a au moins un element:

```typescript
{videos && videos.length > 0 && (
  <CollapsibleSection
    title={`Videos (${videos.length})`}
    icon={<Video size={14} />}
    defaultOpen
  >
    {/* Video grid */}
  </CollapsibleSection>
)}
```

Positionnement: apres la section "Visuels (images)" et avant la section "Scores qualite".

---

## Structure du Player Video

Chaque video est rendue dans un conteneur avec:

```html
<div class="video-card">
  <!-- Conteneur aspect ratio -->
  <div class="video-aspect-container">
    <video
      src="{video.url}"
      controls
      poster="{video.posterUrl}"
      preload="metadata"
      style="width: 100%; height: 100%; object-fit: cover; border-radius: ..."
    />
    <!-- Badges overlay en haut a droite -->
    <div class="video-badges">
      <span class="badge badge-provider">{provider}</span>
      <span class="badge badge-resolution">{width}x{height}</span>
      {durationSeconds && <span class="badge badge-duration">{duration}s</span>}
    </div>
  </div>
</div>
```

---

## Design Visuel -- ASCII Mockup

```
+----------------------------------------------------------+
| [v] Videos (1)                                    [Video] |
+----------------------------------------------------------+
|                                                          |
|  +---------------------------------------------+        |
|  |                                             |        |
|  |          +-----------+                      |        |
|  |          | > PLAY    |    [Mock] [1080x1920]|        |
|  |          +-----------+    [15s]             |        |
|  |                                             |        |
|  |   <video controls poster="...">            |        |
|  |                                             |        |
|  +---------------------------------------------+        |
|                                                          |
+----------------------------------------------------------+


  Grille (2+ videos):

  +---------------------+  +---------------------+
  |                     |  |                     |
  |    [video player]   |  |    [video player]   |
  |    [Mock][1080x1920]|  |    [Veo][720x1280] |
  |    [15s]            |  |    [10s]            |
  |                     |  |                     |
  +---------------------+  +---------------------+
```

---

## Layout Grid

```typescript
<div
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 12,
  }}
>
  {videos.map((video, i) => (
    <VideoCard key={video.assetId || i} video={video} />
  ))}
</div>
```

Pattern identique a la grille d'images existante (ligne 548-578), mais avec `minmax(280px, 1fr)` au lieu de `minmax(140px, 1fr)` car les videos necessitent plus d'espace.

---

## VideoCard -- Composant Interne

```typescript
function VideoCard({ video }: { video: VideoAsset }) {
  const isMock = video.provider === 'mock' || video.url.includes('/mock/');
  const resolution = `${video.width}x${video.height}`;
  const providerLabel = isMock ? 'Mock' : video.provider;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 'var(--cs-radius)',
      overflow: 'hidden',
      border: '1px solid var(--cs-border-hair)',
      background: 'var(--cs-bg-sunken)',
    }}>
      {/* Aspect ratio container */}
      <div style={{
        position: 'relative',
        paddingBottom: `${(video.height / video.width) * 100}%`,
      }}>
        <video
          src={video.url}
          controls
          poster={video.posterUrl}
          preload="metadata"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 'var(--cs-radius)',
          }}
        />
      </div>

      {/* Badge overlay */}
      <div style={{
        position: 'absolute',
        top: 8,
        right: 8,
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
      }}>
        <VideoBadge
          label={providerLabel}
          color={isMock ? 'var(--cs-warning)' : 'var(--cs-accent)'}
        />
        <VideoBadge label={resolution} color="var(--cs-fg-secondary)" />
        {video.durationSeconds && (
          <VideoBadge label={`${video.durationSeconds}s`} color="var(--cs-fg-secondary)" />
        )}
      </div>
    </div>
  );
}
```

---

## VideoBadge -- Sous-composant

```typescript
function VideoBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 'var(--cs-radius-sm)',
      background: 'rgba(0, 0, 0, 0.6)',
      color: '#fff',
      fontSize: 'var(--cs-text-xs)',
      fontFamily: 'var(--cs-font-mono)',
      fontWeight: 500,
      backdropFilter: 'blur(4px)',
      border: `1px solid ${color}`,
    }}>
      {label}
    </span>
  );
}
```

---

## Styles CSS Tokens

```
--cs-radius           (border-radius du conteneur video)
--cs-radius-sm        (border-radius des badges)
--cs-border-hair      (bordure du conteneur)
--cs-bg-sunken        (fond du conteneur)
--cs-fg-secondary     (couleur badges resolution/duration)
--cs-warning          (couleur badge "Mock")
--cs-accent           (couleur badge provider reel)
--cs-text-xs          (taille texte badges)
--cs-font-mono        (police badges)
--cs-shadow-sm        (ombre conteneur, optionnel)
```

---

## Mock Video dans la Reponse Generate

### Modification de MOCK_GENERATION_RESULT

Le mock existant a `videos: []`. Il faut ajouter un mock video:

```typescript
const MOCK_GENERATION_RESULT = {
  // ... champs existants ...
  videos: [
    {
      assetId: 'mock-video-001',
      url: '/_media/ai-engine/mock/femiglow-reel-preview.mp4',
      mimeType: 'video/mp4',
      width: 1080,
      height: 1920,
      durationSeconds: 15,
      provider: 'mock',
      model: 'mock-video-generator',
      posterUrl: '/_media/ai-engine/mock/femiglow-reel-poster.jpg',
      costCents: 0,
    },
  ],
  // ... suite ...
};
```

Note: Le fichier video mock n'a pas besoin d'exister physiquement pour le test unitaire. En E2E ou en demo, un petit MP4 placeholder peut etre place dans `public/_media/ai-engine/mock/`.

### Fichier Video Mock (Optionnel pour Demo)

Si un fichier video est necessaire pour la demo, generer un placeholder MP4 via ffmpeg:

```bash
ffmpeg -f lavfi -i color=c=#F5F0EB:s=1080x1920:d=3 \
  -vf "drawtext=text='FemiGlow Mock Video':fontsize=48:fontcolor=#D1B799:x=(w-tw)/2:y=(h-th)/2" \
  -c:v libx264 -t 3 -pix_fmt yuv420p \
  public/_media/ai-engine/mock/femiglow-reel-preview.mp4
```

---

## Data Flow

```
1. POST /generate retourne:
   { ..., videos: [{ url, width, height, durationSeconds, provider, ... }] }

2. handleGenerate() stocke data dans result:
   setResult(data)  // data.videos est inclus

3. GenerationResult recoit result.videos:
   const { script, caption, hashtags, images, videos, ... } = result;

4. Si videos.length > 0, la section Videos est rendue
   avec un CollapsibleSection + grille de VideoCard
```

---

## Accessibilite

- Chaque `<video>` a un attribut `aria-label="Video generee N"` (ou N est l'index + 1)
- Le poster image sert de fallback visuel avant lecture
- Les controles natifs du player sont accessibles au clavier (play, pause, volume, fullscreen)
- Les badges ont `aria-hidden="true"` (decoratifs, l'info est redondante avec le player)
- La section CollapsibleSection a `aria-expanded` (deja gere par le composant)

---

## Edge Cases

| Cas                                          | Comportement                                              |
|----------------------------------------------|-----------------------------------------------------------|
| `videos` est undefined                       | Section non rendue                                        |
| `videos` est un tableau vide `[]`            | Section non rendue                                        |
| Video URL invalide/404                       | Le player affiche le poster ou un cadre vide              |
| Video sans posterUrl                         | Pas d'attribut poster, premiere frame affichee au chargement |
| Video sans durationSeconds                   | Badge duration non rendu                                  |
| Plusieurs videos (2+)                        | Grille responsive, 2 colonnes sur desktop, 1 sur mobile   |
| Video tres longue (> 60s)                    | Le player gere nativement, pas de limite cote UI          |
| Video verticale (9:16)                       | Aspect ratio calcule correctement via paddingBottom        |
| Video horizontale (16:9)                     | Aspect ratio calcule correctement                         |
| Provider non-mock (ex: "higgsfield")         | Badge affiche "higgsfield" avec accent color              |
| Pas d'images mais des videos                 | Section Images absente, section Videos seule              |
| Images et videos presentes                   | Les deux sections rendues l'une apres l'autre             |

---

## Fichiers Impactes

| Fichier | Modification |
|---------|-------------|
| `components/admin/content-studio-v2/ai-engine/GenerationResult.tsx` | Ajouter `VideoAsset` type, section Videos, `VideoCard`, `VideoBadge` |
| `test/msw/ai-engine-handlers.ts` | Ajouter mock video dans `MOCK_GENERATION_RESULT.videos` |
| `public/_media/ai-engine/mock/` | (Optionnel) Ajouter fichier MP4 placeholder et poster JPG |
