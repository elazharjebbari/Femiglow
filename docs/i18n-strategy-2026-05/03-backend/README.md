# 03 — Backend i18n

> Tout ce qui touche au **serveur** dans la stratégie i18n FemiGlow : où stocker les traductions, comment les servir via RSC, quelles routes API exposer, comment garantir le SEO multilingue, comment gérer le contenu CMS traduit, et comment résoudre la locale d'un visiteur côté edge.

## TL;DR

| Aspect | Décision V1 | Notes |
|---|---|---|
| **Stockage strings UI** | JSON statiques `apps/web/messages/[locale].json` | Bundlé au build, edge-cache CDN |
| **Stockage content CMS** | Table `component_field_bindings` (`locale` déjà présent) | Multilingue-ready, pas de migration majeure |
| **Stockage pages légales** | Table `legal_pages` (`locale` déjà présent) | Variante par locale, fallback FR |
| **Catalog clés** | Optionnel : table `i18n_translation_keys` pour coverage tracking | Hybride : JSON = source, DB = miroir |
| **Library** | `next-intl` 3.x avec `createMiddleware` | Routing `/[locale]/...` + RSC support |
| **Détection locale** | path > cookie `NEXT_LOCALE` > Accept-Language > `fr` | Middleware edge (~ 15ms overhead) |
| **API admin** | 7 endpoints sous `/api/admin/i18n/*` + 3 publics sous `/api/i18n/*` | Auth requise sur admin, rate-limit 60 req/min |
| **SEO** | hreflang + canonical par locale + sitemap multi-locale | JSON-LD `inLanguage` propre |
| **RSC** | `getTranslations()` server-only + `generateStaticParams` pour 3 locales | Pas de waterfall, streaming OK |
| **Fallback** | Locale fallback chain depuis `i18n_locales.fallback_locale` | Log Sentry sur clé manquante |

## Pourquoi ces choix

1. **JSON statiques** : zero-cost runtime, bundle splitting natif, type-safety via TS module augmentation, lecture par humains pour le traducteur.
2. **DB pour CMS** : le contenu CMS varie sans déploiement (fondatrice édite `/admin/cms`), donc doit être dynamique. La colonne `locale` existe déjà — on étend juste l'UI admin.
3. **next-intl** : score 88/100 dans le benchmark (`01-options-techniques/comparaison-libraries.md`), seule library testée vraiment RSC-first sur App Router Next 14.
4. **Middleware edge** : la résolution doit être instantanée pour ne pas dégrader le TTFB. next-intl fait ça en ~ 5-15ms sur Vercel edge.
5. **API admin séparées des publiques** : public = cacheable CDN, admin = auth + audit log.

## Sommaire du sous-dossier

| Fichier | Sujet | Lecture |
|---|---|---|
| [`README.md`](./README.md) | Ce fichier — index et TL;DR | 5 min |
| [`translation-store.md`](./translation-store.md) | Stockage des messages : JSON vs DB, structure, validation, cache, lazy-loading | 25 min |
| [`api-routes.md`](./api-routes.md) | Spécification complète des 10 routes API i18n (signatures, Zod, Drizzle, curl) | 30 min |
| [`server-rendering.md`](./server-rendering.md) | Patterns RSC : `getTranslations()`, `generateStaticParams`, `unstable_setRequestLocale`, hydration, streaming | 25 min |
| [`seo-canonicals.md`](./seo-canonicals.md) | Metadata multilingue, hreflang, sitemap, robots, JSON-LD, OpenGraph par locale | 25 min |
| [`content-translation.md`](./content-translation.md) | Extension de `component_field_bindings` pour multi-locale, UI admin, fallback CMS, workflow traducteur | 25 min |
| [`locale-resolver.md`](./locale-resolver.md) | Algorithme middleware `createMiddleware`, custom resolver, edge cases (bots, crawlers, missing locale) | 20 min |

**Total** : ~2h30 pour lire le sous-dossier complet.

## Comment lire ce sous-dossier

### Lecture rapide (30 min)
1. Ce `README.md` (vous y êtes)
2. `translation-store.md` § 1-3 (stockage)
3. `api-routes.md` § 1 (vue d'ensemble)
4. `server-rendering.md` § 1-2 (patterns RSC)

### Lecture lead technique (1h30)
- Tout `translation-store.md`
- Tout `server-rendering.md`
- `locale-resolver.md` complet (impact edge runtime)
- `api-routes.md` § 1, 2, 4 (focus sur sécurité + Drizzle)

### Lecture dev d'implémentation (2h30)
- Lecture séquentielle des 6 fichiers
- Croiser avec `02-design-conception/api-contracts.md` (signatures déjà spécifiées)
- Croiser avec `02-design-conception/data-model.md` (schémas DB)

### Lecture traducteur / content (45 min)
- `content-translation.md` complet
- `translation-store.md` § 2 (structure JSON)
- `api-routes.md` § 3.6, 3.7 (export/import CSV)

## Dépendances et références croisées

Ce sous-dossier suppose la lecture préalable de :

- [`00-context/etat-actuel.md`](../00-context/etat-actuel.md) — pour comprendre les tables déjà multilingue-ready
- [`01-options-techniques/comparaison-libraries.md`](../01-options-techniques/comparaison-libraries.md) — pour le choix `next-intl`
- [`02-design-conception/api-contracts.md`](../02-design-conception/api-contracts.md) — signatures des helpers et endpoints
- [`02-design-conception/data-model.md`](../02-design-conception/data-model.md) — schémas DB existants + à créer
- [`02-design-conception/locale-detection.md`](../02-design-conception/locale-detection.md) — algorithme de résolution
- [`02-design-conception/url-strategy.md`](../02-design-conception/url-strategy.md) — décision routing `/[locale]/...`
- [`02-design-conception/naming-conventions.md`](../02-design-conception/naming-conventions.md) — règles de nommage des clés

Et est référencé par :

- `04-frontend/` — Components consomment `getTranslations()` et les API client
- `06-data-strategy/` — Migration data et workflow content
- `07-tests/` — Tests d'intégration des endpoints API
- `08-plan-action/` — Ordre d'implémentation des fonctionnalités backend
- `10-monitoring/` — Alerts sur les coverage et les erreurs i18n

## Glossaire backend i18n

| Terme | Définition |
|---|---|
| **Locale** | Identifiant BCP-47 d'une langue+région (ex: `fr`, `ar`, `en`, `fr-MA`). V1 : `fr`, `ar`, `en`. |
| **Messages** | Le dictionnaire des strings UI traduits pour une locale donnée. Stocké en JSON. |
| **Namespace** | Premier niveau de la clé de traduction (ex: `marketing`, `wizard`, `common`). |
| **ICU MessageFormat** | Standard de format pour pluriels, sélections, nombres, dates. Utilisé par next-intl. |
| **Fallback chain** | Ordre de résolution si une clé manque dans la locale demandée. |
| **`getTranslations()`** | API server-only de next-intl pour utiliser i18n dans un RSC. |
| **`useTranslations()`** | API isomorphique de next-intl (RSC + Client). |
| **`unstable_setRequestLocale`** | Helper next-intl pour activer le rendu statique d'une page localisée. |
| **`generateStaticParams`** | API Next.js pour pré-générer les versions par locale au build. |
| **hreflang** | Tag HTML qui indique à Google les versions traduites d'une page. |
| **Edge middleware** | Code exécuté au plus proche de l'utilisateur (Cloudflare/Vercel edge), avant que la requête atteigne le serveur. |

## Anti-patterns globaux à éviter

Cf. détail dans chaque fichier, mais les pièges classiques :

1. **Charger `messages/*.json` dans un Client Component sans wrapper** : casse l'hydratation, perd le typage.
2. **Mettre les pages légales (12+ kB chacune) dans `messages.json`** : explose la taille du bundle. Garder en `legal_pages.body_md`.
3. **Oublier `unstable_setRequestLocale(locale)` dans une page RSC statique** : next-intl 3 throw si pas appelé avant `getTranslations`.
4. **Détecter la locale dans la page elle-même** : doit être fait dans le middleware pour avoir un cache CDN efficace.
5. **Hardcoder l'URL canonical sans locale** : tue le SEO multilingue. Toujours `canonical = /[locale]/path`.
6. **Servir des données CMS sans `WHERE locale = ?` avec fallback** : utilisateur AR voit du contenu FR sans le savoir, dégrade la UX.

## Checklist globale backend i18n

À l'issue de l'implémentation backend, vérifier :

- [ ] `middleware.ts` redirige bien `/` → `/fr/` (ou détection cookie/header)
- [ ] `/api/admin/i18n/*` exigent un admin role (test : 401 sans auth)
- [ ] `/api/i18n/coverage` rend < 200ms (test perf)
- [ ] `getTranslations()` fonctionne dans une page RSC statique
- [ ] `generateStaticParams` produit `/fr/kit`, `/ar/kit`, `/en/kit` au build
- [ ] `hreflang` présent sur les 6 pages principales (`/`, `/maison`, `/kit`, `/rituel`, `/contact`, `/journal`)
- [ ] `sitemap.xml` liste les 3 locales × N pages
- [ ] `robots.txt` autorise tous les crawlers sur toutes les locales
- [ ] Fallback FR fonctionne si clé manquante en AR (test : ajouter clé manquante)
- [ ] Log Sentry sur clé manquante (test : `t('non.existent')`)
- [ ] CMS admin permet de saisir une variante AR pour un composant existant
- [ ] Export CSV depuis `/api/admin/i18n/export` valide pour traducteur externe
- [ ] Import CSV : 0 erreur sur fichier valide, errors listées sur fichier invalide
- [ ] Rate limit admin endpoints actif (test : 61 req/min → 429)
