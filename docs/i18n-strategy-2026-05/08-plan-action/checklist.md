# Checklists exhaustives — Plan d'action i18n FemiGlow

> Checklists vérifiables item par item pour chaque phase du plan. À cocher pendant l'exécution.
>
> **Format** : `- [ ]` pour `to do`, `- [x]` pour `fait`. À mettre à jour au fil de l'eau.
>
> **Total items** : ~240 items distribués sur 9 phases.

## Sommaire

- [Pré-requis projet](#pré-requis-projet)
- [Phase 0 — Étude validée + ADRs](#phase-0--étude-validée--adrs)
- [Phase 1 — Foundation](#phase-1--foundation)
- [Phase 2 — Content extraction](#phase-2--content-extraction)
- [Phase 3 — CMS multilingue](#phase-3--cms-multilingue)
- [Phase 4 — RTL + AR](#phase-4--rtl--ar)
- [Phase 5 — Workflow translateur](#phase-5--workflow-translateur)
- [Phase 6 — Tests denses](#phase-6--tests-denses)
- [Phase 7 — Deploy + observabilité](#phase-7--deploy--observabilité)
- [Phase 8 — Stabilisation](#phase-8--stabilisation)
- [Clôture projet](#clôture-projet)

---

## Pré-requis projet

Items vérifiés avant de démarrer la Phase 0.

- [ ] Étude `docs/i18n-strategy-2026-05/` lue intégralement par fondatrice
- [ ] Étude lue intégralement par lead technique
- [ ] Budget temps validé (~11 semaines, ~540h cumulées)
- [ ] Ressources confirmées : fondatrice, lead, dev, QA disponibles
- [ ] Translateur AR identifié (interne ou externe)
- [ ] Translateur EN identifié (peut être lead/dev avec relecture)
- [ ] Vercel project access vérifié (env vars settings)
- [ ] Neon DB backup procédure connue
- [ ] Sentry projet existe et opérationnel
- [ ] Repo Git droits push sur `master` confirmés
- [ ] CI/CD GitHub Actions vert sur master

---

## Phase 0 — Étude validée + ADRs

### Relecture étude (T0.1)

- [ ] Fondatrice a lu `00-context/etat-actuel.md`
- [ ] Fondatrice a lu `01-options-techniques/recommendation.md`
- [ ] Fondatrice a lu `02-design-conception/architecture-cible.puml`
- [ ] Fondatrice a lu `05-ui-ux-design/tone-style-guide.md`
- [ ] Lead a lu tous les `README.md` des 12 sous-dossiers
- [ ] Lead a lu `03-backend/translation-store.md`
- [ ] Lead a lu `04-frontend/translation-keys.md`
- [ ] Lead a lu `11-test-execution/`
- [ ] Notes de relecture déposées (commentaires PR ou doc partagé)

### Réunion décision (T0.2)

- [ ] Date de réunion fixée (45 min minimum)
- [ ] Agenda partagé 24h avant
- [ ] Présents : fondatrice + lead + dev
- [ ] Q1 (path-based routing) — décidée
- [ ] Q2 (next-intl) — décidée
- [ ] Q3 (JSON files in repo) — décidée
- [ ] Q4 (DB CMS multilingue) — décidée
- [ ] Q5 (Crowdin Free vs PR GitHub) — décidée
- [ ] Q6 (Wizard CHA-231 conservé) — décidée
- [ ] Q7 (RTL via Tailwind logical) — décidée
- [ ] Q8 (default locale `fr` vs `fr-MA`) — décidée
- [ ] Q9 (locales V1 = FR + AR + EN) — décidée
- [ ] Q10 (migration progressive route par route) — décidée
- [ ] CR réunion rédigé et partagé
- [ ] CR signé par fondatrice et lead

### ADRs (T0.3)

- [ ] ADR-0001 — Choix next-intl rédigé et mergé
- [ ] ADR-0002 — Path-based routing rédigé et mergé
- [ ] ADR-0003 — Default locale fr rédigé et mergé
- [ ] ADR-0004 — Locales V1 fr-ar-en rédigé et mergé
- [ ] ADR-0005 — RTL via Tailwind logical properties rédigé et mergé
- [ ] ADR-0006 — CMS component_field_bindings multilang rédigé et mergé
- [ ] ADR-0007 — Wizard CHA-231 préservé rédigé et mergé
- [ ] ADR-0008 — Workflow translateur PR GitHub rédigé et mergé

### Setup tracking (T0.4)

- [ ] Branche `feat/i18n-foundation` créée depuis master
- [ ] Epic créé dans outil PM (Linear / JIRA)
- [ ] Sous-tâches T1.1 → T1.8 créées sous l'epic
- [ ] Labels GitHub `i18n`, `phase-1`, `phase-2`, etc. créés
- [ ] README étude basculé de `Draft` à `Validé`

---

## Phase 1 — Foundation

### Installation (T1.1)

- [ ] `pnpm add -F web next-intl@<version>` exécuté
- [ ] Version pinned dans `apps/web/package.json` (pas de `^`)
- [ ] `pnpm-lock.yaml` à jour et commité
- [ ] `pnpm install` vert
- [ ] `pnpm typecheck` vert
- [ ] `pnpm build` vert
- [ ] Bundle size avant/après mesuré et noté

### Middleware locale (T1.2)

- [ ] `apps/web/src/i18n/config.ts` créé avec locales, defaultLocale, type Locale
- [ ] `apps/web/src/i18n/routing.ts` créé (helpers Link, Pathname)
- [ ] `apps/web/src/middleware.ts` mis à jour avec next-intl middleware
- [ ] Matcher exclut `/admin/*`
- [ ] Matcher exclut `/api/*`
- [ ] Matcher exclut `/_next/*`
- [ ] Matcher exclut `/static/*`, `/favicon.ico`
- [ ] Matcher exclut `/sitemap.xml`, `/robots.txt`
- [ ] Tests unit sur helpers locale (3 cas min)

### Structure `[locale]` (T1.3)

- [ ] Dossier `apps/web/src/app/[locale]/` créé
- [ ] `apps/web/src/app/[locale]/layout.tsx` créé avec `getMessages()`
- [ ] `apps/web/src/app/[locale]/contact/page.tsx` déplacée
- [ ] Redirect 308 `/contact` → `/fr/contact` configuré
- [ ] `/fr/contact` rend la page (200)
- [ ] `/en/contact` rend la page (200)
- [ ] `/ar/contact` rend la page (200)
- [ ] `/contact` retourne 308 vers `/fr/contact`

### Fichiers messages (T1.4)

- [ ] `apps/web/messages/fr.json` créé avec ~30 strings `/contact`
- [ ] `apps/web/messages/ar.json` créé (copie FR temporaire)
- [ ] `apps/web/messages/en.json` créé (placeholder ou trad initiale)
- [ ] JSON valide (lint pass)
- [ ] Type augmentation `apps/web/src/i18n/messages.d.ts` créé
- [ ] `useTranslations('contact')` type-safe (autocomplete fonctionne)
- [ ] ESLint pass sur fichiers messages

### LocaleSwitcher (T1.5)

- [ ] `apps/web/src/components/i18n/LocaleSwitcher.tsx` créé
- [ ] Affiche les 3 locales (fr/ar/en)
- [ ] Utilise `Intl.DisplayNames` pour noms natifs
- [ ] Pas de drapeaux (préférence)
- [ ] Persistance cookie `NEXT_LOCALE`
- [ ] Préserve la querystring
- [ ] Accessible clavier (tab, enter, escape)
- [ ] ARIA labels OK
- [ ] Intégré dans `SiteHeader`
- [ ] Visible mobile + desktop
- [ ] Tests unit (3 cas min : render, click, persistance)

### E2E baseline (T1.6)

- [ ] `apps/web/e2e/i18n/contact-locales.spec.ts` créé
- [ ] Test 1 : GET `/contact` redirige vers `/fr/contact`
- [ ] Test 2 : GET `/fr/contact` rend 200
- [ ] Test 3 : GET `/en/contact` rend 200
- [ ] Test 4 : GET `/ar/contact` rend 200
- [ ] Test 5 : Click switcher EN → URL change + cookie set
- [ ] Test 6 : Cookie set → fresh visit respecte cookie
- [ ] 6 specs verts en local
- [ ] 6 specs verts en CI

### Feature flag (T1.7)

- [ ] `apps/web/src/lib/feature-flags/i18n.ts` créé
- [ ] Export `isI18nEnabled()` typed
- [ ] Lit `process.env.I18N_ENABLED` une seule fois (cache module)
- [ ] `.env.example` mis à jour avec `I18N_ENABLED=true`
- [ ] Middleware bypass si `I18N_ENABLED=false`
- [ ] Tests unit (2 cas : enabled/disabled)
- [ ] Manual test : toggle local fonctionne

### Code review et signoff (T1.8)

- [ ] PR `feat/i18n-foundation` ouverte
- [ ] Description PR détaille les 8 tâches
- [ ] Captures écran 3 locales fournies
- [ ] Lead technique review code
- [ ] Tous commentaires résolus
- [ ] CI vert (typecheck, lint, test, build, E2E)
- [ ] Fondatrice valide démo (call ou async)
- [ ] PR mergée sur master via squash
- [ ] Branche `feat/i18n-foundation` supprimée

---

## Phase 2 — Content extraction

### Audit strings (T2.1)

- [ ] Commande scan exécutée (rg ou script)
- [ ] Inventaire CSV créé : `docs/i18n-strategy-2026-05/06-data-strategy/inventaire-strings.csv`
- [ ] Colonnes : `file`, `line`, `string_fr`, `context`, `priority`, `key_proposed`
- [ ] ≥ 600 lignes (cible ~700)
- [ ] Priorité P0 (nav, CTA, légal) marquée
- [ ] Priorité P1 (sections marketing) marquée
- [ ] Priorité P2 (admin, dev-only) marquée

### Script AST (T2.2)

- [ ] `apps/web/scripts/i18n/extract.ts` créé
- [ ] Parse TSX avec ts-morph (ou équivalent)
- [ ] Détecte JSX text
- [ ] Détecte `aria-label`, `title`, `alt`, `placeholder`
- [ ] Génère entrée JSON dans `messages/fr.json`
- [ ] Refactor TSX vers `t('key')`
- [ ] Mode dry-run disponible
- [ ] `README.md` du script avec usage
- [ ] Tests unit sur le parser (5 fixtures)

### Extraction home (T2.3)

- [ ] `app/[locale]/page.tsx` refactoré
- [ ] Namespace `home.*` créé dans messages
- [ ] ~80 strings externalisées
- [ ] `/fr/` rend identique à avant (visual diff = 0)
- [ ] `/en/` rend avec trads EN
- [ ] `/ar/` rend (copie FR pour l'instant)
- [ ] Metadata SEO localisée (`generateMetadata`)
- [ ] E2E mis à jour

### Extraction maison (T2.4)

- [ ] `app/[locale]/maison/page.tsx` refactoré
- [ ] Namespace `maison.*` créé
- [ ] ~50 strings externalisées
- [ ] 3 locales rendent OK
- [ ] Metadata localisée
- [ ] Visual regression 0 diff

### Extraction kit (T2.5)

- [ ] `app/[locale]/kit/page.tsx` refactoré
- [ ] Namespace `kit.*` créé
- [ ] ~120 strings externalisées
- [ ] **Wizard CHA-231 PAS touché** (vérification explicite)
- [ ] `WizardDictionary` import inchangé
- [ ] Wizard E2E toujours vert
- [ ] Sections kit-hero refactorées (cf. project_kit_hero_refonte)

### Extraction rituel (T2.6)

- [ ] `app/[locale]/rituel/page.tsx` refactoré
- [ ] Namespace `rituel.*` créé
- [ ] ~60 strings externalisées
- [ ] Repo `ritual_testimonials` filtré par locale
- [ ] Fallback FR si pas de testimonial dans locale

### Extraction journal (T2.7)

- [ ] `app/[locale]/journal/page.tsx` refactoré
- [ ] `app/[locale]/journal/[slug]/page.tsx` refactoré
- [ ] Namespace `journal.*` créé
- [ ] ~20 strings externalisées
- [ ] `data/mock/articles.ts` supporte multilingue ou fallback FR
- [ ] Articles individuels servis selon locale

### Validation voix FR (T2.8)

- [ ] Fondatrice review `messages/fr.json` ligne par ligne
- [ ] Corrections tonalité (sobre, posée, pas urgence factice)
- [ ] Glossaire termes-marque validé (FemiGlow, Maison, Kit, rituel)
- [ ] Log modifs dans `docs/i18n-strategy-2026-05/05-ui-ux-design/log-revue-voix-fr.md`
- [ ] Tests visuels rejoués après modifs
- [ ] Fondatrice signe-off explicite

### ESLint rule (T2.9)

- [ ] `apps/web/eslint-rules/no-hardcoded-strings.js` créé
- [ ] Rule détecte JSX text FR
- [ ] Whitelist `*.test.tsx`, `*.stories.tsx`, `e2e/`
- [ ] Whitelist `messages/`
- [ ] Suggest fix (autofix optionnel)
- [ ] Tests unit sur la rule
- [ ] Activée en mode `warn` dans `eslint.config.js`
- [ ] CI documentée pour mode `error` futur (phase 6)

### Traduction EN baseline (T2.10)

- [ ] Script DeepL automatique (FR → EN) sur ~700 strings
- [ ] `messages/en.json` rempli à 100%
- [ ] Review humaine sur P0 (nav, CTA, légal, metadata SEO)
- [ ] Glossaire EN créé : `docs/i18n-strategy-2026-05/06-data-strategy/glossaire-en.csv`
- [ ] Tests Playwright `/en/*` verts
- [ ] 0 string identique FR (sauf intentionnel comme noms propres)

---

## Phase 3 — CMS multilingue

### Repo extension (T3.1)

- [ ] `componentFieldBindingsRepo.getByLocale()` méthode ajoutée
- [ ] Signature : `{ componentId, fieldKey, locale, fallbackLocale }`
- [ ] Retourne `{ value, resolvedLocale, isFallback }`
- [ ] Tests unit (4 cas : direct, fallback, missing, error)
- [ ] Tests integration DB (4 cas)

### UI Admin onglets (T3.2)

- [ ] Composant `LocaleTabs` créé
- [ ] Affiche FR / AR / EN
- [ ] Switch tab préserve édition courante (warning si dirty)
- [ ] Indicateur visuel "locale traduite vs vide"
- [ ] Save par locale (un seul champ à la fois)
- [ ] Save toutes locales (batch)
- [ ] Tests E2E admin
- [ ] Visual regression admin OK

### Migration data (T3.3)

- [ ] Migration Drizzle créée : `00XX-cms-locale-backfill.sql`
- [ ] Backfill `locale='fr'` sur rows NULL
- [ ] Index ajouté `(component_id, field_key, locale)`
- [ ] Migration testée local
- [ ] Migration testée staging
- [ ] Migration testée rollback (down)

### Intégration frontend (T3.4)

- [ ] Helper RSC `loadCmsField(locale)` créé
- [ ] Marker dev visible si fallback FR utilisé
- [ ] Cache revalidatePath sur edit admin
- [ ] Composants marketing utilisent helper
- [ ] Tests integration

### Tests CMS multilang (T3.5)

- [ ] Test : read AR exists
- [ ] Test : read AR missing → fallback FR
- [ ] Test : read EN exists
- [ ] Test : read EN missing → fallback FR
- [ ] Test : write FR puis read FR
- [ ] Test : write AR puis read AR
- [ ] Test : cache invalidation
- [ ] Test : history versioning par locale
- [ ] Test : status (draft/published) par locale
- [ ] Test : edit FR ne touche pas AR
- [ ] Test : delete FR retire FR, garde AR
- [ ] Test : duplicate FR vers AR (helper)
- [ ] 12 tests verts

---

## Phase 4 — RTL + AR

### Audit RTL (T4.1)

- [ ] Scan rg sur classes `ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`, `border-l`, `border-r`, `left-`, `right-`
- [ ] Inventaire CSV : `docs/i18n-strategy-2026-05/05-ui-ux-design/audit-rtl.csv`
- [ ] Colonnes : `file`, `line`, `class`, `replacement`, `context`
- [ ] ≥ 150 lignes attendues (cible ~200)
- [ ] Classification par catégorie (margin/padding/text/border)

### Refactor Tailwind logical (T4.2)

- [ ] `ml-X` → `ms-X` partout
- [ ] `mr-X` → `me-X` partout
- [ ] `pl-X` → `ps-X` partout
- [ ] `pr-X` → `pe-X` partout
- [ ] `text-left` → `text-start`
- [ ] `text-right` → `text-end`
- [ ] `border-l` → `border-s`
- [ ] `border-r` → `border-e`
- [ ] `left-X` → `start-X`
- [ ] `right-X` → `end-X`
- [ ] `pnpm typecheck` vert
- [ ] `pnpm test` vert
- [ ] Visual regression LTR = 0 diff (vérification critique)

### `<html dir>` dynamique (T4.3)

- [ ] `app/[locale]/layout.tsx` génère `<html dir>` selon locale
- [ ] `<html lang>` selon locale (`fr`, `ar`, `en`)
- [ ] `dir="rtl"` pour `ar`
- [ ] `dir="ltr"` pour `fr`, `en`
- [ ] Test E2E inspect HTML attributes

### Font Cairo (T4.4)

- [ ] `next/font/google` import Cairo
- [ ] Subsets `arabic` et `arabic-extended`
- [ ] Variable CSS `--font-arabic`
- [ ] Tailwind extend `fontFamily.arabic`
- [ ] Appliqué uniquement si locale=ar
- [ ] DevTools Network vérifie chargement conditionnel
- [ ] Lighthouse perf budget OK (pas de régression > 5%)

### Tests visuels RTL (T4.5)

- [ ] `apps/web/e2e/visual/rtl/home.spec.ts`
- [ ] `apps/web/e2e/visual/rtl/maison.spec.ts`
- [ ] `apps/web/e2e/visual/rtl/kit.spec.ts`
- [ ] `apps/web/e2e/visual/rtl/rituel.spec.ts`
- [ ] `apps/web/e2e/visual/rtl/journal.spec.ts`
- [ ] `apps/web/e2e/visual/rtl/contact.spec.ts`
- [ ] Baselines générées (`pnpm playwright test --update-snapshots`)
- [ ] Mask éléments dynamiques (date, prix)
- [ ] 6 specs verts

### A11y RTL (T4.6)

- [ ] `axe-playwright` setup
- [ ] Scan `/ar/` 0 violation critique
- [ ] Scan `/ar/maison` 0 violation critique
- [ ] Scan `/ar/kit` 0 violation critique
- [ ] Scan `/ar/rituel` 0 violation critique
- [ ] Scan `/ar/journal` 0 violation critique
- [ ] Scan `/ar/contact` 0 violation critique
- [ ] Rapport JSON enregistré

---

## Phase 5 — Workflow translateur

### Export/import (T5.1)

- [ ] Script `apps/web/scripts/i18n/export.ts` créé
- [ ] Format XLIFF 2.0 ou XLSX
- [ ] CLI : `pnpm i18n:export --source fr --target ar`
- [ ] Output dans `exports/`
- [ ] Script `apps/web/scripts/i18n/import.ts` créé
- [ ] CLI : `pnpm i18n:import --file exports/ar.xliff`
- [ ] Validation Zod sur structure
- [ ] Tests roundtrip (export → import)

### Doc translateur (T5.2)

- [ ] `docs/i18n-strategy-2026-05/09-runbook/onboarding-translateur.md` créé
- [ ] Section : comment recevoir le fichier
- [ ] Section : outil recommandé (Trados, OmegaT, ou simple XLSX)
- [ ] Section : règles voix FemiGlow
- [ ] Section : glossaire FR-AR
- [ ] Section : pluralization AR (6 formes)
- [ ] Section : retour du fichier (email ou PR)
- [ ] Glossaire `glossaire-fr-ar.csv` créé
- [ ] Translateur teste la doc et confirme OK

### Traduction AR (T5.3)

- [ ] Fichier export envoyé au translateur
- [ ] Translateur confirme réception
- [ ] 100% des clés ont une traduction (pas de vide)
- [ ] 0 string identique au FR (sauf noms propres)
- [ ] Pluralization respectée
- [ ] Glossaire respecté
- [ ] Fichier import reçu

### Intégration AR (T5.4)

- [ ] `messages/ar.json` à jour avec traductions
- [ ] `I18N_LOCALES_ACTIVE=fr,ar,en` activé
- [ ] `/ar/*` affiche traductions réelles
- [ ] Tests E2E AR verts
- [ ] Visual regression mise à jour avec AR traduit

### Validation native (T5.5)

- [ ] Native speaker AR-MA review 6 routes
- [ ] Tonalité OK (sobre, premium)
- [ ] Register OK (Darija vs MSA selon contexte validé)
- [ ] Mots-clés produit OK (peau, rituel, etc.)
- [ ] Pas de faux-amis ou mistranslation
- [ ] Validation écrite enregistrée dans `validation-ar-ma.md`

---

## Phase 6 — Tests denses

### Pyramide unit (T6.1)

- [ ] `resolveLocale` 12 tests
- [ ] `LocaleSwitcher` 8 tests
- [ ] `formatDate` 18 tests (6 locales × 3 formats)
- [ ] `formatCurrency` 6 tests
- [ ] `pluralize` 12 tests
- [ ] Hook `useLocale` 4 tests
- [ ] Hook `useTranslations` smoke 3 tests
- [ ] Coverage `src/i18n/*` ≥ 90%
- [ ] Coverage `src/components/i18n/*` ≥ 85%

### Pyramide integration (T6.2)

- [ ] `componentFieldBindings.getByLocale` integration test
- [ ] `legal_pages.getByLocale` integration test
- [ ] `ritual_testimonials.byLocale` integration test
- [ ] Server action `setCmsLocale` integration test
- [ ] API route `/api/i18n/messages` integration test (si exposée)
- [ ] Coverage `src/lib/cms/*` méthodes locale ≥ 90%

### E2E 3 locales (T6.3)

- [ ] 6 routes principales × 3 locales = 18 scenarios baseline
- [ ] Switch locale au milieu parcours
- [ ] Deep link préserve UTM
- [ ] 404 par locale
- [ ] Cookie expiration → fallback
- [ ] Persistance après login admin
- [ ] Wizard checkout 3 locales (FR + AR + EN)
- [ ] Journal article slug × 3 locales
- [ ] 50+ specs Playwright verts

### Visual regression (T6.4)

- [ ] 6 routes × 3 locales × 2 viewports = 36 snapshots
- [ ] Desktop 1280 baselines
- [ ] Mobile 375 baselines
- [ ] Mask éléments dynamiques
- [ ] Update strategy documentée (`--update-snapshots`)
- [ ] 36 specs verts

### A11y scans (T6.5)

- [ ] 6 routes × 3 locales = 18 scans axe
- [ ] 0 violation critique
- [ ] 0 violation sérieuse
- [ ] Modérées documentées (acceptables ou backlog)
- [ ] Rapports JSON archivés

### Lighthouse CI (T6.6)

- [ ] `apps/web/lighthouserc.json` créé
- [ ] Performance budget ≥ 90 (mobile)
- [ ] Accessibility ≥ 95
- [ ] SEO ≥ 90
- [ ] PWA budget si applicable
- [ ] GitHub Actions workflow ajoute step Lighthouse
- [ ] 3 locales testées

### Coverage gates (T6.7)

- [ ] Vitest config gates `src/i18n/*` ≥ 90%
- [ ] Vitest config gates `src/components/i18n/*` ≥ 85%
- [ ] Vitest config gates `src/lib/cms/*` (locale) ≥ 90%
- [ ] CI fail si coverage drop sous seuil
- [ ] Badge coverage README à jour

### ESLint mode error (T6.8)

- [ ] `no-hardcoded-strings` passé de `warn` à `error`
- [ ] CI fail si dev ajoute string hardcoded
- [ ] Documentation `apps/web/eslint-rules/README.md` mise à jour

### Boucle correction (T6.9)

- [ ] Boucle décrite dans `11-test-execution/boucle-correction.md` exécutée
- [ ] Tous tests rouges fixés
- [ ] 3 runs consécutifs verts (no flaky)
- [ ] Rapport `docs/i18n-strategy-2026-05/11-test-execution/rapport-boucle-1.md` signé

---

## Phase 7 — Deploy + observabilité

### Vercel feature flag (T7.1)

- [ ] `I18N_ENABLED=true` sur Vercel preview
- [ ] `I18N_ENABLED=true` sur Vercel staging
- [ ] `I18N_ENABLED=false` sur Vercel production (initial)
- [ ] `I18N_LOCALES_ACTIVE=fr,ar,en` sur tous environnements
- [ ] `I18N_RTL_ENABLED=true` activé
- [ ] `I18N_CMS_BINDINGS_ENABLED=true` activé
- [ ] Screenshots Vercel settings archivés

### Snapshot DB (T7.2)

- [ ] Snapshot Neon créé : `pre-i18n-deploy-{YYYYMMDD}`
- [ ] Restore testé sur DB temp
- [ ] Documenté dans `docs/i18n-strategy-2026-05/08-plan-action/rollback.md`
- [ ] Rétention 30 jours minimum

### Canary 10% (T7.3)

- [ ] Vercel Edge Config configuré 10% trafic
- [ ] Dashboard monitoring opérationnel
- [ ] Pendant 24h : 0 erreur Sentry critique
- [ ] Pendant 24h : taux conversion ±5%
- [ ] Pendant 24h : 0 spike 5xx
- [ ] Validation lead + fondatrice OK

### Canary 50% (T7.4)

- [ ] Edge Config 50%
- [ ] Pendant 48h : KPIs stables
- [ ] Locale distribution conforme expected
- [ ] 0 incident critique
- [ ] Validation OK

### Canary 100% (T7.5)

- [ ] Edge Config 100%
- [ ] Pendant 72h : aucun incident
- [ ] Conversion FR stable
- [ ] AR/EN visibles dans funnel
- [ ] Validation finale

### Sentry tag (T7.6)

- [ ] Erreurs Sentry taguées `locale`
- [ ] Dashboard filtrable par locale
- [ ] Test : provoquer error → tag présent

### Analytics locale (T7.7)

- [ ] Dimension custom `locale` configurée
- [ ] Events tagués
- [ ] Dashboard `Locale distribution` opérationnel

### Rollback testé (T7.8)

- [ ] Test rollback sur staging
- [ ] Chrono ≤ 5 min
- [ ] Routes legacy fonctionnent
- [ ] Données préservées
- [ ] Procédure dans `rollback.md` validée

---

## Phase 8 — Stabilisation

### Bug bash (T8.1)

- [ ] Session 2h planifiée
- [ ] Présents : fondatrice + lead + dev + QA
- [ ] Navigation libre sur 3 locales
- [ ] Liste bugs / améliorations collectée
- [ ] Triée P0 / P1 / P2
- [ ] P0 fixés sous 24h
- [ ] P1 fixés sous 72h
- [ ] P2 → backlog

### A11y approfondi (T8.2)

- [ ] Audit manuel WCAG 2.1 AA
- [ ] Test NVDA (FR + AR + EN)
- [ ] Test VoiceOver (FR + AR + EN)
- [ ] Test Talkback Android (FR + AR + EN)
- [ ] Score WCAG ≥ 95%
- [ ] Rapport `docs/i18n-strategy-2026-05/11-test-execution/audit-a11y.md`

### Perf approfondi (T8.3)

- [ ] Bundle size delta < +15%
- [ ] LCP < 2.5s sur 3 locales (mobile et desktop)
- [ ] CLS < 0.1
- [ ] FID < 100ms
- [ ] WebPageTest run sur 3 locales
- [ ] Lighthouse CI consistent
- [ ] Rapport `docs/i18n-strategy-2026-05/10-monitoring/audit-perf-post-deploy.md`

### Doc finale (T8.4)

- [ ] `09-runbook/ajouter-nouvelle-langue.md` finalisé
- [ ] `09-runbook/onboarding-translateur.md` finalisé
- [ ] `09-runbook/troubleshooting.md` finalisé
- [ ] `09-runbook/faq-i18n.md` créé
- [ ] Relecture par dev externe (n'a pas participé)
- [ ] Corrections appliquées

### Post-mortem (T8.5)

- [ ] Template post-mortem rempli
- [ ] Section "Ce qui a bien marché"
- [ ] Section "Ce qui a foiré"
- [ ] Section "Leçons apprises"
- [ ] 3 actions concrètes identifiées
- [ ] Partagé en équipe
- [ ] Archivé `docs/i18n-strategy-2026-05/00-context/post-mortem.md`

---

## Clôture projet

- [ ] Toutes les checklists de phases cochées
- [ ] Tous les milestones M1-M7 atteints
- [ ] PR finale mergée
- [ ] Branches feature supprimées
- [ ] Epic outil PM fermé
- [ ] Documentation publiée en interne
- [ ] Présentation équipe (15 min) effectuée
- [ ] Fondatrice signe le PV de livraison
- [ ] Backup étude `docs/i18n-strategy-2026-05/` archivé
- [ ] Monitoring 30 jours post-deploy en place
- [ ] Tickets backlog créés pour V2 (locales additionnelles, admin i18n, etc.)

---

## Total items

| Phase | Items |
|---|---|
| Pré-requis | 11 |
| Phase 0 | 31 |
| Phase 1 | 60 |
| Phase 2 | 65 |
| Phase 3 | 30 |
| Phase 4 | 33 |
| Phase 5 | 28 |
| Phase 6 | 50 |
| Phase 7 | 30 |
| Phase 8 | 28 |
| Clôture | 11 |
| **Total** | **~377 items** |

---

## Utilisation

1. Copier ce fichier au démarrage du projet
2. Cocher au fil de l'eau dans GitHub (Markdown checkboxes interactifs)
3. À chaque fin de phase, sanity check : tous les items de la phase sont cochés
4. Si un item est skip pour raison valide, remplacer `- [ ]` par `- [N/A]` avec commentaire

## Liens

- [`README.md`](./README.md) — TL;DR
- [`phases.md`](./phases.md) — Plan détaillé
- [`rollback.md`](./rollback.md) — Procédures rollback
- [`feature-flags.md`](./feature-flags.md) — Feature flags
- [`risk-matrix.csv`](./risk-matrix.csv) — Risques
