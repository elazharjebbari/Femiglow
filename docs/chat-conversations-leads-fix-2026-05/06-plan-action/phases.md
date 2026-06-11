# Phases détaillées T0 → T6

## T0 — Préparation (0.5 j-h, J+0)

### Tâches

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T0.1 | Lire dossier d'audit + ce dossier de fix | Dev + Lead | 30 min |
| T0.2 | Créer branche `fix/chat-conversations-leads-pollution` | Dev | 5 min |
| T0.3 | Ajouter `CHAT_ADMIN_FILTERS_V2=false` dans `.env.example` + Vercel preview | Dev | 10 min |
| T0.4 | Étendre `src/lib/chat/feature-flag.ts` avec `isChatAdminFiltersV2Enabled()` | Dev | 5 min |
| T0.5 | Créer `src/lib/chat/db/kind.ts` (constants + type) | Dev | 10 min |
| T0.6 | Ajouter task linear/notion "CHA-LEAD-V2 Sprint" | Lead | 10 min |
| T0.7 | Snapshot DB pré-fix (cf. `04-data-strategy/audit-queries.md` §1) | Dev | 10 min |

### Deliverable

- ✅ Branch `fix/chat-conversations-leads-pollution` pushée
- ✅ Flag `CHAT_ADMIN_FILTERS_V2` opérationnel (mais false partout)
- ✅ Constants `CHAT_SESSION_KINDS` exportées
- ✅ Pré-snapshot DB stocké dans `docs/.../04-data-strategy/snapshots/pre-migration.json`

### Critères de passage T0 → T1

- [ ] `pnpm typecheck` passe (pas de nouvelle erreur)
- [ ] Test `isChatAdminFiltersV2Enabled()` retourne false par défaut
- [ ] Snapshot DB exporté et reviewé

---

## T1 — Backend core (1 j-h, J+1)

### Tâches

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T1.1 | Modifier `src/lib/chat/db/schema.ts` (ajout `kind`) | Dev | 15 min |
| T1.2 | Générer migration Drizzle `pnpm drizzle-kit generate --name chat_session_kind` | Dev | 5 min |
| T1.3 | Éditer migration SQL pour ajouter index CONCURRENTLY + backfill | Dev | 20 min |
| T1.4 | Appliquer migration local : `pnpm drizzle-kit migrate` | Dev | 5 min |
| T1.5 | Exécuter audit SQL post-migration (`04-data-strategy/audit-queries.md` §2) | Dev | 10 min |
| T1.6 | Modifier `src/lib/chat/repos/session.ts` : insert `kind: 'chat'` + log | Dev | 20 min |
| T1.7 | Modifier `src/lib/checkout/repos/session-repo.ts` : insert `kind: 'wizard_pivot'` + log | Dev | 20 min |
| T1.8 | Modifier `src/lib/chat/admin/queries.ts` : ajout helpers + filtres | Dev | 90 min |
| T1.9 | Créer `src/lib/chat/admin/cleanup.ts` | Dev | 30 min |
| T1.10 | Créer `src/app/api/admin/chat/cleanup-ghosts/route.ts` | Dev | 30 min |
| T1.11 | Créer `src/app/api/admin/chat/audit-pollution/route.ts` | Dev | 20 min |
| T1.12 | Smoke test manuel : `curl /api/admin/chat/audit-pollution` | Dev | 10 min |

### Deliverable

- ✅ Migration `0XYZ_chat_session_kind.sql` appliquée local
- ✅ Tous les inserts `chat_session` ont un `kind` explicite
- ✅ Toutes les queries admin acceptent les nouveaux opts (`kinds`, `sources`, `withMessagesOnly`)
- ✅ Endpoint cleanup-ghosts + audit-pollution opérationnels

### Critères de passage T1 → T2

- [ ] `pnpm typecheck` passe sur tous les fichiers touchés
- [ ] `pnpm vitest run src/lib/chat/admin/` passe (tests existants)
- [ ] Manuel : `curl ... /api/admin/chat/audit-pollution` retourne JSON valide
- [ ] Audit SQL §2 montre `kind` rempli partout

---

## T2 — Tests vitest unit + intégration MSW (1 j-h, J+2)

### Tâches

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T2.1 | Créer `src/lib/chat/admin/queries.kind.test.ts` (6 tests) | Dev | 60 min |
| T2.2 | Créer `src/lib/chat/repos/session.kind.test.ts` (3 tests) | Dev | 30 min |
| T2.3 | Créer `src/lib/checkout/repos/session-repo.kind.test.ts` (2 tests) | Dev | 30 min |
| T2.4 | Créer `src/lib/chat/admin/cleanup.test.ts` (4 tests) | Dev | 30 min |
| T2.5 | Créer `src/lib/chat/feature-flag.test.ts` (3 tests) | Dev | 15 min |
| T2.6 | Créer `src/lib/chat/db/__tests__/schema-kind.invariant.test.ts` (2 tests) | Dev | 15 min |
| T2.7 | Créer `src/app/api/admin/chat/cleanup-ghosts/route.test.ts` (5 tests) | Dev | 30 min |
| T2.8 | Créer `src/test/integration/chat-admin.integration.test.ts` (6 tests) | Dev | 90 min |
| T2.9 | Exécuter suite complète vitest : `pnpm vitest run` | Dev | 5 min |
| T2.10 | Coverage : `pnpm vitest run --coverage` | Dev | 5 min |

### Deliverable

- ✅ 25 nouveaux tests (18 unit + 7 MSW intégration) verts
- ✅ Suite globale vitest : Tests verts >= 7159 (idem ou supérieur)
- ✅ Coverage des nouvelles lignes ≥ 85 %

### Critères de passage T2 → T3

- [ ] `pnpm vitest run` exit 0
- [ ] Aucun test précédemment vert n'est devenu rouge
- [ ] Coverage rapport sauvegardé dans `docs/.../05-tests/coverage-report.html`

---

## T3 — Frontend pages + composants (0.5 j-h, J+3)

### Tâches

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T3.1 | Créer `src/components/admin/chat/SourceBadge.tsx` + tests | Dev | 30 min |
| T3.2 | Créer `src/components/admin/chat/KindBadge.tsx` + tests | Dev | 20 min |
| T3.3 | Créer `src/components/admin/chat/CleanupGhostsButton.tsx` + tests | Dev | 40 min |
| T3.4 | Modifier `src/app/admin/chat/conversations/page.tsx` (toggle debug + badge kind) | Dev | 30 min |
| T3.5 | Modifier `src/app/admin/chat/leads/page.tsx` (badge source + toggle includeWizard) | Dev | 20 min |
| T3.6 | Modifier `src/app/admin/chat/audit/page.tsx` (section pollution + cleanup button) | Dev | 30 min |
| T3.7 | Lancer preview local + vérifier visuellement | Dev | 20 min |
| T3.8 | Test axe-core sur les pages (warnings dans console) | Dev | 10 min |

### Deliverable

- ✅ 3 nouveaux composants créés et testés
- ✅ 3 pages admin chat modifiées
- ✅ Aucune régression visuelle observée
- ✅ Aucun warning a11y dans la console

### Critères de passage T3 → T4

- [ ] `pnpm dev` démarre sans erreur
- [ ] Visite `/admin/chat/conversations` charge sans erreur 500
- [ ] Visite `/admin/chat/leads` charge sans erreur 500
- [ ] Visite `/admin/chat/audit` affiche le tableau pollution

---

## T4 — Tests Playwright E2E (0.5 j-h, J+4)

### Tâches

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T4.1 | Créer `apps/web/e2e/chat-purity.spec.ts` (4 tests filtres + 3 cleanup) | Dev | 60 min |
| T4.2 | Créer `apps/web/e2e/a11y/chat-admin.spec.ts` (6 specs a11y) | Dev | 30 min |
| T4.3 | Créer `apps/web/scripts/smoke-chat-purity.ts` | Dev | 30 min |
| T4.4 | Exécuter `pnpm playwright test --grep @chat-purity` | Dev | 10 min |
| T4.5 | Exécuter `pnpm playwright test --grep @a11y` | Dev | 10 min |
| T4.6 | Exécuter `pnpm tsx scripts/smoke-chat-purity.ts` local | Dev | 5 min |
| T4.7 | Si flaky : 10 runs successifs pour valider stabilité | Dev | 15 min |

### Deliverable

- ✅ 7 specs Playwright `@chat-purity` verts
- ✅ 6 specs `@a11y` verts
- ✅ Smoke script exit 0 sur localhost
- ✅ Aucune flakiness sur 10 runs

### Critères de passage T4 → T5

- [ ] `pnpm playwright test --grep @chat-purity` exit 0
- [ ] `pnpm tsx scripts/smoke-chat-purity.ts` exit 0
- [ ] Vidéos Playwright dispo si échec (pour debug si flaky en CI)

---

## T5 — Backfill data + monitoring (0.5 j-h, J+5)

### Tâches

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T5.1 | Capture snapshot DB pré-fix (si pas déjà fait en T0) | Dev | 10 min |
| T5.2 | Exécuter backfill DB local : `pnpm tsx scripts/backfill-chat-session-kind.ts --dry-run` | Dev | 5 min |
| T5.3 | Si dry-run OK : `--execute` | Dev | 5 min |
| T5.4 | Audit post-backfill (queries §3) | Dev | 15 min |
| T5.5 | Capture snapshot DB post-fix | Dev | 5 min |
| T5.6 | Configurer Sentry alert rules (cf. `04-data-strategy/monitoring.md` §4.1) | Lead | 30 min |
| T5.7 | Configurer Plausible custom events | Lead | 20 min |
| T5.8 | Vérifier dashboard `/admin/chat/audit` affiche counts cohérents | Dev | 10 min |
| T5.9 | Documenter dans `docs/.../04-data-strategy/snapshots/*.json` | Dev | 10 min |

### Deliverable

- ✅ Backfill exécuté avec succès local
- ✅ Snapshots before/after sauvegardés
- ✅ Sentry alerts configurées
- ✅ Plausible events configurés
- ✅ Dashboard pollution opérationnel

### Critères de passage T5 → T6

- [ ] Audit SQL §3 : 0 row mal classée
- [ ] Dashboard chat audit : counts cohérents avec SQL
- [ ] Sentry test alert reçu (mock trigger)

---

## T6 — Ship + monitoring 48h (1 j-h, J+6 et J+7)

### Phase A — Staging (J+6 matin, 2h)

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T6.A.1 | Merge PR1+PR2+PR3 dans `master` | Lead | 15 min |
| T6.A.2 | Déploiement staging (Vercel preview ou env dédié) | DevOps | 15 min |
| T6.A.3 | Migration DB staging via Drizzle migrate | DevOps | 10 min |
| T6.A.4 | Vérifier `CHAT_ADMIN_FILTERS_V2=false` (toujours OFF en staging) | DevOps | 5 min |
| T6.A.5 | Smoke staging : `pnpm tsx scripts/smoke-chat-purity.ts --url https://staging.femiglow-maroc.com` | Dev | 5 min |
| T6.A.6 | Activer flag : `CHAT_ADMIN_FILTERS_V2=true` en staging | DevOps | 5 min |
| T6.A.7 | Re-smoke staging avec flag ON | Dev | 5 min |
| T6.A.8 | Visite manuelle `/admin/chat/conversations` staging | Dev + Lead | 30 min |
| T6.A.9 | Backfill staging si DB pas vide : `pnpm tsx scripts/backfill-chat-session-kind.ts --execute` | DevOps | 10 min |
| T6.A.10 | Audit SQL staging | Dev | 15 min |

### Phase B — Prod (J+6 après-midi, 2h)

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T6.B.1 | Backup DB prod (snapshot Neon) | DevOps | 10 min |
| T6.B.2 | Migration DB prod via Drizzle migrate | DevOps | 15 min |
| T6.B.3 | Déploiement prod avec `CHAT_ADMIN_FILTERS_V2=false` | DevOps | 15 min |
| T6.B.4 | Smoke prod : `pnpm tsx scripts/smoke-chat-purity.ts --url https://femiglow-maroc.com` | Dev | 5 min |
| T6.B.5 | Vérifier `/admin/chat/conversations` prod = comportement legacy (flag off) | Dev | 5 min |
| T6.B.6 | Backfill prod : `--execute` (volume estimé 500-2000 rows ~10s) | DevOps | 15 min |
| T6.B.7 | Audit SQL prod post-backfill | Dev | 15 min |
| T6.B.8 | Activer flag : `CHAT_ADMIN_FILTERS_V2=true` en prod | DevOps | 5 min |
| T6.B.9 | Re-smoke prod avec flag ON | Dev | 5 min |
| T6.B.10 | Visite manuelle `/admin/chat/conversations` prod | Lead | 30 min |

### Phase C — Observation 48h (J+6 soir → J+7 soir)

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T6.C.1 | Monitoring Sentry toutes les 2-3h | Lead | passive |
| T6.C.2 | Vérifier Plausible event `admin_chat_conversations_view` | Lead | 10 min |
| T6.C.3 | J+1 (24h) : checklist post-deploy `04-data-strategy/monitoring.md` §6 | Lead | 30 min |
| T6.C.4 | J+2 (48h) : checklist final + décision flag default true | Lead | 30 min |
| T6.C.5 | Communication équipe / fondatrice "Fix shipped" | Lead | 15 min |
| T6.C.6 | Archiver les snapshots et clore le sprint | Lead | 15 min |

### Deliverable

- ✅ Fix shipped en prod avec flag ON
- ✅ Monitoring 48h : 0 erreur Sentry liée au sprint
- ✅ Counts admin cohérents (pollution rate < 5 % en prod)
- ✅ Fondatrice valide manuellement la vue `/admin/chat/conversations`

### Critères de succès final

- [ ] `/admin/chat/conversations` affiche en prod uniquement les vraies conversations
- [ ] `/admin/chat/leads` affiche en prod uniquement les leads chat purs
- [ ] `/admin/leads` continue d'afficher la vue globale
- [ ] Fondatrice valide la pertinence des leads visibles
- [ ] 0 incident en 48h

---

## Récap effort total

| Phase | Effort | Calendrier | Owner |
|---|---|---|---|
| T0 | 0.5 j-h | J+0 (1 demi-journée) | Dev + Lead |
| T1 | 1.0 j-h | J+1 | Dev |
| T2 | 1.0 j-h | J+2 | Dev |
| T3 | 0.5 j-h | J+3 matin | Dev |
| T4 | 0.5 j-h | J+3 après-midi | Dev |
| T5 | 0.5 j-h | J+4 matin | Dev + Lead |
| T6 | 1.0 j-h | J+5 (staging+prod) + J+6/7 (obs) | Lead + DevOps |
| **Total** | **5 j-h** | **7 jours calendaires** | |
