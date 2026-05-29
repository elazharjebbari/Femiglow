# BUG-006 — Le picker propose des modeles live (OpenAI/Higgsfield) qui throwent tous a la generation — desync UI/realite total

| | |
|---|---|
| **Sévérité** | `critical` |
| **Domaine** | create-ui-flow |
| **Composant** | `ModelPicker.tsx + /api/admin/content-studio/models/route.ts + image-generation.ts` |
| **Mode mock** | `works` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le ModelPicker liste des modeles disponibles; selectionner un modele et generer produit un media (mock) ou un media reel (live).

## État réel vérifié
GET /models?role=image renvoie 18 modeles tous source=live (gpt-image-1-mini suggested, flux_2, gpt_image_2...). En mode live, generer avec le modele auto-suggere gpt-image-1-mini => HTTP 409 invalid_state 'CONTENT_STUDIO_OPENAI_API_KEY manquant'. Generer avec n'importe quel hf-* => HTTP 409 invalid_state 'credential Higgsfield incomplet'. AUCUN modele live ne fonctionne aujourd'hui, mais tous sont proposes avec un badge vert 'Live'.

## Écart
Le picker ne reflete pas la capacite reelle de generation: discovery utilise resolveApiKey() (trouve OPENAI_API_KEY generique) tandis que generateStudioImage lit env.CONTENT_STUDIO_OPENAI_API_KEY en direct (vide). Deux chemins de resolution de cle divergents.

## Cause racine
image-generation.ts lignes 87/98/124 referencent env.CONTENT_STUDIO_OPENAI_API_KEY directement; models/route.ts ligne 127 utilise resolveApiKey('openai') qui chaine vers OPENAI_API_KEY (api-key-manager ENV_KEY_MAP ligne 42). Higgsfield: higgsfieldAuthHeader() renvoie null car AI_ENGINE_HIGGSFIELD_API_KEY n'a pas de ':' et AI_ENGINE_HIGGSFIELD_API_SECRET absent.

## Preuves
- curl POST generate-visual cs_generation_mode=live model=gpt-image-1-mini => {"error":{"code":"invalid_state","message":"Modèle OpenAI « gpt-image-1-mini » sélectionné mais CONTENT_STUDIO_OPENAI_API_KEY manquant..."}} HTTP 409
- curl POST generate-visual cs_generation_mode=live model=hf-flux-pro => invalid_state 'credential Higgsfield incomplet' HTTP 409
- curl GET /models?role=image => discovery:{'openai':'cache','higgsfield':'fallback'}; 18 modeles, gpt-image-1-mini source=live, suggested=gpt-image-1-mini
- image-generation.ts:87 if (!env.CONTENT_STUDIO_OPENAI_API_KEY) throw HttpError invalid_state
- pm2 env 0: CONTENT_STUDIO_OPENAI_API_KEY=(vide), OPENAI_API_KEY=sk-proj-... present

## Reproduction
1. Ouvrir /admin/content-studio-v2/create. 2. Creer une idee, choisir une variante. 3. Basculer le toggle sur Live. 4. Cliquer 'Générer un visuel IA' (modele auto-suggere gpt-image-1-mini). 5. Toast d'erreur 'Génération visuelle : Modèle OpenAI ... CONTENT_STUDIO_OPENAI_API_KEY manquant'.

## Piste de correction
Unifier la resolution de cle: generateStudioImage doit utiliser resolveApiKey('openai') comme le picker, OU le picker ne doit lister live que les modeles dont le chemin de generation a la meme cle. Filtrer/desactiver dans le picker les modeles dont le provider n'a pas de credential generation-ready. Renseigner CONTENT_STUDIO_OPENAI_API_KEY et AI_ENGINE_HIGGSFIELD_API_SECRET.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Tout est prouvé en exerçant le réel. pm2 env 0: CONTENT_STUDIO_OPENAI_API_KEY vide, OPENAI_API_KEY=sk-proj-... présent. La divergence de résolution de clé est exacte: models/route.ts:127 utilise resolveApiKey('openai') dont ENV_KEY_MAP (api-key-manager.ts:42) chaîne ['AI_ENGINE_OPENAI_API_KEY','CONTENT_STUDIO_OPENAI_API_KEY','CHAT_OPENAI_API_KEY','OPENAI_API_KEY'] -> trouve OPENAI_API_KEY -> discovery OpenAI réelle (j'ai vu source 'live' au 1er hit puis 'cache'). image-generation.ts:87/98 lit env.CONTENT_STUDIO_OPENAI_API_KEY (vide) -> throw. Probe LIVE réelle: POST generate-visual model=gpt-image-1-mini => {code:invalid_state, 'CONTENT_STUDIO_OPENAI_API_KEY manquant'} HTTP 409; model=hf-flux-pro => invalid_state 'credential Higgsfield incomplet' HTTP 409. GET models?role=image: 18 modèles, suggested=gpt-image-1-mini source=live (gpt-image-2-2026-04-21 etc. prouvent un appel live réel). Le throw OpenAI/Higgsfield se produit AVANT tout fetch externe (aucun coût).
- **Contre-preuve / nuance :** Seul écart mineur vs le realState de l'auditeur: il a écrit discovery:{'openai':'cache'} pour role=image alors que le 1er appel renvoie 'live' (puis 'cache' via TTL 5min, model-discovery.ts:358). Cela RENFORCE le finding (la découverte live OpenAI marche vraiment) plutôt que de le réfuter.

> Réf. registre : `bug-register.csv` ligne `BUG-006` · matrice : `gap-matrix.csv`.
