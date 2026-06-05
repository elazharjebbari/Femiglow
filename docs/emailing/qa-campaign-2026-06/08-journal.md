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

## Session 2026-06-05 (vague 3 — phases 6+7+8, + audit UX vague 3.5)

**Orchestration** : workflow 4 chantiers parallèles + durcissement séquentiel.
Run tué DEUX fois (compaction/fermeture de session) puis repris à chaque fois
via `resumeFromRunId` — les chantiers terminés reviennent du cache journal,
seuls les interrompus rejouent. En parallèle (lecture seule, zéro conflit) :
audit UX/pilotabilité de 8 surfaces (vague 3.5).

### Chantiers livrés (rouge→fix→vert constaté)
- **m05 UI automations** (40 tests, ×2 runs) : DEUX promesses fausses corrigées —
  trigger `event`/`subscription` sans champ eventName (triggerConfig:{} persisté
  → automation INERTE côté dispatcher) ; step send sans template accepté jusqu'à
  la revue. Oracle central : l'argument exact remis à createAutomation = les
  noms/unités que lisent event-dispatcher/runner/frequency.
- **m11 infra/santé** (67 tests, ×2 runs) : F-002 corrigé — fraîcheur delivered
  (>24h warn / >72h incident) et heartbeat du cron de drain (tick périmé >15min
  → incident même sur file vide) câblés DANS le niveau worst-wins du badge ;
  heartbeat additif sur email_settings (zéro migration) ; DLQ 24h exposée et
  dégradante ; script R-003 `scripts/check-email-timers.sh` (read-only,
  prod-runnable) + test anti-drift route↔timer.
- **scénarios S2/S3/S4** (16 tests vraie-DB, ×2 runs, zéro modif src) :
  3 findings métier → R-026 (suppression irréversible par voie applicative),
  R-027 (relance panier envoyée même après achat), garde-fou delete automation
  à vérifier (vague 4).
- **E2E Playwright phase 6 + S5** : 5 specs / 14 tests, 3 RUNS CONSÉCUTIFS verts
  (~13s), serveur :8013 production build sur femiglow_test_e2e ; 3 races
  d'isolation inter-specs corrigées (cleanup scopé par préfixe, capture d'ids
  par data-testid, seed non-claimable par le cron via scheduled_for=2999).
  S1 = checklist manuelle (Listmonk volontairement mort en local).
- **durcissement p8** : couverture src/lib/mail ciblée — schemas.ts 0→100 %,
  context-resolver.ts 0→100 %, audiences/queries.ts 41→100 %, resume.ts
  0→87.65 % (53 tests) ; CI `.github/workflows/emails-qa.yml` (unit+composant
  sans DB, puis intégration postgres:16 + _migrate-safe.mjs) ; double-run
  STRICTEMENT identique (unit 767 / composant 317 / intégration 362), 0 flake.

### Bugs prod découverts par le durcissement dans du code gelé (fix orchestrateur)
- **R-028 (CRITIQUE, corrigé)** : `sweepWaitForEventTimeouts` bindait une Date
  JS crue dans le template sql postgres-js → ERR_INVALID_ARG_TYPE, le cron
  email-automation 500 à CHAQUE tick (invisible : le test de la route mocke la
  sweep). PLUS un second défaut révélé par le fix : lecture du résultat via
  `.rows` (shape neon-http) alors que postgres-js renvoie le tableau → compte
  toujours 0. Fix : bind ISO ::timestamptz + lecture tableau|{rows}.
  Bascule d'oracles : AUT-RESUME-007 pin du crash → garde-fou no-reject ;
  AUT-RESUME-008 dé-skippé. 21/21 verts ×2.
- **R-029 (corrigé)** : `listAudiencesWithSnapshotCount` — référence externe non
  qualifiée dans la sous-requête corrélée (`WHERE "audience_id" = "id"`) →
  snapshotCount TOUJOURS 0 dans l'admin. Fix : `"email_audience"."id"` en dur.
  AUD-QRY-012 pin → garde-fou cohérence ; AUD-QRY-013 dé-skippé.

### Audit UX vague 3.5 (8 auditeurs + architecte, lecture seule)
110 findings (21 P0, 51 P1), 29 manques d'autocomplétion. Synthèse → 7 chantiers
vague 4 à file-freeze disjoints : FONDATION (EntityCombobox a11y + StatusBadge FR
+ Breadcrumb + useUrlFilters + 3 routes suggestions) et PARCOURS_PUBLIC d'abord,
puis DASHBOARD/COCKPIT/CAMPAGNES/AUDIENCES/AUTOMATIONS. R-026/R-027 injectés
dans COCKPIT (suppression réversible) et AUTOMATIONS (cancel sur achat).

### Gates vague 3
tsc 0 erreur ; batteries emails complètes vertes (cf. logs) ; suite globale :
attendu 1 seul échec préexistant tracking (event-catalog.checkout, hors périmètre).

### Addendum vague 3 — bug prod n°3 (chantier E2E)
**R-030 (corrigé)** : la validation des routes bulk-retry/bulk-suppress exigeait
des UUID alors que `email_outbox.id` est un `createId('out')` (`out_<nanoid>`)
→ 422 sur TOUS les ids réels : le bulk retry/suppress du cockpit était
inopérant en prod. Invisible des tests unit (UUID factices) ET composant
(routes MSW mockées) — seul l'E2E contre la vraie route l'a vu. Fix :
OutboxIdSchema opaque (alphanum+`_-`, ≤64, compat UUID).

## Session 2026-06-05 (vague 4 — UX/pilotabilité, 7 chantiers)

**Origine** : audit UX vague 3.5 (8 surfaces, 110 findings dont 21 P0,
29 manques d'autocomplétion) synthétisé en 7 chantiers à file-freeze disjoints.
**Orchestration** : FONDATION + PARCOURS_PUBLIC d'abord, puis 5 chantiers
surface en parallèle consommant le socle gelé. ~88 min, 1.37M tokens, 818 tool
uses. Tous les P0 livrés, doctrine rouge→fix→vert respectée partout.

### Livré
- **FONDATION** : EntityCombobox accessible (ARIA combobox/listbox complet,
  clavier, debounce 250ms + AbortController + compteur de séquence anti-option-
  fantôme, fermeture clic-extérieur/Escape/Tab — PAS mouseleave), wrappers par
  entité, StatusBadge FR canonique (11 statuts), Breadcrumb, useUrlFilters
  (router.replace + URL minimale partageable), loading/error de segment,
  3 routes suggestions (recipients/sources/leads, escapeLikePrefix anti-wildcard,
  DB-down → 200 liste vide). 52 tests ×2.
- **PARCOURS_PUBLIC** (4 bugs prod corrigés) : R-032 GET unsubscribe DESTRUCTIF
  (un préfetch Gmail/Outlook safelinks désinscrivait sans intention) → GET page
  de confirmation 0 écriture, POST exécute, RFC 8058 préservé, + réabonnement ;
  send.ts laissait le littéral {{unsubscribe_url}} sans secret → fallback
  mailto + log error ; newsletter ok:true sans envoi → 503 actionnable ;
  case newsletter du contact = note morte → vrai double opt-in idempotent.
  CTA order-confirmation re-pointé /merci?order= (la route /compte/commandes
  n'existait pas). Premisse d'audit corrigée : NewsletterForm ÉTAIT monté
  (NewsletterBlock dynamic ssr:false). 104 tests ×2.
- **DASHBOARD** : KPI cards → liens cockpit filtré (?status=…), lignes du badge
  santé actionnables (DLQ/sending/file/webhook) + rendu deliveredFreshness/
  cronHeartbeat, horodatage role=status + bouton Rafraîchir anti double-clic,
  quick-link Events, page events FR + drill-down.
- **COCKPIT** : R-026 corrigé — suppression consultable ET réversible
  (removeSuppression + GET/DELETE /api/admin/emails/suppression + écran
  filtrable + Retirer confirmé + deep-link depuis un envoi suppressed) ;
  régression F-016 corrigée (initialViews sans filterState → vue système
  inopérante au 1er chargement) ; palette template:/to:/source: branchée.
- **CAMPAGNES** : test-send (LeadEmailCombobox), pause/reprise/annulation
  d'urgence (isLegalTransition + anti no-op paused→paused), persistance du
  template corrigée (payload_json.listmonkTemplateId, perdu à chaque reload
  avant), confirmation d'envoi chiffrée bloquante tant que l'estimation vaut
  '…', duplication, deep-links par UUID (le lien slug 404ait).
- **AUDIENCES** : page édition réutilisant le wizard (PATCH, slug immuable),
  exclusions éditables, operator between (num + dates), urlPattern/until/since,
  snapshot confirmé avec count live + retry errored + auto-refresh, membres
  paginés (route + drill-down), country multi-select chips, MAD→cents avec
  helper d'équivalence.
- **AUTOMATIONS** : R-027 corrigé — cancel-on-event.ts générique
  (cart.abandoned→order.placed, runs sans outbox du bon lead, raison
  consignée), flip S3-05 documenté ; triggerConditions éditables (la page edit
  écrasait les conditions à null = perte de données) ; schedule/webhook
  désamorcés (promesse fausse : dispatcher unsupported_trigger) ; retry d'un
  run errored ; onTimeout='abort' enfin honoré par la sweep (cancelled +
  raison) ; timeline lisible du run (skip/defer reasons) ; comboboxes
  template/tag/source partout. 124 tests vraie-DB ×2.

### Pièges React 18.3 documentés par les agents (évités au runtime)
- useActionState N'EXISTE PAS (React 19) → useFormState (react-dom) ;
- react-dom 18.3.1 n'exporte PAS useFormState/useFormStatus dans ce repo selon
  le chantier cockpit (RetryButton : state pending explicite) — vérifié au cas
  par cas ;
- useTransition().isPending ne couvre pas un await arbitraire.

### Fix harnais orchestrateur
cancel-on-purchase.integration.test.ts : hooks top-level non gardés →
collection en échec en batterie unit (env DB absente) malgré le skip honnête.
Garde hasEmailsTestDb() ajoutée aux 3 hooks (conventions §8 complétées par
l'exemple).

### Matrice
R-026/R-027 corrigés ; +R-031 (deleteAutomation DELETE brut vs FK RESTRICT,
mitigé : câblé à aucune UI) ; +R-032 (GET unsubscribe destructif, corrigé).

### Addendum vague 4 — R-033 (flake révélateur, corrigé)
PIP-INT-062 a flaké en batterie (vert solo ×3) : l'ORDER BY du sous-SELECT de
claim ne survit PAS au RETURNING de l'UPDATE…FROM — Postgres joint en ordre
physique. L'ordre « plus anciennes d'abord » ne tenait que par accident de
plan. Fix : re-tri déterministe côté JS du batch claimé (next_retry NULLS
FIRST, created_at ASC, comparateur sans NaN). Le flake était un VRAI bug.
