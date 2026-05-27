# Exécution pas-à-pas

> Suite linéaire d'instructions, prêtes à copier-coller. Référence dans chaque étape au plan détaillé.

## J+0 — Préparation (1h)

### 1. Setup environnement

```bash
cd /Users/elazhar/PycharmProjects/template-femiglow
git fetch origin
git checkout master
git pull
nvm use 20
cd apps/web
pnpm install
pnpm vitest run 2>&1 | tail -5  # baseline avant fix
# Noter : Tests X passed | Y skipped
```

**Vérifier** :
- Output mentionne `7159 passed` ou similaire
- Pas d'erreur de typecheck

### 2. Créer branche

```bash
cd /Users/elazhar/PycharmProjects/template-femiglow
git checkout -b fix/chat-conversations-leads-pollution
git push -u origin fix/chat-conversations-leads-pollution
```

### 3. Snapshot DB pré-fix

```bash
cd apps/web
mkdir -p ../../docs/chat-conversations-leads-fix-2026-05/04-data-strategy/snapshots

psql $DATABASE_URL -c "
  SELECT json_build_object(
    'timestamp', NOW()::text,
    'total_sessions', (SELECT COUNT(*) FROM chat_session),
    'total_leads', (SELECT COUNT(*) FROM chat_lead),
    'by_prefix', (
      SELECT json_object_agg(prefix, n)
      FROM (
        SELECT LEFT(id, 3) AS prefix, COUNT(*) AS n
        FROM chat_session GROUP BY 1
      ) t
    ),
    'by_source', (
      SELECT json_object_agg(source, n)
      FROM (SELECT source, COUNT(*) AS n FROM chat_lead GROUP BY 1) t
    )
  )
" -t -A > ../../docs/chat-conversations-leads-fix-2026-05/04-data-strategy/snapshots/pre-migration.json

cat ../../docs/chat-conversations-leads-fix-2026-05/04-data-strategy/snapshots/pre-migration.json | jq
```

### 4. Ajouter feature flag

```bash
# Dans apps/web/.env
echo "CHAT_ADMIN_FILTERS_V2=false" >> .env

# Dans apps/web/.env.example
echo "" >> .env.example
echo "# CHA-LEAD-V2 — Active filtres admin V2 (kind + source)" >> .env.example
echo "CHAT_ADMIN_FILTERS_V2=false" >> .env.example
```

### 5. Étendre feature-flag.ts

Éditer `apps/web/src/lib/chat/feature-flag.ts` :

```ts
// Ajouter après isChatEnabled()
export function isChatAdminFiltersV2Enabled(): boolean {
  return process.env.CHAT_ADMIN_FILTERS_V2 === 'true';
}
```

### 6. Créer kind.ts

```bash
cat > apps/web/src/lib/chat/db/kind.ts <<'EOF'
/**
 * CHA-LEAD-V2 — Discriminateur de chat_session.kind.
 */
export const CHAT_SESSION_KINDS = ['chat', 'wizard_pivot', 'system'] as const;
export type ChatSessionKind = (typeof CHAT_SESSION_KINDS)[number];

export const ADMIN_CHAT_VISIBLE_KINDS: ReadonlyArray<ChatSessionKind> = ['chat'];
export const ADMIN_CHAT_VISIBLE_LEAD_SOURCES = ['chat_widget', 'inline'] as const;
EOF
```

### 7. Type check

```bash
pnpm typecheck 2>&1 | grep "src/lib/chat" | head -5
# Doit être vide (pas d'erreur dans chat/)
```

### 8. Commit T0

```bash
git add apps/web/src/lib/chat/feature-flag.ts \
        apps/web/src/lib/chat/db/kind.ts \
        apps/web/.env.example \
        docs/chat-conversations-leads-fix-2026-05/

git commit -m "$(cat <<'EOF'
feat(chat-lead-v2): T0 — feature flag + kind constants + snapshot

- CHAT_ADMIN_FILTERS_V2 env flag (default false)
- ChatSessionKind enum + constants
- Pre-migration DB snapshot

Cf. docs/chat-conversations-leads-fix-2026-05/06-plan-action/phases.md T0

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## J+1 — Backend core (4-6h)

### 1. Modifier schema.ts

Éditer `apps/web/src/lib/chat/db/schema.ts` selon `02-backend/migrations.md` §3.

### 2. Générer migration

```bash
cd apps/web
pnpm drizzle-kit generate --name chat_session_kind
ls drizzle/migrations/ | tail -3
# Noter le numéro de migration (ex. 0042)
```

### 3. Éditer la migration générée

Ajouter les sections backfill et index CONCURRENTLY (cf. `02-backend/migrations.md` §2).

### 4. Appliquer migration local

```bash
pnpm drizzle-kit migrate
# Vérifier : "Migration applied successfully"
```

### 5. Vérifier la colonne

```bash
psql $DATABASE_URL -c "\d chat_session" | grep kind
# Doit afficher : kind | text | not null | default 'chat'

psql $DATABASE_URL -c "SELECT kind, COUNT(*) FROM chat_session GROUP BY 1"
# Doit afficher les rows avec kind rempli
```

### 6. Modifier les repos

Éditer selon `02-backend/repos.md` :
- `apps/web/src/lib/chat/repos/session.ts`
- `apps/web/src/lib/checkout/repos/session-repo.ts`

### 7. Modifier les queries admin

Éditer `apps/web/src/lib/chat/admin/queries.ts` selon `02-backend/queries-admin.md`.

### 8. Créer cleanup.ts

```bash
# Créer le fichier selon 02-backend/api-routes.md §1
```

### 9. Créer endpoint cleanup-ghosts

```bash
mkdir -p apps/web/src/app/api/admin/chat/cleanup-ghosts
# Créer route.ts selon 02-backend/api-routes.md §1
```

### 10. Créer endpoint audit-pollution

```bash
mkdir -p apps/web/src/app/api/admin/chat/audit-pollution
# Créer route.ts selon 02-backend/api-routes.md §3
```

### 11. Type check + smoke

```bash
pnpm typecheck 2>&1 | grep "src/lib/chat\|src/app/api/admin/chat" | head -10
# Doit être vide (pas d'erreur dans nos fichiers)

pnpm dev  # dans un autre terminal

# Smoke local
curl http://localhost:3001/api/admin/chat/audit-pollution \
  -H 'cookie: ...' | jq
```

### 12. Commit T1

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(chat-lead-v2): T1 — backend (schema + queries + endpoint)

- Add chat_session.kind column ('chat', 'wizard_pivot', 'system')
- Drizzle migration with CONCURRENTLY index + backfill
- sessionRepo.create insert kind='chat' + log
- wizardSessionRepo.ensureForWizard insert kind='wizard_pivot' + log
- adminQueries filtres kind + source (derrière flag)
- /api/admin/chat/cleanup-ghosts endpoint
- /api/admin/chat/audit-pollution endpoint

Cf. docs/chat-conversations-leads-fix-2026-05/06-plan-action/phases.md T1

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### 13. Ouvrir PR1

```bash
gh pr create --title "feat(chat-lead-v2): T0+T1 — backend pollution fix" \
  --body "$(cat <<'EOF'
## Summary

- Add chat_session.kind discriminator (chat / wizard_pivot / system)
- Migration Drizzle + backfill historique
- Repos write kind explicite
- Admin queries filtrent par défaut (derrière feature flag)
- Endpoint cleanup-ghosts + audit-pollution

## Test plan

- [ ] pnpm vitest run (baseline maintenue)
- [ ] pnpm drizzle-kit migrate
- [ ] curl /api/admin/chat/audit-pollution OK
- [ ] Audit SQL §2

Cf. docs/chat-conversations-leads-fix-2026-05/

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## J+2 — Tests vitest (4h)

### 1. Créer les 6 fichiers de test

Cf. `05-tests/unit-vitest.md` pour les contenus complets.

```bash
# 1.1 queries.kind.test.ts
touch apps/web/src/lib/chat/admin/queries.kind.test.ts
# (coller le code de 05-tests/unit-vitest.md §1)

# 1.2 repos/session.kind.test.ts
touch apps/web/src/lib/chat/repos/session.kind.test.ts
# (coller le code de §2)

# 1.3 checkout/repos/session-repo.kind.test.ts
touch apps/web/src/lib/checkout/repos/session-repo.kind.test.ts
# (coller le code de §3)

# 1.4 cleanup.test.ts
touch apps/web/src/lib/chat/admin/cleanup.test.ts
# (coller le code de §4)

# 1.5 feature-flag.test.ts
touch apps/web/src/lib/chat/feature-flag.test.ts
# (coller le code de §5)

# 1.6 db/__tests__/schema-kind.invariant.test.ts
mkdir -p apps/web/src/lib/chat/db/__tests__
touch apps/web/src/lib/chat/db/__tests__/schema-kind.invariant.test.ts
# (coller le code de §6)
```

### 2. Test endpoint

```bash
touch apps/web/src/app/api/admin/chat/cleanup-ghosts/route.test.ts
# (coller le code de 02-backend/api-routes.md §2)
```

### 3. Intégration MSW

```bash
mkdir -p apps/web/src/test/integration
touch apps/web/src/test/integration/chat-admin.integration.test.ts
# (coller le code de 05-tests/integration-msw.md §2)
```

### 4. Run

```bash
pnpm vitest run \
  src/lib/chat/admin/queries.kind.test.ts \
  src/lib/chat/repos/session.kind.test.ts \
  src/lib/checkout/repos/session-repo.kind.test.ts \
  src/lib/chat/admin/cleanup.test.ts \
  src/lib/chat/feature-flag.test.ts \
  src/lib/chat/db/__tests__/schema-kind.invariant.test.ts \
  src/app/api/admin/chat/cleanup-ghosts/route.test.ts \
  src/test/integration/chat-admin.integration.test.ts

# Doit afficher : 25 tests passed
```

### 5. Suite globale

```bash
pnpm vitest run 2>&1 | tail -5
# Tests >= 7184 passed (7159 baseline + 25 nouveaux)
```

### 6. Commit T2

```bash
git add -A
git commit -m "$(cat <<'EOF'
test(chat-lead-v2): T2 — vitest unit + MSW intégration (25 tests)

- 6 fichiers vitest unit (queries, repos, cleanup, flag, schema)
- 1 fichier route test (cleanup-ghosts endpoint)
- 1 fichier MSW intégration (admin chat queries end-to-end)

Total: 25 tests verts, suite globale non régressive.

Cf. docs/chat-conversations-leads-fix-2026-05/05-tests/

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## J+3 — Frontend (4h)

### 1. Créer composants

```bash
touch apps/web/src/components/admin/chat/SourceBadge.tsx
touch apps/web/src/components/admin/chat/SourceBadge.test.tsx
touch apps/web/src/components/admin/chat/KindBadge.tsx
touch apps/web/src/components/admin/chat/CleanupGhostsButton.tsx
# (coller les codes de 03-frontend-ui-ux/components.md)
```

### 2. Modifier pages admin

```bash
# Éditer (cf. 03-frontend-ui-ux/pages-admin.md)
apps/web/src/app/admin/chat/conversations/page.tsx
apps/web/src/app/admin/chat/leads/page.tsx
apps/web/src/app/admin/chat/audit/page.tsx
```

### 3. Vérifier visuellement

```bash
# Activer le flag local pour preview
echo "CHAT_ADMIN_FILTERS_V2=true" >> apps/web/.env

pnpm dev
# Naviguer http://localhost:3001/admin/chat/conversations
# Vérifier : liste propre, toggle debug fonctionne
# Naviguer http://localhost:3001/admin/chat/leads
# Vérifier : badges source visibles
# Naviguer http://localhost:3001/admin/chat/audit
# Vérifier : section pollution + bouton cleanup
```

### 4. Tests composants

```bash
pnpm vitest run src/components/admin/chat/
# Doit afficher : tests passed (3+ pour SourceBadge, etc.)
```

### 5. Commit T3

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(chat-lead-v2): T3 — frontend pages + composants

- <SourceBadge /> + <KindBadge /> + <CleanupGhostsButton />
- /admin/chat/conversations : toggle debug + badge kind
- /admin/chat/leads : badge source + toggle includeWizard
- /admin/chat/audit : rapport pollution + cleanup UI

Cf. docs/chat-conversations-leads-fix-2026-05/03-frontend-ui-ux/

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## J+4 — Tests Playwright + smoke (3h)

### 1. Créer specs Playwright

```bash
touch apps/web/e2e/chat-purity.spec.ts
mkdir -p apps/web/e2e/a11y
touch apps/web/e2e/a11y/chat-admin.spec.ts
# (coller les codes de 05-tests/e2e-playwright.md)
```

### 2. Créer smoke script

```bash
touch apps/web/scripts/smoke-chat-purity.ts
# (coller le code de 05-tests/e2e-playwright.md §3)
```

### 3. Run Playwright local

```bash
# S'assurer que dev server tourne sur 3001
pnpm dev &
sleep 5

# Run specs
pnpm playwright test --grep @chat-purity 2>&1 | tail -10
# Attendu : 7 passed

pnpm playwright test --grep @a11y 2>&1 | tail -10
# Attendu : 6 passed
```

### 4. Smoke local

```bash
pnpm tsx scripts/smoke-chat-purity.ts
# Attendu : 3/3 OK, exit 0
```

### 5. Commit T4 + ouvrir PR3

```bash
git add -A
git commit -m "$(cat <<'EOF'
test(chat-lead-v2): T4 — Playwright @chat-purity + smoke

- e2e/chat-purity.spec.ts (7 specs filters + cleanup)
- e2e/a11y/chat-admin.spec.ts (6 specs a11y)
- scripts/smoke-chat-purity.ts

Cf. docs/chat-conversations-leads-fix-2026-05/05-tests/e2e-playwright.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"

git push origin fix/chat-conversations-leads-pollution
```

---

## J+5 — Backfill + monitoring (3h)

### 1. Backfill local

```bash
pnpm tsx scripts/backfill-chat-session-kind.ts --dry-run
# Noter : Candidates : X

pnpm tsx scripts/backfill-chat-session-kind.ts --execute
# Attendu : Updated X rows
```

### 2. Audit post-backfill

```bash
psql $DATABASE_URL -f - <<'EOF'
\echo '=== Distribution kind ==='
SELECT kind, COUNT(*) FROM chat_session GROUP BY 1 ORDER BY 2 DESC;
\echo '=== Coherence ==='
SELECT s.kind, l.source, COUNT(*) FROM chat_session s
JOIN chat_lead l ON l.session_id = s.id GROUP BY 1, 2 ORDER BY 3 DESC;
\echo '=== Cleanup candidates ==='
SELECT COUNT(*) FROM chat_session s
WHERE s.kind = 'wizard_pivot' AND s.status = 'open'
AND NOT EXISTS (SELECT 1 FROM chat_lead l WHERE l.session_id = s.id)
AND s.opened_at < NOW() - INTERVAL '30 days';
EOF
```

### 3. Snapshot post-fix

```bash
# Repeat snapshot avec date suffix
psql $DATABASE_URL -c "..." > docs/.../snapshots/post-migration.json
```

### 4. Sentry & Plausible

- Configurer manuel via dashboards (cf. `04-data-strategy/monitoring.md`).

### 5. Commit T5

```bash
git add docs/chat-conversations-leads-fix-2026-05/04-data-strategy/snapshots/
git commit -m "$(cat <<'EOF'
data(chat-lead-v2): T5 — backfill local + audit snapshots

- pre/post migration snapshots
- audit SQL §3 OK (0 incoherence)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## J+6 — Staging + Prod

Cf. fichiers séparés :
- [`verifications-staging.md`](./verifications-staging.md)
- [`deploiement-prod.md`](./deploiement-prod.md)

---

## J+7 — Observation 48h

```bash
# J+1 24h
# Vérifier Sentry : 0 erreur
# Vérifier dashboard /admin/chat/audit
# Vérifier KPIs business

# J+2 48h
# Décision : maintenir flag ON
# Notifier fondatrice
# Clore sprint
```

## Récap branche

```bash
git log --oneline fix/chat-conversations-leads-pollution
# Attendu :
# XXX feat(chat-lead-v2): T0 — feature flag + kind constants
# XXX feat(chat-lead-v2): T1 — backend (schema + queries + endpoint)
# XXX test(chat-lead-v2): T2 — vitest unit + MSW intégration
# XXX feat(chat-lead-v2): T3 — frontend pages + composants
# XXX test(chat-lead-v2): T4 — Playwright @chat-purity + smoke
# XXX data(chat-lead-v2): T5 — backfill local + audit snapshots
```
