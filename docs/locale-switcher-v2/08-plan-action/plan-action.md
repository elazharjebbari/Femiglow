# Plan d'action détaillé — Locale Switcher V2

> Découpage en **lots** (`L0`…`L8`). Chaque lot = objectif, fichiers, **tests à écrire**, **commandes de vérif**, **Definition of Done** (CONTRACT §7). Aucun lot n'avance sans sa cible verte + garde de non-régression verte. Piloté par `09-runbook/runbook.md`.

## Vue d'ensemble

| Lot | Titre | Dépend de | Livrable |
|---|---|---|---|
| **L0** | Préparation (branche, flag, baseline) | — | Flag `localeSwitcherV2`, baseline verte |
| **L1** | Helpers purs (`buildSwitchUrl`, `deriveLocale`) | L0 | Helpers + tests unit |
| **L2** | Hook `useLocaleTransition` | L1 | Hook + tests (4 modes) |
| **L3** | Composants présentation (variantes + veil + announcer) | L2 | UI branchée derrière flag |
| **L4** | Backend config (table + API public/admin) | L0 | API + migration + tests |
| **L5** | Détection serveur + `LocaleNudge` | L4 | Nudge one-shot + tests |
| **L6** | Page admin `/admin/i18n` | L4 | UI admin + authz + audit |
| **L7** | E2E + a11y + garde-fous | L3,L5,L6 | Playwright + axe verts |
| **L8** | Bascule du flag (switcher) + livraison | L7 | Flag on, runbook de sortie |
| **L9** | Moteur — devinette + politique (pures) | L1 | `guessPreferredLocale` + `evaluateSuggestionPolicy` + tests table |
| **L10** | Moteur — runtime + prompt + transition | L2,L9 | `useLocaleSuggestionEngine` + `LocaleSuggestionPrompt` + breakpoints |
| **L11** | Moteur — config + admin + audit | L4,L9 | section `i18n_suggestion_engine` + onglet admin + vue audit |
| **L12** | Moteur — E2E + a11y + garde + activation progressive | L10,L11 | Playwright + audit + A/B profil par profil |

---

## L0 — Préparation
**Objectif.** Socle sûr, rien de visible.
**Étapes.**
1. Brancher `feat/locale-switcher-v2`.
2. Ajouter le flag `localeSwitcherV2` (off par défaut) selon le pattern repo.
3. Capturer la **baseline** : `pnpm typecheck`, `pnpm lint`, `pnpm build`, scanners i18n (= 0), Playwright switcher actuel vert.
**Tests.** Aucun nouveau ; on **fige** l'état vert.
**DoD.** Baseline verte archivée (runbook §B).

## L1 — Helpers purs
**Objectif.** Logique d'URL et de locale, **sans UI**.
**Fichiers.** `lib/i18n/build-switch-url.ts`, `deriveLocale` (dans `i18n.config` ou util).
**Comportement.** insert/replace du segment locale ; **préserve querystring/UTM** (INV-4) ; gère racine, chemins profonds, locale absente.
**Tests (Vitest, voir `vitest-plan.csv` IDs U-URL-*).**
- `/kit` + ar → `/ar/kit` ; `/fr/kit` + ar → `/ar/kit` ; `/fr` + ar → `/ar`.
- `/fr/kit?utm_source=ig&x=1` + ar → `/ar/kit?utm_source=ig&x=1`.
- `/fr/journal/post-1` + en → `/en/journal/post-1`.
- locale inconnue dans l'URL → défaut.
**Vérif.** `pnpm vitest run build-switch-url`.
**DoD.** 100 % des cas verts ; INV-4 couvert.

## L2 — Hook `useLocaleTransition`
**Objectif.** Le cœur no-reload (4 modes).
**Fichiers.** `components/i18n/use-locale-transition.ts` + helpers `announce`, `prefersReducedMotion`, `afterFade`.
**Comportement.** Voir `05-frontend/use-locale-transition.md`.
**Tests (Vitest IDs U-HOOK-*, MSW non requis).**
- no-op langue active (INV-11).
- chemin `reduced` (mock matchMedia) → apply direct, event `reduced`.
- chemin `vt` (mock `startViewTransition`) → `dir/lang` posés **avant** softnav (INV-2), event `vt`.
- chemin `veil` (pas de VT) → phases in→apply→out, event `veil`.
- `apply` échoue → `window.location.assign` appelé, event `reload`.
- double-clic → une seule transition.
**Vérif.** `pnpm vitest run use-locale-transition`.
**DoD.** 4 modes + no-op + fallback couverts ; INV-1,2,3,4,7,11 testés.

## L3 — Composants de présentation
**Objectif.** Brancher l'UI derrière le flag, sans changer le comportement flag-off.
**Fichiers.** `LocaleSwitcher` (variantes dropdown/pills/segmented), `LocaleItem`, `LocaleVeil`, `LiveAnnouncer` ; montage Header/Drawer/Footer/layout.
**Tests (Vitest intégration IDs I-SW-*, MSW config).**
- rendu endonymes (FR/AR/EN), **0 latin** sur /ar (INV-6).
- clic item → `switchTo(target, surface)` appelé avec bonne surface.
- langue active marquée (point sauge), non-cliquable (INV-11).
- clavier : ↑↓ Home End Esc, roving tabindex.
- config invalide/absente → défauts (INV-12).
- caché en contexte wizard/admin (INV-5).
**Vérif.** `pnpm vitest run LocaleSwitcher LocaleVeil`.
**DoD.** flag off = comportement identique ; flag on = nouvelle UI ; a11y clavier ok.

## L4 — Backend config
**Objectif.** Config éditable + lecture publique cachée.
**Fichiers.** migration `i18n_locale_config`, `app/api/i18n/config/route.ts` (public, ETag/cache), `app/api/admin/i18n/config/route.ts` (authz, validation Zod, audit), repo/queries.
**Tests (Vitest IDs I-API-*, MSW + DB de test).**
- `GET public` : 200 + payload conforme ; cache headers/ETag.
- validation : config invalide (2 défauts, default désactivé, endonyme vide) → 422 ; lecture publique → **défauts** (INV-12).
- `PUT admin` : 401 sans auth ; 200 + audit avec auth ; concurrence optimiste (conflict 409).
**Vérif.** `pnpm vitest run i18n-config`.
**DoD.** chemins succès/échec/authz couverts ; INV-12 testé.

## L5 — Détection serveur + Nudge
**Objectif.** Suggestion one-shot anti-flash.
**Fichiers.** `lib/i18n/suggested-locale.ts`, `LocaleNudge.tsx`, montage SSR.
**Tests (Vitest IDs U-DET-*, I-NUDGE-*).**
- précédence : cookie `NEXT_LOCALE` > Accept-Language > défaut.
- `Accept-Language: ar,fr` sur `/fr` → suggested `ar`, nudge montré 1×.
- dismiss → cookie `locale_nudge_dismissed` → plus jamais montré.
- jamais sur wizard ; accepté → `switchTo('ar','nudge')`.
- events `nudge_shown/accepted/dismissed` (payloads CONTRACT §4).
**Vérif.** `pnpm vitest run suggested-locale LocaleNudge`.
**DoD.** one-shot + précédence + events couverts ; pas de flash (résolu serveur).

## L6 — Page admin `/admin/i18n`
**Objectif.** Pilotage sans redéploiement.
**Fichiers.** `app/admin/i18n/page.tsx` + form + preview FR/AR/EN (dont RTL).
**Tests (Vitest/Playwright IDs I-ADMIN-*, E-ADMIN-*).**
- authz (rôle requis) ; non-autorisé → refus.
- toggle locale, edit endonyme, reorder, set default, toggle nudge → save + validation.
- garde-fous : impossible de désactiver le défaut / toutes les locales (confirmation destructive).
- preview reflète la config sans muter la locale réelle.
- audit : before/after enregistré.
**Vérif.** `pnpm vitest run admin-i18n` + `playwright --grep @locale-admin`.
**DoD.** authz + validation + audit + preview couverts.

## L7 — E2E + a11y + garde-fous
**Objectif.** Robustesse bout-en-bout.
**Tests (Playwright IDs E-*, axe).** Voir `playwright-plan.csv`. Couvre INV-1..INV-10 sur 6 pages × 3 locales + mobile drawer + footer + nudge + admin + wizard caché + clavier + reduced-motion + no-JS hreflang + axe par locale.
**Garde-fous.** scanners i18n = 0 ; build vert ; wizard intact.
**Vérif.** `pnpm playwright test --grep @locale-switcher` + scanners + build.
**DoD.** **coverage-matrix.csv** sans trou (chaque INV a ≥ 1 test vert).

## L8 — Bascule du flag + livraison
**Objectif.** Activer en prod, mesurer.
**Étapes.** flag on (ou A/B B1 vs B2) ; vérifier events `locale_switch` remontent ; tableau de bord par langue ; runbook de sortie + rollback prêt.
**DoD.** flag on stable, télémétrie OK, rollback testé (flag off = retour V1).

---

# Track moteur de suggestion (L9→L12)

> Voir `../10-suggestion-engine/`. Mêmes règles : chaque lot = code + tests + DoD ; **off par défaut** (INV-13) ; zones calmes inviolables (INV-14/15).

## L9 — Devinette + politique (fonctions PURES)
**Objectif.** Le « cerveau », sans UI, testable par table de vérité.
**Fichiers.** `lib/i18n/guess-preferred-locale.ts` (faisceau S1..S7), `lib/i18n/suggestion-policy.ts` (`evaluateSuggestionPolicy`), `lib/i18n/suggestion-signals.ts` (types + valeurs par défaut sûres).
**Comportement.** Voir `10-suggestion-engine/01-conception/detection-strategies.md` + `00-study/behavioral-profiles.md` §4.
**Tests (Vitest, IDs `05-tests/vitest-plan.csv`).**
- `guessPreferredLocale` : consensus AR (S1+S3+S4) ; contradiction (cookie fr vs accept ar) → confiance basse ; q-weights ; adLocale ; signal manquant → pas de vote, pas de crash ; IP-géo jamais seul.
- `evaluateSuggestionPolicy` (table de vérité) : engine off → `suppress('engine-off')` (INV-13) ; never **prime** trigger (checkout+trigger → suppress, INV-14) ; deep-read/fresh/fast-scroll → suppress ; budget/dismiss → suppress (INV-16) ; same-lang/low-conf → suppress ; éligible → `defer` puis `show` au breakpoint (INV-17) ; profil custom honoré (INV-18).
- valeurs par défaut sûres : signal absent ⇒ jamais `show`.
**Vérif.** `pnpm vitest run guess-preferred-locale suggestion-policy`.
**DoD.** Table de vérité complète ; **test négatif** par invariant (INV-13..17).

## L10 — Runtime + prompt + transition
**Objectif.** Collecte signaux, defer-to-breakpoint, prompt, acceptation sans reload.
**Fichiers.** `components/i18n/use-locale-suggestion-engine.ts`, `LocaleSuggestionPrompt.tsx`, détecteur de breakpoint ; câblage sur `useLocaleTransition`.
**Comportement.** Voir `10-suggestion-engine/04-frontend/engine-runtime.md`.
**Tests (Vitest intégration + Playwright).**
- moteur off → 0 listener, 0 prompt (INV-13).
- éligible mais pas de breakpoint → rien ; pause scroll → show (INV-17) ; TTL → abandon.
- checkout/form/deep-read → jamais (INV-14/15) — même trigger actif.
- accept → bascule sans reload via `useLocaleTransition` (INV-1).
- dismiss persistant → plus jamais (INV-16) ; jamais d'auto-redirect (INV-20).
- a11y non-modal + reduced-motion statique.
**Vérif.** `pnpm vitest run use-locale-suggestion-engine LocaleSuggestionPrompt` + Playwright `@locale-engine`.
**DoD.** Tous chemins (suppress/defer/show/accept/dismiss/abandon) couverts.

## L11 — Config + admin + audit
**Objectif.** Pilotage total + observabilité (INV-18/19).
**Fichiers.** seed section `i18n_suggestion_engine` (app_config) ; onglet « Moteur » `/admin/i18n` ; vue `/admin/i18n/engine/audit` ; validation Zod (`engine off si invalide`, plancher zones calmes).
**Comportement.** Voir `10-suggestion-engine/02-config/{engine-config-schema.yaml,admin-feature-spec.md,audit-model.md}`.
**Tests.**
- config invalide → moteur off (INV-13) ; checkout/form never non désactivable (INV-14 floor).
- admin : activer/désactiver global + par profil ; **créer/éditer/supprimer** profils trigger **et** never (INV-18) ; dry-run/simulate ; authz ; audit before/after.
- vue d'audit reflète montré/supprimé + raison + profil (INV-19).
**Vérif.** `pnpm vitest run suggestion-engine-config` + `playwright --grep @locale-engine-admin`.
**DoD.** CRUD profils + dry-run + audit + plancher zones calmes couverts.

## L12 — E2E + a11y + garde + activation progressive
**Objectif.** Robustesse bout-en-bout + sortie maîtrisée.
**Tests (Playwright IDs `05-tests/playwright-plan.csv`).** off-par-défaut ; activer `TRIG-ENTRY-MISMATCH` → prompt **au breakpoint seulement** ; jamais en checkout/deep-read ; dismiss persiste ; accept = no-reload ; exit-intent toast (desktop) ; idle-break (mobile) ; reduced-motion statique ; clavier + axe ; audit cohérent ; **0** suppression-en-zone-calme manquée.
**Garde-fous.** scanners i18n = 0 ; wizard intact ; build vert.
**Activation.** flag `localeSuggestionEngine` off → on **profil par profil**, sous A/B + lecture d'audit (acceptation, dismiss<2s, suppressions zones calmes = 0).
**DoD.** `10-suggestion-engine/05-tests/coverage-matrix.csv` sans trou (INV-13..INV-20, chacun ≥ 1 test + 1 négatif) ; activation documentée + rollback (flag off / `engineEnabled=false`).
