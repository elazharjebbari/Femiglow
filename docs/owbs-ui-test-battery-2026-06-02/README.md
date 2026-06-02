# OWBS — Batterie de tests UI/opérateur (agency-grade)

> **Objectif** : garantir une qualité **très supérieure** d'OWBS (Optimistic Wizard
> & Background Lead Sync) en se plaçant **du point de vue de l'opérateur et de
> l'utilisateur** des interfaces (acheteuse + admin), pour débusquer les bugs
> d'usage réel — pas seulement les unités isolées.
>
> Ce dossier **complète** (ne remplace pas) le dossier d'ingénierie
> [`../checkout-leads-background-2026-06-01/`](../checkout-leads-background-2026-06-01/).
> Il se concentre sur les **éléments peu/non testés** : le **comportement des
> interfaces** sous conditions réelles (réseau dégradé Maroc/mobile, fermeture
> d'onglet, reprise, états dégradés, multi-langue/RTL, a11y), et la **gestion
> admin** du nouveau système (leads, outbox, worker, flag, rate-limit).

**Statut :** `DRAFT — prêt pour exécution` · **Date :** 2026-06-02
**Cible code :** branche `feat/owbs-lead-background` (OWBS implémenté, flag OFF par défaut)
**Méthode :** approche delivery de grande agence (TCS/Capgemini/Infosys/Accenture) —
inventaire exhaustif → matrices de scénarios → batteries denses RTL+MSW+Playwright
→ scénarios métier réalistes → plan d'action piloté par runbook + boucle de correction.

---

## Principe directeur : tester *comme un opérateur*, pas comme un compilateur

Les tests unitaires existants prouvent que **les briques** fonctionnent. Cette
batterie prouve que **l'expérience** fonctionne : ce que voit, clique, attend,
subit un humain (acheteuse mobile au Maroc, opérateur admin à Rabat) à travers
**chaque écran**, dans **chaque condition** (succès, lenteur, coupure, reprise,
abandon, double-clic, retour arrière, langue AR/RTL, lecteur d'écran).

Trois couches, toujours du **point de vue UI** :
1. **RTL (Vitest + @testing-library/react)** — comportement composant observé via le DOM (rôles, libellés, états visibles), jamais via l'implémentation.
2. **MSW** — le réseau **réel** du composant simulé (latence, 5xx, 409, offline, désordre) pour observer la **réaction UI**.
3. **Playwright** — parcours **bout-en-bout** dans un vrai navigateur (build flag-ON), timing perçu, beacon, reprise, multi-onglet, a11y, i18n.

---

## Navigation

| # | Bloc | Contenu |
|---|---|---|
| 00 | [`00-strategy/`](00-strategy/) | Stratégie, **inventaire exhaustif** des fonctionnalités, risques, traçabilité, harness, portes qualité |
| F01–F14 | `F01..F14/` | **Un sous-dossier par fonctionnalité** : fonctionnement optimal + points à vérifier (UI/UX/design/data/back/front) + matrice de scénarios + plan de tests RTL/MSW/Playwright + scénarios métier |
| 90 | [`90-execution/`](90-execution/) | **Plan d'action global**, **runbook**, **boucle de correction**, commandes, reporting |

Vocabulaire : [`glossary.md`](glossary.md). Inventaire : [`00-strategy/functionality-inventory.csv`](00-strategy/functionality-inventory.csv).

## Modules (fonctionnalités) — vue d'ensemble

| Module | Surface | Public | Sous-dossier |
|---|---|---|---|
| F01 | Wizard — capture lead optimiste (étape `lead_capture`) | Acheteuse | [`F01-wizard-lead-capture/`](F01-wizard-lead-capture/) |
| F02 | Wizard — conversion (address→order) + garantie flush | Acheteuse | [`F02-wizard-conversion/`](F02-wizard-conversion/) |
| F03 | File de synchronisation en arrière-plan (retry/backoff/drop) | Système (effets UI) | [`F03-background-sync-queue/`](F03-background-sync-queue/) |
| F04 | Zéro-perte — beacon + reprise reload + miroir | Acheteuse | [`F04-zero-loss-beacon/`](F04-zero-loss-beacon/) |
| F05 | Indicateur dégradé FR-11 (UX d'erreur non bloquante) | Acheteuse | [`F05-degraded-indicator/`](F05-degraded-indicator/) |
| F06 | Réseau dégradé / offline / conditions Maroc-mobile | Acheteuse | [`F06-degraded-network/`](F06-degraded-network/) |
| F07 | Funnel chat optimiste (`LeadFormBubble`) | Acheteuse | [`F07-chat-funnel/`](F07-chat-funnel/) |
| F08 | i18n (FR/AR/EN), RTL & a11y du parcours optimiste | Acheteuse | [`F08-i18n-a11y/`](F08-i18n-a11y/) |
| F09 | Persistance & reprise (resume banner, hydratation) | Acheteuse | [`F09-resume-persistence/`](F09-resume-persistence/) |
| F10 | Admin — leads : liste, détail, états, actions | Opérateur | [`F10-admin-leads/`](F10-admin-leads/) |
| F11 | Admin — outbox & worker : supervision (gap UI inclus) | Opérateur | [`F11-admin-outbox-worker/`](F11-admin-outbox-worker/) |
| F12 | Flag / rollout / kill-switch / parité legacy | Opérateur | [`F12-flag-rollout/`](F12-flag-rollout/) |
| F13 | Rate-limit `/sync` & sécurité (honeypot, anti-abus) | Système/Opérateur | [`F13-ratelimit-security/`](F13-ratelimit-security/) |
| F14 | Intégrité données, idempotence & tracking/attribution | Système/Opérateur | [`F14-data-idempotency-tracking/`](F14-data-idempotency-tracking/) |

## Comment ce dossier est utilisé

1. L'**inventaire** garantit qu'**aucune** fonctionnalité n'est oubliée.
2. Chaque module décrit le **fonctionnement optimal** et **tout ce qu'il faut
   vérifier** (UI/UX/design/data/backend/frontend), puis liste une **matrice de
   scénarios** dense et des **plans de tests** concrets (RTL/MSW/Playwright).
3. Le **plan d'action global** ([`90-execution/action-plan.md`](90-execution/action-plan.md))
   ordonnance l'écriture/l'exécution de la batterie, avec une **boucle de
   correction** ([`90-execution/correction-loop.md`](90-execution/correction-loop.md)).
4. Le **runbook** ([`90-execution/runbook.md`](90-execution/runbook.md)) pilote
   l'exécution, vague par vague, jusqu'au vert intégral.
