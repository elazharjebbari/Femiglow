# BUG-043 — Le picker de modèles propose des modèles 'live' (gpt-image-1) servis depuis un cache mémoire périmé, sans clé réelle

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | test-mock-infrastructure |
| **Composant** | `src/app/api/admin/content-studio/models/route.ts + src/lib/ai-engine/services/model-discovery.ts (cache) + api-key-manager.ts` |
| **Mode mock** | `n/a` |
| **Mode live** | `broken` |
| **Verdict vérification** | `adjusted` (confiance: high) |

## État supposé (code + tests)
source:'live' devrait signifier qu'une clé valide existe et que le fournisseur confirme le modèle, donc qu'il est utilisable.

## État réel vérifié
Desync UI<->generation reel mais cause differente: discovery resout une cle VALIDE (OPENAI_API_KEY, len 164) via api-key-manager.resolveEnvKey et marque les modeles 'live' a juste titre; le bug est que image-generation.ts lit une autre variable (env.CONTENT_STUDIO_OPENAI_API_KEY, vide) et throw invalid_state. Ce n est PAS un cache perime masquant l absence de cle — c est un split de variables d env entre discovery et generation. whisper-1 (STT) mal classe role=chat est confirme (probe). ai_engine_api_keys absente en DB confirme (to_regclass NULL) mais sans impact ici car la cle vient de l env.

## Écart
L'UI affiche 'Live' pour des modèles qui throw à l'usage. Pire desync: model-discovery résout la clé via resolveApiKey (DB→env) tandis que image-generation.ts lit env.CONTENT_STUDIO_OPENAI_API_KEY directement (l.87,98,111) → même si discovery dit live, la génération live throw 'invalid_state: CONTENT_STUDIO_OPENAI_API_KEY manquant'. Deux chemins de résolution de clé incohérents.

## Cause racine
(1) Cache discovery in-process sans invalidation au changement de clé, et le label UI ne distingue pas 'cache' de 'live confirmé'. (2) whisper-1 (STT) classé role=chat (route renvoie whisper-1 en role=chat). (3) Source de clé divergente entre discovery (resolveApiKey DB/env) et génération (env brut).

## Preuves
- Probe: curl -H Cookie .../models?role=image&format=post → gpt-image-1 ... 'source':'live' ; discovery:{"openai":"cache","higgsfield":"fallback","anthropic":"no-key"}
- DB: to_regclass('ai_engine_api_keys') → NULL (table absente)
- .env: CONTENT_STUDIO_OPENAI_API_KEY=<EMPTY>, AI_ENGINE_OPENAI_API_KEY/CHAT_OPENAI_API_KEY non définis
- model-discovery.ts:356-359 'if (cached && cached.expiresAt>Date.now()) return {source:"cache"}' ; MODEL_CACHE_TTL_MS=5*60*1000
- models/route.ts:72 'return {...known, source:"live"}' (transforme cache en live)
- image-generation.ts:87,98,111 lit env.CONTENT_STUDIO_OPENAI_API_KEY (pas resolveApiKey) → throw 'manquant'
- Probe role=chat renvoie whisper-1 source:'live'

## Reproduction
curl -s -H "Cookie: $COOKIE" 'http://127.0.0.1:8012/api/admin/content-studio/models?role=image&format=post' | jq '.models[].source, .discovery' → 'live' + {"openai":"cache"}.

## Piste de correction
Mapper 'cache' à un libellé distinct (ou re-vérifier la clé à chaque GET) ; n'afficher 'Live' que si discovery=='live' ET la même fonction de résolution de clé est utilisée par discovery ET génération ; exclure whisper-1 de role=chat ; invalider le cache quand la clé change.

## Vérification adversariale
- **Verdict :** adjusted (confiance high)
- **Analyse :** Le DESYNC UI<->generation est reel et confirme (gpt-image-1 source:'live' alors que la generation live throw), MAIS le MECANISME decrit par l auditeur est FAUX. L auditeur affirme 'aucune cle n est resoluble maintenant' et que 'live' provient d un cache memoire perime masquant l absence de cle. En realite OPENAI_API_KEY EST defini (len 164) dans .env, et api-key-manager.resolveEnvKey lit ENV_KEY_MAP['openai']=[AI_ENGINE_OPENAI_API_KEY, CONTENT_STUDIO_OPENAI_API_KEY, CHAT_OPENAI_API_KEY, OPENAI_API_KEY] (l.42) => il resout OPENAI_API_KEY. La route models/route.ts:127-129 n appelle discoverModels que SI resolveApiKey retourne une cle; le probe renvoie discovery:'cache' => une cle a bien ete resolue et un fetch live a vraiment reussi auparavant. Donc 'live'/'cache' est LEGITIME, pas une illusion de cache vide. La VRAIE cause racine (que le finding capte en secondaire): image-generation.ts lit UNIQUEMENT env.CONTENT_STUDIO_OPENAI_API_KEY (l.87/98/111/124, VIDE) alors que discovery lit OPENAI_API_KEY via resolveApiKey — deux variables d env distinctes, env.ts n expose meme pas OPENAI_API_KEY.
- **Contre-preuve / nuance :** grep '^OPENAI_API_KEY=' .env => SET len=164. api-key-manager.ts:42 ENV_KEY_MAP openai inclut 'OPENAI_API_KEY'. models/route.ts:127 'if (!apiKey) return no-key' => le retour 'cache' prouve qu une cle EST resolue maintenant. grep resolveApiKey/api-key-manager dans model-discovery.ts = vide (le finding attribue a tort la resolution de cle a model-discovery; c est la route qui la fait). image-generation.ts ne lit jamais OPENAI_API_KEY ni resolveApiKey — uniquement env.CONTENT_STUDIO_OPENAI_API_KEY (vide).

> Réf. registre : `bug-register.csv` ligne `BUG-043` · matrice : `gap-matrix.csv`.
