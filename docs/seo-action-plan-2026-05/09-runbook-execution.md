# 09 — Runbook d'exécution

Runbook opérationnel pour exécuter le plan d'action de bout en bout. Commandes, validations, rollback, et critères pour passer à la phase suivante.

## 0. Pré-requis

### 0.1 Environnement local

```bash
# Charger Node 20 (le projet requiert ≥ 18.12, on utilise 20 pour cohérence CI)
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20

cd /Users/elazhar/PycharmProjects/template-femiglow
pnpm install --frozen-lockfile
```

### 0.2 Variables d'environnement

Confirmer dans `.env.local` :

```
NEXT_PUBLIC_SITE_URL=https://femiglow.ma
DATABASE_URL=postgresql://...
# Feature flags (à ajouter, default false)
NEXT_PUBLIC_SEO_OG_DYNAMIC=false
NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES=false
NEXT_PUBLIC_SEO_DEBUG=false
```

### 0.3 Branche de travail

```bash
git checkout main
git pull --ff-only origin main
git checkout -b seo-action-plan-2026-05
```

Branches dédiées par phase (option recommandée si revues PR) :

```bash
git checkout -b seo/phase-0-hot-patches
# ... travail ...
# fin de phase : merge dans seo-action-plan-2026-05 ou main selon flow
```

### 0.4 Vérification de l'état initial

```bash
cd apps/web
pnpm typecheck                # doit passer (sauf erreurs pré-existantes documentées)
pnpm lint                     # doit passer
pnpm vitest run --reporter=dot # baseline tests
```

Noter dans un fichier `phase-baseline.txt` le nombre de tests passants / échouant pour comparaison à la fin du plan.

---

## Phase 0 — Hot patches

### Étape 0.1 — Créer la branche

```bash
git checkout -b seo/phase-0-hot-patches
```

### Étape 0.2 — Écrire les tests Vitest

Créer `apps/web/src/components/admin/seo/BulkDeleteConfirmDialog.test.tsx`, `apps/web/src/app/(commerce)/commander/page.test.ts`, `apps/web/src/app/(commerce)/merci/page.test.ts` selon `07-tests-strategy.md` §4.1.

```bash
pnpm vitest run BulkDeleteConfirmDialog
pnpm vitest run apps/web/src/app/\(commerce\)/commander/page.test.ts
pnpm vitest run apps/web/src/app/\(commerce\)/merci/page.test.ts
```

Tests **doivent échouer** (TDD red phase).

### Étape 0.3 — Implémenter

Créer `BulkDeleteConfirmDialog.tsx`, modifier `SeoBulkActionBar.tsx`, ajouter `metadata` dans `commander/page.tsx` et `merci/page.tsx`.

### Étape 0.4 — Valider

```bash
pnpm typecheck
pnpm lint
pnpm vitest run                       # full
pnpm playwright test --grep '@seo'    # E2E si tests Playwright existent déjà
```

Tous verts.

### Étape 0.5 — Smoke test manuel

```bash
pnpm --filter web build
pnpm --filter web start &
SERVER_PID=$!

# Tester /commander
curl -s http://localhost:3000/commander | grep -i '<title>'
curl -s http://localhost:3000/commander | grep -i 'robots'

# Tester /merci
curl -s http://localhost:3000/merci | grep -i '<title>'

kill $SERVER_PID
```

Title doit contenir « Commander — FemiGlow » et « Merci pour votre commande — FemiGlow » respectivement. Meta robots doit contenir `noindex`.

### Étape 0.6 — Commit + PR

```bash
git add -A
git status                   # vérifier les fichiers
git commit -m "$(cat <<'EOF'
feat(seo): hot patches P0 — explicit metadata for /commander /merci, confirm dialog for bulk delete

- Avoid duplicate metadata inheritance from root layout on commerce funnel pages
- Add BulkDeleteConfirmDialog requiring exact count match before destructive op
- Tests: 3 new Vitest specs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"

git push -u origin seo/phase-0-hot-patches
gh pr create --title "feat(seo): hot patches P0" --body "$(cat <<'EOF'
## Summary

- Add explicit metadata to `/commander` and `/merci` to avoid inheriting from root layout
- Add confirmation dialog to bulk delete in SEO admin

## Test plan

- [x] Vitest passes locally
- [x] Manual smoke: title and robots correct on /commander and /merci
- [ ] Reviewer to verify in preview deployment

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Étape 0.7 — Rollback

```bash
git revert <commit-sha>
# Aucune migration DB, aucune feature flag — rollback simple
```

---

## Phase 1 — Sitemap freshness

### Étape 1.1 — Branche

```bash
git checkout main && git pull --ff-only
git checkout -b seo/phase-1-sitemap-freshness
```

### Étape 1.2 — Tests d'abord

Étendre `apps/web/src/app/sitemap.test.ts` avec les 2 nouveaux cas. Lancer :

```bash
pnpm vitest run apps/web/src/app/sitemap.test.ts
```

Tests rouges.

### Étape 1.3 — Implémenter

1. Modifier `next.config.js` pour exposer `NEXT_PUBLIC_BUILD_DATE`.
2. Refactor `sitemap.ts`.
3. Vérifier que `getPublishedArticles` retourne `updatedAt` (sinon étendre).

### Étape 1.4 — Valider

```bash
pnpm typecheck
pnpm vitest run sitemap
pnpm --filter web build
pnpm --filter web start &
curl -s http://localhost:3000/sitemap.xml | head -50
kill %1
```

Vérifier visuellement que `<lastmod>` reflète des dates raisonnables.

### Étape 1.5 — Commit

```bash
git commit -am "$(cat <<'EOF'
feat(seo): use article.updatedAt and build date for sitemap lastModified

- Static routes lastModified now derives from NEXT_PUBLIC_BUILD_DATE (set at build)
- Article routes lastModified uses article.updatedAt from CMS
- Legal pages use page.updatedAt
- Avoids spurious "all routes updated" signal on every deploy

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Étape 1.6 — Rollback

```bash
git revert <commit-sha>
# Rebuild requis pour reprendre l'ancien sitemap
```

---

## Phase 2 — Media picker OG

### Étape 2.1 — Branche

```bash
git checkout main && git pull --ff-only
git checkout -b seo/phase-2-og-image-picker
```

### Étape 2.2 — Reconnaissance du composant MediaPickerDialog existant

```bash
grep -r "MediaPicker" apps/web/src/components/admin/ -l
grep -r "MediaLibrary" apps/web/src/components/admin/ -l
```

Si dialog existe, l'identifier ; sinon extraction nécessaire (allonge la phase).

### Étape 2.3 — Tests d'abord

`OgImagePicker.test.tsx` avec ≥ 8 cas. Lancer :

```bash
pnpm vitest run OgImagePicker
```

### Étape 2.4 — Implémenter

`OgImagePicker.tsx`, intégration `SeoOverrideEditor.tsx` et `SeoSettingsEditor.tsx`.

### Étape 2.5 — Valider

```bash
pnpm typecheck
pnpm vitest run
pnpm playwright test apps/web/e2e/admin/seo-og-image-picker.spec.ts
```

### Étape 2.6 — Smoke test manuel

```bash
pnpm --filter web dev
# Ouvrir http://localhost:3000/admin/seo/new
# Tester les 3 modes du picker
# Vérifier que le preview Facebook se met à jour
```

### Étape 2.7 — Commit

```bash
git commit -am "$(cat <<'EOF'
feat(seo-admin): OG image picker with media library and template fallback

- New OgImagePicker component with 3 modes (none / media / template)
- Integrated into SeoOverrideEditor and SeoSettingsEditor
- Template mode hidden behind NEXT_PUBLIC_SEO_OG_DYNAMIC flag (default off)
- A11y: radio group, focus management, axe-clean

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Étape 2.8 — Rollback

```bash
git revert <commit-sha>
```

---

## Phase 3 — Audit log panel

### Étape 3.1 — Branche

```bash
git checkout main && git pull --ff-only
git checkout -b seo/phase-3-audit-log
```

### Étape 3.2 — Tests d'abord

`SeoAuditLogPanel.test.tsx`, `listAuditEventsForSeo.test.ts`.

### Étape 3.3 — Implémenter

Étendre `lib/db/queries/seo.ts`, créer route API, créer composant et page.

### Étape 3.4 — Valider

```bash
pnpm typecheck
pnpm vitest run audit-log
pnpm --filter web dev
# Naviguer vers /admin/seo/audit-log
# Effectuer une publication SEO depuis un autre onglet
# Vérifier que l'event apparaît dans le panel après recharge
```

### Étape 3.5 — Commit

```bash
git commit -am "$(cat <<'EOF'
feat(seo-admin): audit log panel listing recent SEO actions

- New /admin/seo/audit-log page with cursor pagination
- Filters by action and actor
- Lists events from auditEvents table scoped to SEO resource type

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Étape 3.6 — Rollback

```bash
git revert <commit-sha>
```

---

## Phase 4 — OG image dynamique

### Étape 4.1 — Branche

```bash
git checkout main && git pull --ff-only
git checkout -b seo/phase-4-og-dynamic
```

### Étape 4.2 — Dépendance

Vérifier que `next/og` est disponible (inclus dans Next 14). Sinon `pnpm add @vercel/og` au niveau `apps/web`.

### Étape 4.3 — Tests d'abord

`og-image.schemas.test.ts`, `og-image-resolver.test.ts`, `ogImageGenerator.test.ts`.

### Étape 4.4 — Implémenter

Schemas, resolver, templates JSX, route handler edge.

### Étape 4.5 — Activer le flag en staging

```bash
# Sur l'environnement staging (Vercel ou autre)
NEXT_PUBLIC_SEO_OG_DYNAMIC=true
# Redéployer
```

### Étape 4.6 — Valider

```bash
# Local
pnpm typecheck
pnpm vitest run og-image
pnpm --filter web build
pnpm --filter web start &
curl -I "http://localhost:3000/api/og/product?title=Le%20Kit&theme=sauge&v=2026-05"
# Status 200, content-type image/png
curl -s "http://localhost:3000/api/og/product?title=Le%20Kit" > /tmp/og.png
file /tmp/og.png  # doit dire PNG image data, 1200 x 630

# E2E
pnpm playwright test apps/web/e2e/og/dynamic-og.spec.ts
```

Mesure latence :

```bash
# 10 fois pour P95 approximatif
for i in {1..10}; do
  time curl -s -o /dev/null "http://localhost:3000/api/og/product?title=Test$i"
done
```

### Étape 4.7 — Validation Open Graph Debugger

Une fois déployé en staging :

```
https://developers.facebook.com/tools/debug/
-> Saisir https://staging.femiglow.ma/kit
-> Vérifier que l'image OG résout correctement
```

### Étape 4.8 — Commit

```bash
git commit -am "$(cat <<'EOF'
feat(seo): dynamic OG image generation with 4 templates (marketing/article/product/default)

- New /api/og/[template] route handler (edge runtime, @vercel/og)
- ImageResponse 1200x630 PNG with FemiGlow palette and typography
- Cache-Control: public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000
- Behind NEXT_PUBLIC_SEO_OG_DYNAMIC flag (off in prod until validation)
- Zod schema og-image.schemas.ts validates query params

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Étape 4.9 — Activer en prod

Après validation 24-48 h en staging :

```bash
# Vercel ou autre : promouvoir NEXT_PUBLIC_SEO_OG_DYNAMIC=true en prod
# Redéployer prod
# Smoke test Open Graph Debugger sur https://femiglow.ma/kit
```

### Étape 4.10 — Rollback

```bash
# Option 1 : flag off (immédiat)
NEXT_PUBLIC_SEO_OG_DYNAMIC=false
# Redéployer

# Option 2 : revert code
git revert <commit-sha>
```

---

## Phase 5 — Scope component branché

### Étape 5.1 — Branche

```bash
git checkout main && git pull --ff-only
git checkout -b seo/phase-5-component-scope
```

### Étape 5.2 — Snapshot baseline

Capturer le metadata `/kit` actuel pour snapshot test :

```bash
pnpm --filter web build
pnpm --filter web start &
curl -s http://localhost:3000/kit > /tmp/kit-before.html
grep -E '<title>|name="description"|property="og:|canonical' /tmp/kit-before.html > /tmp/kit-meta-before.txt
kill %1
```

### Étape 5.3 — Tests d'abord

`component-resolve.test.ts`, snapshot `__snapshots__/kit-metadata.snap`, `getActiveComponentOverrides.test.ts`.

### Étape 5.4 — Implémenter

`lib/seo/cache.ts`, `lib/seo/component-resolve.ts`, batch fetch, modifier `app/kit/page.tsx`, étendre publish route.

### Étape 5.5 — Validation flag OFF (zéro régression)

Avec `NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES=false`, rebuild et compare :

```bash
pnpm --filter web build
pnpm --filter web start &
curl -s http://localhost:3000/kit > /tmp/kit-after.html
grep -E '<title>|name="description"|property="og:|canonical' /tmp/kit-after.html > /tmp/kit-meta-after.txt
diff /tmp/kit-meta-before.txt /tmp/kit-meta-after.txt
# DOIT être vide (zéro diff)
kill %1
```

### Étape 5.6 — Validation flag ON avec override

```bash
# Activer flag en local
echo 'NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES=true' >> .env.local

# Créer un override composant via API (auth admin requise — utiliser fixture)
curl -X POST http://localhost:3000/api/admin/seo \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <admin-session>' \
  -d '{
    "scope": "component",
    "targetKey": "kit-hero",
    "locale": "fr-MA",
    "title": "Test override composant",
    "robotsIndex": true,
    "robotsFollow": true
  }'

# Publier
curl -X POST http://localhost:3000/api/admin/seo/<id>/publish \
  -H 'Cookie: <admin-session>'

# Vérifier
curl -s http://localhost:3000/kit | grep -E '<title>'
# Doit afficher "Test override composant"

# Cleanup
curl -X DELETE http://localhost:3000/api/admin/seo/<id> -H 'Cookie: <admin-session>'
```

### Étape 5.7 — E2E

```bash
pnpm playwright test apps/web/e2e/seo/kit-component-override.spec.ts
```

### Étape 5.8 — Commit

```bash
git commit -am "$(cat <<'EOF'
feat(seo): wire component scope to page metadata resolution

- New resolvePageWithComponents() merges page + component overrides
- /kit generateMetadata uses new resolver (behind flag)
- Component override publish triggers parent page revalidateTag
- Batch fetch via getActiveComponentOverrides (no N+1)
- Snapshot test guarantees zero regression when flag is off

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Étape 5.9 — Rollback

```bash
# Désactiver flag (immédiat)
NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES=false

# Ou revert
git revert <commit-sha>
```

---

## Phase 6 — Backlog (à exécuter à la demande)

Suivre le même pattern : branche dédiée, tests d'abord, implémentation, validation, commit avec message clair.

---

## Validation cross-phases (avant merge final sur main)

```bash
# Sur la branche finale agrégée seo-action-plan-2026-05 (si flow squash)
git checkout main && git pull --ff-only
git checkout seo-action-plan-2026-05
git rebase main

# Tests complets
pnpm typecheck
pnpm lint
pnpm vitest run --coverage
# Vérifier couverture >= 90% sur lib/seo/** et components/admin/seo/**
pnpm playwright test --grep '@seo'

# Build prod
pnpm --filter web build

# Comparer le baseline
pnpm vitest run --reporter=dot 2>&1 | tee phase-final.txt
diff phase-baseline.txt phase-final.txt
```

## Post-déploiement prod

### Smoke tests prod

```bash
# Pages critiques
for path in / /kit /rituel /journal /maison /contact /commander /merci; do
  echo "=== $path ==="
  curl -s "https://femiglow.ma$path" | grep -E '<title>|name="description"|property="og:image"|canonical' | head -5
done

# Sitemap
curl -s "https://femiglow.ma/sitemap.xml" | head -30

# Robots
curl -s "https://femiglow.ma/robots.txt"

# OG image dynamique (si phase 4 activée)
curl -I "https://femiglow.ma/api/og/product?title=Le%20Kit&v=2026-05"
```

### Validation outils externes

- Google Rich Results Test : https://search.google.com/test/rich-results
  - Tester `/kit`, `/journal/<dernier-article>`, `/maison`, `/contact`.
- Facebook OG Debugger : https://developers.facebook.com/tools/debug/
  - Tester `/`, `/kit`, `/journal/<article>`.
- Twitter Card Validator : https://cards-dev.twitter.com/validator (si encore actif).
- Google Search Console : soumettre nouveau sitemap, monitorer indexation 7 j.

### Monitoring 24-48 h

- Pas d'erreurs 5xx sur `/api/admin/seo/*` (vérifier logs).
- Pas d'erreurs 5xx sur `/api/og/*` si phase 4 active.
- Latence P95 conformes aux cibles `02-vision-objectifs.md` §2.

## Rollback global du plan

Si problème majeur post-merge :

```bash
# Désactiver tous les flags
NEXT_PUBLIC_SEO_OG_DYNAMIC=false
NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES=false
# Redéployer

# Si insuffisant : revert chaque phase dans l'ordre inverse
git revert <phase-5-sha>
git revert <phase-4-sha>
git revert <phase-3-sha>
git revert <phase-2-sha>
git revert <phase-1-sha>
git revert <phase-0-sha>
git push origin main
```

Les phases 0-3 n'ont aucun feature flag : leur rollback est uniquement par `git revert`.

## Aide-mémoire commandes

| Action | Commande |
|---|---|
| Lancer un test ciblé | `pnpm vitest run <pattern>` |
| Lancer Playwright SEO | `pnpm playwright test --grep '@seo'` |
| Type check | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Build prod | `pnpm --filter web build` |
| Dev server | `pnpm --filter web dev` |
| Coverage | `pnpm vitest run --coverage` |
| Debug SEO route | `curl http://localhost:3000/api/_debug/seo?route=/kit` |
| Inspect sitemap | `curl http://localhost:3000/sitemap.xml \| head -50` |
| Inspect robots | `curl http://localhost:3000/robots.txt` |
