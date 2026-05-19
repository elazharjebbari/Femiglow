# 06 — Runbook (exécution opérationnelle)

> Commandes exactes, vérifications, rollback. À garder ouvert pendant l'exécution. **Tout ce qu'on tape vit dans ce fichier.**

---

## 1. Pré-requis machine

| Outil | Version | Vérification |
|---|---|---|
| Node.js | ≥ 20 | `node -v` |
| pnpm | ≥ 9 | `pnpm -v` |
| PostgreSQL | ≥ 14 | `psql --version` |
| tsx | (via pnpm) | `pnpm dlx tsx --version` |
| git | ≥ 2.30 | `git --version` |

Variables d'environnement (héritées de `apps/web/.env` local) :
- `DATABASE_URL=postgresql://elazhar@localhost:5432/femiglow`
- `AUTO_SEED=1` (pour les scripts de seed)

---

## 2. Vue rapide des commandes (cheat sheet)

```bash
# Toutes les commandes ci-dessous se lancent depuis :
#   /Users/elazhar/PycharmProjects/template-femiglow

# Working set typique :
pnpm install                                    # 1 fois
pnpm --filter @femiglow/web dev                 # serveur local sur :3001
pnpm --filter @femiglow/web typecheck           # type-check TS
pnpm --filter @femiglow/web lint                # ESLint
pnpm --filter @femiglow/web test --run          # vitest (single run)
pnpm --filter @femiglow/web test:coverage       # avec coverage
pnpm --filter @femiglow/web test:e2e            # playwright

# Migrations & seed :
pnpm --filter @femiglow/web migrate             # _migrate-safe.mjs custom
pnpm --filter @femiglow/web seed:components     # composants registry → DB
pnpm --filter @femiglow/web seed:components-fields  # field bindings → DB
pnpm --filter @femiglow/web seed:reviews-photos # photos clientes (nouveau)

# DB direct :
psql $DATABASE_URL -c "<query>"
```

---

## 3. Pre-flight (à exécuter avant Phase 1)

```bash
# 3.1 Branche propre
git status
# Attendu : working tree clean (sinon stash)

git fetch origin
git checkout master
git pull --ff-only

# 3.2 Dependencies
pnpm install
# Attendu : "Done"

# 3.3 Dev server up
pnpm --filter @femiglow/web dev
# Attendu : "ready - started server on 0.0.0.0:3001"
# Ouvrir http://localhost:3001/kit dans le browser

# 3.4 DB reachable
psql $DATABASE_URL -c "SELECT 1"
# Attendu : "(1 row)"

# 3.5 État actuel du composant kit-hero-produit
psql $DATABASE_URL -c "
  SELECT key, name, status
  FROM site_components
  WHERE key = 'kit-hero-produit';"
# Attendu : 1 row, status='active'

# 3.6 État actuel des bindings
psql $DATABASE_URL -c "
  SELECT cfb.field_key, cfb.status, substring(cfb.value::text, 1, 80) AS sample
  FROM component_field_bindings cfb
  JOIN site_components sc ON sc.id = cfb.component_id
  WHERE sc.key = 'kit-hero-produit';"
# Attendu : 0 ou N rows selon état seed
```

### Captures `before-*`

```bash
# 3.7 Démarrer dev si pas déjà fait
# Ouvrir DevTools → toggle device → 375 × 812 → /kit
# Capturer la fenêtre → enregistrer sous :
#   docs/kit-hero-optim/captures/before-mobile.png

# 3.8 Idem desktop 1280 × 800 :
#   docs/kit-hero-optim/captures/before-desktop.png

# Vérification :
ls -la docs/kit-hero-optim/captures/
```

### Backup DB

```bash
# 3.9 Backup des bindings actuels (au cas où)
psql $DATABASE_URL -c "
  COPY (
    SELECT cfb.*
    FROM component_field_bindings cfb
    JOIN site_components sc ON sc.id = cfb.component_id
    WHERE sc.key = 'kit-hero-produit'
  ) TO STDOUT WITH CSV HEADER
" > docs/kit-hero-optim/captures/backup-bindings-$(date +%Y%m%d).csv

ls -la docs/kit-hero-optim/captures/backup-bindings-*.csv
```

---

## 4. Exécution phase par phase

### Phase 1 — Seed registry & description

```bash
# 4.1 Modifier registry.ts (suivre 02-architecture.md §2.1)
# Éditeur : vim/vscode sur apps/web/src/lib/components/registry.ts

# 4.2 Type-check
pnpm --filter @femiglow/web typecheck
# Attendu : "Found 0 errors"

# 4.3 Re-seed composants
pnpm --filter @femiglow/web seed:components
# Attendu : "Upserted N components"

# 4.4 Re-seed bindings (force pour récupérer les nouveaux fields)
pnpm --filter @femiglow/web seed:components-fields
# Attendu : "Seeded M field bindings (X new, Y unchanged)"

# 4.5 Vérification SQL
psql $DATABASE_URL -c "
  SELECT cfb.field_key, cfb.status
  FROM component_field_bindings cfb
  JOIN site_components sc ON sc.id = cfb.component_id
  WHERE sc.key = 'kit-hero-produit'
  ORDER BY cfb.field_key;"
# Attendu : tagline, description, attributeChips, trustRow, reviewBadgeEnabled,
#           reviewBadgeOverride, ctaPulseEnabled

# 4.6 Vérification UI
open http://localhost:3001/admin/components/kit-hero-produit/fields
# Attendu : tous les fields apparaissent avec leurs valeurs par défaut
```

### Phase 2 — Migration + helpers

```bash
# 4.7 Créer la migration (suivre 02-architecture.md §2.2)
# Fichier : apps/web/drizzle/migrations/0057_review_photos.sql

# 4.8 Modifier schema.ts + client.ts + types.ts
# Suivre 02-architecture.md §2.3 et §2.4

# 4.9 Type-check
pnpm --filter @femiglow/web typecheck
# Attendu : Found 0 errors

# 4.10 Exécuter la migration
pnpm --filter @femiglow/web migrate
# Attendu : "Applied migrations: 0057_review_photos.sql"

# 4.11 Vérifier la table
psql $DATABASE_URL -c "\d product_review_photos"
# Attendu : description de la table avec toutes les colonnes

# 4.12 Créer helper getKitHeroGalleryImages + tests
# Fichiers : apps/web/src/lib/products/kit-hero-gallery.ts
#           apps/web/src/lib/products/kit-hero-gallery.test.ts

# 4.13 Run tests
pnpm --filter @femiglow/web test src/lib/products/kit-hero-gallery
# Attendu : 4 tests passing

# 4.14 Créer le script seed-reviews-photos
# Fichier : apps/web/scripts/seed-reviews-photos.ts
# Ajouter dans apps/web/package.json :
#   "seed:reviews-photos": "tsx scripts/seed-reviews-photos.ts"

# 4.15 Si photos dispo dans public/reviews/, exécuter le seed
pnpm --filter @femiglow/web seed:reviews-photos
# Attendu : "Seeded N review photos" OU "No photos found in public/reviews/ — skip"

# 4.16 Vérifier en DB
psql $DATABASE_URL -c "SELECT id, src, status FROM product_review_photos;"
```

### Phase 3 — HeroGallery

```bash
# 4.17 Créer les composants (cf. 03-vignette-system.md)
# Fichiers à créer :
#   apps/web/src/components/sections/hero/useGallery.ts
#   apps/web/src/components/sections/hero/HeroGalleryDots.tsx
#   apps/web/src/components/sections/hero/HeroGalleryThumbnails.tsx
#   apps/web/src/components/sections/hero/HeroGalleryMain.tsx
#   apps/web/src/components/sections/hero/HeroGalleryArrow.tsx
#   apps/web/src/components/sections/hero/HeroGallery.tsx
#   + tests .test.ts(x) pour chaque

# 4.18 Tests
pnpm --filter @femiglow/web test src/components/sections/hero
# Attendu : 18 tests passing (useGallery + Dots + Thumbnails + Gallery)

# 4.19 Type-check + lint
pnpm --filter @femiglow/web typecheck
pnpm --filter @femiglow/web lint

# 4.20 Playground manuel (optionnel)
# Créer apps/web/src/app/(playground)/hero-gallery-demo/page.tsx
# Ouvrir http://localhost:3001/hero-gallery-demo dans le browser
# Vérifier : swipe mobile (DevTools touch mode), click thumb desktop,
#            keyboard nav, reduced-motion CSS toggle
```

### Phase 4 — Composants commerce

```bash
# 4.21 Créer les 3 composants
# Fichiers :
#   apps/web/src/components/commerce/AttributeChips.tsx
#   apps/web/src/components/commerce/SocialProofBadge.tsx
#   apps/web/src/components/commerce/TrustRow.tsx
#   + tests

# 4.22 Tests
pnpm --filter @femiglow/web test src/components/commerce/AttributeChips \
                                  src/components/commerce/SocialProofBadge \
                                  src/components/commerce/TrustRow
# Attendu : 14 tests passing
```

### Phase 5 — Refonte HeroProduit + Bound

```bash
# 4.23 Refondre les 2 fichiers
# Fichiers :
#   apps/web/src/components/sections/HeroProduit.tsx
#   apps/web/src/components/sections/HeroProduitBound.tsx

# 4.24 Si pas de token Tailwind 'sauge-profond', ajouter dans tailwind.config.ts
# Sinon utiliser bg-[#4A5D4A] direct
# Vérifier d'abord :
grep -r 'sauge' apps/web/tailwind.config* apps/web/src/styles/ 2>/dev/null

# 4.25 Type-check + lint
pnpm --filter @femiglow/web typecheck
pnpm --filter @femiglow/web lint

# 4.26 Test d'intégration
pnpm --filter @femiglow/web test src/components/sections/HeroProduit
# Attendu : 2 tests passing

# 4.27 Vérification visuelle
# Ouvrir /kit en mobile + desktop, comparer avec 01-vision-design.md §2
```

### Phase 6 — E2E + a11y

```bash
# 4.28 Installer axe-core
pnpm add -D -w @axe-core/playwright

# 4.29 Créer le fichier e2e
# Fichier : apps/web/e2e/kit-hero.spec.ts (cf. 04-test-strategy.md §4.2)

# 4.30 Run e2e en headed (debug)
pnpm --filter @femiglow/web exec playwright test e2e/kit-hero.spec.ts --headed --project=chromium-desktop

# 4.31 Run e2e mobile
pnpm --filter @femiglow/web exec playwright test e2e/kit-hero.spec.ts --project=chromium-mobile

# 4.32 Run complet
pnpm --filter @femiglow/web test:e2e
# Attendu : All tests passing

# 4.33 Si tests flaky :
pnpm --filter @femiglow/web exec playwright test e2e/kit-hero.spec.ts --retries=2
```

### Phase 7 — Polish

```bash
# 4.34 Lighthouse local
pnpm --filter @femiglow/web exec lighthouse http://localhost:3001/kit \
  --preset=desktop --output=html --output-path=docs/kit-hero-optim/captures/lighthouse-desktop.html

pnpm --filter @femiglow/web exec lighthouse http://localhost:3001/kit \
  --form-factor=mobile --output=html --output-path=docs/kit-hero-optim/captures/lighthouse-mobile.html

# 4.35 Bundle analysis (optionnel)
pnpm --filter @femiglow/web build
# Inspecter .next/analyze ou .next/static/

# 4.36 Greps voix maison
cd apps/web/src/components/sections
grep -rn '!' HeroProduit.tsx hero/ 2>/dev/null | grep -v 'src=' | grep -v '\.test\.'
# Attendu : zéro résultat (ou uniquement dans des contextes non-copy)

grep -rEn '[\u{1F300}-\u{1F9FF}]' HeroProduit.tsx hero/ 2>/dev/null
# Attendu : zéro emoji

# 4.37 Run total
pnpm --filter @femiglow/web lint && \
pnpm --filter @femiglow/web typecheck && \
pnpm --filter @femiglow/web test --run && \
pnpm --filter @femiglow/web test:e2e
# Attendu : tout vert

# 4.38 Captures after-*
# Browser DevTools, /kit en mobile + desktop, enregistrer :
#   docs/kit-hero-optim/captures/after-mobile.png
#   docs/kit-hero-optim/captures/after-desktop.png

# 4.39 README captures
# Créer docs/kit-hero-optim/captures/README.md avec contexte (date, branch, version repo)

# 4.40 Supprimer playground
rm -rf apps/web/src/app/\(playground\)/hero-gallery-demo
```

---

## 5. Vérifications de bonne santé (à tout moment)

```bash
# Sanity checks rapides :

# DB OK ?
psql $DATABASE_URL -c "SELECT count(*) FROM site_components" && echo "DB OK"

# Migration appliquée ?
psql $DATABASE_URL -c "SELECT name FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 3"

# Type-check OK ?
pnpm --filter @femiglow/web typecheck && echo "TS OK"

# Tests OK ?
pnpm --filter @femiglow/web test --run --reporter=min && echo "VITEST OK"

# Build OK ?
pnpm --filter @femiglow/web build && echo "BUILD OK"

# /kit charge sans erreur 500 ?
curl -sSf http://localhost:3001/kit -o /dev/null && echo "200 OK"
```

---

## 6. Rollback par phase

### 6.1 Phase 1 (registry)

```bash
# Revert le commit registry
git log --oneline | head -20
git revert <hash-du-commit-phase-1>

# Re-seed pour réécrire les bindings (revient à l'état précédent)
pnpm --filter @femiglow/web seed:components
pnpm --filter @femiglow/web seed:components-fields

# OU plus brutal : delete les bindings nouveaux
psql $DATABASE_URL -c "
  DELETE FROM component_field_bindings
  WHERE component_id IN (SELECT id FROM site_components WHERE key='kit-hero-produit')
    AND field_key IN ('tagline','description','attributeChips','trustRow',
                      'reviewBadgeEnabled','reviewBadgeOverride','ctaPulseEnabled');"
```

### 6.2 Phase 2 (migration + table)

```bash
# Drop la table
psql $DATABASE_URL -c "DROP TABLE IF EXISTS product_review_photos CASCADE;"

# Supprimer la migration de l'historique drizzle
psql $DATABASE_URL -c "
  DELETE FROM drizzle.__drizzle_migrations
  WHERE hash IN (SELECT hash FROM drizzle.__drizzle_migrations WHERE name = '0057_review_photos');"

# Revert git
git revert <hash-phase-2>
```

### 6.3 Phase 3-5 (code)

```bash
# Revert git suffit (pas d'état persistant)
git log --oneline | head -20
git revert <hash-phase-N>

# Pour delete brutal des fichiers nouveaux :
rm -rf apps/web/src/components/sections/hero/
rm apps/web/src/components/commerce/AttributeChips.tsx \
   apps/web/src/components/commerce/SocialProofBadge.tsx \
   apps/web/src/components/commerce/TrustRow.tsx
rm apps/web/src/lib/products/kit-hero-gallery.ts

# Restaurer HeroProduit.tsx depuis l'historique
git checkout master -- apps/web/src/components/sections/HeroProduit.tsx
```

### 6.4 Phase 6 (tests e2e)

```bash
rm apps/web/e2e/kit-hero.spec.ts
```

---

## 7. Debug courant

### 7.1 "Cannot resolve module @/components/sections/hero/..."

```bash
# Le composant n'existe pas ou imports cassés
ls apps/web/src/components/sections/hero/
# Vérifier les exports `export` dans le fichier
```

### 7.2 "Field tagline not found in component fields"

```bash
# Re-seed des bindings :
pnpm --filter @femiglow/web seed:components-fields

# Vérif DB :
psql $DATABASE_URL -c "
  SELECT cfb.field_key FROM component_field_bindings cfb
  JOIN site_components sc ON sc.id = cfb.component_id
  WHERE sc.key = 'kit-hero-produit';"
```

### 7.3 "Migration 0057 failed"

```bash
# Vérifier le SQL :
cat apps/web/drizzle/migrations/0057_review_photos.sql

# Lancer manuellement pour voir l'erreur :
psql $DATABASE_URL -f apps/web/drizzle/migrations/0057_review_photos.sql

# Si déjà appliquée partiellement :
psql $DATABASE_URL -c "
  SELECT * FROM drizzle.__drizzle_migrations
  WHERE name LIKE '%0057%';"
```

### 7.4 "vitest IntersectionObserver is not defined"

```bash
# Le mock est dans vitest.setup.ts — vérifier qu'il est chargé :
cat apps/web/vitest.setup.ts | grep -i intersection
# Sinon ajouter le mock global
```

### 7.5 Playwright "CTA not visible"

```bash
# Run en headed pour voir :
pnpm --filter @femiglow/web exec playwright test e2e/kit-hero.spec.ts \
  --headed --project=chromium-mobile

# Capturer l'état :
pnpm --filter @femiglow/web exec playwright test \
  e2e/kit-hero.spec.ts --trace=on
# Puis ouvrir playwright-report/index.html
```

### 7.6 LCP > 2,5 s

- Vérifier que la 1ère image a `priority + fetchPriority="high"`.
- Vérifier les `sizes` de l'Image (mobile : `100vw`, desktop : `40vw`).
- Vérifier le `blurDataURL` est présent (réduit le CLS perçu).
- Inspecter Network tab → temps de TTFB de l'image.

---

## 8. Variables d'environnement spécifiques au projet

```bash
# .env local (pas modifié par ce plan, juste vérification)
echo "DATABASE_URL=$DATABASE_URL"
echo "DIRECT_DATABASE_URL=$DIRECT_DATABASE_URL"
echo "AUTO_SEED=$AUTO_SEED"

# Si AUTO_SEED=0, les seeds ne tournent pas → forcer manuellement :
AUTO_SEED=1 pnpm --filter @femiglow/web seed:components
```

---

## 9. Notes opérationnelles

- **Toujours commit après chaque phase verte.** Ne pas accumuler les changements non commit.
- **Toujours vérifier sur /kit en mobile DevTools + desktop** avant de passer à la phase suivante.
- **Ne pas merger sans avoir coché tous les items du checkpoint** de la phase.
- **Ne jamais skip les tests.** Si un test échoue, fix le test ou fix le code — ne pas le commenter.
- **Ne pas créer de PR avant la fin de la Phase 7** (sauf si demandé par l'utilisateur).

---

## 10. Commandes "one-liner" utiles

```bash
# Reset complet du composant kit-hero-produit (DB + seed)
psql $DATABASE_URL -c "
  DELETE FROM component_field_bindings
  WHERE component_id IN (SELECT id FROM site_components WHERE key='kit-hero-produit');
" && pnpm --filter @femiglow/web seed:components-fields

# Reset complet review photos
psql $DATABASE_URL -c "TRUNCATE product_review_photos;" \
  && pnpm --filter @femiglow/web seed:reviews-photos

# Status global
pnpm --filter @femiglow/web typecheck && \
pnpm --filter @femiglow/web lint && \
pnpm --filter @femiglow/web test --run --reporter=min && \
echo "===== ALL GREEN ====="

# Capture rapide /kit (sans navigateur — utilise wkhtmltoimage si installé)
wkhtmltoimage --width 375 --height 812 http://localhost:3001/kit \
  docs/kit-hero-optim/captures/quick-mobile.png 2>/dev/null || \
  echo "wkhtmltoimage non installé, utiliser DevTools manuellement"
```

---

## 11. Voir aussi

- [`05-action-plan.md`](05-action-plan.md) — checkpoints détaillés par phase
- [`README.md`](README.md) — vue d'ensemble et Definition of Done
- `apps/web/scripts/_migrate-safe.mjs` — runner de migration custom
- `apps/web/package.json` — toutes les commandes pnpm disponibles
