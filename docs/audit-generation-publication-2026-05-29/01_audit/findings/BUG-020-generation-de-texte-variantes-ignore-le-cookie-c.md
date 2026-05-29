# BUG-020 — Generation de texte/variantes ignore le cookie cs_generation_mode et tombe silencieusement sur template en 'live'

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | create-ui-flow |
| **Composant** | `/api/admin/content-studio/ideas/[id]/generate/route.ts + generation.ts + CreateWorkspace.onCreated` |
| **Mode mock** | `partial` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
En mode live, generer les variantes appelle le LLM reel; le badge 'Généré par {model}' reflete le modele IA utilise. En mock, variantes simulees.

## État réel vérifié
La route ideas/generate NE LIT PAS le cookie cs_generation_mode. generation.ts lit CONTENT_STUDIO_OPENAI_API_KEY ?? CHAT_OPENAI_API_KEY (les deux vides) et, sans cle, retourne fallbackGeneration => provider:'fallback', model:'deterministic-template'. Aucune erreur n'est levee. L'operateur en 'live' obtient un texte template en croyant avoir du texte IA. Le toggle Mock/Live n'a AUCUN effet sur le texte.

## Écart
Le toggle de mode pilote uniquement generate-visual; la generation texte est mode-agnostique et degrade silencieusement.

## Cause racine
generation.ts:70-72 fallback inconditionnel sans cle; route ideas/generate (route.ts entier) n'extrait jamais cookies().get('cs_generation_mode').

## Preuves
- ideas/[id]/generate/route.ts: aucune reference a cs_generation_mode ni cookies()
- generation.ts:70 const apiKey = env.CONTENT_STUDIO_OPENAI_API_KEY ?? env.CHAT_OPENAI_API_KEY; :72 if (!apiKey) return fallbackGeneration(idea); :195 provider:'fallback', model:'deterministic-template'
- pm2 env: CONTENT_STUDIO_OPENAI_API_KEY et CHAT_OPENAI_API_KEY vides

## Reproduction
1. /create, toggle Live. 2. Creer une idee. 3. Variantes apparaissent (template deterministe). 4. Badge 'Généré par deterministic-template · fallback · gratuit' — mais l'operateur a demande le mode live.

## Piste de correction
Faire lire le cookie par ideas/generate et passer mode a generateForIdea; en mode live sans cle, throw invalid_state explicite au lieu de degrader en silence. Au minimum, surfacer un toast/avertissement quand provider==='fallback' en mode live.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Vérifié par lecture exhaustive: ideas/[id]/generate/route.ts ne lit jamais cookies() ni cs_generation_mode; generateIdeaDrafts (service.ts:99-107) appelle generateForIdea sans notion de mode; generation.ts:70 const apiKey = env.CONTENT_STUDIO_OPENAI_API_KEY ?? env.CHAT_OPENAI_API_KEY (les deux vides/absents — confirmé via pm2 env), :72 if(!apiKey) return fallbackGeneration -> :195 provider:'fallback', model:'deterministic-template', sans throw. costCents forcé à 0 (service.ts:143). Le toggle mock/live ne touche QUE generate-visual (route.ts:27-29). Le texte est donc mode-agnostique et dégrade silencieusement en template en mode 'live'.
- **Contre-preuve / nuance :** Aucune contre-preuve. Nuance: CONTENT_STUDIO_OPENAI_API_KEY est '' (chaîne vide) et non undefined, donc '?? CHAT' ne s'applique pas (nullish), mais '!""'=true déclenche quand même fallbackGeneration. Conclusion inchangée.

> Réf. registre : `bug-register.csv` ligne `BUG-020` · matrice : `gap-matrix.csv`.
