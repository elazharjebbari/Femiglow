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

### Addendum gate global (session 2026-06-04)
`pnpm test` complet : **9249 verts / 1 échec / 76 skips (928 fichiers)**.
L'unique échec — `src/lib/tracking/__tests__/event-catalog.checkout.test.ts`
(« lead_capture par défaut sur google_ga4 + meta + google_ads ») — est
**préexistant sur master** (reproduit à l'identique dans /var/www/femiglow) :
séquelle de la session GTM/google_ads, HORS périmètre emailing. À arbitrer
côté tracking (oracle obsolète vs câblage manquant). Zéro régression emails.

## Session 2026-06-04 (vague 2 — phases 2+3+4+5)

**Orchestration** : workflow 9 chantiers parallèles (DB dédiée par chantier,
fichiers gelés par vague). Run interrompu à 7/9 (compaction de session) puis
**repris via resumeFromRunId** — les 7 terminés sont revenus du cache, seuls
m08/m09 ont rejoué. Total ~1.8M tokens, ~96 min.

### Bugs corrigés (rouge→fix→vert constaté pour chacun)
- **R-021** (07) : parser Stalwart accepte le batch natif `{events:[…]}` +
  rétro-compat plate ; route N événements/requête, isolation par-événement.
  64 tests (37 unit + 27 contract vraie-DB rejouant les 20 fixtures).
- **R-011 + R-025/A-AUD-2 + annexe** (04) : règle `country` (compilait TRUE),
  **engagement corrélé au lead** (EXISTS global = tout-ou-rien ; corrélation
  outbox.to_email OU subscriber_link ; templateSlug/urlPattern appliqués),
  Date JS crue dans templates sql. R-012 : reapStuckSnapshots + idempotence
  anti-zombie. 165 tests audiences.
- **R-010** (03) : finalizeCampaign atomique/idempotent (réservation
  draft→sending, anti campagne-fantôme/double envoi) ; A-CMP-5 garde de
  transition de statut ; double-soumission wizard (pending React 18). 78 tests.
- **R-015 + 5 défauts** (02) : pagination réelle, saved views appliquées,
  create-view réel, export CSV RFC 4180, couleur tendance higherIsBad,
  sparkline queued retirée. 130 tests cockpit.
- **R-017** (06) : 3 vecteurs XSS réels bouchés (CSS expression/url(js)
  inline+<style>, USE_PROFILES form/svg/details, data:text/html) + garde-fou
  suppression de template câblé + data.version TemplateEditor. 87 tests.
- **R-014 + 3** (10) : timeout/retry/429 client Listmonk, listAll anti-cap-50,
  reprise push partiel (marqueur listmonkPushedAt), anti-fuite de listes à la
  purge. 80 tests.
- **R-009** (08, déjà en code) vérifié + batterie machine d'états/concurrence/
  crash-recovery (194 tests scope module).
- **F-001** (01) : carte Livrés alerte quand sent>0 et delivered=0. 60 tests.
- **R-024** (09, fix orchestrateur) : en-tête List-Unsubscribe one-click
  émettait `?email=` (adresse en clair) mais la route ne lit que `?t=` → le
  bouton natif Gmail/Apple Mail ne désinscrivait PAS (400). Fix : token signé
  dans l'en-tête (CLI-INT-UNSUB-HDR-001/002, rouge constaté avant fix).

### Écarts résiduels documentés par oracles (non corrigés, décision requise)
- R-013 Listmonk : tout subscriber.bounced suppressé hard quel que soit
  bounce_type (comportement épinglé M07-CT-LM-002 — décision produit).
- F-002 : fraîcheur delivered ne dégrade pas le badge ; pas de heartbeat cron.
- F-012 : select-all limité à la page visible (50) sans avertissement.
- A-CMP-3/4 : fenêtre poll 24h fige les métriques ; deliveredCount mort.
- Pipeline : bounced_soft jamais re-drainé ; pas de classification
  permanent/transient ; drain sans budget temps ; tls.rejectUnauthorized=false
  (figé PIP-INT-114) ; DLQ silencieuse (→ module 11).

### Harnais
- test:emails:integration passe d'une liste explicite à un glob
  (scripts/test-emails-integration.sh, sérialisé) ; unit élargi aux routes/
  admin emails. Suite route unsubscribe rendue autosuffisante
  (vi.hoisted MAIL_UNSUB_TOKEN_SECRET).
- Gates vague 2 : tsc 0 erreur ; unit 749 verts / composant 287 verts /
  intégration 332 verts (27 suites).
