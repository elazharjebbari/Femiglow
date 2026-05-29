# BUG-048 — Le flux opérateur réel (/admin/content-studio-v2/create) n'a AUCUN lien avec voix-off/musique/sous-titres

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | voix-off |
| **Composant** | `src/lib/content-studio/* , src/components/admin/content-studio-v2/create/* , src/app/api/admin/content-studio/drafts/[id]/generate-visual/route.ts` |
| **Mode mock** | `n/a` |
| **Mode live** | `n/a` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
L'opérateur sur /create génère du contenu; le pont content-studio-bridge.ts est censé connecter le graphe AI-Engine (avec audio) au flux create.

## État réel vérifié
Confirme avec correction mineure d'evidence: le bridge est importe par 3 routes AI-Engine (generate, generate-stream, jobs/[id]/review), pas une seule. Aucune n'est le parcours operateur /create.

## Écart
La voix-off/musique/sous-titres sont réservées au graphe AI-Engine, accessibles seulement via la page séparée /ai-engine/create, jamais via le flux create principal de l'opérateur. Deux systèmes parallèles non connectés sur ce périmètre.

## Cause racine
Le pont est unidirectionnel et déclenché par l'AI-Engine, pas par le create flow; le create flow fait sa propre génération texte (generation.ts, OpenAI/fallback) sans média audio.

## Preuves
- grep -rn 'ai-engine|runGeneration|generateVoiceover|orchestrator|buildContentGraph|getContentEngine' src/lib/content-studio/ (hors tests) => AUCUN résultat
- grep -rln 'voiceover|music|subtitle|voix' src/components/admin/content-studio-v2/create/ => AUCUN résultat
- grep -nE 'voiceover|music|subtitle|ai-engine|runGeneration|audio|tts' .../drafts/[id]/generate-visual/route.ts => AUCUN résultat
- content-studio-bridge.ts:81 bridgeToContentStudio importé uniquement par src/app/api/admin/ai-engine/generate/route.ts:7

## Reproduction
1. Auditer imports de src/lib/content-studio (grep ai-engine) => vide. 2. Auditer composants create (grep voiceover) => vide. 3. Confirmer que seul /ai-engine/create appelle /api/admin/ai-engine/generate.

## Piste de correction
Décision produit: soit brancher le create flow sur le graphe AI-Engine (et exposer l'audio, cf voix-off-2), soit retirer toute promesse de voix-off/musique du parcours opérateur. Documenter clairement que l'audio est exclusif à la page AI-Engine.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Greps re-executes: grep ai-engine/runGeneration/generateVoiceover/orchestrator dans src/lib/content-studio (hors tests) = AUCUN; grep voiceover/music/subtitle/voix/tts dans src/components/admin/content-studio-v2/create/ = AUCUN; grep audio/ai-engine dans drafts/[id]/generate-visual/route.ts = AUCUN. Le pont est unidirectionnel AI-Engine->content-studio, jamais declenche par /create. Voix-off/musique/sous-titres restent exclusifs a /ai-engine/create.
- **Contre-preuve / nuance :** Une preuve de l'auditeur est inexacte: bridgeToContentStudio n'est pas importe 'uniquement par .../generate/route.ts:7' mais aussi par jobs/[id]/review/route.ts et generate-stream/route.ts (et bridge/index.ts). Ces 3 importeurs sont TOUS cote AI-Engine — aucun n'est /create. La conclusion tient.

> Réf. registre : `bug-register.csv` ligne `BUG-048` · matrice : `gap-matrix.csv`.
