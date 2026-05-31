# Checklist Definition of Done

> Critères d'acceptation détaillés par phase + global.

## Global (à valider AVANT chaque release)

### Compilation & lint
- [ ] `pnpm typecheck` passe sur tous les fichiers touchés
- [ ] `pnpm lint` 0 erreur sur fichiers touchés
- [ ] Aucun import circulaire introduit
- [ ] Aucune dépendance npm ajoutée (réutilisation de l'existant)

### Tests
- [ ] 7159+ tests vitest verts (baseline maintenue ou supérieure)
- [ ] 18 tests unitaires nouveaux verts
- [ ] 6 tests intégration MSW verts
- [ ] 7 specs Playwright `@chat-purity` verts
- [ ] 6 specs `@a11y` verts
- [ ] Smoke script exit 0 local + staging + prod
- [ ] Coverage ≥ 85 % sur fichiers modifiés

### Comportement fonctionnel
- [ ] `/admin/chat/conversations` (flag ON) → seules les vraies conversations
- [ ] `/admin/chat/conversations?debug=ghosts` → toutes les sessions (debug)
- [ ] `/admin/chat/leads` (flag ON) → seuls les leads `chat_widget` + `inline`
- [ ] `/admin/chat/leads?includeWizard=1` → tous les leads (debug)
- [ ] `/admin/leads` (vue globale) → tous les leads (chat + wizard)
- [ ] `/admin/chat/audit` → affiche le rapport pollution
- [ ] `POST /api/admin/chat/cleanup-ghosts` dryRun → counts sans muter
- [ ] `POST /api/admin/chat/cleanup-ghosts` execute → archive les rows
- [ ] `GET /api/admin/chat/audit-pollution` → JSON distributions

### Data integrity
- [ ] Migration appliquée sans erreur
- [ ] Backfill exécuté : 0 row préfixe `s_` reste en `kind='chat'`
- [ ] Backfill exécuté : 0 row préfixe `cs_` devient `kind='wizard_pivot'`
- [ ] Cohérence kind ↔ source ≥ 99 %
- [ ] Aucune row supprimée (uniquement UPDATE et INSERT)

### Performance
- [ ] Latency SSR `/admin/chat/conversations` < 500ms (avant fix : ~200ms)
- [ ] Latency SSR `/admin/chat/leads` < 500ms
- [ ] Index `chat_session_kind_status_idx` créé sans lock long
- [ ] Aucune nouvelle requête > 100ms côté serveur

### Observabilité
- [ ] Logs `chat.session.create` incluent `kind`
- [ ] Logs `chat.admin.cleanup_ghosts` émis
- [ ] Sentry rules configurées
- [ ] Plausible events émis
- [ ] Dashboard pollution opérationnel

### Documentation
- [ ] `docs/chat-assistant/03-backend.md` mis à jour (section table partagée)
- [ ] `docs/chat-conversations-leads-fix-2026-05/` complet (9 sous-dossiers)
- [ ] `CHANGELOG.md` ou release notes mises à jour
- [ ] PR descriptions incluent lien vers ce dossier

### Sécurité
- [ ] Endpoint cleanup-ghosts requiert auth admin
- [ ] Rate limit appliqué (5 req/h)
- [ ] olderThanDays >= 7 enforced
- [ ] Aucune SQL injection possible (toutes les valeurs paramétrées via Drizzle)

### Rollback ready
- [ ] Feature flag `CHAT_ADMIN_FILTERS_V2=false` restaure comportement legacy
- [ ] Migration ne peut pas être rollback automatiquement, mais DROP COLUMN reste possible
- [ ] Procédure rollback documentée dans `06-plan-action/rollback.md`

---

## T0 — Prep DoD

- [ ] Branch `fix/chat-conversations-leads-pollution` créée
- [ ] `CHAT_ADMIN_FILTERS_V2` ajouté à `.env.example`
- [ ] `isChatAdminFiltersV2Enabled()` exporté
- [ ] `CHAT_SESSION_KINDS` exporté depuis `kind.ts`
- [ ] Snapshot pré-fix DB stocké
- [ ] Task linear/notion créé

## T1 — Backend DoD

- [ ] Schema Drizzle modifié (colonne `kind`)
- [ ] Migration SQL générée et appliquée local
- [ ] Index créé sans erreur
- [ ] Backfill UPDATE exécuté
- [ ] `sessionRepo.create()` insère `kind: 'chat'`
- [ ] `wizardSessionRepo.ensureForWizard()` insère `kind: 'wizard_pivot'`
- [ ] Logs `chat.session.create` émis avec `kind`
- [ ] 7 queries admin modifiées (listConversations, listChatLeads, convertedSessionIds, overviewKpis, businessFunnel, careOverview)
- [ ] `cleanupGhosts()` business logic créée
- [ ] Endpoint `/api/admin/chat/cleanup-ghosts` créé
- [ ] Endpoint `/api/admin/chat/audit-pollution` créé
- [ ] Type check OK
- [ ] Tests existants restent verts

## T2 — Tests DoD

- [ ] 18 tests vitest unit nouveaux verts
- [ ] 6 tests intégration MSW verts
- [ ] Suite globale ≥ 7159 verts (non-régression)
- [ ] Coverage ≥ 85 % sur fichiers modifiés

## T3 — Frontend DoD

- [ ] `<SourceBadge />` créé + tests
- [ ] `<KindBadge />` créé + tests
- [ ] `<CleanupGhostsButton />` créé + tests
- [ ] Page conversations modifiée (toggle debug + badge kind)
- [ ] Page leads modifiée (badge source + toggle includeWizard)
- [ ] Page audit étendue (rapport pollution + cleanup button)
- [ ] Aucun warning a11y dans la console
- [ ] Couleurs respectent design tokens existants

## T4 — Tests Playwright DoD

- [ ] 7 specs `@chat-purity` verts
- [ ] 6 specs `@a11y` verts
- [ ] Smoke script local OK
- [ ] 10 runs successifs sans flakiness

## T5 — Data DoD

- [ ] Backfill local exécuté
- [ ] Audit SQL §3 montre 0 incohérence
- [ ] Sentry rules configurées
- [ ] Plausible events configurés
- [ ] Dashboard pollution affiche counts cohérents
- [ ] Snapshots before/after archivés

## T6 — Ship DoD

### Staging
- [ ] Déploiement staging OK
- [ ] Migration staging appliquée
- [ ] Backfill staging OK
- [ ] Smoke staging OK
- [ ] Flag ON staging OK
- [ ] Visite manuelle staging validée par Lead

### Prod
- [ ] Backup DB prod réalisé
- [ ] Migration prod appliquée sans erreur
- [ ] Déploiement prod OK
- [ ] Backfill prod OK
- [ ] Smoke prod OK (flag off)
- [ ] Flag ON prod OK
- [ ] Smoke prod re-confirmé (flag on)
- [ ] Visite manuelle prod validée par Lead

### Observation 48h
- [ ] J+1 : 0 erreur Sentry
- [ ] J+1 : checklist monitoring §6 OK
- [ ] J+2 : conversion rate stable ou ↑
- [ ] J+2 : Care manual sondage → leads pertinents
- [ ] Décision : maintenir flag ON

### Communication
- [ ] Fondatrice notifiée et a validé
- [ ] Équipe Care notifiée du changement
- [ ] Changelog public mis à jour
- [ ] Sprint clos formellement

---

## Anti-patterns à éviter

- ❌ Merge sans avoir runé le smoke
- ❌ Activer le flag avant le backfill (verra ZERO conversation)
- ❌ Désactiver le flag sans investigation (perte de visibilité)
- ❌ Commit-and-push direct dans master sans PR
- ❌ Skip les tests Playwright en CI ("on les runa après")
- ❌ Modifier le schéma sans migration Drizzle (drift)
- ❌ DELETE des rows historiques (cf. ADR-004)
