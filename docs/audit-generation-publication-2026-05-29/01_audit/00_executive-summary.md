# Synthèse direction — audit génération + publication

> FemiGlow Content Studio v2 / AI Engine · baseline figée **2026-05-29** · branche `feat/ai-engine-langgraph-mvp`.
> Méthode : vérité = comportement réel exercé (mock **et** live), chaque finding réfuté par un vérificateur indépendant. Cf. `01_methodology.md`.

## Verdict

> **Le pipeline « générer → publier » n'est PAS fonctionnel de bout en bout pour un opérateur, et le signal de test le masque.** Seul le **mode mock** produit un résultat ; la génération **live est cassée des deux côtés** (image/vidéo) et la **publication programmée ne s'exécute jamais**. Le décalage que vous constatez est réel, mesuré, et sa **cause racine est systémique** : l'outillage de test certifie un état fictif.

La preuve la plus parlante a été obtenue en **30 secondes** : `vitest` affiche **1695 tests « passed », 0 échec**… mais le **process sort en `exit 1`** (rejet de promesse masqué par des fake-timers). Un voyant vert au-dessus d'un process en échec. En parallèle, sur le **seul parcours opérateur**, 2 scénarios E2E sont rouges, et le sélecteur de modèles propose 14 modèles badgés « Live » dont **aucun n'est générable aujourd'hui**.

## Les 4 blockers (l'opérateur est bloqué)

| ID | Domaine | Problème réel | Cause racine |
|---|---|---|---|
| **BUG-001** | image | La génération image **live** échoue toujours (HTTP 409 avant tout appel réseau) | **Split de variable d'env** : une clé `OPENAI_API_KEY` valide existe dans le process mais n'est ni déclarée dans `env.ts` ni lue par le flux create (qui lit `CONTENT_STUDIO_OPENAI_API_KEY`, vide). + Higgsfield incomplet. |
| **BUG-002** | vidéo | La génération vidéo **live** est non fonctionnelle | Credential Higgsfield incomplet **et** endpoints codés en **synchrone** alors que l'API réelle est **async submit+poll**. |
| **BUG-003** | publication | La publication **programmée ne s'exécute jamais** (le job accuse réception mais reste inerte) | Le `social-publish-scheduler` n'est **branché à aucun cron** (absent de `vercel.json` + non appelé par `/tick`), et **staging est self-hosted** → les crons Vercel ne tournent pas. |
| **BUG-004** | voix-off / montage | Voix-off, musique, sous-titres, montage et export sont **inatteignables** depuis le parcours opérateur | **Deux pipelines parallèles** (LangGraph « A » vs create-flow « B ») ; le pont est **unidirectionnel A→B** et B n'invoque jamais A. |

## Bilan chiffré

- **68 findings confirmés** (après réfutation adversariale) : **4 blocker · 8 critical · 35 major · 18 minor · 3 info**. **1 réfuté**, **9 ajustés**, **34 problèmes manqués** relevés par les vérificateurs.
- Criticité par axe : **blocker** sur *backend, fiabilité, process, robustesse* ; **critical** sur *ui-ux, frontend, maintenabilité, débogabilité* ; **major** sur *design, évolutivité, modularité*.
- **0 test sur 95** du périmètre publication n'asserte un **effet backend réel** côté opérateur (BUG-041) ; `msw` est installé mais **non câblé** en harnais de parité (BUG-046).

## Les 3 causes racines systémiques (pourquoi ça « ment »)

1. **L'outillage de test ne reflète pas le réel.** Mocks au niveau module (`vi.mock`) et doublures qui ne respectent pas la forme des réponses live ; assertions qui vérifient l'UI sans vérifier l'effet backend ; gate CI sur la ligne de résumé, pas sur le code de sortie. → *un test vert n'est pas une preuve.*
2. **Deux pipelines de génération dupliqués et mal raccordés** (A LangGraph riche / B create-flow pauvre), pont unidirectionnel : l'UI promet des capacités du pipeline A que l'opérateur (pipeline B) n'atteint jamais.
3. **Résolution de credentials dispersée** sur ≥3 chemins divergents (picker ≠ générateur ≠ graphe) : l'UI annonce « Live » ce que le moteur ne peut pas produire.

## Risques majeurs à surveiller

- **Incident client si l'on « répare » BUG-003 naïvement** : brancher le scheduler **avant** la déduplication/synchronisation d'état (T-301/302) transformerait un blocker inerte en **doubles publications / publication d'un post annulé** sur de **vrais comptes Instagram clients**. → garde-fou explicite dans le plan.
- **Publication réelle** : `dry_run` est le défaut (rien n'est posté) **mais** le post passe quand même à `published` avec un permalien factice — divergence d'état trompeuse.

## Top priorités (séquencement non négociable)

1. **P0 — Rétablir la vérité d'abord** : gate CI sur l'`exit code`, fermer la fuite fake-timer, verdir les 2 E2E opérateur, **harnais de parité mock/live (MSW réseau)**, et **unifier la résolution de clé** (débloque OpenAI live — *correctif bon marché, la clé est déjà là*). *Sans cette couche, aucune correction n'est vérifiable.*
2. **P1 — Les 4 blockers**, chacun « fini » seulement s'il est **prouvé bout-en-bout par un chemin opérateur, en mock ET en live**.
3. **P2→P4** : criticals (texte figé, picker mensonger, désync), majors (état publication, variation, hygiène), puis dette.

> **Definition of Done globale** : *système 100 % fonctionnel, prouvé par des tests orientés opérateur qui passent à l'identique en mock ET en live.* Tant qu'un chemin n'est pas prouvé dans les deux modes, il reste **cassé par défaut**.

## Ce que cet audit a corrigé sur lui-même (honnêteté méthodologique)

- Le finding « voix-off cassée car `lavfi` indisponible » (BUG-012/013) a été **réfuté** par contre-exécution du binaire `ffmpeg-static` réel (lavfi fonctionne) → reclassé `minor`. L'impact réel reste gouverné par BUG-004 (inatteignabilité).
- L'idée « aucune clé OpenAI » est **fausse** : la clé existe, c'est un **split d'env** — d'où un correctif peu coûteux.

➡️ Détails : `bug-register.csv`, `gap-matrix.csv`, `mock-live-parity.csv`, `findings/`, `../06_action-plan/`, `../07_runbook/`.
