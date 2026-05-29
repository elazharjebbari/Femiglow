# BUG-049 — Aucun provider TTS réel utilisable: provider=mock, ElevenLabs non configuré, OpenAI non sélectionné comme TTS — voix-off LIVE non fonctionnelle

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | voix-off |
| **Composant** | `src/lib/ai-engine/config/engine-config.ts, .env, src/lib/ai-engine/nodes/generate-voiceover.ts` |
| **Mode mock** | `n/a` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Voix-off live via OpenAI tts-1 (generateOpenAITTS) ou ElevenLabs (generateElevenLabsTTS), sélection par AI_ENGINE_DEFAULT_TTS_PROVIDER.

## État réel vérifié
Confirme. Branche TTS live jamais atteinte (provider=mock). Seul OpenAI tts-1 disponible si bascule du provider; ElevenLabs indisponible (cle absente). Non teste live -> casse par defaut.

## Écart
La voix-off live n'est ni activée (provider=mock) ni complètement provisionnée (ElevenLabs absent). Non vérifiable en live -> cassée par défaut.

## Cause racine
Config staging volontairement en mock + clé ElevenLabs non fournie. La sélection TTS exige provider 'openai' ET clé openai pour appeler OpenAI; condition non remplie car provider='mock'.

## Preuves
- /proc/<pid web>/environ: AI_ENGINE_DEFAULT_TTS_PROVIDER=mock
- .env:129 AI_ENGINE_DEFAULT_TTS_PROVIDER=mock
- Probe /api/admin/ai-engine/config/providers: ElevenLabs caps=['tts'] configured=False; OpenAI configured=True ttsModels=['tts-1']
- Process environ: AI_ENGINE_ELEVENLABS_API_KEY len=0; OPENAI_API_KEY len=164 (fallback engine-config.ts:75)
- generate-voiceover.ts:147-176: branche openai exige config.providers.tts.default==='openai' && config.apiKeys.openai; branche elevenlabs exige ===' elevenlabs' && key

## Reproduction
1. GET /api/admin/ai-engine/config/providers -> ElevenLabs configured:false. 2. cat /proc/<pid>/environ | grep TTS -> mock. 3. Code: seule la branche else (silent mock) est atteinte.

## Piste de correction
Pour activer la voix-off live: poser AI_ENGINE_DEFAULT_TTS_PROVIDER=openai (clé OPENAI déjà présente) OU fournir AI_ENGINE_ELEVENLABS_API_KEY et provider=elevenlabs. Tester réellement le retour audio (mp3) et la durée estimée. NE PAS marquer la voix-off 'works' tant que non testée en live.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Verifie sur le process REEL. /proc/3603311/environ: AI_ENGINE_DEFAULT_TTS_PROVIDER=mock (et VIDEO_PROVIDER=mock). Probe /api/admin/ai-engine/config/providers: ElevenLabs caps=['tts'] configured=False; OpenAI configured=True avec tts-1. generate-voiceover.ts:147 exige tts.default==='openai' && apiKeys.openai; :162 ==='elevenlabs' && key. Provider='mock' -> seule branche else (silent mock, qui echoue via lavfi). Voix-off live ni activee ni exercable.
- **Contre-preuve / nuance :** environ process: AI_ENGINE_DEFAULT_TTS_PROVIDER=mock. API: ElevenLabs configured=False. Nuance: OpenAI EST configure (tts-1) donc la voix-off live OpenAI serait techniquement activable en basculant provider=openai — mais en l'etat (mock) jamais empruntee.

> Réf. registre : `bug-register.csv` ligne `BUG-049` · matrice : `gap-matrix.csv`.
