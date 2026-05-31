# Emailing FemiGlow — Dossier de conception

> Plan complet pour intégrer un **système d'emailing transactionnel + broadcast + automation** dans l'admin FemiGlow, basé sur **Listmonk** (open-source) en backend et **Stalwart** (MTA déjà en place) comme moteur d'envoi. Niveau d'intégration cible : **iframe + reverse proxy + SSO**, un seul login, un seul domaine, une seule sidebar.

## Pourquoi ce dossier

L'audit `docs/audit-stalwart-email.md` a établi que :
- Stalwart est opérationnel à 90 % côté serveur (SPF/DKIM/DMARC/UFW/Redis désormais OK).
- L'app FemiGlow n'a **aucun fil de sortie** vers ce serveur, et aucun système de gestion d'emails côté admin.

Ce dossier décrit la **mise en œuvre complète** d'un système d'emailing :
- Gérable depuis `https://admin.femiglow-maroc.com/admin/emails/*` (l'admin existant).
- Adossé à Stalwart pour la livraison et à Listmonk pour la composition/segments/automation.
- Couvrant les 3 niveaux d'usage : transactionnel (N1), broadcast/newsletter (N2), automation déclenchée (N3).
- Robuste, maintenable, débogable, ergonomique, élégant, modulable, évolutif, testé.

## TL;DR — décisions structurantes

| Sujet | Décision | Pourquoi |
|---|---|---|
| **Backend emailing** | Listmonk (binaire Go, ~80 Mo RAM, MIT, Postgres) | Templates, lists, segments, A/B, double opt-in, bounce parser, tracking pixel + click rewrite, RFC 8058 List-Unsubscribe — tout inclus. Réinventer = 4-6 semaines. |
| **MTA** | Stalwart `127.0.0.1:587` | Déjà en place, DKIM (RSA + Ed25519) configuré, DMARC `p=reject`, SPF correct. Pas de SaaS, pas d'IP supplémentaire. |
| **Niveau d'intégration UI** | **Niveau 2** : iframe + reverse proxy + SSO middleware | Un seul login (FemiGlow), un seul domaine, sidebar partagée. Effort ~1 semaine vs ~3-4 pour tout rebâtir. |
| **Transactionnel** | nodemailer direct → Stalwart 587 + outbox SQL + retry cron | Latence < 200 ms. Listmonk API tx en backup. Pattern calqué sur `lib/webhooks/`. |
| **Broadcast / newsletter** | 100 % via Listmonk (UI iframe + API) | Bénéficie du compositeur WYSIWYG natif et des analytics open/click. |
| **Automation (workflows déclenchés)** | Cron FemiGlow + appel `POST /api/tx` Listmonk | Pas de moteur supplémentaire ; FemiGlow décide quand, Listmonk envoie. |
| **DB** | Tables FemiGlow (Drizzle) pour transactionnel + bridge ; Postgres dédiée Listmonk (séparée, recommandée par upstream) | Évite contention et migrations croisées. Lien via `email_subscriber.listmonk_subscriber_id`. |
| **Sécurité** | Reverse proxy ne route que loopback ; SSO via session middleware ; secrets dans `.env` permissions 600 ; suppression list applicative + Listmonk ; CNDP-conforme | Listmonk jamais exposé publiquement direct. |
| **Tests** | **Jest** (unit + integration React), **MSW** (mock API Listmonk + webhooks Stalwart pour stories isolées), **Playwright** (E2E flux utilisateur complets). Scénarios atomiques par composant. | Couverture par étage. Aucun chemin critique sans test E2E. |
| **Wizard de campagne** | Wizard custom 6 étapes dans FemiGlow (pas l'éditeur Listmonk direct) | Pour l'onboarding non-technique. Étapes : Type → Audience → Template → Compose → Schedule → Review. Spec ultra-détaillée dans `06-wizard-specification.md`. |
| **Templates** | **react-email** côté FemiGlow (avec MJML fallback pour import Listmonk WYSIWYG) | Versionné en Git, preview RSC, design tokens partagés avec le site. |
| **Observabilité** | Sentry tag `mailer` + Stalwart logs + Listmonk metrics + dashboard `/admin/emails` | Tout incident traçable de l'event applicatif à la livraison SMTP. |

## Navigation

Les fichiers sont numérotés pour une lecture séquentielle, mais chacun est autonome. Lire dans l'ordre la première fois ; revenir au fichier ciblé ensuite.

| # | Fichier | Quand le lire |
|---|---|---|
| 0 | `README.md` *(ici)* | Toujours, en premier. |
| 1 | [`00-executive-summary.md`](00-executive-summary.md) | 1 page pour décideur — synthèse, coût, risques. |
| 2 | [`01-vision-architecture.md`](01-vision-architecture.md) | Avant de toucher au code. Diagramme système, flux entrée/sortie, choix tech motivés. |
| 3 | [`02-data-model.md`](02-data-model.md) | Avant les migrations. Tables Drizzle `email_*` + bridge Listmonk + index. |
| 4 | [`03-backend-integration.md`](03-backend-integration.md) | Pendant l'impl backend. Proxy, SSO middleware, webhooks Stalwart, transactional sender, API client Listmonk. |
| 5 | [`04-frontend-admin.md`](04-frontend-admin.md) | Pendant l'impl frontend. Routes, RSC, hooks, état, navigation. |
| 6 | [`05-ui-ux-design.md`](05-ui-ux-design.md) | Avant les composants. Tokens, primitives, layouts, états, responsive, a11y. |
| 7 | [`06-wizard-specification.md`](06-wizard-specification.md) | ⭐ **Spec ultra-détaillée du wizard campagne**. Layout, validations, états, edge cases, a11y, tests scénarios. |
| 8 | [`07-templates-system.md`](07-templates-system.md) | Avant de bâtir le studio templates. react-email, variables, preview, versioning, sync Listmonk. |
| 9 | [`08-tests-strategy.md`](08-tests-strategy.md) | ⭐ Pendant l'impl. Patterns Jest + MSW + Playwright + scénarios atomiques **par composant**. |
| 10 | [`09-infrastructure-setup.md`](09-infrastructure-setup.md) | Avant le premier déploiement. Install Listmonk, nginx, systemd, comptes Stalwart, env vars. |
| 11 | [`10-observability-debugging.md`](10-observability-debugging.md) | Après mise en prod. Logs, Sentry, dashboards, recettes de debug. |
| 12 | [`11-security-rgpd.md`](11-security-rgpd.md) | Avant de récolter le premier email. Consentement, suppression, CNDP marocaine, audit. |
| 13 | [`12-runbook.md`](12-runbook.md) | ⭐ **Pilote de l'exécution**. Index complet des fichiers par phase + procédures opérationnelles + incidents. |
| 14 | [`13-plan-action.md`](13-plan-action.md) | Avant chaque phase. Roadmap M0→M6 avec deliverables et acceptance criteria. |

## Demandes utilisateur cartographiées

> Pour traçabilité : où chaque sous-demande de l'utilisateur (a..g) est traitée.

| Demande | Document principal | Sections clés |
|---|---|---|
| **(a)** Système simple d'envoi/réception | `01-vision-architecture.md` §1-3 | Schéma global, flux IN/OUT, ce qui est piloté par FemiGlow vs Listmonk vs Stalwart |
| **(b)** Gérable depuis l'interface FemiGlow (1 seul admin) | `03-backend-integration.md` §2 + `04-frontend-admin.md` §1-3 | SSO middleware, iframe wrapper, sidebar entry, routes admin |
| **(c)** UI/UX/design qualitatif | `05-ui-ux-design.md` (tout) + `06-wizard-specification.md` (wizard détaillé) | Tokens, primitives, layouts, mockups ASCII, états, transitions |
| **(d)** Backend robuste | `03-backend-integration.md` + `02-data-model.md` + `10-observability-debugging.md` | Outbox, idempotency, retry, webhooks, secrets, audit |
| **(e)** Data architecture | `02-data-model.md` (tout) | Schéma Drizzle, index, bridge Listmonk, migrations |
| **(f)** Plan d'action + roadmap | `13-plan-action.md` + `12-runbook.md` | Phases M0→M6, deliverables, acceptance criteria |
| **(g)** Tests Jest + Playwright + **MSW** + scénarios atomiques par composant | `08-tests-strategy.md` (tout) | Patterns, mocks API, fixtures, E2E flows, scénarios par composant |
| **(h)** Wizard très détaillé | `06-wizard-specification.md` (dédié) | Étapes 1→6, layouts, validations, états, focus order, raccourcis, edge cases |
| **(i)** Runbook qui pilote + indexe les références | `12-runbook.md` (dédié) | Index par phase, ordre d'exécution, dépendances entre fichiers |

## Glossaire express

| Terme | Définition |
|---|---|
| **MTA** | Mail Transfer Agent. Stalwart joue ce rôle ici. Reçoit, signe (DKIM), met en queue, livre. |
| **MUA** | Mail User Agent. Webmail Stalwart, Thunderbird, app FemiGlow via nodemailer. |
| **Transactional** | Email 1-pour-1 déclenché par une action user (contact, reset, accusé). |
| **Broadcast** | Email 1-pour-N planifié (newsletter, annonce). |
| **Automation** | Workflow déclenché par un event (abandon panier, post-achat J+7). |
| **Subscriber** | Personne qui peut recevoir des broadcasts. Stocké côté Listmonk, mirrored dans `email_subscriber` côté FemiGlow pour les filtres applicatifs. |
| **List** (Listmonk) | Liste de subscribers (~mailing list classique). Mappée 1↔1 à une `email_audience` côté FemiGlow. |
| **Campaign** | Envoi broadcast unique (peut être planifié ou immédiat). |
| **Outbox** | Table SQL `email_outbox` côté FemiGlow qui stocke les envois transactionnels (status, attempts, retry). Garantie at-least-once. |
| **Suppression list** | Adresses à **ne plus** contacter (hard bounce, spam complaint, unsubscribe). Doublonnée côté FemiGlow ET Listmonk. |
| **DSN** | Delivery Status Notification — mail bounce normalisé (RFC 3464). |
| **List-Unsubscribe RFC 8058** | Header + endpoint POST one-click. **Exigé** par Gmail/Outlook depuis 2024 pour expéditeurs > 5k/jour. |
| **Idempotency key** | Hash applicatif qui empêche le double envoi (ex. `{template}:{user_id}:{day}`). |
| **DLQ** | Dead Letter Queue — entrées en `failed_permanent` après max retries. |
| **SSO middleware** | Composant Next.js qui valide la session admin FemiGlow et injecte les credentials Listmonk en backend, transparent côté navigateur. |

## Conventions transverses du dossier

- Code en **TypeScript strict** ; SQL en majuscules pour les keywords.
- Toutes les routes admin sont **RSC** ; le client n'a accès qu'aux endpoints `/api/admin/emails/*` (auth `requireAdmin`).
- Toutes les routes proxy `/listmonk/*` passent par un **middleware d'auth**. Aucun accès public, aucun token Listmonk exposé au navigateur.
- Tous les secrets dans `apps/web/.env` (permissions 600) ou dans le secret manager du VPS.
- Tous les emails sortants utilisent **From : `noreply@femiglow-maroc.com`** et **Reply-To : `info@femiglow-maroc.com`** sauf cas justifié.
- Tous les composants UI dérivent des **tokens admin existants** (`stone-*` Tailwind + brand `sauge / ciel / champagne / petale`). Aucun nouveau token global.
- Tous les emails ajoutés sont **catalogués** dans `email-catalog.ts` (cf. `07-templates-system.md`). Aucun template "sauvage".
- Toutes les tables Drizzle nouvelles sont **versionnées** via migrations idempotentes.
- Tous les composants exportés publient un **scénario MSW** + **un test Jest** + **un test Playwright** quand ils touchent un flux critique (cf. `08-tests-strategy.md`).

## Dépendances internes au dossier

```
README.md
   │
   ├── 00 (synthèse)
   ├── 01 (archi) ────────────────────┐
   │      │                            │
   │      ├── 02 (data) ───────┐       │
   │      ├── 03 (backend) ────┼───────┤
   │      ├── 04 (frontend) ───┤       │
   │      │      └── 05 (UI design) ───┤
   │      │             └── 06 (wizard spec) ⭐
   │      └── 07 (templates) ──┤
   │                            │
   ├── 08 (tests) ──────────────┘
   ├── 09 (infra)
   ├── 10 (observabilité)
   ├── 11 (sécu/RGPD)
   │
   └── 12 (runbook) ⭐  ──── indexe & ordonne tous les précédents
              │
              └── 13 (plan d'action) ──── M0..M6 ordonnancés
```

## Statut initial

- ✅ Stalwart opérationnel (cf. audit du 2026-05-11, MAJ 2026-05-13)
- ✅ SPF / DKIM / DMARC / UFW / Redis OK
- ⚠️ Tous les crons `femiglow-cron-*.service` sont **`failed`** — **bloquant** pour le retry de l'outbox. À résoudre en M0.
- ❌ Aucun système d'envoi côté app FemiGlow (à part webhooks JSON).
- ❌ Aucun compte `noreply@femiglow-maroc.com` créé dans Stalwart.
- ❌ Listmonk non installé.

Démarrage recommandé : **`12-runbook.md`** pour orchestrer, puis `09-infrastructure-setup.md` pour M0.
