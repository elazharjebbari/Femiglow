# Rollback Plan

## Stratégie

Tous les changements sont feature-flag par variables d'environnement ou par flags atomiques. Aucun n'est destructif. Si une phase casse, désactiver son flag suffit à revenir au comportement antérieur.

## Flags

| Flag | Effet quand OFF | Effet quand ON |
|------|-----------------|----------------|
| `CONTENT_STUDIO_V2_MOCK_MODE` | Mock pour image only (legacy) | Mock global texte+image+video |
| `CONTENT_STUDIO_V2_TEXT_MODEL_PICKER` (UI feature flag) | IntentionForm sans ModelPicker | IntentionForm avec ModelPicker |
| `CONTENT_STUDIO_V2_MEDIA_MODEL_PICKER` (UI feature flag) | MediaStudio sans tabs+ModelPicker | MediaStudio refactor complet |
| `CONTENT_STUDIO_V2_STEP_PROGRESSION_V2` (UI feature flag) | Stepper hack legacy | Stepper status-only + ApproveButton |
| `CONTENT_STUDIO_VIDEO_PROVIDER` | (real provider) | `mock` |

## Procédure de rollback par phase

### Phase 1 — Foundations
- Désactiver `CONTENT_STUDIO_V2_MOCK_MODE=false`
- Le endpoint `/models` reste actif (lecture seule, additif)
- Pas de risque, pas de rollback DB

### Phase 2 — Text model selector
```bash
# Désactiver le picker UI
echo "NEXT_PUBLIC_FF_CS2_TEXT_MODEL_PICKER=false" >> apps/web/.env
pm2 restart web
```
- Le backend continue d'accepter le champ `model` mais en l'absence, utilise le défaut env
- Aucune migration DB

### Phase 3 — Media model selector
```bash
echo "NEXT_PUBLIC_FF_CS2_MEDIA_MODEL_PICKER=false" >> apps/web/.env
pm2 restart web
```
- MediaStudio revient à l'UI antérieure
- Backend reste compatible (kind défault image, model optionnel)

### Phase 4 — Mock video
- Retirer les fichiers MP4 : `rm apps/web/public/_media/content-studio/mock/*.mp4`
- Désactiver le video provider : `CONTENT_STUDIO_VIDEO_PROVIDER=disabled` (handled gracefully)
- Le video flow retournera 503 — l'UI tab vidéo se masque (cf condition format)

### Phase 5 — Step progression
```bash
echo "NEXT_PUBLIC_FF_CS2_STEP_PROGRESSION_V2=false" >> apps/web/.env
pm2 restart web
```
- Stepper revient au hack `deriveActiveStep`
- ApproveButton masqué
- ⚠ Conséquence : retour au bug G01 (Validate inaccessible) → ne désactiver QUE en urgence

### Phase 6 — Publish validation
- Pas de flag UI ; les changements sont du polish (dialog enrichi, mapping erreurs)
- Pour rollback partiel : revert le commit dédié et re-deploy

## Conservation de l'état utilisateur

Aucune migration DB destructive. Les données existantes restent compatibles :
- Drafts existants : champs nouveaux (model) sont optionnels
- Posts existants : intacts
- Generation_runs existants : intacts

## Procédure d'urgence

Si un déploiement casse la prod :

```bash
# 1. Revert le déploiement
pm2 stop web
git revert <commit-hash> --no-edit
pnpm run build
pm2 start web

# 2. Si revert impossible : kill switch
echo "CONTENT_STUDIO_V2_MOCK_MODE=true" >> apps/web/.env
echo "NEXT_PUBLIC_FF_CS2_TEXT_MODEL_PICKER=false" >> apps/web/.env
echo "NEXT_PUBLIC_FF_CS2_MEDIA_MODEL_PICKER=false" >> apps/web/.env
echo "NEXT_PUBLIC_FF_CS2_STEP_PROGRESSION_V2=false" >> apps/web/.env
pm2 restart web

# 3. Communication
# Avertir l'équipe sur Slack #ops
# Logger l'incident
```

## Vérification post-rollback

```bash
curl -s http://localhost:8012/api/admin/content-studio/health | jq '.mockMode'
# attendu : matches the rollback intent (true ou false selon stratégie)

# Smoke test
curl -s -o /dev/null -w "%{http_code}" http://localhost:8012/admin/content-studio-v2/create
# attendu : 200 ou 307

# Vérifier qu'un parcours de base reste fonctionnel
# (test E2E "smoke" : nominal create v1 ou v2 selon flag)
```
