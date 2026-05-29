# BUG-021 — GenerationModeToggle defaut 'mock' contredit health.mockMode=false (etat affiche incoherent)

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | create-ui-flow |
| **Composant** | `GenerationModeToggle.tsx + MediaStudio.tsx + StudioContext (mockMode)` |
| **Mode mock** | `partial` |
| **Mode live** | `partial` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
L'indicateur de mode et le toggle reflthe le meme etat que l'env serveur (CONTENT_STUDIO_V2_MOCK_MODE).

## État réel vérifié
Réel: le toggle affiche MOCK et pose cookie=mock; le MockModeBadge global (piloté par health.mockMode=false) ne s'affiche pas; les générations VISUELLES partent bien en mock (cookie + défaut serveur concordants). Seule l'indication globale (badge) est désynchronisée du toggle — incohérence cosmétique d'affichage, pas de divergence de comportement de génération.

## Écart
Le defaut du toggle n'est pas alimente par l'env serveur; aucune synchronisation entre le toggle (cookie) et health.mockMode (env).

## Cause racine
MediaStudio.tsx:179 <GenerationModeToggle /> sans envDefault; GenerationModeToggle.tsx:44 envDefault='mock' par defaut; health renvoie mockMode depuis l'env CONTENT_STUDIO_V2_MOCK_MODE (false).

## Preuves
- curl GET /content-studio/health => {"mode":"drizzle","enabled":true,"version":"P3","mockMode":false}
- GenerationModeToggle.tsx:44 envDefault = 'mock'
- MediaStudio.tsx:179 <GenerationModeToggle />  (aucun envDefault transmis)
- StudioContext.tsx:104-114 mockMode initialise false puis lu depuis health

## Reproduction
1. /create. 2. Observer: toggle affiche MOCK actif (orange) mais aucun MockModeBadge dans le Stepper/footer (car mockMode=false). 3. La 1ere generation part en mock (cookie pose a mock).

## Piste de correction
Transmettre envDefault depuis health.mockMode au GenerationModeToggle, ou aligner le defaut du toggle sur l'env (live quand CONTENT_STUDIO_V2_MOCK_MODE!=true). Unifier MockModeBadge sur la meme source que le toggle.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Vérifié: MediaStudio.tsx:179 <GenerationModeToggle /> sans envDefault; GenerationModeToggle.tsx:44 envDefault='mock' par défaut, :47 useState(envDefault), :52-56 persistMode au montage -> cookie cs_generation_mode=mock. health renvoie mockMode:false (probe: {mode:drizzle,enabled:true,version:P3,mockMode:false}; CONTENT_STUDIO_V2_MOCK_MODE non défini, défaut env.ts:141 'false'). StudioContext.tsx:104/111 lit mockMode=false depuis health; Stepper.tsx:74 et PublishActionGroup.tsx:135 n'affichent MockModeBadge que si mockMode -> donc PAS de badge, alors que le toggle est sur MOCK. Deux sources de vérité divergentes confirmées. Aucune trace d'envDefault câblé nulle part.
- **Contre-preuve / nuance :** Atténuant sur la SÉVÉRITÉ: l'incohérence est d'affichage (badge global vs toggle), pas un bris fonctionnel — les générations partent bien en mock car le cookie ET le défaut serveur (generate-visual route.ts:28-29) sont tous deux 'mock'. Le système reste cohérent dans son comportement par défaut (mock). Le préjudice est de la confusion opérateur, pas une perte d'état.

> Réf. registre : `bug-register.csv` ligne `BUG-021` · matrice : `gap-matrix.csv`.
