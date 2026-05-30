# S03 — Mock Video Flow

> Valide l'intégrité du chemin vidéo mock de bout en bout.

## Étapes

1. Visit create page, format=reel
2. Submit IntentionForm
3. Select variant
4. Toggle Vidéo dans MediaStudio
5. Click Générer

## Vérifications backend
- POST /generate-visual { kind: 'video', model: 'mock-video-1.0' } → 200
- Réponse contient media.kind='video', durationMs=5000, dimensions 1080x1920
- INSERT content_generation_run { provider: 'mock', model: 'mock-video-1.0', costCents: 0 }
- INSERT content_asset_binding { draftId, mediaId, role: 'primary' }

## Vérifications frontend
- PreviewPane rend `<video controls>` avec src vers /_media/.../reel-9x16.mp4
- video.duration > 0 après loadedmetadata
- Bouton Lecture cliquable, video.currentTime avance
- thumbnail (poster) visible avant lecture
- Pas de console error

## Vérifications réseau
- Request à /_media/content-studio/mock/reel-9x16.mp4 retourne 200 avec content-type video/mp4
- Taille du fichier raisonnable (< 2 MB)

## Cas limites
- Format=story → utilise story-9x16.mp4 (3s)
- Format=post → vidéo non disponible (toggle masqué ou erreur claire)
- Format=carousel → idem

## Spec Playwright
`e2e/content-studio-v2/create-mock-video.spec.ts`
