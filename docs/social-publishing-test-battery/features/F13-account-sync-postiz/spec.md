# F13 — Postiz integrations sync

## Importance : 🟠 P1

## Objectif
Synchroniser les comptes connectés côté Postiz dans la table `social_account` FemiGlow.

## Comportement attendu

### Déclenchement
- Cron `/api/cron/content-studio/postiz-sync` toutes les heures
- Manuel via `POST /api/admin/content-studio/postiz/integrations/sync`
- Au montage de la page Home (via SWR)

### Flow
1. GET Postiz `/api/public/v1/integrations`
2. Pour chaque integration (= compte IG/FB) :
   - UPSERT `social_account` (provider='postiz', remoteId=integration.id, name, platform, status, capabilities)
3. Supprimer en soft les rows obsolètes (Postiz ne les renvoie plus)
4. Retourner liste mise à jour

### Capabilities mapping
- Si integration.platform='instagram' → capabilities = [{ format:'post', mediaRequired:true, maxCaptionLength:2200 }, ...]
- Si platform='facebook' → similaire avec maxCaptionLength:63206

## Tests
Voir `test-scenarios.yaml`.
