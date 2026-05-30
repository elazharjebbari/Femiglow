# BUG-016 — Desync picker de modèles: whisper-1 (STT) et gpt-3.5-turbo proposés en 'live' alors que la génération texte ne les utilisera jamais

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | copywriting |
| **Composant** | `src/app/api/admin/content-studio/models/route.ts + src/lib/ai-engine/services/model-discovery.ts (inferRole) + api-key-manager.ts` |
| **Mode mock** | `n/a` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le picker role=chat propose des modèles de rédaction réellement utilisables, marqués 'live' quand la clé est configurée.

## État réel vérifié
GET /api/admin/content-studio/models?role=chat&format=post renvoie en premier whisper-1 (modèle de transcription STT) avec source:'live', puis gpt-3.5-turbo. La discovery réussit car resolveApiKey('openai') retombe sur OPENAI_API_KEY (valide), mais la génération texte (generation.ts) n'utilise PAS cette clé -> tout modèle choisi est sans effet (fallback).

## Écart
L'UI propose des modèles 'live' (i) inadaptés (whisper-1 ne génère pas de texte) et (ii) qui ne seront de toute façon jamais appelés par le chemin de génération. Double tromperie: faux 'live' + modèle ignoré.

## Cause racine
inferRole (model-discovery.ts:~165) classe en 'chat' par défaut tout id ne matchant pas embed/video/image/tts/speech — whisper-1 ne matche 'tts|speech' donc tombe en chat. resolveApiKey (api-key-manager.ts:42) chaîne ['AI_ENGINE_OPENAI_API_KEY','CONTENT_STUDIO_OPENAI_API_KEY','CHAT_OPENAI_API_KEY','OPENAI_API_KEY'] -> trouve OPENAI_API_KEY. Mais generation.ts a une chaîne différente et plus courte.

## Preuves
- curl GET /api/admin/content-studio/models?role=chat&format=post -> [{id:'whisper-1',role:'chat',source:'live'},{id:'gpt-3.5-turbo',source:'live'},...]
- model-discovery.ts inferRole: `if (/tts|speech/i.test(id)) return 'tts'; ... return 'chat';` — 'whisper' n'est pas couvert
- api-key-manager.ts:42 `openai: ['AI_ENGINE_OPENAI_API_KEY','CONTENT_STUDIO_OPENAI_API_KEY','CHAT_OPENAI_API_KEY','OPENAI_API_KEY']`
- role=image renvoie aussi gpt-image-1 source:'live' (cf. /tmp/audit-playwright.log) idem desync

## Reproduction
curl -H Cookie '/api/admin/content-studio/models?role=chat&format=post' et observer whisper-1 en tête avec source:'live'.

## Piste de correction
Ajouter 'whisper|transcribe|stt' au regex tts d'inferRole et filtrer whisper du rôle chat. Surtout: faire pointer la discovery du picker sur la MÊME clé que celle réellement utilisée par generation.ts, sinon ne jamais marquer 'live' un modèle que le chemin de génération ne peut pas appeler.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Probe reelle GET /api/admin/content-studio/models?role=chat&format=post -> whisper-1 EN PREMIER avec source:'live' role:'chat', puis gpt-3.5-turbo, gpt-3.5-turbo-16k, gpt-4-0613... tous source:'live'. model-discovery.ts:166-171 inferRole: `if (/video/i) return video; if (/image|diffusion|dall-?e|stable|xl/i) return image; if (/tts|speech/i) return tts; return chat;` — 'whisper' n'est couvert par AUCUN regex donc tombe en 'chat'. api-key-manager.ts:42 chaine ['AI_ENGINE_OPENAI_API_KEY','CONTENT_STUDIO_OPENAI_API_KEY','CHAT_OPENAI_API_KEY','OPENAI_API_KEY'] avec resolveEnvKey utilisant `if (val) return val` (saute correctement la chaine vide) -> retombe sur OPENAI_API_KEY (valide). generation.ts utilise une chaine differente et plus courte avec `??` (ne saute pas la chaine vide). D'ou un picker 'live' sur un moteur qui restera en fallback. role=image renvoie aussi gpt-image-1 source:'live' (verifie). Severite major justifiee.
- **Contre-preuve / nuance :** Aucune. Toutes les probes confirment, y compris whisper-1 en tete.

> Réf. registre : `bug-register.csv` ligne `BUG-016` · matrice : `gap-matrix.csv`.
