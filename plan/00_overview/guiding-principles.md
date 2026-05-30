# Principes directeurs du plan

> FemiGlow Content Studio v2 / AI Engine · baseline `docs/audit-generation-publication-2026-05-29/`
> Ces principes sont **contraignants** : toute tâche, PR et Definition of Done (DoD) du plan s'y conforme. Ils opérationnalisent les ADR-0002 (vérité = comportement réel), ADR-0003 (parité mock/live), ADR-0005 (cron self-hosted), ADR-0006 (Higgsfield async), ADR-0007 Option 1 (convergence vers A).

---

## P1 — Vérité = comportement réel (pas « test au vert »)

Un test vert n'est une preuve **que** s'il exerce le comportement réel et asserte un **effet observable** (asset servi en `200` avec des octets valides, ligne `generation_run` créée, job daté en base, permalien conforme). La preuve fondatrice de l'audit — 1695 tests « passed » sur un process en `exit 1` — interdit de faire confiance au signal de test nominal.

**Règles dérivées :**
- La CI échoue sur le **code de sortie** du process, jamais sur la ligne de résumé (T-001).
- Aucun `vi.mock` de module provider : on mocke au **niveau réseau** (MSW), pas au niveau module (ADR-0003).
- Toute assertion d'un parcours opérateur vérifie un **effet backend**, pas seulement le rendu UI (BUG-041).
- Pas de **faux succès silencieux** : un job ne peut pas être `completed quality 0.91` avec un asset manquant ; tout échec/dégradation pousse dans `state.errors` et expose une raison (MISS-011, T-304).

## P2 — Parité MOCK et LIVE (le cœur de la DoD)

> **Definition of Done globale : un comportement est « fini » seulement s'il est prouvé bout-en-bout par un chemin opérateur qui passe à l'identique en MOCK ET en LIVE.** Tant qu'un chemin n'est pas prouvé dans les deux modes, il reste **cassé par défaut.**

**Règles dérivées :**
- Mêmes scénarios, deux modes, **un drapeau unique** : `MODE=mock` (MSW actif, handlers fidèles aux contrats réels) et `MODE=live` (services réels, **comptes/credentials de test dédiés — jamais clients**). (ADR-0003 §2, ADR-0005.)
- **Détecteur de divergence** : un contract-test compare la *forme* des réponses mock vs live (schéma zod partagé) ; toute divergence échoue le CI. `onUnhandledRequest:'error'`. (ADR-0003 §3, T-006.)
- Les **handlers MSW sont calqués sur les specs réelles** : OpenAI images, Higgsfield **async** submit+poll (`POST /v1/{text2image|image2video}/<model>` → `GET /v1/requests/{id}/status`), Postiz `/api/public/v1/*`. Un mock infidèle reproduit la cause racine (ADR-0006).
- Les adapters de publication exposent **le même contrat** en `dry-run` et en `postiz` (permaliens/statuts) (T-308, BUG-045).
- **DoD à deux niveaux** quand un credential externe manque (ex. Higgsfield `KEY_SECRET`) : sous-DoD « contrat async + auth conforme prouvés en mock fidèle » découplé du sous-DoD « vérif live » déclenché à la fourniture du credential (ADR-0006). Ne jamais bloquer la valeur OpenAI live dessus.

## P3 — Garde-fou anti-incident (scheduler / déduplication) — NON NÉGOCIABLE

Le seul risque **irréversible** du projet est la publication erronée sur de **vrais comptes Instagram clients**. Brancher le scheduler (BUG-003) avant la déduplication et la synchronisation d'état provoquerait des **doubles publications** ou la **publication d'un post annulé**.

**Règles dérivées (gate dur de release) :**
- **L'activation live du scheduler (T-103b) est gardée par T-204 (idempotence indépendante de `scheduledAt` + dédup) et T-301 (sync `content_post ↔ social_publish_job`).** Dépendance dure, pas un conseil.
- Le **branchement + test mock/staging** du scheduler peut précéder ; le flip `SOCIAL_PUBLISHING_MODE=live` est protégé par checklist + ≥ 1 dry-run prouvé + **kill-switch** documenté au runbook.
- `dry_run` est le défaut ; `metadata.dryRun` est **dérivé du mode résolu**, jamais codé en dur, et on ne marque jamais `published` avec un permalien factice (T-308, BUG-065).
- En live, le **compte de publication est explicite** — jamais deviné via `resolveDefaultAccount` (T-303, BUG-039).
- Idempotence/locking sur ticks chevauchants (ADR-0005).

## P4 — Modularité & frontière de service unique (convergence vers A)

La cible est un **moteur de génération unique (A, LangGraph)** ; le create-flow (B) est une **UI au-dessus de A**. On supprime la duplication et les frontières floues.

**Règles dérivées :**
- **Une frontière d'invocation unique** : `invokeEngine(brief) → GenerationResult` que B appelle ; pont **bidirectionnel** et idempotent (ADR-0007). On ne répare un provider **qu'une fois, dans A**.
- **Résolution de credentials unifiée** : une seule source de vérité `resolveProviderCredential(provider)` consommée par A, B **et** le picker (ADR-0004, T-005). Un contract-test échoue si picker et générateur lisent des variables différentes.
- **Une seule infra de jobs async** mutualisée entre le polling provider (Higgsfield) et le scheduler de publication — pas deux mécaniques concurrentes (ADR-0006 §⚠, ADR-0005).
- **Retirer les fausses affordances** : aucun badge « Live » ne s'affiche sans que le moteur retourne réellement une clé ET un provider joignable (T-202).

## P5 — Robustesse & fiabilité

- **Pas de polling dans la requête HTTP opérateur** : le poll Higgsfield (jusqu'à plusieurs minutes) vit dans un **worker/job resumable**, borné par backoff + timeout global, pour ne pas violer les timeouts runtime (PM2/LiteSpeed self-hosted) (ADR-0006).
- **Retry borné** des jobs `failed` retryables ; jamais de boucle infinie (T-302).
- **Fallbacks audibles/visibles** : un asset dégradé est marqué `degraded` avec raison ; jamais `<video src=''>` ni image 404 servis comme succès (T-304, MISS-020/021).
- **Stockage déterministe** : `MEDIA_DIR` absolu injecté, indépendant de `process.cwd()` (le worker/cron peut tourner avec un autre cwd que `apps/web`) ; isolation du stockage de test ; purge des stubs de prod (T-306/T-411, MISS-024/032).

## P6 — Évolutivité

- Frontière provider stable (credential unifié + adapters) → ajouter un provider/réseau ne touche pas l'UI ni le create-flow.
- Taxonomies (objectifs/piliers/tone) **unifiées** entre A et B, source unique (T-203/T-412).
- Le contrat `GenerationResult` propage **toutes** les capacités de A (composition/exports/thumbnails) → toute nouvelle capacité du graphe devient exposable sans refonte du pont (T-104, MISS-005).

## P7 — Débogabilité & observabilité

- **Caches invalidables** : `resolvedKeyCache`, `modelCache`, `getEngineConfig` singleton — un changement d'env/config doit être pris en compte sans masquer un correctif (un restart requis doit être *documenté*) (T-410, MISS-030/033).
- Chaque exécution scheduler émet un `social_publish_event` (heartbeat + résultat) ; alerte si aucun tick depuis N minutes (ADR-0005 §3).
- Les messages d'erreur serveur utiles ne sont pas écrasés par un libellé générique (T-414, BUG-054).
- Toute route `/api/cron/*` a un déclencheur vérifié sur la **cible de déploiement effective** (self-hosted), contrôlé en CI (ADR-0005).

## P8 — Maintenabilité

- Pas de chemins de credentials/résolution dupliqués (≥ 3 aujourd'hui → 1 cible).
- Pas de deux générateurs texte/image concurrents (B délègue à A).
- Convergence **incrémentale et réversible** (feature-flag), gardée par le smoke opérateur : si le mock B régresse, le PR est bloqué — on ne casse jamais le seul parcours qui fonctionne aujourd'hui.

---

## Definition of Done — gabarit applicable à chaque tâche

Une tâche est **DONE** si, et seulement si :
1. Le comportement réel est exercé et asserte un **effet backend** (P1).
2. Il est prouvé en **MOCK** (MSW fidèle au contrat réel) **ET** en **LIVE** (compte/credential de test), via le **même** scénario (P2). *Sous-DoD live découplé si credential externe manquant (ADR-0006).*
3. Aucun **faux succès silencieux** ; toute dégradation est explicite (P1/P5).
4. Si la tâche touche la publication live : les **garde-fous anti-doublon** sont satisfaits *avant* activation (P3).
5. La parité est **automatique** (contract-test de divergence au vert) et la CI échoue sur l'exit code (P1/P2).
6. Pas de régression du smoke opérateur (mock + live) (P8).
