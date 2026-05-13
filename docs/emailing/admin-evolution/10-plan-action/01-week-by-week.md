# Plan d'exécution semaine par semaine

> Découpage temporel suggestion sur 13 semaines (3 mois). Adaptable
> selon disponibilité.

## Hypothèses
- 1 développeur, 5j/semaine, jours productifs
- Buffer 20% pour imprévus

## Calendrier

### Semaine 1 — M5.1 — Inbox transactionnelle (1)
- M5.1.0 worktree setup + migration
- M5.1.1 filters parser
- M5.1.2 backend queries
- M5.1.3 API endpoints

### Semaine 2 — M5.1 — Inbox transactionnelle (2)
- M5.1.4 CommandPalette
- M5.1.5 KpiHeader
- M5.1.6 SavedViewsSidebar + FilteredTable + BulkActionsBar
- M5.1.7 Page refonte
- M5.1.8 Test ultime + merge

### Semaine 3 — M5.2 — Events unifiés (1)
- M5.2.0 migration
- M5.2.1 helper insertUserEvent
- M5.2.2 bridge web tracking
- M5.2.3 bridge email webhooks

### Semaine 4 — M5.2 — Events unifiés (2)
- M5.2.4 bridge server actions
- M5.2.5 bridge admin
- M5.2.6 backfill (optional)
- M5.2.7 dashboard debug
- M5.2.8 test ultime + merge

### Semaine 5 — M5.3 — Audiences (1)
- M5.3.0 migrations + types
- M5.3.1 rules compiler P1
- M5.3.2 rules compiler P2

### Semaine 6 — M5.3 — Audiences (2)
- M5.3.3 composition + exclusions
- M5.3.4 preview engine
- M5.3.5 snapshot engine

### Semaine 7 — M5.3 — Audiences (3)
- M5.3.6 audience CRUD API
- M5.3.7 AudienceRulesBuilder
- M5.3.8 AudiencePreview + AudienceWizard

### Semaine 8 — M5.3 — Audiences (4) + démarrage M5.4
- M5.3.9 pages audiences
- M5.3.10 cron purge
- M5.3.11 test ultime + merge
- M5.4.0 migration

### Semaine 9 — M5.4 — Campaigns (1)
- M5.4.1 Listmonk sync engine
- M5.4.2 finalizeCampaign V2
- M5.4.3 wizard step 2 refonte

### Semaine 10 — M5.4 — Campaigns (2) + démarrage M5.5
- M5.4.4 wizard step 6
- M5.4.5 detail page
- M5.4.6 cron cleanup
- M5.4.7 test ultime + merge
- M5.5.0 migration

### Semaine 11 — M5.5 — Automation (1)
- M5.5.1 types Zod
- M5.5.2 handlers wait+send refactor
- M5.5.3 handler branch + condition evaluator
- M5.5.4 handlers tag + update_lead

### Semaine 12 — M5.5 — Automation (2)
- M5.5.5 handler webhook
- M5.5.6 handler wait_for_event + resume
- M5.5.7 frequency
- M5.5.8 catalogue events
- M5.5.9 composants StepEditor + ConditionBuilder + FrequencySettings

### Semaine 13 — M5.5 — Automation (3) + M5.6 polish
- M5.5.10 AutomationWizard + StepList
- M5.5.11 pages automation
- M5.5.12 test ultime + merge
- M5.6.1 Cmd-K universel
- M5.6.2-7 polish (empty states, a11y, raccourcis, motion, micro-copy)
- M5.6.8 test ultime final + merge

## Checkpoints

- **Fin semaine 2** : M5.1 en prod, admin peut chercher emails fluide
- **Fin semaine 4** : M5.2 en prod, dashboard events visible
- **Fin semaine 8** : M5.3 en prod, audiences créables
- **Fin semaine 10** : M5.4 en prod, campagnes ciblées
- **Fin semaine 13** : M5.5 + M5.6 en prod, MVP complet

## Risques timing

| Risque | Mitigation |
|---|---|
| Rules compiler plus long que prévu | Buffer 1 jour sur semaine 6 |
| Listmonk sync edge cases | Tests MSW dès semaine 9 |
| Automation runner V2 complexity | Faire branch + wait_for_event en premier (les plus complexes) |
| A11y violations en M5.6 | Audit a11y dès chaque phase, pas en M5.6 only |

## Communication

- Standup quotidien (5 min) : "fait hier / aujourd'hui / blocage"
- Démo en fin de phase : 30 min, le test ultime joué live
- Retro toutes les 2 semaines : ajuster plan
