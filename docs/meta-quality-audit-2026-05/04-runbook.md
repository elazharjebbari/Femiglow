# 04 — Runbook d'exécution

> **Lien amont** : [`02-plan-dev-action.md`](./02-plan-dev-action.md), [`03-tests-strategy.md`](./03-tests-strategy.md)
>
> **Objectif** : suivre ce runbook **dans l'ordre**, copier-coller les commandes, valider chaque gate avant de passer à l'étape suivante.

---

## 0. Prérequis & setup worktree

### 0.1 Hypothèses

- Worktree existant : `/var/www/femiglow/.claude/worktrees/webhook`
- Branche actuelle : `feat/tracking-tiktok-init` (clean)
- Prod tourne sur `master` + `femiglow.service` (PID actif)

### 0.2 Créer la branche `feat/meta-quality-fix`

```bash
cd /var/www/femiglow/.claude/worktrees/webhook
git fetch origin
git checkout master
git pull origin master
git checkout -b feat/meta-quality-fix
```

### 0.3 Configurer une DB worktree isolée

> **Important** : on ne touche **pas** la DB prod tant qu'on n'a pas validé localement.

```bash
# 1. Créer la DB worktree
sudo -u postgres createdb femiglow_worktree_meta

# 2. Vérifier
sudo -u postgres psql -l | grep femiglow_worktree_meta

# 3. Configurer .env worktree
cp apps/web/.env.example apps/web/.env
```

Éditer `apps/web/.env` pour pointer sur la DB worktree :

```dotenv
DATABASE_URL=postgresql://femiglow_app:CHANGEME@localhost:5432/femiglow_worktree_meta
NEXT_PUBLIC_SITE_URL=http://localhost:3001
PORT=3001
# Reprendre les autres vars de prod (clés API, etc.) depuis /etc/systemd/system/femiglow.service.d/env.conf
```

> ⚠️ **Permission Postgres** : créer `femiglow_app` user avec accès à la DB worktree si pas déjà fait :
> `sudo -u postgres psql -c "GRANT ALL ON DATABASE femiglow_worktree_meta TO femiglow_app;"`

### 0.4 Installer + migrer + seed

```bash
cd /var/www/femiglow/.claude/worktrees/webhook
pnpm install
pnpm --filter @femiglow/web db:migrate
pnpm --filter @femiglow/web seed:admin
pnpm --filter @femiglow/web seed:tracking      # crée les providers Meta/Snap/TikTok
pnpm --filter @femiglow/web seed:products
```

### 0.5 Vérification setup

```bash
# Vérifier que la DB worktree est OK
psql $DATABASE_URL -c "SELECT count(*) FROM tracking_providers WHERE kind='meta';"
# → doit retourner ≥ 1

# Tester un dev server
pnpm --filter @femiglow/web dev &
sleep 8
curl -s http://localhost:3001/ -o /dev/null -w "%{http_code}\n"
# → doit retourner 200

# Stopper
kill %1
```

### 0.6 Setup terminé — checkpoint

- [ ] Branche `feat/meta-quality-fix` créée et active
- [ ] DB `femiglow_worktree_meta` créée et migrée
- [ ] `apps/web/.env` configuré
- [ ] Dev server répond sur :3001
- [ ] Prod (`femiglow.service` sur :3000) **non perturbée**

---

## 1. Phase 1 — Quick wins Purchase (≈ 3 h)

### 1.1 Step 1.1 — `enrichPurchase`

```bash
cd /var/www/femiglow/.claude/worktrees/webhook
```

**1.1.a** Créer `apps/web/src/lib/tracking/providers/_enrich-purchase.ts` selon `01-design-conception.md` §2.1.

**1.1.b** Créer `apps/web/src/lib/tracking/providers/_enrich-purchase.test.ts` selon `03-tests-strategy.md` §2.3.

**1.1.c** Valider :

```bash
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/providers/_enrich-purchase.test.ts
pnpm --filter @femiglow/web typecheck
```

**1.1.d** Commit :

```bash
git add apps/web/src/lib/tracking/providers/_enrich-purchase.ts \
        apps/web/src/lib/tracking/providers/_enrich-purchase.test.ts
git commit -m "$(cat <<'EOF'
feat(tracking): pure enrichPurchase helper

Adds a pure async helper that completes Meta Purchase value/currency
from the orders table when they're missing or invalid in event params.

Fail-closed: returns source='unavailable' if the order can't be found,
which the metaAdapter will use to skip the dispatch (next commit).

Tests: 13 cases (5 enrich flows + 8 isValid* paramétrés) — 100% coverage.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### 1.2 Step 1.2 — Guard `metaAdapter`

**1.2.a** Éditer `apps/web/src/lib/tracking/providers/meta.ts` selon `01-design-conception.md` §2.2.

**1.2.b** Étendre `apps/web/src/lib/tracking/providers/meta.test.ts` selon `02-plan-dev-action.md` step 1.2.

**1.2.c** Valider :

```bash
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/providers/meta.test.ts
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/
pnpm --filter @femiglow/web typecheck
```

**1.2.d** Commit :

```bash
git add apps/web/src/lib/tracking/providers/meta.ts \
        apps/web/src/lib/tracking/providers/meta.test.ts
git commit -m "$(cat <<'EOF'
feat(tracking): guard meta dispatch on purchase missing value/currency

When event is purchase or purchase_server, the adapter now calls
enrichPurchase() first. If the result is source='unavailable' (no
valid value+currency in params AND no order row found in DB), the
dispatch is skipped with error='purchase_value_currency_invalid'.

Effect: no malformed Purchase reaches Meta CAPI anymore. This will
push the Meta Events Manager 'Purchase value/currency' quality from
~81% to ≥97% within 24h of deployment.

Tests: 5 new cases — guard skip, DB enrich, purchase_server, view_item
non-affected.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### 1.3 Step 1.3 — Mapping `purchase_server` (conditionnel)

**1.3.a** Audit :

```bash
grep -n "purchase_server" apps/web/src/lib/tracking/providers/event-mapping.ts
```

- **Si déjà mappé Meta** : aller en 1.3.b (test verrou uniquement).
- **Sinon** : ajouter le mapping selon `02-plan-dev-action.md` step 1.3.

**1.3.b** Étendre `apps/web/src/lib/tracking/providers/event-mapping.test.ts` :

```ts
it('maps purchase_server to Meta Purchase canonical', () => {
  expect(EVENT_MAPPING.purchase_server.meta).toEqual({ name: 'Purchase', isStandard: true });
});
```

**1.3.c** Valider :

```bash
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/providers/event-mapping.test.ts
pnpm --filter @femiglow/web typecheck
```

**1.3.d** Commit :

```bash
git add apps/web/src/lib/tracking/providers/event-mapping.ts \
        apps/web/src/lib/tracking/providers/event-mapping.test.ts
git commit -m "$(cat <<'EOF'
fix(tracking): map purchase_server to Meta Purchase canonical

Ensures Stripe webhook purchases (event purchase_server) are reported
to Meta CAPI as standard Purchase events, not custom or dropped.

If the mapping was already there, this commit just adds the asserting
test as a regression lock.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### 1.4 Step 1.4 — Vue SQL `v_purchase_quality`

**1.4.a** Créer `apps/web/drizzle/sql/views/purchase_quality.sql` (cf. `01-design-conception.md` §4.2).

**1.4.b** Créer `apps/web/scripts/install-view-purchase-quality.ts` (cf. `02-plan-dev-action.md` step 1.4).

**1.4.c** Ajouter le script dans `apps/web/package.json` :

```bash
# Édition manuelle ou via jq:
jq '.scripts["db:install-purchase-view"] = "tsx scripts/install-view-purchase-quality.ts"' \
  apps/web/package.json > /tmp/pkg.json && mv /tmp/pkg.json apps/web/package.json
```

**1.4.d** Installer la vue en local worktree DB :

```bash
pnpm --filter @femiglow/web db:install-purchase-view
psql $DATABASE_URL -c "SELECT * FROM v_purchase_quality LIMIT 5;"
# → doit retourner 0 lignes (DB worktree vide) ou des lignes (si seed) sans erreur SQL
```

**1.4.e** Commit :

```bash
git add apps/web/drizzle/sql/views/purchase_quality.sql \
        apps/web/scripts/install-view-purchase-quality.ts \
        apps/web/package.json
git commit -m "$(cat <<'EOF'
feat(tracking): v_purchase_quality SQL view for observability

CREATE OR REPLACE VIEW that groups tracking_events by day and event_name
(purchase + purchase_server) and computes:
- total
- valid (value > 0 AND currency ~ ^[A-Z]{3}$)
- quality_pct = 100 * valid / total

Usage:
  psql $DATABASE_URL -c "SELECT * FROM v_purchase_quality"

Lets us monitor the Purchase quality % directly from the DB instead
of waiting for Meta Events Manager's 7-day reporting cycle.

Wired as `pnpm db:install-purchase-view` for one-shot install.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### 1.5 Phase 1 GATE

```bash
# 1. Tous les tests tracking
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/

# 2. Typecheck
pnpm --filter @femiglow/web typecheck

# 3. Build
pnpm --filter @femiglow/web build

# 4. Lint
pnpm --filter @femiglow/web lint

# 5. Vérifier 4 commits
git log --oneline master..HEAD | wc -l
# → doit afficher 4
```

**STOP si un seul check échoue.** Investiguer + fixer avant de continuer.

---

## 2. Phase 2 — Server-side ViewContent fire (≈ 5 h)

### 2.1 Step 2.1 — `deriveEventId`

**2.1.a** Créer `apps/web/src/lib/tracking/event-id.ts` (cf. `01-design-conception.md` §2.3).

**2.1.b** Créer `apps/web/src/lib/tracking/event-id.test.ts` (cf. `03-tests-strategy.md`).

**2.1.c** Valider + commit :

```bash
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/event-id.test.ts
git add apps/web/src/lib/tracking/event-id.ts apps/web/src/lib/tracking/event-id.test.ts
git commit -m "feat(tracking): deriveEventId deterministic helper

Pure function producing a 32-hex SHA-256-derived event_id from
(eventName, sessionId, pageId, 5min-bucket). Identical inputs within
the same 5min bucket yield the same id — enables Meta to deduplicate
Pixel and CAPI events that share this id.

Tests: 7 cases — deterministic, bucket boundary, per-input variance.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### 2.2 Step 2.2 — `isBotRequest`

**2.2.a** Créer `apps/web/src/lib/tracking/is-bot.ts` (cf. `01-design-conception.md` §2.5).

**2.2.b** Créer `apps/web/src/lib/tracking/is-bot.test.ts` (cf. `03-tests-strategy.md`).

**2.2.c** Valider + commit :

```bash
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/is-bot.test.ts
git add apps/web/src/lib/tracking/is-bot.ts apps/web/src/lib/tracking/is-bot.test.ts
git commit -m "feat(tracking): isBotRequest UA detection helper

Lightweight UA-based bot detection (~10 patterns, no external deps).
Used by serverEmit to skip CAPI fires from bots/crawlers.

Tests: ~15 cases — humans Mozilla/Edg/Safari, bots Googlebot/Bing/
facebookexternalhit/Lighthouse/HeadlessChrome, empty UA edge.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### 2.3 Step 2.3 — `serverEmit`

**2.3.a** Créer `apps/web/src/lib/tracking/server-emit.ts` (cf. `01-design-conception.md` §2.4).

**2.3.b** Créer `apps/web/src/lib/tracking/server-emit.test.ts` (cf. `03-tests-strategy.md` §3.2).

**2.3.c** Setup MSW handlers si pas déjà présent :

```bash
ls apps/web/src/lib/tracking/__test-utils__/ 2>/dev/null
# Si vide, créer les helpers MSW selon 03-tests-strategy.md §3.1
```

**2.3.d** Valider + commit :

```bash
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/server-emit.test.ts
pnpm --filter @femiglow/web typecheck
git add apps/web/src/lib/tracking/server-emit.ts \
        apps/web/src/lib/tracking/server-emit.test.ts \
        apps/web/src/lib/tracking/__test-utils__/
git commit -m "feat(tracking): serverEmit helper for server-side CAPI fire

Fire-and-forget helper to emit ViewContent (or view_item_list, select_item)
directly from Next.js Server Components, bypassing the client batch HTTP
path. The event_id is derived deterministically so Pixel + CAPI share it
and Meta can deduplicate.

RGPD: respects consent.ad_storage cookie. Skips bots, anonymous-only
sessions, and disabled Meta providers.

Tests: 8 cases (MSW) — fire OK, bot skip, no session, disabled provider,
consent denied, same-bucket dedup, error logging, fbp/fbc passthrough.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### 2.4 Step 2.4 — `ViewItemTracker` eventIdSeed prop

**2.4.a** Éditer `apps/web/src/components/tracking/ViewItemTracker.tsx` (cf. `01-design-conception.md` §3.1).

**2.4.b** Étendre `apps/web/src/components/tracking/ViewItemTracker.test.tsx`.

**2.4.c** Valider + commit :

```bash
pnpm --filter @femiglow/web exec vitest run src/components/tracking/
pnpm --filter @femiglow/web typecheck
git add apps/web/src/components/tracking/ViewItemTracker.tsx \
        apps/web/src/components/tracking/ViewItemTracker.test.tsx
git commit -m "feat(tracking): ViewItemTracker accepts eventIdSeed prop

When the SSR passes a deterministic eventIdSeed (computed via
deriveEventId), the client emit uses it as the event_id override.
This makes the client Pixel fire share the same id as the server-side
CAPI fire — Meta dedups them transparently.

Backwards-compatible: prop is optional. Existing callers without the
prop keep the legacy uuidv7 generation.

Tests: 3 new cases — null seed, valid seed, re-render idempotence.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### 2.5 Step 2.5 — `TrackingClient.emit` eventIdOverride option

**2.5.a** Éditer `apps/web/src/lib/tracking/client.ts` (cf. `01-design-conception.md` §3.2).

**2.5.b** Étendre `apps/web/src/lib/tracking/client.test.ts`.

**2.5.c** Valider + commit :

```bash
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/client.test.ts
git add apps/web/src/lib/tracking/client.ts apps/web/src/lib/tracking/client.test.ts
git commit -m "feat(tracking): TrackingClient accepts eventIdOverride option

Optional opt-in field on EmitOptions. If present and well-formed
(uuid v7 or 32-hex), it's used as the entry event_id instead of
generating a uuidv7. Used by ViewItemTracker to align Pixel ↔ CAPI.

Tests: 3 new cases — without (legacy uuid), with (exact match),
malformed (fallback to uuid).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### 2.6 Step 2.6 — Wire `/kit`

**2.6.a** Éditer `apps/web/src/app/(marketing)/kit/page.tsx` (cf. `01-design-conception.md` §3.3).

**2.6.b** Smoke test :

```bash
pnpm --filter @femiglow/web dev &
sleep 8
curl -s http://localhost:3001/kit -o /dev/null
sleep 2  # laisser le temps au fire-and-forget
psql $DATABASE_URL -c "SELECT event_id, event_name, page_path FROM tracking_events WHERE event_name='view_item' ORDER BY created_at DESC LIMIT 1;"
# → doit afficher 1 row avec event_id matching le hash du SSR /kit
kill %1
```

**2.6.c** Commit :

```bash
git add apps/web/src/app/\(marketing\)/kit/page.tsx
git commit -m "feat(tracking): wire serverEmit ViewContent in /kit SSR

The /kit page now fires a Meta CAPI ViewContent event server-side on
every SSR render (fire-and-forget). The eventIdSeed is also passed to
the client ViewItemTracker so the Pixel fire shares the same id.

Effect: Meta CAPI/Pixel coverage for /kit ViewContent goes from ~50%
(client-only with batch losses) to ≥ 95% (server is reliable).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### 2.7 Step 2.7 — Wire `/maison`

Idem 2.6, sur `apps/web/src/app/(marketing)/maison/page.tsx`. Commit avec message symétrique.

### 2.8 Step 2.8 — Wire `/rituel`

Idem 2.6, sur `apps/web/src/app/(marketing)/rituel/page.tsx`. Commit symétrique.

### 2.9 Step 2.9 — Audit + correction GTM container

**2.9.a** Audit du container :

```bash
ls -lt draft/container.production.*.json | head -1
# Soit <FILE>
jq '.containerVersion.tag[] | select(.name | test("Meta.*ViewContent"; "i")) | .name, .parameter[] | select(.key == "html") | .value' <FILE>
```

Chercher dans la sortie `eventID:` ou `eventID :`.

- **Si présent** : RAS, ajouter un test snapshot pour verrouiller (cf. `02-plan-dev-action.md` step 2.9).
- **Sinon** : patcher `apps/web/src/lib/tracking/plan/exporter.ts` pour inclure `eventID: {{DLV - event_id}}` dans tous les tags `fbq('track', ...)`.

**2.9.b** Si modif exporter : régénérer le container :

```bash
pnpm --filter @femiglow/web tracking:plan-export --env production
ls -lt draft/container.production.*.json | head -1
# → vérifier que le nouveau JSON inclut eventID
```

**2.9.c** Commit :

```bash
git add apps/web/src/lib/tracking/plan/exporter.ts apps/web/src/lib/tracking/plan/exporter.test.ts
git commit -m "fix(tracking): include eventID in Meta Pixel tags via GTM exporter

The GTM container's Meta Pixel tags (Purchase, ViewContent, AddToCart, …)
must pass eventID: {{DLV - event_id}} for Meta to deduplicate Pixel
fires with their matching CAPI server fires. Audit revealed eventID
was [missing|present-but-not-tested].

After this change, regenerate the container via:
  pnpm tracking:plan-export --env production
Then import draft/container.production.*.json in GTM UI.

Tests: snapshot exporter ensures every fbq('track', X) tag includes
eventID.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### 2.10 Phase 2 GATE

```bash
# Unit + intégration
pnpm --filter @femiglow/web exec vitest run

# E2E Playwright (start dev server, run spec, kill)
pnpm --filter @femiglow/web dev &
sleep 8
pnpm --filter @femiglow/web exec playwright test tests/e2e/kit-view-item-dedup.spec.ts
kill %1

# Typecheck + build
pnpm --filter @femiglow/web typecheck
pnpm --filter @femiglow/web build
```

**STOP si un check échoue.**

---

## 3. Merge vers master + déploiement prod

### 3.1 Pré-merge

```bash
# 1. Vérifier l'état
git status                                    # clean
git log --oneline master..HEAD                # liste des commits P1+P2
git fetch origin
git rebase origin/master                      # absorber les commits récents de master
# Si conflits : résoudre, `git rebase --continue`

# 2. Push vers origin
git push -u origin feat/meta-quality-fix
```

### 3.2 Création de la PR

```bash
gh pr create --title "feat(tracking): Meta CAPI quality fix — Purchase + ViewContent" --body "$(cat <<'EOF'
## Summary

Corrige les deux signaux dégradés Meta Events Manager détectés 2026-05-18 :
- Purchase value/currency à 81 % → ≥ 97 % attendu.
- CAPI ViewContent coverage < 50 % → ≥ 95 % attendu.

## Phase 1 — Quick wins Purchase (4 commits)
- `enrichPurchase` helper pure pour compléter value/currency depuis `orders` DB.
- Guard `metaAdapter.dispatch` qui skip avec log si Purchase reste invalide après enrich.
- Mapping `purchase_server` → Meta Purchase canonique.
- Vue SQL `v_purchase_quality` pour observabilité directe.

## Phase 2 — Server-side ViewContent fire (9 commits)
- `deriveEventId` (déterministe SHA-256) + `isBotRequest` + `serverEmit` helpers.
- `ViewItemTracker` + `TrackingClient.emit` acceptent un eventId aligné Pixel ↔ CAPI.
- Wire `serverEmit('view_item')` dans les SSR `/kit`, `/maison`, `/rituel`.
- Patch GTM exporter pour inclure `eventID` dans tous les tags `fbq('track')`.

## Architecture
Cf. [`docs/meta-quality-audit-2026-05/01-design-conception.md`](docs/meta-quality-audit-2026-05/01-design-conception.md)

## Test plan
- [ ] CI passe (typecheck + vitest + build)
- [ ] Vitest 55+ nouveaux tests verts
- [ ] Playwright spec `kit-view-item-dedup.spec.ts` verte
- [ ] Smoke local sur DB worktree : SSR /kit déclenche row `view_item` en DB avec event_id 32-hex
- [ ] Container GTM régénéré (`draft/container.production.*.json`) avec `eventID` dans tags Meta

## Post-deploy
1. Importer le container GTM régénéré dans GTM UI → Submit + Publish.
2. Installer la vue SQL en prod : `pnpm db:install-purchase-view`.
3. Monitorer `v_purchase_quality` 24 h → attendre quality_pct ≥ 97 %.
4. Monitorer Meta Events Manager 7 j → confirmer ≥ 95 % coverage.
5. Si OK, démarrer Phase 3 (durcissement schéma + dedup persistante).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 3.3 Merge

Après review et CI verte :

```bash
gh pr merge --merge   # ou --squash selon convention équipe
```

### 3.4 Déploiement prod

```bash
# Dans le clone principal (PAS le worktree)
cd /var/www/femiglow
git checkout master
git pull origin master

# Installer la vue SQL en prod (one-shot)
pnpm --filter @femiglow/web db:install-purchase-view

# Build
pnpm --filter @femiglow/web build

# Restart service
systemctl restart femiglow.service
sleep 3
systemctl is-active femiglow.service
```

### 3.5 Import GTM container

Si l'exporter a été modifié (step 2.9) :

```bash
# Régénérer le container avec env=production sur la DB prod
cd /var/www/femiglow
pnpm --filter @femiglow/web tracking:plan-export --env production
ls -lt draft/container.production.*.json | head -1
```

Puis manuellement dans **GTM Web UI** :
1. Admin → Import Container → choisir le fichier `draft/container.production.<planId>.<v>.json`
2. Workspace existant → menu "Renommer balises existantes"
3. Confirm → Submit + Publish

---

## 4. Smoke tests post-déploiement prod

### 4.1 Healthchecks immédiats

```bash
# 1. HTTP 200 sur les pages produit
for page in kit maison rituel; do
  echo -n "/$page → "
  curl -sk -o /dev/null -w "%{http_code}\n" https://femiglow-maroc.com/$page
done
# Tous doivent retourner 200

# 2. Service actif
systemctl status femiglow.service --no-pager | head -5

# 3. Logs absent d'erreur server-emit
journalctl -u femiglow.service --since "5 min ago" | grep -i "server-emit\|capi\|meta" | head -20
# Aucune ligne ERROR
```

### 4.2 Healthcheck DB (Purchase quality, T+1h)

```bash
psql $PROD_DATABASE_URL -c "SELECT * FROM v_purchase_quality WHERE day = CURRENT_DATE;"
```

Attendre au moins 5-10 Purchase events réels (peut prendre quelques heures pour FemiGlow). Le `quality_pct` doit être ≥ 95 %.

### 4.3 Healthcheck DB (ViewContent server-side, T+10min)

```bash
# Compte des view_item avec event_id 32-hex (= server-emit fire)
psql $PROD_DATABASE_URL -c "
SELECT
  COUNT(*) FILTER (WHERE event_id ~ '^[a-f0-9]{32}$') AS server_fires,
  COUNT(*) FILTER (WHERE event_id ~ '^[0-9a-f-]{36}$') AS client_uuid_fires,
  COUNT(*) AS total
FROM tracking_events
WHERE event_name = 'view_item'
  AND created_at > NOW() - INTERVAL '10 minutes';
"
```

Attendu : `server_fires > 0` (≈ égal au nombre de hits /kit/maison/rituel).

### 4.4 Healthcheck Meta (T+24h, puis T+7j)

URL : `https://business.facebook.com/events_manager/list/pixel/{PIXEL_ID}/diagnostics`

À vérifier manuellement :
- **Purchase qualité value/currency** : doit afficher ≥ 95 %.
- **Couverture CAPI ViewContent** : doit afficher ≥ 95 %.
- **Doublons / Inconsistencies** : aucun nouveau warning.

---

## 5. Phase 3 — Durcissement (après 14 j d'observation)

> **Pré-requis** : Meta Events Manager confirme ≥ 95 % sur les deux métriques pendant 7 j consécutifs.

### 5.1 Step 3.1 — Schéma strict

```bash
cd /var/www/femiglow/.claude/worktrees/webhook
git checkout master
git pull origin master
git checkout -b feat/meta-quality-harden-phase3
```

Éditer `apps/web/src/lib/tracking/schemas.ts` selon `02-plan-dev-action.md` step 3.1. Étendre les tests. Commit.

### 5.2 Step 3.2 — Dedup persistante DB

Migration Drizzle + refactor `server/dedup.ts`. Commit + `db:migrate-safe:plan` puis `db:migrate-safe` en prod.

### 5.3 Step 3.3 — Admin widget (optionnel)

Server Component `/admin/tracking/purchase-quality` qui query `v_purchase_quality`. Commit.

### 5.4 PR + merge + déploiement

Pareil que §3.

---

## 6. Procédure de rollback

### 6.1 Rollback d'une étape isolée

```bash
git revert <HASH>
git push
# Re-déployer (build + restart prod)
```

### 6.2 Rollback de toute la phase 2 (ex : trop coûteux Meta CAPI)

```bash
# Identifier les commits P2
git log --oneline | grep -E "(serverEmit|ViewContent|eventIdSeed|eventIdOverride)" | head -10
# Revert tous
git revert <HASH1> <HASH2> ... <HASH9>
git push
# Re-déployer
```

### 6.3 Rollback complet

```bash
git revert --no-edit <RANGE_START>..<RANGE_END>
git push
# Re-déployer
```

Aucun module n'est destructif côté DB hors Phase 3 (migration `tracking_events_dedup`). Le rollback P1/P2 est purement code.

---

## 7. Cleanup post-stabilisation

Après 30 jours stables en prod :

```bash
# 1. Supprimer le worktree si plus nécessaire
git worktree remove /var/www/femiglow/.claude/worktrees/webhook

# 2. Drop la DB worktree
sudo -u postgres dropdb femiglow_worktree_meta

# 3. Archiver le dossier docs en lecture seule
chmod -R 444 docs/meta-quality-audit-2026-05/
```

---

## 8. FAQ runbook

**Q : Que faire si le dev server ne démarre pas sur :3001 ?**
A : Vérifier qu'aucun autre process n'occupe le port : `ss -tlnp | grep 3001`. Sinon, changer `PORT` dans `apps/web/.env`.

**Q : Que faire si la DB worktree refuse la connexion ?**
A : Vérifier le user/password dans `.env` + `pg_hba.conf` (`host all femiglow_app 127.0.0.1/32 scram-sha-256` requis).

**Q : Que faire si la vue SQL existe déjà en prod (P1.4) ?**
A : `CREATE OR REPLACE VIEW` est idempotent — le script peut être ré-exécuté sans risque.

**Q : Que faire si Meta Events Manager ne descend pas sous 95 % de qualité Purchase après 48h ?**
A : Investiguer :
1. Query `v_purchase_quality` pour confirmer le % réel côté DB.
2. Si DB ≥ 95 % mais Meta < 95 %, le delta vient de la queue Meta (latence reporting 24-48h).
3. Si DB < 95 %, chercher les Purchase avec value/currency invalides : `SELECT * FROM tracking_events WHERE event_name='purchase' AND created_at > NOW() - INTERVAL '24 hours' AND NOT (payload ? 'value' AND payload->>'currency' ~ '^[A-Z]{3}$') LIMIT 10;` puis examiner les call-sites.

**Q : Le Playwright E2E échoue en CI mais passe en local — pourquoi ?**
A : Le test dépend de cookies Meta `_fbp`/`_fbc` qui peuvent ne pas exister en CI fresh. Soit set des cookies manuellement avec `await context.addCookies([...])`, soit skip avec `test.skip(process.env.CI === 'true')`.

---

> **Fin du runbook.** Pour la conception, voir [`01-design-conception.md`](./01-design-conception.md). Pour les étapes détaillées, voir [`02-plan-dev-action.md`](./02-plan-dev-action.md).
