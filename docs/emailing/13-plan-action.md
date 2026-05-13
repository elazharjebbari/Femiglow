# 13 — Plan d'action — M0 à M6

> Roadmap d'exécution en 7 phases avec deliverables, acceptance criteria, dépendances. Estimations en sprints (1 sprint = 1 semaine 1 dev plein temps). Cf. `12-runbook.md` pour le pilotage et les fichiers de référence par phase.

## §1 — Vue d'ensemble

```
M0  Préparation         1 sprint   ░░░ critique : bloque tout
M1  Transactional core  2 sprints  ░░░░░░ valeur immédiate
M2  Audit & robustness  1 sprint   ░░░ stabilise M1
M3  Broadcast & wizard  3 sprints  ░░░░░░░░░ gros lot
M4  Automation          2 sprints  ░░░░░░ valeur récurrente
M5  Analytics & RGPD    1 sprint   ░░░ conformité
M6  Hardening prod      1 sprint   ░░░ scale-readiness
                       ──────
            Total :   11 sprints (~3 mois)
```

Hors imprévus, charge effective ~7-8 semaines pour un dev expérimenté plein-temps. Le rallongement vient du test E2E + reviews + go-live encadré.

## §2 — Découpage par PR

> Chaque phase = 3-5 PR. Aucune PR > 800 lignes. Critique : chaque PR est autonomement mergeable et déployable (pas de feature flag complexe).

### M0 — Préparation

| PR | Périmètre | Fichiers |
|---|---|---|
| `chore(emailing): repair femiglow-cron-*` | Diagnostic + fix unit files | `/etc/systemd/system/femiglow-cron-*.service` |
| `chore(emailing): install Listmonk infra` | systemd + Postgres + config | `/etc/listmonk/*`, `/etc/systemd/system/listmonk.service` |
| `feat(emailing): drizzle schema email_*` | Tables + matviews + index | `apps/web/src/db/schema/emails.ts`, migrations |
| `feat(emailing): env vars + zod` | Validation env + bootstrap | `apps/web/src/lib/env.ts` |
| `chore(emailing): cron services` | 6 nouveaux timers | `/etc/systemd/system/femiglow-cron-email-*.{service,timer}` |

**Acceptance M0** :
- [ ] `systemctl list-units --failed` : aucun cron FemiGlow failed
- [ ] `listmonk.service` active
- [ ] DB `listmonk` créée + schema migré
- [ ] 10 tables `email_*` présentes côté DB FemiGlow
- [ ] 6 timers `femiglow-cron-email-*` actifs
- [ ] `pnpm typecheck && pnpm test:unit` pass
- [ ] Test bout-en-bout `09 §12` : 5 checks ✅

**Risques M0** :
- Crons failed → root cause inconnue avant diagnostic. **Réserver 2 jours**.
- Conflits de ports / DB existante → maîtrisable.

### M1 — Transactional core

| PR | Périmètre |
|---|---|
| `feat(emailing): nodemailer client + verifySmtp` | `lib/mail/client.ts` + tests |
| `feat(emailing): catalog + render pipeline` | `lib/mail/catalog.ts`, `render.ts`, `_shared/`, 5 templates |
| `feat(emailing): sendTransactional + outbox` | `lib/mail/send.ts`, `outbox.ts`, `backoff.ts`, cron route |
| `feat(emailing): stalwart webhook receiver` | `app/api/mail/webhook/stalwart` + Zod + tests |
| `feat(emailing): wire 5 endpoints to mailer` | Modifier `api/contact`, `api/newsletter`, etc. |
| `feat(emailing): unsubscribe + suppression check` | `api/mail/unsubscribe`, `lib/mail/suppression.ts` |
| `feat(emailing): admin transactional list + detail` | `app/(admin)/admin/emails/transactional/*` |

**Acceptance M1** :
- [ ] 5 endpoints applicatifs envoient un mail réel (vérifié dans boîte gmail/outlook)
- [ ] List-Unsubscribe one-click fonctionnel (test gmail/outlook)
- [ ] Suppression list bloque le re-envoi (test E2E)
- [ ] Coverage `lib/mail/` ≥ 90 %
- [ ] E2E Playwright `transactional.spec.ts` : 4 tests pass
- [ ] 100 envois consécutifs : 0 perte, p95 < 5 s

**Risques M1** :
- Réputation initiale (sandbox réseau Hostinger, IP non warmed) → premiers envois en CC à mail-tester pour score.

### M2 — Audit & robustness

| PR | Périmètre |
|---|---|
| `feat(emailing): structured logging + Sentry tags` | logger calls partout |
| `feat(emailing): /api/admin/emails/health + UI badge` | endpoint + composant |
| `feat(emailing): audit log mail.*` | calls `logAuditEvent` |
| `feat(emailing): rate-limit endpoints` | middleware + Redis namespace |
| `chore(emailing): contract fixtures Stalwart/Listmonk` | fixtures réelles + tests |

**Acceptance M2** :
- [ ] Health badge montre 3 états (couper Stalwart → rouge en < 60s)
- [ ] Audit log : 100 % des actions admin mail capturées
- [ ] Sentry alertes opérationnelles (test : trigger DLQ → alerte Slack)
- [ ] Rate limit : test charge déclenche 429 attendu

### M3 — Broadcast & wizard

> **Phase la plus longue.** Cf. `06-wizard-specification.md` pour le détail.

| PR | Périmètre |
|---|---|
| `feat(emailing): listmonk proxy + SSO middleware` | `api/listmonk/[...path]`, middleware |
| `feat(emailing): ListmonkFrame + iframe page` | composant + page + theming CSS |
| `feat(emailing): listmonk typed client + bridge syncs` | `lib/mail/listmonk/*`, crons sync |
| `feat(emailing): wizard shell + step Type` | navigation, persistence, step 1 |
| `feat(emailing): wizard step Audience` | step 2 + estimate |
| `feat(emailing): wizard step Template` | step 3 + preview |
| `feat(emailing): wizard step Compose` | step 4 + variables + test-send |
| `feat(emailing): wizard step Schedule` | step 5 |
| `feat(emailing): wizard step Review + finalize` | step 6 + sync Listmonk |
| `feat(emailing): admin dashboard + campaigns list` | `/admin/emails` + `/admin/emails/campaigns` |
| `feat(emailing): listmonk webhook + metrics mirror` | `api/mail/webhook/listmonk` |

**Acceptance M3** :
- [ ] Wizard E2E happy path : 11 scénarios pass
- [ ] A11y 0 violation sur 6 pages clés (jest-axe + AxeBuilder)
- [ ] Test utilisateur : opératrice non-tech crée campagne en < 15 min seul
- [ ] Iframe Listmonk loads < 1 s
- [ ] Webhook Listmonk met à jour metrics campagne en < 30 s
- [ ] Visual regression : 5 snapshots stables

**Risques M3** :
- iframe theming "fait main" → écart visuel mal toléré. **Plan B** : Niveau 1 (UI custom complète) si rejet UX.
- Wizard complexity : sous-estimation possible. **Découpage strict en sub-PR** par step + revue à chaque sub-PR.

### M4 — Automation

| PR | Périmètre |
|---|---|
| `feat(emailing): automation schema + runner` | `email_automation`, `email_automation_run`, cron runner |
| `feat(emailing): triggers cart-abandoned` | trigger event + template + tests |
| `feat(emailing): triggers post-purchase-d7 + birthday` | 2 autres triggers |
| `feat(emailing): admin /automation UI` | liste + détail + activation/pause |

**Acceptance M4** :
- [ ] 3 automations actives en prod
- [ ] Idempotence vérifiée (E2E : double trigger → 1 mail)
- [ ] Pause/reprise fonctionne (E2E)

### M5 — Analytics & RGPD

| PR | Périmètre |
|---|---|
| `feat(emailing): DSR endpoints access/erase` | RGPD requests |
| `chore(emailing): update privacy policy` | docs/legal |
| `feat(emailing): pruning retention cron` | cron + tests |
| `feat(emailing): dashboard heatmap + perf templates` | UI dashboard étendu |
| `chore(emailing): postmaster tools setup` | DNS + verif |

**Acceptance M5** :
- [ ] CNDP numéro déclaration affiché
- [ ] DSR : test E2E (export + erase) sur compte fictif
- [ ] Pruning cron : sur DB de staging, ancien data effectivement purgée
- [ ] Postmaster Tools : domain verified

### M6 — Hardening prod

| PR | Périmètre |
|---|---|
| `chore(emailing): backups validation + restore drill` | scripts + runbook |
| `feat(emailing): smarthost relay readiness` | docs + config tested in staging |
| `chore(emailing): rotation secrets calendar` | doc + scripts |
| `chore(emailing): load test 10k envois` | scripts + monitoring |

**Acceptance M6** :
- [ ] Backup Listmonk restoré en staging en < 30 min
- [ ] Smarthost relay drill réussi (5 min de bascule, retour OK)
- [ ] Load test 10k mails en 30 min : 0 perte, p95 < 30 s
- [ ] Rotation secrets calendar dans tooling team
- [ ] Documentation runbook complète et auditée par un tiers

## §3 — Estimations détaillées

| Phase | Effort dev | Effort QA | Effort review | Total |
|---|---|---|---|---|
| M0 | 4 j | 0.5 j | 0.5 j | **5 j** |
| M1 | 8 j | 1.5 j | 1 j | **10.5 j** |
| M2 | 4 j | 0.5 j | 0.5 j | **5 j** |
| M3 | 13 j | 2 j | 1.5 j | **16.5 j** |
| M4 | 8 j | 1 j | 1 j | **10 j** |
| M5 | 4 j | 0.5 j | 0.5 j | **5 j** |
| M6 | 4 j | 1 j | 1 j | **6 j** |
| **Total** | **45 j** | **7 j** | **5.5 j** | **~58 j (12 sem)** |

## §4 — Dépendances entre phases

```
M0 (préparation)
 └── M1 (transactional)
      ├── M2 (audit / robustness)
      └── M3 (broadcast / wizard)
           ├── M4 (automation)
           └── M5 (analytics / RGPD)
                └── M6 (hardening)
```

- M1 et M3 partagent **certaines couches** mais sont décollables grâce au pattern "transactional via nodemailer direct, broadcast via Listmonk". M1 peut shipper sans Listmonk fonctionnel.
- M2 améliore M1 sans le bloquer ; peut se faire en parallèle de M3 (un dev sur chaque).
- M4 a besoin de M1 (sendTransactional) ET partiellement de M3 (compose templates broadcast pour les workflows).

## §5 — Plan de mise en prod par phase

| Phase | Strategy |
|---|---|
| M0 | Big bang weekend (infra). Pas d'impact utilisateur. |
| M1 | Progressive : 1 endpoint à la fois (`/api/contact` d'abord). Monitor 48h avant le suivant. |
| M2 | Progressive : un toggle pour activer logger.info verbosity, default OFF en prod. |
| M3 | Big bang weekend pour le wizard, mais accessible derrière feature flag `EMAILS_WIZARD_BETA` pendant 1 sprint. |
| M4 | Progressive : 1 automation à la fois, sample 10 % users d'abord. |
| M5 | Big bang ; RGPD est non-toggleable. |
| M6 | Big bang. |

## §6 — Risques & atténuations

| Risque | Probabilité | Impact | Atténuation |
|---|---|---|---|
| Réparation crons FemiGlow plus longue que prévu | moyenne | M0 décalé | 2 j réserve dans M0 + escalation senior |
| Réputation IP fragile en début | moyenne | M1 spam folder | Test mail-tester en M1, plan B smarthost relay |
| Wizard complexity sous-estimée | élevée | M3 décalé | Sub-PR par step, demo hebdo |
| Iframe Listmonk theming mal accepté | moyenne | M3 refonte UI | Plan B Niveau 1 (UI custom) documenté en réserve |
| Listmonk version evolution casse contract | basse | M3-M6 | Pinned version + contract tests + rebuild fixtures |
| CNDP rejette les processus | basse | M5 retravail | Engager juriste CNDP en M0 (audit préliminaire) |
| Charge prod réelle dépasse capacité Stalwart | basse-moyenne | M6 saturation | Smarthost relay plan B + monitoring queue |

## §7 — Définition de "Done"

Une phase est `done` quand :
1. Toutes les acceptance criteria de §3 du runbook (`12-runbook.md`) sont cochées.
2. Tests CI verts (unit + integration + E2E).
3. Coverage ≥ 80 % global, ≥ 90 % `lib/mail/`.
4. Visual regression : 0 diff non review-é.
5. PR review : 1 approver minimum sur chaque PR.
6. Déployée en prod **sans rollback** pendant 48h.
7. Section `Statut` du `12-runbook.md` §9 mise à jour.

## §8 — Suivi de la roadmap

À chaque démarrage de phase, créer un Linear/Notion epic "Emailing — Mx". Sub-tasks = PRs listées en §2. Statut visible dans le dashboard PO.

À chaque fin de phase :
- Demo 30 min (équipe + Souheila).
- Retrospective 30 min (qu'est-ce qui a bien marché, ce qui aurait pu être mieux).
- Tag git `emailing-mx-shipped` sur le commit prod.

## §9 — Quand renégocier

Re-scope si :
- M0 dépasse 7 j → escalation pour aide infra.
- M3 dépasse 4 sprints → couper wizard step 4.5 A/B (V2) et step automation conditional (V2).
- Réputation IP < 70/100 sur Postmaster après M1 → activer smarthost relay sans attendre M6.

## §10 — Références

- `12-runbook.md` : pilotage détaillé phase par phase, procédures
- `06-wizard-specification.md` : détail wizard (phase M3 critique)
- `08-tests-strategy.md` : critère de tests à chaque PR
- `09-infrastructure-setup.md` : préreq infra (M0)
- `11-security-rgpd.md` : checklist RGPD (M5)
