# Journal de campagne — QA emailing

## Session 2026-06-04 (phases 0 + 1)

**Environnement posé (pré-session, orchestrateur)** : worktree rebasé sur
origin/master ; `.env` dédié (port 8013, secrets régénérés, SMTP→Mailpit,
Listmonk neutralisé) ; DB dev `femiglow_emailqa` (clone prod, baseline
`/root/femiglow-emailqa-baseline-20260604.dump`) ; DB harnais `femiglow_test`
construite par `scripts/_migrate-safe.mjs` (83 migrations — `drizzle-kit
migrate` échoue, exit 1 silencieux) + 5 clones par chantier.

**Découverte structurante** : la prod ET les migrations donnent
`lead_tag.id uuid DEFAULT gen_random_uuid()` — le drift de l'audit est dans
`schema.ts` (text + `createId('tag')`), PAS dans la DB. Fix 1.1 inversé en
conséquence : aligner Drizzle/code sur uuid, aucune migration.

### Étapes complétées
- **Phase 0 entière** (5 agents) : `emails.factory.ts` (13 factories
  `satisfies $inferInsert` = oracle anti-drift, smoke 26),
  `emails-handlers.ts` (23 routes couvertes + grille `emailsFailWith`,
  smoke 27), `src/test/db/emails-db.ts` (garde-fou femiglow_test, truncate 17
  tables, canari 3), 20 fixtures webhook (12 Stalwart + 8 Listmonk, provenance
  documentée, conformité parsers vérifiée), Mailpit docker + helper Playwright
  + scripts npm `test:emails:*`.
- **Phase 1 entière** (6 chantiers, rouge→fix→vert constaté à chaque fois) :
  - 1.1 lead_tag : ROUGE 3 failed/4 (500 uuid) → schema.ts uuid + route
    checkout → VERT 4/4. PCL-INT-001..004.
  - 1.3+1.6 outbox : reaper `reapStuckSending` (10 min, UPDATE atomique,
    cast ::email_outbox_status requis) + INSERT-avant-render (placeholder
    subject, échec render → failed+lastError). 9 tests.
  - 1.4+1.7 automations : `event-dispatcher.ts` (lit triggerType/triggerConfig,
    idempotence dedupeKey `event:<id>`, lookback 1h) + `orphan-sweep.ts`.
    ROUGE 7/11 (aucun run créé) → VERT 81/81 sur src/lib/mail/automation.
  - 1.8 frequency : câblé branche send (cap→cooldown→quiet hours), différé
    idempotent via nextActionAt, minuit tz Africa/Casablanca corrigé. 38+7.
  - 1.5 cockpit : ROUGE 14/18 (faux succès bulk) → res.ok systématique,
    sélection conservée, anti double-clic → VERT 18/18 (109 sur le dossier).
  - 1.2 health : checks webhookSilent / cronOutboxLate / sendingStuck
    (HLT-INT 15) — le badge ne peut plus mentir.
- **Intégration croisée (orchestrateur)** : régression latente
  `step-handlers/tag.ts` (createId dans colonne uuid) — ROUGE 3/3 constaté →
  fix (id généré DB) → VERT 3/3 (AUT-INT-030..032). Skip honnête des suites
  vraie-DB sans env (`describeEmailsDb`) — `pnpm test` global ne casse plus.

### Bugs code découverts par les tests (au-delà des 8 visés)
- R-021 (CRITIQUE, ouvert) : stalwart-parser attend une enveloppe PLATE
  `{event,...}` mais Stalwart v0.16 natif envoie un BATCH
  `{events:[{type,data,...}]}` → même après reconfig infra, rien ne parserait.
  Prouvé par fixture 008 (rejetée par le schéma). À traiter en phase 5.
- R-022 (corrigé) : tag.ts × fix uuid (ci-dessus).
- R-023 (mitigé) : suites vraie-DB parallèles sur la même base → deadlocks
  40P01 ; script intégration sérialisé (`--no-file-parallelism`).
- Cast enum Postgres dans UPDATE CASE (text→email_outbox_status) ; Date JS
  interpolée crue dans template `sql` postgres-js (ERR_INVALID_ARG_TYPE).

### Tests
- Ajoutés : ~140 nouveaux (26+27+3 fondations, 4+9+16+22+18+15 chantiers,
  +3 orchestrateur). 0 quarantainé.
- Gates : tsc 0 erreur ; `test:emails:unit` 420 verts (35 skips légitimes) ;
  `test:emails:component` 136 verts ; `test:emails:integration` 57 verts.

### À remonter à l'humain (infra prod, hors worktree)
1. Reconfig webhook Stalwart : URL actuelle `https://admin.femiglow-maroc.com/...`
   (host inexistant, ~64k err/jour) → `https://femiglow-maroc.com/api/mail/webhook/stalwart`
   — ET d'abord régler R-021 côté code, sinon le webhook livrera des payloads imparsables.
2. Timers systemd manquants : 8 routes cron emailing en code, seul
   femiglow-cron-email-outbox.timer existe.

### Prochaine étape
Phases 2 (unit dense) + 3 (composant+MSW masse) module par module, + R-021
(contrat Stalwart natif) en chantier prioritaire.
