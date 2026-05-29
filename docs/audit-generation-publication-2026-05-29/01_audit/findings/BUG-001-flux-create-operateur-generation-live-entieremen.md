# BUG-001 — Flux create operateur: generation LIVE entierement cassee (OpenAI key non lue, Higgsfield credential incomplet)

| | |
|---|---|
| **Sévérité** | `blocker` |
| **Domaine** | generation-image |
| **Composant** | `src/lib/content-studio/image-generation.ts + generate-visual route` |
| **Mode mock** | `works` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
En mode live, cliquer 'Generer un visuel IA' produit une vraie image via le provider du modele selectionne (OpenAI ou Higgsfield).

## État réel vérifié
Tout chemin live throw HttpError('invalid_state') -> HTTP 409 AVANT tout appel reseau. gpt-image-* -> step 4 lit env.CONTENT_STUDIO_OPENAI_API_KEY (VIDE dans le process) -> throw. hf-* -> higgsfieldAuthHeader() null (cle sans secret) -> throw. Modele decouvert non-prefixe -> step 5 -> cle vide -> throw.

## Écart
Aucune image live generable par l'operateur, quel que soit le modele.

## Cause racine
Triple cause: (1) image-generation.ts ligne 87/98/111 lit UNIQUEMENT env.CONTENT_STUDIO_OPENAI_API_KEY, vide, sans fallback vers OPENAI_API_KEY (qui EST present et valide, len 164, sk-); (2) Higgsfield credential incomplet (cle hf_ sans ':' et pas de AI_ENGINE_HIGGSFIELD_API_SECRET) -> higgsfieldCredential() renvoie null; (3) endpoints Higgsfield encore synchrones faux.

## Preuves
- /proc/3603311/environ: CONTENT_STUDIO_OPENAI_API_KEY = EMPTY ; OPENAI_API_KEY = SET (prefix sk-, len 164, hasColon=no) ; AI_ENGINE_HIGGSFIELD_API_KEY = SET (prefix hf_, hasColon=no) ; pas de AI_ENGINE_HIGGSFIELD_API_SECRET
- image-generation.ts:86-94 step4 throw invalid_state si !env.CONTENT_STUDIO_OPENAI_API_KEY
- image-generation.ts:71-83 step3 throw invalid_state si higgsfieldAuthHeader() null
- higgsfield-auth.ts:30-37 higgsfieldCredential() renvoie null si cle sans ':' et secret absent
- http-error.ts:29 invalid_state -> 409

## Reproduction
1) /admin/content-studio-v2/create, creer idee+drafts. 2) Toggle 'Live'. 3) Selectionner draft, choisir un modele image (gpt-image-1-mini suggere). 4) Cliquer 'Generer un visuel IA' -> toast erreur 'CONTENT_STUDIO_OPENAI_API_KEY manquant...' (HTTP 409). Idem hf-flux-pro -> 'credential Higgsfield incomplet'.

## Piste de correction
Court terme: faire lire au flux create la meme chaine que resolveApiKey (OPENAI_API_KEY en fallback de CONTENT_STUDIO_OPENAI_API_KEY) pour debloquer OpenAI. Fournir AI_ENGINE_HIGGSFIELD_API_SECRET (ou format KEY_ID:KEY_SECRET) pour Higgsfield. Reecrire les endpoints Higgsfield en async submit+poll (/v1/text2image/<model> + /v1/requests/{id}/status). Sinon, masquer/desactiver le mode live tant que non valide.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Toutes les preuves survivent a la refutation. /proc/3603311/environ confirme: CONTENT_STUDIO_OPENAI_API_KEY=EMPTY, OPENAI_API_KEY=SET(len=164, prefix=sk-pro, hasColon=no), AI_ENGINE_HIGGSFIELD_API_KEY=SET(len=67, prefix=hf_, hasColon=no), AI_ENGINE_HIGGSFIELD_API_SECRET absent. image-generation.ts:86-94 lit UNIQUEMENT env.CONTENT_STUDIO_OPENAI_API_KEY (vide) -> throw HttpError invalid_state. env.ts:249 lit process.env.CONTENT_STUDIO_OPENAI_API_KEY sans fallback vers OPENAI_API_KEY. higgsfield-auth.ts:30-37: cle sans ':' + secret absent -> higgsfieldCredential() null -> higgsfieldAuthHeader() null -> image-generation.ts:71-83 throw. Le step 5 (live sans modele) lit aussi CONTENT_STUDIO_OPENAI_API_KEY vide -> throw. Tout chemin live throw AVANT appel reseau. Le MOCK marche (verifie: generation-runs reels provider=mock). Blocker justifie: aucune image live generable par l'operateur.
- **Contre-preuve / nuance :** Aucune contre-preuve. Confirme: env probe (CONTENT_STUDIO_OPENAI_API_KEY=EMPTY, OPENAI_API_KEY=SET sans colon, pas de HIGGSFIELD_API_SECRET); image-generation.ts:87 `if (!env.CONTENT_STUDIO_OPENAI_API_KEY) throw`; env.ts:249 mapping direct sans fallback.

> Réf. registre : `bug-register.csv` ligne `BUG-001` · matrice : `gap-matrix.csv`.
