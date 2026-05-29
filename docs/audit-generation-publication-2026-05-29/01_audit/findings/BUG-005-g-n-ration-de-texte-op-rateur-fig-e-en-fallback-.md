# BUG-005 — Génération de texte opérateur figée en fallback déterministe (jamais LLM) — MOCK et LIVE identiques

| | |
|---|---|
| **Sévérité** | `critical` |
| **Domaine** | copywriting |
| **Composant** | `src/lib/content-studio/generation.ts:66-102 (generateForIdea) + service.ts:99-176 (generateIdeaDrafts)` |
| **Mode mock** | `works` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le picker propose des modèles (gpt-4o-mini, etc.) et l'opérateur reçoit un brief + 3 drafts rédigés par un LLM, avec une copie adaptée à l'idée; provider=openai, coût ~2¢.

## État réel vérifié
Tous les runs texte sont provider=fallback, model=deterministic-template, status=fallback, cost=0. Le texte est un template figé : hook constant, captions quasi-identiques préfixées du prompt brut. Le modèle choisi dans l'UI est enregistré mais ignoré.

## Écart
Aucune génération LLM réelle ne se produit pour l'opérateur, dans AUCUN mode. Le mode 'mock' n'existe pas pour le texte : MOCK et LIVE donnent strictement le même fallback déterministe.

## Cause racine
generation.ts:70 résout la clé via `env.CONTENT_STUDIO_OPENAI_API_KEY ?? env.CHAT_OPENAI_API_KEY` — les deux sont vides/absents (CONTENT_STUDIO_OPENAI_API_KEY len=0, CHAT_OPENAI_API_KEY non défini). Le `OPENAI_API_KEY` générique valide (len=164) n'est PAS dans la chaîne de fallback de ce module. `if (!apiKey) return fallbackGeneration(idea)` court-circuite avant tout appel API.

## Preuves
- PID=3603311; /proc/<pid>/environ: CONTENT_STUDIO_OPENAI_API_KEY len=0 ; OPENAI_API_KEY len=164 ; CHAT_OPENAI_API_KEY absent ; AI_ENGINE_OPENAI_API_KEY absent
- curl GET /api/admin/content-studio/generation-runs?limit=5 -> tous les runs texte: provider=fallback, model=deterministic-template, status=fallback, cost=0, err=None
- generation.ts:70 `const apiKey = env.CONTENT_STUDIO_OPENAI_API_KEY ?? env.CHAT_OPENAI_API_KEY;` puis ligne 72 `if (!apiKey) return fallbackGeneration(idea);`
- POST /ideas/ci_2k8lzkz9ciwq8fst/generate (cookie cs_generation_mode=mock) -> brief.angle='Relier produit à un geste...', 3 drafts identiques en structure

## Reproduction
1) COOKIE depuis .auth/admin.json. 2) POST /api/admin/content-studio/ideas {pillar:produit,objective:conversion,platform:instagram,format:post,prompt:'...'} -> idea.id. 3) POST /api/admin/content-studio/ideas/<id>/generate {} (avec ou sans cookie cs_generation_mode=mock, et avec ou sans body {model:'gpt-4o-mini'}). 4) Observer runs[0].provider=fallback dans la réponse et dans /generation-runs.

## Piste de correction
Aligner la résolution de clé de generation.ts sur celle d'engine-config.ts:75 (ajouter `?? env.OPENAI_API_KEY`), OU documenter explicitement que le texte opérateur est volontairement déterministe. Si LLM voulu en staging, poser CONTENT_STUDIO_OPENAI_API_KEY. Remplacer `?? ` par une vérification de chaîne non vide (les `??` ne capturent pas la chaîne vide).

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Reverifie en environnement reel ET en code. /proc/3603311/environ: CONTENT_STUDIO_OPENAI_API_KEY len=0 (present mais vide), OPENAI_API_KEY len=164 prefix sk-proj (valide), CHAT_OPENAI_API_KEY ABSENT, AI_ENGINE_OPENAI_API_KEY ABSENT — identique a la claim. generation.ts:70 `env.CONTENT_STUDIO_OPENAI_API_KEY ?? env.CHAT_OPENAI_API_KEY` resout sur la chaine vide (le ?? ne capture PAS la chaine vide), puis ligne 72 `if (!apiKey) return fallbackGeneration(idea)` court-circuite. Le run reel cgr_paosnrtkwge2657i (idea ci_2k8lzkz9ciwq8fst) montre provider=fallback, model=deterministic-template, status=fallback, costCents=0. fallbackGeneration() ecrase le model choisi par 'deterministic-template' (ligne 196). Aucune divergence mock/live possible: la route generate ne lit pas le cookie cs_generation_mode et generation.ts ne lit pas OPENAI_API_KEY. Severite critical justifiee: la generation texte operateur n'appelle JAMAIS de LLM.
- **Contre-preuve / nuance :** Aucune contre-preuve trouvee; toutes les probes confirment. Seule nuance attenuante: l'UI CreateWorkspace.tsx:246 affiche honnetement un badge 'Genere par deterministic-template · fallback · gratuit', donc l'operateur voit que le run est en fallback — la 'tromperie' porte surtout sur le picker de modeles (qui propose du live) et non sur l'affichage du run lui-meme.

> Réf. registre : `bug-register.csv` ligne `BUG-005` · matrice : `gap-matrix.csv`.
