# BUG-002 — Génération vidéo LIVE entièrement non-fonctionnelle: credential Higgsfield incomplet (clé sans secret)

| | |
|---|---|
| **Sévérité** | `blocker` |
| **Domaine** | generation-video |
| **Composant** | `src/lib/content-studio/video-generation.ts:104-116 + src/lib/content-studio/higgsfield-auth.ts:30-43` |
| **Mode mock** | `n/a` |
| **Mode live** | `broken` |
| **Verdict vérification** | `adjusted` (confiance: high) |

## État supposé (code + tests)
En mode live avec un modèle hf-video-*, generateStudioVideo soumet le job à Higgsfield et poll jusqu'à completion, renvoyant une vidéo réelle.

## État réel vérifié
AI_ENGINE_HIGGSFIELD_API_KEY est une cle mono-partie sans ':'; AI_ENGINE_HIGGSFIELD_API_SECRET est ABSENTE de .env (non pas '=' vide). higgsfieldCredential() -> null, higgsfieldAuthHeader() -> null, video-generation.ts:106 throw 'credential Higgsfield incomplet'. Chemin live hf-* 100% casse. Reserve de portee: l'operateur par defaut tombe en mode mock (cookie absent => mock) avec modele suggere mock-video-1.0, donc seule une bascule Live manuelle + selection hf-* declenche ce blocker.

## Écart
Tout chemin live throw avant tout appel réseau. La fonctionnalité live est annoncée (toggle Live, modèles hf-*) mais 100% cassée.

## Cause racine
Credential à deux parties (KEY_ID:KEY_SECRET) non fourni: clé seule + secret vide.

## Preuves
- .env → AI_ENGINE_HIGGSFIELD_API_KEY=hf_vPNYTSQ3...<redacted> (un seul token, pas de ':')
- grep AI_ENGINE_HIGGSFIELD_API_SECRET → ligne présente mais VIDE (=) dans .env
- higgsfield-auth.ts:31-37 → key.includes(':')?key:(secret?`${key}:${secret}`:null) → renvoie null ici
- video-generation.ts:106 → if(!auth) throw new HttpError('invalid_state', `...credential Higgsfield incomplet...`)
- video-generation.test.ts:111-122 → test confirme: mode=live + hf-* sans key → rejects /credential Higgsfield incomplet/

## Reproduction
Statique: env confirmé (clé sans ':', secret vide). En live, model=hf-video-lite → HttpError invalid_state. (Probe POST live volontairement NON exécutée: hors périmètre 1-POST-mock.)

## Piste de correction
Fournir AI_ENGINE_HIGGSFIELD_API_SECRET ou poser la clé au format KEY_ID:KEY_SECRET. Ne pas activer en prod sans valider d'abord (cf. finding-3 endpoints faux).

## Vérification adversariale
- **Verdict :** adjusted (confiance high)
- **Analyse :** Le coeur du finding est correct: credential Higgsfield incomplet -> tout chemin live video throw avant reseau. Verifie: AI_ENGINE_HIGGSFIELD_API_KEY ne contient pas ':' (grep -c ':' = 0), higgsfield-auth.ts:30-37 retourne null sans secret, video-generation.ts:106-114 throw HttpError invalid_state. MAIS correction factuelle: le secret n'est PAS 'present mais vide (=)' dans .env — la ligne AI_ENGINE_HIGGSFIELD_API_SECRET est totalement ABSENTE de .env (grep exit=1). env.ts:157 la declare z.string().optional() -> undefined. L'effet est identique (credential null) donc severite blocker maintenue pour le chemin LIVE. Note de portee: le defaut operateur reste mock (route.ts:28-29 mode='mock' par defaut + suggested=mock-video-1.0), donc l'operateur lambda n'est PAS bloque; seul un operateur qui bascule explicitement Live + choisit hf-* l'est. Le blocker est reel mais conditionnel a une action manuelle.
- **Contre-preuve / nuance :** grep -n AI_ENGINE_HIGGSFIELD_API_SECRET .env -> exit 1 (ABSENTE, pas '=' vide). env.ts:157 AI_ENGINE_HIGGSFIELD_API_SECRET: z.string().optional(). .env: AI_ENGINE_HIGGSFIELD_API_KEY=hf_vPNYTSQ3...(un seul token, 0 occurrence de ':'). higgsfield-auth.ts:35 if(!secret) return null.

> Réf. registre : `bug-register.csv` ligne `BUG-002` · matrice : `gap-matrix.csv`.
