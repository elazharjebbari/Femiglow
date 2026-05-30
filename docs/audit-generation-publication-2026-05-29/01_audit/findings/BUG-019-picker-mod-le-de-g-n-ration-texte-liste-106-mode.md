# BUG-019 — Picker 'Modèle de génération' (texte) liste 106 modeles dont whisper-1, sora-2, omni-moderation, gpt-realtime/audio

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | create-ui-flow |
| **Composant** | `IntentionForm.tsx (ModelPicker role=chat) + models/route.ts discoveryRoleToStudio` |
| **Mode mock** | `partial` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le picker de modele texte (label 'Modèle de génération') ne propose que des modeles de redaction (chat completion).

## État réel vérifié
GET /models?role=chat renvoie 106 entrees incluant whisper-1 (STT), omni-moderation-latest/2024 (moderation), sora-2 / sora-2-pro (video), gpt-realtime-* et gpt-audio-* (audio/realtime), davinci-002/babbage-002 (completions legacy). Tous source=live. L'operateur peut selectionner whisper-1 comme modele de generation de caption.

## Écart
La projection role->studio (discoveryRoleToStudio) ne filtre que sur la string role renvoyee par discovery; whisper/sora/realtime sont classes 'chat' par la discovery OpenAI et passent le filtre. Aucune validation cote ideas/generate du modele recu.

## Cause racine
models/route.ts discoveryRoleToStudio() accepte tout role 'chat' sans liste blanche de capacites. La discovery OpenAI classe en 'chat' des modeles non-chat. contentIdeaCreateSchema accepte model:z.string().min(1).max(120) sans validation contre le registre.

## Preuves
- curl GET /models?role=chat => 106 modeles; lignes: 'whisper-1 | source=live', 'sora-2 | source=live', 'omni-moderation-latest | source=live', 'gpt-realtime | source=live', 'gpt-audio | source=live'
- IntentionForm.tsx:347-354 <ModelPicker role="chat" ...> sous label 'Modèle de génération'
- schemas.ts:21 model: z.string().min(1).max(120).optional() — pas de check registre

## Reproduction
1. /create. 2. Ouvrir le picker 'Modèle de génération' dans le cadre Intention. 3. Taper 'whisper' -> whisper-1 apparait selectionnable. 4. Le selectionner, enregistrer l'idee -> model='whisper-1' transmis a ideas/generate et logge sur content_generation_run.model.

## Piste de correction
Cote models/route.ts: liste blanche d'ids/patterns chat (exclure whisper, tts, audio, realtime, moderation, sora, davinci/babbage, embedding, image). Cote schema: valider model contre findModelById ou un set autorise par role.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** GET models?role=chat renvoie 106 modèles (105 openai live + 1 anthropic static). Probe confirme la présence sélectionnable de whisper-1, sora-2/sora-2-pro, omni-moderation-latest/2024, gpt-realtime-*, gpt-audio-*, davinci-002, babbage-002, tous source=live, role=chat. Cause racine vérifiée: inferRole() (model-discovery.ts:166-172) ne matche que embed/video/image/tts; tout le reste tombe en 'chat' — donc whisper, sora (pas de sous-chaîne 'video'), moderation, realtime, audio, davinci/babbage sont classés chat. discoveryRoleToStudio('chat')='chat' (route.ts:50-53) sans liste blanche. visualGenerationSchema/ideasGenerateSchema/contentIdeaCreateSchema valident model par z.string().min(1).max(120) sans contrôle de registre (schemas.ts:21,29,61). IntentionForm.tsx:347-355 monte <ModelPicker role='chat'> sous label 'Modèle de génération'.
- **Contre-preuve / nuance :** Atténuant: suggested=gpt-4o-mini (sain), donc le modèle auto-sélectionné par défaut est correct; il faut une action délibérée de l'opérateur pour choisir whisper/sora. N'invalide pas le finding mais réduit la probabilité d'occurrence accidentelle.

> Réf. registre : `bug-register.csv` ligne `BUG-019` · matrice : `gap-matrix.csv`.
