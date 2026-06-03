# Architecture de la batterie de tests

## 1. Pyramide adaptée au contexte

Le ressenti « pas fiable » vient de l'**UI opérateur** et de **promesses UI non tenues
par le backend**. La pyramide classique (beaucoup d'unit, peu d'E2E) est donc
**rééquilibrée vers le milieu** : la couche composant+MSW est la couche reine,
car c'est elle qui modélise le point de vue opérateur à coût d'exécution faible.

```
        ▲  E2E Playwright (parcours opérateur complets, ~15%)
       ▲▲  Intégration API + vraie DB (routes, schéma, transactions, ~20%)
     ▲▲▲▲  Composant + MSW (chaque écran admin, chaque action, chaque échec, ~45%)
   ▲▲▲▲▲▲  Unit Vitest (parsers, compilateurs, backoff, Zod, ~20%)
```

## 2. Les cinq couches

### Couche 1 — Unit (Vitest pur)
- **Cible** : logique pure sans I/O — `backoff.ts`, `filters-parser.ts`,
  `rules-compiler.ts` (génération SQL inspectée), `stalwart-parser.ts`,
  `listmonk-parser.ts`, `unsub-token.ts`, `frequency.ts`, `step-path.ts`,
  schémas Zod de `catalog.ts` et `schemas.ts`.
- **Style** : table-driven (`it.each`), cas limites systématiques (vide, null,
  unicode, très grand, négatif, timezone, passage minuit, DST).
- **Localisation** : à côté du source (`*.test.ts`), convention repo existante.

### Couche 2 — Composant + MSW (la couche reine)
- **Cible** : chaque composant de `src/components/admin/emails/**` et chaque page
  client de `src/app/admin/emails/**`.
- **Outillage** : Testing Library + `user-event` + **MSW 2.x** (`msw/node`,
  `setupServer`) — JAMAIS de `vi.mock(fetch)` : MSW intercepte au niveau réseau,
  donc on teste aussi la construction des requêtes (URL, body, headers).
- **Règle d'or — la grille d'échecs** : pour CHAQUE action réseau d'un composant,
  5 tests minimum :
  | # | Réponse MSW | Oracle UI |
  |---|---|---|
  | 1 | 200 nominal | état mis à jour + feedback succès |
  | 2 | 401 | message session expirée, PAS de faux succès, sélection conservée |
  | 3 | 422 (Zod) | erreur de validation affichée, champ en cause identifiable |
  | 4 | 500 | message d'erreur générique + état antérieur conservé + bouton retry |
  | 5 | délai/timeout (`delay('infinite')` + abort) | état chargement visible, pas de double-soumission |
- C'est exactement la grille qui aurait détecté le bug « bulk actions avalent
  les erreurs » (audit C1 cockpit).

### Couche 3 — Intégration API + vraie DB
- **Cible** : les route handlers (`api/admin/emails/**`, `api/mail/**`,
  `api/cron/email-*`, `api/checkout/order/[orderId]/email`) appelés comme des
  fonctions, contre une **Postgres de test migrée avec les vraies migrations
  drizzle** (pas de mock DB).
- **Pourquoi** : c'est la SEULE couche qui attrape les drifts de schéma
  (cas `lead_tag` uuid/text) et les problèmes transactionnels (crash mid-flow).
- **Harnais** : base `femiglow_test` dédiée, `drizzle-kit migrate` en setup global,
  troncature des tables email entre tests, helpers de seed factorisés.
- **Interdiction** : ne jamais pointer ces tests vers la DB prod
  (cf. mémoire projet : pas d'isolation DB en prod).

### Couche 4 — E2E Playwright (point de vue opérateur)
- **Cible** : parcours complets multi-écrans dans un vrai navigateur, contre un
  build local + DB de test (jamais la prod).
- **Conventions** : réutiliser `e2e/_helpers` (login admin), specs dans
  `e2e/emails-*.spec.ts`, sélecteurs par rôle/label (resilience), `data-testid`
  seulement en dernier recours.
- **Spécificité emailing** : un faux SMTP (Mailpit ou stub) + déclenchement manuel
  des routes cron via `request.post('/api/cron/...')` pour simuler le temps.

### Couche 5 — Contract tests (frontières externes)
- **Cible** : les payloads RÉELS de Stalwart v0.16 et Listmonk (capturés en prod,
  anonymisés, versionnés dans `fixtures/`) rejoués contre les routes webhook.
- **Garantie** : si Stalwart/Listmonk change de format après upgrade, les contract
  tests cassent AVANT la prod. Inclut : DSN bounce multiples variantes, complaint,
  delivered, message-id absent, payload tronqué, signature invalide, rejeu.

## 3. Doctrine « promesse UI = comportement réel »

Pour chaque réglage exposé dans l'admin, un test de **câblage bout-en-bout** :

| Réglage UI | Test de câblage exigé |
|---|---|
| Automation `active` toggle | un user_event déclenche un run quand actif, aucun quand inactif |
| `triggerType: event` + nom d'event | l'event nommé crée un run; un autre event n'en crée pas |
| Quiet hours 22h-08h | un send à 23h Casablanca est différé à 08h00 |
| `dailyCap: N` | le (N+1)-ième envoi du jour est bloqué |
| `cooldownSeconds` | deux triggers rapprochés → un seul run |
| Exclusion `hard_bounce` d'une audience | un email suppressé n'apparaît pas dans le snapshot |
| Bouton « Marquer en suppression » | la cible ne reçoit plus NI transactionnel NI campagne |
| Statut campagne « sent » | les compteurs affichés == état Listmonk réel |

Tout réglage sans test de câblage est réputé **non câblé** (leçon de l'audit :
frequency.ts, triggerConfig — 100 % code mort présenté comme fonctionnel).

## 4. Données de test

- **Factories** (cf. 05-conventions-harnais.md) : `makeOutboxRow()`, `makeAutomation()`,
  `makeAudience()`, `makeCampaignLink()`, `makeStalwartWebhook()`, `makeListmonkWebhook()`
  — valeurs réalistes marocaines (téléphones +212, ar/fr, fuseaux Africa/Casablanca).
- **Fixtures de contract tests** : `fixtures/stalwart/*.json`, `fixtures/listmonk/*.json`
  — capturées du réel, anonymisées (emails → exemple.test).
- **Volumes** : jeux « petit » (5 lignes), « page » (50), « gros » (5 000 via seed SQL)
  pour les tests de pagination/perf du cockpit.

## 5. Anti-régression et non-flakiness

1. Aucun `sleep` arbitraire : `findBy*`/`waitFor` (composant), `expect.poll`
   (intégration), auto-waiting Playwright.
2. Horloge contrôlée : `vi.useFakeTimers()` pour backoff/quiet-hours/cooldown;
   les routes acceptent une injection `now` quand c'est possible.
3. Tests d'intégration DB sérialisés par fichier (pas de partage d'état).
4. Chaque bug d'audit corrigé reçoit un test de non-régression nommé
   `regression: <ref audit>` avant le fix (red → green).
5. Budget flakiness : un test qui flake 2 fois est quarantainé (`describe.todo`)
   et tracké, jamais re-run silencieusement.

## 6. Diagramme

Voir `02-architecture-tests.puml` (rendu : `plantuml 02-architecture-tests.puml`).
