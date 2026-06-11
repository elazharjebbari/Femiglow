# Campagne QA Emailing — Dossier intégral (juin 2026)

> **Mission** : mettre en place une batterie de tests ultra-dense, orientée UI/opérateur,
> garantissant une qualité minimale très supérieure sur **tout** le système emailing
> (admin + parcours client + pipeline + intégrations Listmonk/Stalwart).
>
> **Méthode** : approche « grande agence » (Sogeti/TMap, Capgemini, TCS) —
> inventaire exhaustif → matrices de couverture → scénarios métier bout-en-bout →
> exécution pilotée par runbook avec boucle corrections/vérifications.

## Pourquoi ce dossier existe

L'audit du 2026-06-03 (cf. mémoire projet + rapport de session) a révélé que le système
emailing souffre de défauts **que les tests actuels ne détectent pas** :

| Constat prod | Ce que la batterie doit garantir |
|---|---|
| Opt-in post-achat en 500 (drift schéma `lead_tag` uuid/text) | tests d'intégration DB **contre le vrai schéma** (pas seulement des mocks) |
| Webhook Stalwart vers un domaine inexistant → 0 `delivered` jamais enregistré | tests E2E de la chaîne événement → KPI UI, contract-tests des webhooks |
| 5 crons email sur 6 sans timer systemd | tests de runbook/infra + healthcheck qui détecte un cron mort |
| Moteur de triggers d'automation jamais câblé (UI promet, runtime ignore) | tests « promesse UI = comportement backend » pour CHAQUE réglage exposé |
| Bulk actions UI avalent les erreurs HTTP (faux succès) | tests MSW d'échec systématiques sur chaque action opérateur |
| Quiet hours / cooldown / daily cap = code mort | tests de câblage (le réglage produit un effet observable) |

**Principe directeur n°1** : tout test reproduit le point de vue de l'**opérateur**
(admin) ou du **client**. On teste ce que l'humain voit et fait, puis on vérifie
l'état serveur résultant.

**Principe directeur n°2** : chaque réglage visible dans l'UI doit avoir un test
qui prouve qu'il a un **effet réel**. Un réglage sans effet = bug de classe
« promesse non tenue » (la plus corrosive pour la confiance opérateur).

## Structure du dossier

```
qa-campaign-2026-06/
├── 00-README.md                        ← ce fichier (index + méthode)
├── 01-inventaire-fonctionnalites.csv   ← inventaire EXHAUSTIF (aucune exception)
├── 02-architecture-tests.md            ← pyramide, couches, outillage
├── 02-architecture-tests.puml          ← diagramme des couches de test
├── 03-plan-action-global.md            ← plan d'action phasé + boucle corrections
├── 04-runbook.md                       ← runbook d'exécution pilotable (humain ou agent)
├── 05-conventions-harnais.md           ← conventions code, factories, MSW, fixtures
├── 06-matrice-risques.csv              ← risques × modules × priorités
└── modules/
    ├── 01-dashboard-sante/             ← /admin/emails (KPIs, badge santé)
    ├── 02-cockpit-transactionnel/      ← /admin/emails/transactional (+ détail)
    ├── 03-campagnes/                   ← /admin/emails/campaigns (wizard, sync)
    ├── 04-audiences/                   ← /admin/emails/audiences (builder, snapshots)
    ├── 05-automations/                 ← /admin/emails/automation (wizard, runner, runs)
    ├── 06-templates/                   ← /admin/emails/templates (éditeur, versions)
    ├── 07-webhooks-entrants-evenements/← webhooks Stalwart/Listmonk + /admin/emails/events
    ├── 08-pipeline-outbox-crons/       ← send/outbox/retry/DLQ/suppression + crons
    ├── 09-parcours-client/             ← opt-in post-achat, newsletter, contact, unsubscribe
    ├── 10-integration-listmonk/        ← client API, sync, snapshots→listes, iframe
    └── 11-infra-monitoring/            ← timers systemd, healthcheck, observabilité
```

### Contenu de CHAQUE sous-dossier module

| Fichier | Rôle |
|---|---|
| `README.md` | Description très détaillée du **fonctionnement optimal** (état cible), périmètre, fichiers sources concernés |
| `test-matrix.csv` | Matrice dense : ID, fonctionnalité, scénario, type (unit/integration/e2e), couche (vitest/MSW/playwright), priorité, oracle |
| `scenarios-metier.md` | Scénarios métier complexes bout-en-bout (personas, journées types d'opérateur) |
| `test-plan.yaml` | Plan machine-lisible : suites, fichiers cibles, prérequis, ordre d'exécution |
| `*.puml` | Diagrammes (séquence, états) des flux à tester |
| `specs/` | Code de tests **fonctionnel** : exemples vitest+MSW et Playwright prêts à adapter |

## Couches de test (résumé — détail dans 02-architecture-tests.md)

1. **Unit (Vitest)** — logique pure : parsers, backoff, compilateur de règles, schémas Zod.
2. **Composant (Vitest + Testing Library + MSW)** — chaque composant admin rendu
   réellement, interactions `user-event`, réseau intercepté par MSW (succès **et**
   tous les échecs : 401/422/500/timeout/payload vide).
3. **Intégration API (Vitest + DB de test)** — routes API contre une vraie Postgres
   éphémère : c'est la couche qui aurait attrapé le drift `lead_tag`.
4. **E2E opérateur (Playwright)** — parcours complets dans le vrai navigateur sur
   build local, conventions `e2e/_helpers` existantes.
5. **Contract tests** — payloads Stalwart/Listmonk réels (fixtures capturées en prod)
   rejoués contre les parsers et les routes webhook.

## Comment exécuter

➡️ Suivre **`04-runbook.md`** qui pilote **`03-plan-action-global.md`** phase par
phase, avec critères d'entrée/sortie et boucle de correction à chaque étape.

## Conventions de nommage des tests

- IDs de la matrice : `<MODULE>-<TYPE>-<NNN>` — ex. `CKP-MSW-014` (cockpit, test MSW n°14).
- Chaque test code référence son ID en commentaire : traçabilité matrice ↔ code.
- Un test = un oracle explicite (jamais « ne crashe pas » seul).
