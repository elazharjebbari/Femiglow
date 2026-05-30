# Prompt de reprise — Locale Switcher V2 + Moteur de suggestion

> Copier-coller intégral dans une nouvelle session. Auto-suffisant.

---

## RÔLE & OBJECTIF
Tu es un ingénieur full-stack senior. Tu reprends l'implémentation de **« Locale Switcher V2 »** + **« Moteur de suggestion linguistique »** pour l'e-commerce **FemiGlow** (Next.js 14 App Router, next-intl, Drizzle+Postgres, locales `fr`/`ar`/`en`, **AR = RTL**, marque « maison » : sobre, sans emoji, sans drapeau, sans urgence).
Le **dossier de delivery complet existe déjà** et fait foi : `docs/locale-switcher-v2/`. La **source de vérité absolue** est `docs/locale-switcher-v2/CONTRACT.md` (noms d'artefacts, events, tokens, **invariants INV-1→INV-20**, Definition of Done §8). Lis-le en premier, ainsi que `08-plan-action/plan-action.md` (lots L0→L12) et `09-runbook/runbook.md` + `09-runbook/test-loop.md`.

**Méthode imposée (runbook)** : fonctions pures d'abord → test vert → commit atomique. Chaque lot se termine par une **porte verte** (tests + zéro régression) AVANT le suivant. Pour chaque invariant, au moins **un test négatif** (le casser fait échouer un test).

## BRANCHE & ÉTAT GIT
- Branche de travail : **`feat/locale-switcher-v2`** (déjà créée, basée sur `feat/i18n-foundation`).
- **8 commits déjà faits** (lots L1, L2, L3, L4, L5, L9 + prompt UI). ~137 tests Vitest verts. Suite i18n complète : 132 verts.
- Un **hook git gitleaks** bloque les secrets au commit. **NE committe JAMAIS** : `apps/web/.env.example` (contient une vraie clé `OLLAMA_PROVIDER_KEY` à révoquer), `apps/web/src/test/db/test-db.ts` (URL DB de test flaggée), `.claude/*`. `git push` est actuellement refusé (droits remote à régler par l'humain) — travaille en local.

## DÉJÀ FAIT — À RÉUTILISER, NE PAS RECONSTRUIRE
Tous testés et commités. Importe-les, ne les ré-écris pas :

**Switcher (cœur sans reload)**
- `apps/web/src/lib/i18n/build-switch-url.ts` → `buildSwitchUrl(pathname, search, locale)` (UTM préservé, INV-4), `deriveLocale(pathname)`.
- `apps/web/src/lib/i18n/transition-helpers.ts` → `getDirection`, `applyHtmlLocale` (INV-2), `prefersReducedMotion` (INV-7), `supportsViewTransitions`, `announceLocale` (INV-10), `LIVE_REGION_ID`.
- `apps/web/src/components/i18n/use-locale-transition.ts` → `useLocaleTransition()` ⇒ `{ switchTo(target, surface), veil, active }`. 4 modes : reduced / View Transitions / voile / reload de secours. Types `SwitchSurface`, `TransitionKind`, `VeilState`.
- `apps/web/src/components/i18n/LiveAnnouncer.tsx`, `LocaleVeil.tsx`.
- `apps/web/src/components/i18n/locale-transition-context.tsx` → `LocaleTransitionProvider` (monté dans `app/[locale]/layout.tsx` derrière flag), `useLocaleSwitch()` (null sans provider → fallback V1).
- `apps/web/src/components/i18n/locale-switcher-flag.ts` → `isLocaleSwitcherV2Enabled()` (`NEXT_PUBLIC_LOCALE_SWITCHER_V2`).
- `apps/web/src/components/i18n/LocaleSwitcher.tsx` → déjà branché (gardé par flag + contexte).

**Config**
- `apps/web/src/lib/i18n/locale-config-schema.ts` → `localeConfigSchema`, `DEFAULT_LOCALE_CONFIG`, `safeParseLocaleConfig` (fallback INV-12), type `LocaleConfig`.
- `apps/web/src/lib/i18n/locale-config.ts` → `getResolvedLocaleConfig` (cache), `fetchLocaleConfig`, `LOCALE_CONFIG_SECTION='i18n_locale_config'`, `LOCALE_CONFIG_TAG`.
- `apps/web/src/app/api/i18n/config/route.ts` → `GET` public caché.

**Moteur (cerveau pur)**
- `apps/web/src/lib/i18n/suggestion-types.ts` → `Signals`, `SAFE_DEFAULT_SIGNALS` (défauts CONSERVATEURS : signal absent ⇒ jamais show), `Condition`, `Profile`, `EngineConfig`, `Decision`, `withSafeDefaults`.
- `apps/web/src/lib/i18n/suggestion-policy.ts` → `evaluateSuggestionPolicy(signals, config)` PURE. Ordre figé : zones calmes HARD (checkout/form, non désactivables, INV-14) → never configurés → engine-off (INV-13) → budget/dismiss (INV-16) → pertinence → triggers (priorité/confiance) → moment opportun (defer/show, INV-17).
- `apps/web/src/lib/i18n/guess-preferred-locale.ts` → `guessPreferredLocale`, `parseAcceptLanguage`, `DEFAULT_STRATEGY_WEIGHTS`.
- `apps/web/src/lib/i18n/suggested-locale.ts` → `resolveSuggestedLocale(input)` ⇒ `{ suggested, served, confidence, differsFromServed }`.
- `apps/web/src/components/i18n/LocaleSuggestionPrompt.tsx` → perle/toast, 2 choix symétriques, non-modal, Échap=rester (INV-20). Props : `{ suggested, surface, switchLabel, stayLabel, ariaLabel, onAccept, onDismiss }`.

## RESTE À FAIRE (dans cet ordre)

### LOT L10 — Runtime du moteur (réutilise policy + guess + prompt)
1. `apps/web/src/lib/i18n/suggestion-signals.ts` → `collectSignals(): Partial<Signals>` (lit DOM/window : `inCheckout` via pathname `/checkout|/commander|wizard`, `formFocused` via `document.activeElement` input/textarea, `modalOpen` via chat store, `dwellMs`, `scrollVelocity`, `atBreakpoint`, `exitIntent`, `hoverSwitcher`…). Fusionne avec `withSafeDefaults`.
2. Détecteur de breakpoint (scrollEnd = pause ≥ N ms après activité / idle court / exitIntent desktop) + **TTL d'abandon** (INV-17).
3. `apps/web/src/lib/i18n/engine-config-schema.ts` → schéma Zod section **`i18n_suggestion_engine`** (`engineEnabled:false` par défaut INV-13 ; profils trigger/never ; plancher zones calmes NON désactivable INV-14 ; safeParse→défauts) + resolver `getResolvedEngineConfig` (même pattern que `locale-config.ts`). Voir `10-suggestion-engine/02-config/engine-config-schema.yaml` + `profiles-catalog.csv`.
4. `apps/web/src/components/i18n/use-locale-suggestion-engine.ts` → hook : props `{ guessedLocale, confidence, config }` (résolus serveur), collecte signaux, appelle `evaluateSuggestionPolicy`, applique defer-to-breakpoint, expose `{ prompt, accept, dismiss }`. `accept` → `useLocaleSwitch().switchTo(suggested,'nudge')` (réutilise L2/L3). `dismiss` → cookie `locale_suggestion_dismissed` (session/persistant). **Inerte si engine off** (0 listener). Émet les 5 events (`CONTRACT §7.3`).
5. Monter dans `LocaleTransitionProvider` (ou un `EngineProvider`) ; rendre `LocaleSuggestionPrompt` au breakpoint. Jamais pendant le wizard (INV-14).
6. Tests Vitest : `collectSignals` (défauts sûrs), hook (off→rien INV-13 ; checkout→jamais INV-14 ; deep-read→jamais INV-15 ; defer→show au breakpoint INV-17 ; accept→switch ; dismiss persistant INV-16 ; no-redirect INV-20), engine-config-schema (invalide→off, plancher zones calmes). Plans détaillés : `10-suggestion-engine/05-tests/`.

### LOT L6/L11 — Admin (config + moteur + audit)
- `apps/web/src/app/api/admin/i18n/config/route.ts` → `GET`/`PUT` admin : **authz** (cookie `SESSION_COOKIE` dans `src/lib/auth/session.ts`, mirrorer un guard admin existant), validation Zod (422), concurrence `If-Match` (409), **audit** `logAuditEvent` + snapshot (`upsertAppConfig` existe déjà dans `src/lib/db/queries/app-config.ts`), `revalidateTag(LOCALE_CONFIG_TAG)`. Idem pour `i18n_suggestion_engine`.
- `apps/web/src/app/admin/i18n/page.tsx` → form (toggle/endonyme/reorder/défaut/nudge/variant) + **preview FR/AR/EN (dont RTL)** sans muter la locale réelle (réutiliser `LocaleSwitcher` en mode preview). Onglet **Moteur** : activer/désactiver global + par profil, **builder no-code de profils** (trigger ET never) + **dry-run/simulate** via `evaluateSuggestionPolicy`, vue **audit** `/admin/i18n/engine/audit`. Spécs : `10-suggestion-engine/02-config/admin-feature-spec.md` + `audit-model.md`.
- Garde-fous : zones calmes checkout/form **non désactivables** (INV-14) ; impossible de désactiver la locale par défaut / toutes les locales.
- Tests : Vitest (authz, validation, plancher) + Playwright `@locale-engine-admin`.

### LOT L7/L12 — E2E Playwright + a11y
- Spécs sous `apps/web/e2e/` (mirrorer une spec existante pour le style + tags `@locale-switcher` / `@locale-engine`). Lancer avec `NEXT_PUBLIC_LOCALE_SWITCHER_V2=true`.
- Couvre : switch FR→AR **sans reload** (INV-1) + `dir` rtl (INV-2) + scroll (INV-3) + UTM (INV-4) ; sur 6 pages × 3 locales ; pills drawer mobile + footer ; nudge montré 1× + dismiss persiste ; switcher **caché** en wizard + admin (INV-5) ; reduced-motion (INV-7) ; sans-JS hreflang (INV-8) ; clavier ; **axe** par locale ; moteur off-par-défaut, breakpoint-only, zones calmes. Plans : `07-tests/playwright-plan.csv` + `10-suggestion-engine/05-tests/playwright-plan.csv`.

### LOT L8 — Activation
- Flag `NEXT_PUBLIC_LOCALE_SWITCHER_V2` on (switcher) ; `localeSuggestionEngine` on mais **tous profils trigger off** (INV-13) ; activer profil par profil sous A/B + lecture audit. Voir runbook §F/H.

## CONVENTIONS & PIÈGES (importants)
- **Node** : `source ~/.nvm/nvm.sh && nvm use 22` pour build/test/scanners ; `nvm use 20` pour le serveur de preview.
- **Tests** : depuis `apps/web` → `corepack pnpm vitest run <glob>`. Env jsdom + `@testing-library/react`. Pour mocker des modules (next/navigation, tracking) : `vi.hoisted` + `vi.mock`.
- **Build** : depuis `apps/web` → `corepack pnpm build` (peut nécessiter `dangerouslyDisableSandbox` pour les fonts ; valider via `BUILD_EXIT` + présence de `.next/BUILD_ID`, ne pas se fier au pipe).
- **Serveur preview** : `pnpm --filter @femiglow/web start --port 3000` (Node 20). **Scanners i18n** (serveur up, Node 22) : `node scripts/i18n-scan-fr.mjs` (=0) et `node scripts/i18n-scan-latin-ar.mjs` (=0 hors `FemiGlow`). Doivent rester verts (INV-6).
- **next-intl** : `usePathname` de `@/i18n/navigation` **strippe** le préfixe locale → pour la V2, on lit `usePathname` de **`next/navigation`** (chemin brut AVEC locale). Idem côté moteur.
- **`<html dir/lang>`** : posé par un script inline dans `app/[locale]/layout.tsx` au load ; le hook le met à jour impérativement au switch. Ne pas dupliquer.
- **app_config** : on réutilise `getAppConfigRow(section)` / `upsertAppConfig` (sections `i18n_locale_config`, `i18n_suggestion_engine`) — **PAS** le registre `lib/admin-config` SECTIONS (ADR-009, zéro nouvelle table). Audit + snapshots + cache hérités.
- **Charte** : switcher = neutres uniquement (pas de pop chaud, pas de pulse, pas de drapeau/emoji) ; prompt sobre (crème/encre/sauge) ; motion 280 ms courbe `cubic-bezier(0.22,1,0.36,1)`.
- **Vocabulaire `reason` figé** (CONTRACT §7.3) : `engine-off`, `no-trigger`, `low-confidence`, `same-locale`, `budget`, `dismissed-persistent`, `defer-expired`, `<NEVER-*>`. **Ordre never-AVANT-engine-off** (en checkout la raison est `NEVER-CHECKOUT` même moteur off).

## DEFINITION OF DONE (par lot — CONTRACT §8)
1. `typecheck` 0 erreur sur fichiers touchés. 2. Tests du lot verts (+ 1 test négatif par invariant impacté). 3. Invariants couverts. 4. **Zéro régression** : scanners i18n=0, build vert, wizard intact, suite i18n verte. 5. Lint OK. 6. **Commit atomique** `feat(i18n): Lx — …` (gitleaks doit passer ; n'inclure aucun secret).

## PREMIÈRE ACTION
Lis `docs/locale-switcher-v2/CONTRACT.md` + `08-plan-action/plan-action.md` (L10), puis démarre **L10** : crée `suggestion-signals.ts` (+ tests des défauts sûrs), puis le détecteur de breakpoint, puis `use-locale-suggestion-engine.ts` (+ tests), en réutilisant `evaluateSuggestionPolicy`, `guessPreferredLocale`, `LocaleSuggestionPrompt`, `useLocaleSwitch`. Commit dès la porte verte.
