# Spec — Generation Image (flux create operateur, systeme B)

## Objectif
Permettre a un operateur, depuis `/admin/content-studio-v2/create`, de generer un visuel (image) attache a un brouillon, en mode MOCK (simulation gratuite) ou LIVE (vrai provider, cout reel), avec un picker de modeles fidele a la realite.

## Flux nominal
1. Operateur cree une idee + drafts, selectionne une variante (draftId requis).
2. `MediaStudio` affiche le toggle Mock/Live (`GenerationModeToggle`, cookie `cs_generation_mode`) et le `ModelPicker` (role=image, format).
3. Operateur clique 'Generer un visuel IA' -> POST `/api/admin/content-studio/drafts/[id]/generate-visual` `{prompt,size,quality,kind:'image',model}`.
4. Route lit le cookie mode (defaut mock si absent), valide le payload (`visualGenerationSchema`), appelle `generateVisualForDraft`.
5. `generateStudioImage` route par MODELE puis MODE puis ENV.
6. Resultat: media cree (status ready apres optimisation), attache comme primary asset, generation_run enregistre (provider, model, cout reel/estime), audit log.
7. UI affiche l'image dans PreviewPane; budget mis a jour.

## Comportement attendu par mode
- **MOCK**: SVG->PNG synthetique, cout 0, status ready, servi via /_media. Le modele intentionnel devrait etre conserve dans le run (usage.intendedModel) pour audit/simulation de cout.
- **LIVE OpenAI** (gpt-image-*/dall-e-*): appel `api.openai.com/v1/images/generations`, PNG b64, cout reel, provider=openai. Necessite une cle OpenAI resolue par la MEME source que le picker.
- **LIVE Higgsfield** (hf-*): API reelle async — submit `/v1/text2image/<model>` puis poll `/v1/requests/{id}/status`, auth `Authorization: Key KEY_ID:KEY_SECRET`. Necessite credential complet.

## Picker de modeles (contrat de verite)
- `source='live'` UNIQUEMENT si la discovery a reellement reussi (provider API a repondu) ET si le generateur peut utiliser la cle correspondante.
- `source='static'/'cache'/'fallback'` sinon, avec badge distinct. Un modele non routable par le generateur ne doit pas etre propose en live (ou doit etre desactive avec raison).
- Le suggested doit etre generable dans le mode courant.

## Gestion d'erreur attendue
- Cle/credential manquant: erreur explicite (409 invalid_state) AVANT tout appel, message actionnable. (OK aujourd'hui pour le message.)
- Provider indisponible/timeout: 502 upstream_failed, run status=failed enregistre, toast clair.
- Modele non supporte: erreur explicite, PAS de fallback silencieux vers un autre provider.

## Tracabilite & cout
- Un seul barème de pricing (registry) utilise pour: affichage picker, pre-check budget, cout enregistre. Unite coherente (cents).
- generation_run reflète le modele reellement utilise (live) ou intentionnel (mock).