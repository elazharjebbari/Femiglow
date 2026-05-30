# S02 — Switch de modèle (texte + image + vidéo)

> Valide que l'opérateur peut changer chaque modèle et que le choix est correctement propagé en backend.

## Étapes

### Texte
1. Sélectionne format Post
2. Ouvre ModelPicker chat → vérifie suggestion "gpt-4o-mini"
3. Change vers "GPT-4o"
4. Soumet IntentionForm
5. **Attendu** : POST /ideas + /generate ont body.model='gpt-4o' ; runs[0].model='gpt-4o'

### Image
1. Sélectionne variante
2. Tab Générer IA
3. Ouvre ModelPicker image → suggestion "DALL·E 3"
4. Change vers "gpt-image-1"
5. Click Générer
6. **Attendu** : POST /generate-visual body.model='gpt-image-1' ; run.model recorded

### Vidéo
1. Change format à Reel (peut nécessiter redémarrer le flow)
2. Tab Générer IA, toggle Vidéo
3. ModelPicker video → seul "mock-video-1.0" disponible (pas d'erreur)
4. Click Générer
5. **Attendu** : vidéo mock attachée

### Reset
1. Recharge la page
2. Ouvre les 3 pickers
3. **Attendu** : suggestions par défaut (pas de mémorisation entre sessions)

## Spec Playwright
`e2e/content-studio-v2/create-model-switching.spec.ts`
