# 12 — Runbook (pilote d'exécution)

> **Document central** qui orchestre l'implémentation. Indexe les fichiers de référence par phase, ordonne les étapes, expose les checklists d'acceptance, et regroupe les procédures opérationnelles courantes. À garder ouvert pendant toute la durée du projet.

## §1 — Comment utiliser ce runbook

1. **Identifier la phase courante** (cf. §3). Une seule phase est "active" à la fois.
2. **Ouvrir uniquement les fichiers indexés pour cette phase** — pas tout le dossier en parallèle.
3. **Suivre l'ordre des étapes** : chaque étape a un fichier référent, une commande, un acceptance critère.
4. **Cocher** au fur et à mesure dans une copie locale ou via TodoWrite côté Claude.
5. **Ne pas passer à la phase suivante** sans tous les ✅ d'acceptance de la phase courante.

## §2 — Index complet des fichiers du dossier

| # | Fichier | Rôle | Quand l'ouvrir |
|---|---|---|---|
| 0 | `README.md` | Navigation, TL;DR, glossaire | Premier contact + retour confus |
| 1 | `00-executive-summary.md` | Pitch décideur | Pour expliquer le projet à un tiers |
| 2 | `01-vision-architecture.md` | Schéma système & flux | Avant tout code |
| 3 | `02-data-model.md` | Schéma Drizzle | Avant migrations |
| 4 | `03-backend-integration.md` | Proxy, SSO, webhooks, sender | Pendant impl backend |
| 5 | `04-frontend-admin.md` | Routes admin, composants | Pendant impl frontend |
| 6 | `05-ui-ux-design.md` | Tokens, primitives, layouts | Avant composants UI |
| 7 | `06-wizard-specification.md` | Spec wizard détaillée | Pendant impl wizard (M3) |
| 8 | `07-templates-system.md` | react-email, variables | Pendant impl templates |
| 9 | `08-tests-strategy.md` | Jest/MSW/Playwright | À chaque PR |
| 10 | `09-infrastructure-setup.md` | Install Listmonk, configs | Avant M0 |
| 11 | `10-observability-debugging.md` | Logs, Sentry, recipes | Après mise en prod |
| 12 | `11-security-rgpd.md` | Conformité, secrets | Avant 1er opt-in collecté |
| 13 | `12-runbook.md` *(ici)* | Pilote | En permanence |
| 14 | `13-plan-action.md` | Roadmap M0→M6 | Avant chaque phase |

## §3 — Phases & dépendances entre fichiers

Chaque phase consomme un sous-ensemble des fichiers. **Ne PAS ouvrir les fichiers d'une phase future** tant que la phase courante n'est pas validée.

### Phase 0 — Préparation (1 sprint)

**Objectif** : Réparer l'existant + installer Listmonk + créer les tables.

| Étape | Fichier de référence | Commande / action | Acceptance |
|---|---|---|---|
| 0.1 — Diagnostiquer les crons `femiglow-cron-*.service` en `failed` | nouveau ticket | `journalctl -u femiglow-cron-tick.service --since "24h ago"` | Identifier root cause documentée |
| 0.2 — Réparer les crons | (selon diag) | fix code/permissions/env | `systemctl list-units --failed` ne montre plus de cron FemiGlow |
| 0.3 — Installer Listmonk | `09-infrastructure-setup.md` §2 | suivre §2.1→§2.6 | `systemctl status listmonk` = active |
| 0.4 — Créer DB Listmonk + schema | `09-infrastructure-setup.md` §2.3, §2.5 | psql + `listmonk --install` | DB existe, schema en place |
| 0.5 — Compte Stalwart `noreply@` | `09-infrastructure-setup.md` §3.1 | `stalwart-cli create principal` | Compte visible, swaks test 250 OK |
| 0.6 — Listmonk SMTP config | `09-infrastructure-setup.md` §3.2 | UI Listmonk Settings | Test envoi Listmonk → reçu |
| 0.7 — API user `femiglow-app` | `09-infrastructure-setup.md` §4 | UI Listmonk Users | Token noté |
| 0.8 — Webhooks Stalwart + Listmonk | `09-infrastructure-setup.md` §5, §6 | stalwart-cli + UI Listmonk | curl POST webhook → 200 |
| 0.9 — Migrations Drizzle | `02-data-model.md` §4 + `09-…` §10 | `pnpm db:generate && pnpm db:migrate` | 10 tables `email_*` présentes |
| 0.10 — Vars .env | `09-infrastructure-setup.md` §11 | éditer `apps/web/.env` | `env.ts` parse OK |
| 0.11 — Crons FemiGlow emails | `09-infrastructure-setup.md` §9 | créer 6 unit files + timer | 6 timers active |
| 0.12 — Test bout-en-bout | `09-infrastructure-setup.md` §12 | suite de curl | 5 checks ✅ |

**Acceptance phase 0** :
- [ ] Tous les crons FemiGlow `active` (zero failed)
- [ ] Listmonk accessible loopback, jamais publiquement
- [ ] Webhook test depuis Stalwart vers FemiGlow → 200
- [ ] Migrations Drizzle appliquées (10 tables + 2 matviews)
- [ ] `pnpm typecheck` & `pnpm test:unit` pass sur main

→ Si OK : passage en **Phase 1**.

### Phase 1 — Transactional core (1-2 sprints)

**Objectif** : `lib/mail/` opérationnel + 5 templates + intégration aux 5 endpoints existants.

**Fichiers à consulter** :
- `01-vision-architecture.md` §3.1, §4
- `02-data-model.md` §2 (tables outbox, event, suppression, template_meta)
- `03-backend-integration.md` §3, §4
- `07-templates-system.md` (tout)
- `08-tests-strategy.md` §3 (unit), §4 (integration), §5 (templates)
- `11-security-rgpd.md` §3 (List-Unsubscribe)

| Étape | Fichier | Action | Acceptance |
|---|---|---|---|
| 1.1 — Module `lib/mail/client.ts` | 03 §3.2 | nodemailer transport | `verifySmtp()` → OK |
| 1.2 — `lib/mail/catalog.ts` | 07 §2 | 5 entries typées | typecheck pass |
| 1.3 — `lib/mail/render.ts` | 07 §3 | react-email render | snapshot tests pass |
| 1.4 — Templates × 5 | 07 §4, §5 | composants TSX | tests render pass |
| 1.5 — `lib/mail/send.ts` | 03 §3.3 | sendTransactional() | tests unit pass |
| 1.6 — `lib/mail/outbox.ts` + backoff | 03 §3.4, §3.5 | cron runner | test unit batch pickup |
| 1.7 — `/api/cron/email-outbox` | 03 §3.6 | route handler | curl cron → 200 + batch processed |
| 1.8 — `/api/mail/webhook/stalwart` | 03 §4 | route + Zod + dispatch | tests integration pass |
| 1.9 — Câblage `/api/contact` | (modifier existant) | `sendTransactional({ template: 'contact-acknowledgement', ... })` | E2E : form submit → mail reçu |
| 1.10 — Câblage 4 autres endpoints | (modifier existants) | idem | tests E2E pass |
| 1.11 — Suppression check + unsub endpoint | 11 §3 | endpoint POST/GET | test E2E unsubscribe one-click |
| 1.12 — Admin transactional `/admin/emails/transactional` | 04 §3.2-3.3 | RSC + Drizzle | E2E view + retry |

**Acceptance phase 1** :
- [ ] 5 endpoints applicatifs (`/api/contact`, `/api/newsletter`, `/api/chat/lead/contact`, `/api/auth/reset`, `/api/order/create`) envoient un mail réel
- [ ] Coverage `lib/mail/` ≥ 90 %
- [ ] E2E Playwright `transactional.spec.ts` : 4 tests pass
- [ ] 0 envoi en échec sur 100 envois consécutifs (test charge)
- [ ] Listmonk **pas encore utilisé** (transactional direct via Stalwart)

### Phase 2 — Audit & robustness (1 sprint)

**Objectif** : observabilité, audit log, monitoring.

**Fichiers** :
- `10-observability-debugging.md` (tout)
- `11-security-rgpd.md` (§10 audit, §8 rate limit)

| Étape | Fichier | Action |
|---|---|---|
| 2.1 — logger.* sur tous les events mail | 10 §2 | refactor passage |
| 2.2 — Sentry tags `subsystem:mailer` | 10 §2.3 | wrapper |
| 2.3 — `/api/admin/emails/health` | 10 §5.2 | endpoint + UI badge |
| 2.4 — Audit log : `mail.*` events | 11 §10 | call logAuditEvent partout |
| 2.5 — Rate limit endpoints | 11 §8 | middleware existant + nouvelles règles |
| 2.6 — Sentry alerts (DLQ, SMTP fail, hard bounce) | 10 §5.3 | UI Sentry |
| 2.7 — Smoke test contract Stalwart payloads | 08 §8 | fixtures réelles |

**Acceptance phase 2** :
- [ ] Health badge OK reflète vraie santé (test : couper SMTP → badge rouge)
- [ ] Sentry recoit événements `mail.*` taggés
- [ ] Audit log liste toutes les actions mail des 24 dernières heures
- [ ] Tous les endpoints rate-limited

### Phase 3 — Broadcast & wizard (2-3 sprints)

**Objectif** : Wizard de campagne fonctionnel + Listmonk piloté depuis FemiGlow.

**Fichiers** :
- `03-backend-integration.md` §2 (proxy/SSO), §7 (Listmonk client)
- `04-frontend-admin.md` §3.4-3.5
- `05-ui-ux-design.md` (tout)
- `06-wizard-specification.md` ⭐ **TOUT**
- `08-tests-strategy.md` §6 (Playwright wizard)
- `09-infrastructure-setup.md` §8 (theming)

| Étape | Fichier | Action |
|---|---|---|
| 3.1 — Proxy `/api/listmonk/[...path]` | 03 §2.2 | route handler + tests |
| 3.2 — `ListmonkFrame` component | 03 §2.3 | TSX + tests |
| 3.3 — Page `/admin/emails/listmonk` iframe wrapper | 04 §3.8 | page.tsx |
| 3.4 — Theming Listmonk CSS + postMessage | 09 §8 | UI Listmonk |
| 3.5 — `lib/mail/listmonk/client.ts` | 03 §7 | API client + tests MSW |
| 3.6 — Audiences sync cron + UI | 02 §2.4 + 04 §3.7 | cron service + page |
| 3.7 — Templates sync vers Listmonk | 07 §7 | upsert + UI studio |
| 3.8 — Suppression bidir sync | 11 §5 | cron service |
| 3.9 — Wizard scaffolding | 06 §2 | shell + progress + footer |
| 3.10 — Step 1 Type | 06 §3 | composant + tests |
| 3.11 — Step 2 Audience | 06 §4 | composant + tests |
| 3.12 — Step 3 Template | 06 §5 | composant + tests |
| 3.13 — Step 4 Compose | 06 §6 | composant + tests |
| 3.14 — Step 5 Schedule | 06 §7 | composant + tests |
| 3.15 — Step 6 Review | 06 §8 | composant + tests |
| 3.16 — useCampaignWizard hook | 06 §9 | reducer + persistence |
| 3.17 — Server actions wizard | 06 §10 | actions complètes |
| 3.18 — Webhook Listmonk → metrics | 03 §5 | parser + update DB |
| 3.19 — Dashboard `/admin/emails` | 04 §3.1 | RSC + matviews |
| 3.20 — Tests E2E wizard | 08 §6.3 | 11 scénarios Playwright |

**Acceptance phase 3** :
- [ ] Wizard happy path validé E2E (création → schedule → envoi mock)
- [ ] Wizard accessible (jest-axe + Playwright A11y) : 0 violation
- [ ] 11 scénarios E2E `wizard.spec.ts` pass
- [ ] Une opératrice non-tech crée une campagne en < 15 min sans aide (test utilisateur réel)
- [ ] Bridges Listmonk fonctionnent (lists/templates/subscribers synchrones à 5 min)

### Phase 4 — Automation (2 sprints)

**Objectif** : workflows déclenchés (abandon panier, post-achat J+7, anniversaire).

**Fichiers** :
- `02-data-model.md` §2.8, §2.9 (`email_automation`, `email_automation_run`)
- `03-backend-integration.md` (à étendre dans `lib/mail/automation/`)
- `04-frontend-admin.md` §3.6 (page automation)

| Étape | Référence |
|---|---|
| 4.1 — Schéma triggers (event/schedule/subscription/webhook) | 02 §2.8 |
| 4.2 — Runner cron + state machine | (cf. `lib/mail/automation/runner.ts`) |
| 4.3 — 3 triggers initiaux : cart-abandoned-1h, post-purchase-d7, birthday | (à scaffolder) |
| 4.4 — UI admin `/admin/emails/automation` | 04 §3.6 |
| 4.5 — Tests E2E + scénarios déclenchement | 08 §6 |

**Acceptance phase 4** :
- [ ] 3 automations actives, observées en prod
- [ ] Idempotence (un user abandonnant 2 fois en 1h reçoit 1 seul mail)
- [ ] Pause/reprise possible depuis UI

### Phase 5 — Analytics & RGPD (1 sprint)

**Objectif** : analytics complète + conformité RGPD.

**Fichiers** :
- `11-security-rgpd.md` (tout)
- `02-data-model.md` §5 (matviews)
- `10-observability-debugging.md` §6

| Étape | Référence |
|---|---|
| 5.1 — DSR endpoints (access/erase) | 11 §4 |
| 5.2 — Politique de confidentialité MAJ | 11 §2.3 |
| 5.3 — Pruning cron rétention | 11 §6 |
| 5.4 — Inscription Postmaster Tools | 10 §9 |
| 5.5 — Dashboard étendu (heatmap envois, perf templates) | 04 §3.1 |

**Acceptance phase 5** :
- [ ] CNDP : numéro déclaration affiché
- [ ] DSR access/erase : test E2E avec un compte fictif
- [ ] Postmaster Tools FemiGlow vérifié
- [ ] Rétention purge cron opérationnelle

### Phase 6 — Hardening prod (1 sprint)

**Objectif** : derniers garde-fous avant haut volume.

**Fichiers** :
- `09-infrastructure-setup.md` §13, §14, §15
- `10-observability-debugging.md` §10, §11

| Étape | Référence |
|---|---|
| 6.1 — Backups Listmonk validés (restore test) | 09 §13 |
| 6.2 — Rotation secrets calendar | 11 §7.3 |
| 6.3 — Smarthost relay prêt (plan B) | 10 §10 |
| 6.4 — Procédures incidents documentées + drilled | 10 §11 |
| 6.5 — Charge test : 10k envois en 30 min | E2E + monitoring |

**Acceptance phase 6** :
- [ ] Charge test 10k OK
- [ ] Restore Listmonk en < 30 min
- [ ] Smarthost relay bascule en < 10 min (drill réel)

## §4 — Procédures opérationnelles quotidiennes

### 4.1 — Check matinal (~10 min)

```bash
# 1. Health
curl -s -b "admin-session-cookie" https://admin.femiglow-maroc.com/api/admin/emails/health | jq

# 2. Bounces nuit
ssh femiglow "psql femiglow -c \"SELECT COUNT(*) FROM email_event WHERE type IN ('bounced_hard','bounced_soft') AND ts >= now() - interval '24 hours';\""

# 3. DLQ
ssh femiglow "psql femiglow -c \"SELECT COUNT(*) FROM email_outbox WHERE status='dlq' AND created_at >= now() - interval '24 hours';\""

# 4. Stalwart errors
ssh femiglow "grep -c 'queue.message-failed' /etc/stalwart-mail/logs/stalwart.$(date +%Y-%m-%d)"
```

Action si :
- DLQ > 10 → `10 §7.4` debug recipe webhook
- Bounces > 5 % → `10 §7.5` debug recipe bounces
- Stalwart errors > 100 → vérifier réputation IP

### 4.2 — Avant campagne broadcast (~5 min)

```
[ ] Audience cible : taille raisonnable (~plafond 20k)
[ ] Suppression list exclue : ✅ par défaut
[ ] Sujet < 78 char, ≤ 2 emojis
[ ] Test send réussi sur 2 boîtes (gmail + outlook)
[ ] Footer contient le lien désabonnement
[ ] Planification : créneau heure ouvrable
[ ] Capacité Stalwart : > 90 % free
```

### 4.3 — Après campagne (à T+24h, ~10 min)

```
[ ] Open rate raisonnable (> 20 %)
[ ] Click rate (> 2 %)
[ ] Hard bounce < 2 %
[ ] Soft bounce < 5 %
[ ] Complaints = 0
[ ] Pas de pic d'unsubscribes anormal
```

### 4.4 — Rotation secrets

Cf. `11 §7.3`. Tâche calendaire à mettre dans Linear/Notion :
- API token Listmonk : tous les 6 mois (juin & décembre)
- SMTP password noreply : tous les ans (anniversaire de l'install)
- Webhook secrets : tous les ans
- Cleanup `/tmp/stalwart-*.json` : check mensuel (laissés par bootstrap → fuites)

## §5 — Procédures d'incidents (P0/P1/P2)

Cf. `10-observability-debugging.md` §11. Résumé :

| Sévérité | Symptôme | First responder | Procédure |
|---|---|---|---|
| P0 | Tous les envois échouent | dev astreinte | 10 §11 P0 |
| P1 | Listmonk down | dev astreinte | 10 §11 P1 |
| P2 | Bounce > 10 % | data | 10 §11 P2 |
| P3 | UI iframe lent | dev | best-effort |

## §6 — Commandes utiles (cheat-sheet)

```bash
# Status services
systemctl status stalwart-mail listmonk femiglow

# Logs unifiés
journalctl -u femiglow -u listmonk -u stalwart-mail --since "1 hour ago" -f

# Force cron pickup outbox
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/email-outbox

# Refresh matview manuellement
psql femiglow -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_email_kpi_daily;"

# Test send sandbox
swaks --to me@example.com --from noreply@femiglow-maroc.com \
  --server 127.0.0.1:587 --auth-user noreply@femiglow-maroc.com --auth-password "$SMTP_PASSWORD" --tls

# Audit log tail
psql femiglow -c "SELECT ts, category, action, subject_id, meta FROM audit_log WHERE category LIKE 'mail.%' ORDER BY ts DESC LIMIT 20;"

# Stalwart queue
stalwart-cli query queue --limit 20

# Listmonk subscribers count
curl -u "$LISTMONK_API_USER:$LISTMONK_API_TOKEN" http://127.0.0.1:9000/api/lists | jq '.data.results[] | {name, subscriber_count}'
```

## §7 — Index des points de référence externe

| Sujet | URL |
|---|---|
| Listmonk docs | https://listmonk.app/docs/ |
| Stalwart docs | https://stalw.art/docs/ |
| react-email docs | https://react.email/docs/ |
| MSW docs | https://mswjs.io/docs/ |
| Playwright docs | https://playwright.dev/docs/ |
| RFC 8058 List-Unsubscribe | https://datatracker.ietf.org/doc/html/rfc8058 |
| Gmail Postmaster Tools | https://postmaster.google.com/ |
| Microsoft SNDS | https://sendersupport.olc.protection.outlook.com/snds/ |
| Mail-tester | https://www.mail-tester.com/ |
| CNDP | https://www.cndp.ma/ |

## §8 — Conventions de PR pour ce projet

| Préfixe | Quoi |
|---|---|
| `feat(emailing): …` | Nouvelle fonctionnalité (M1-M6) |
| `fix(emailing): …` | Bug fix |
| `chore(emailing): …` | Refacto, docs, deps |
| `test(emailing): …` | Tests added/improved |
| `docs(emailing): …` | Mise à jour `docs/emailing/` |

PR template doit inclure :
- Phase concernée (M0, M1, …)
- Fichiers `docs/emailing/` consultés
- Acceptance criteria atteint (référencer §3 du runbook)
- Screenshots si UI
- Liste des tests ajoutés

## §9 — Suivi de l'avancement

Tableau de bord léger (à maintenir manuellement ou via TodoWrite) :

```
Phase 0  ░░░░░░░░░░  0 %
Phase 1  ░░░░░░░░░░  0 %
Phase 2  ░░░░░░░░░░  0 %
Phase 3  ░░░░░░░░░░  0 %
Phase 4  ░░░░░░░░░░  0 %
Phase 5  ░░░░░░░░░░  0 %
Phase 6  ░░░░░░░░░░  0 %
```

Mettre à jour à chaque PR mergée. Phase suivante débloquée seulement quand tous les ✅ acceptance courants sont cochés.

## §10 — Quand mettre à jour ce runbook

- Après chaque acceptance phase : noter date + qui.
- Quand un fichier `docs/emailing/*` est modifié : vérifier que §2 est encore juste.
- Quand une procédure d'incident est exécutée : enrichir §5 ou `10-observability-debugging.md` §7.
- Quand une rotation secret est faite : noter dans calendar.

## §11 — Référence rapide : qui lit quoi ?

| Rôle | Fichiers principaux |
|---|---|
| **Décideur / PO** | `00`, `13` |
| **Architecte** | `01`, `02`, `03`, `04` |
| **Backend dev** | `03`, `02`, `07`, `09`, `10`, `08 §3-4` |
| **Frontend dev** | `04`, `05`, `06` ⭐, `08 §3-6` |
| **DevOps / Infra** | `09`, `10`, `11` |
| **QA** | `08`, `06`, `04`, `05` |
| **Legal / DPO** | `11` |
| **Support / Ops** | `10`, `12 §4-5` |

Ce runbook est le **point d'entrée**. Tous les autres documents sont indexés ici.
