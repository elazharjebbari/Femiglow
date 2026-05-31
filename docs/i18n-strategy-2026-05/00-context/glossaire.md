# Glossaire i18n

Vocabulaire utilisé tout au long du dossier d'étude.

## A — Concepts généraux

| Terme | Définition |
|---|---|
| **i18n** | Internationalization (`i` + 18 lettres + `n`). Capacité technique du code à supporter plusieurs langues. |
| **l10n** | Localization. Adaptation du contenu à une langue/culture spécifique (traduction + format dates + devises + RTL). |
| **g11n** | Globalization = i18n + l10n + business considerations (taxes, légal, paiement). |
| **Locale** | Identifiant complet langue + région (ex: `fr-FR`, `fr-MA`, `ar-MA`, `en-US`). Format BCP-47. |
| **Language** | Code ISO 639-1 (ex: `fr`, `ar`, `en`). Souvent confondu avec locale. |
| **Region** | Code ISO 3166 (ex: `FR`, `MA`, `US`). Combiné à language → locale. |
| **Default locale** | Locale par défaut si aucune détectée (FemiGlow : `fr` ou `fr-MA`). |

## B — Format / standards

| Terme | Définition |
|---|---|
| **BCP-47** | Standard IETF pour les locales (ex: `ar-MA`, `zh-Hans-CN`). |
| **ICU MessageFormat** | Standard Unicode pour interpolation + pluralization (`{count, plural, =0 {none} one {# review} other {# reviews}}`). |
| **CLDR** | Common Locale Data Repository (Unicode). Données de formats date/nombre/devise. |
| **Intl API** | API navigateur native : `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.PluralRules`, `Intl.RelativeTimeFormat`. |

## C — Structures de données

| Terme | Définition |
|---|---|
| **Message** | Une chaîne traduisible avec une clé (ex: `common.continue` → `"Continuer"`). |
| **Key** | Identifiant d'un message (ex: `wizard.lead.title`). |
| **Namespace** | Groupement de messages par contexte (ex: `wizard`, `marketing`, `legal`). |
| **Dictionary** | Map { key → translated string } pour une locale (ex: `dictionaryFr`). |
| **Catalog** | Synonyme de dictionary (terme historique gettext). |
| **Bundle** | Fichier(s) contenant les messages d'une locale (souvent JSON). |
| **Translation memory (TM)** | DB de traductions passées pour réutilisation (TMS feature). |

## D — Outils et workflows

| Terme | Définition |
|---|---|
| **TMS** | Translation Management System (Crowdin, Lokalise, Phrase, Transifex). |
| **CAT tool** | Computer-Assisted Translation tool (SDL Trados, MemoQ). Pour traducteurs pros. |
| **Crowdin / Lokalise / Phrase** | TMS SaaS populaires (subscription monthly). |
| **i18n Ally** | Extension VS Code populaire pour edit translations inline. |
| **react-i18next** | Library JS React-native (pages router). |
| **next-intl** | Library spécifique Next.js App Router (RSC-first). |
| **paraglide-js** | Library moderne ICU-first, bundle léger. |
| **Lingui** | Library focus macro JSX (`<Trans>...</Trans>`). |

## E — Concepts UI/UX

| Terme | Définition |
|---|---|
| **RTL** | Right-to-Left (arabe, hébreu). Direction de lecture inverse. |
| **LTR** | Left-to-Right (français, anglais, espagnol). |
| **BiDi** | Bidirectional text (mix LTR + RTL dans même paragraphe). |
| **Logical properties** | CSS `margin-inline-start` au lieu de `margin-left` (auto-adapté RTL). |
| **Locale switcher** | UI permettant à l'utilisateur de changer la langue (dropdown / icône globe / boutons). |
| **Pseudo-localization** | Test technique : remplacer FR par `[Très long pseudo-français accentué é à î ô]` pour détecter overflow UI. |

## F — Concepts techniques Next.js

| Terme | Définition |
|---|---|
| **App Router** | Next 13+ architecture (`app/` directory). |
| **RSC** | React Server Components — rendu côté serveur, pas client. |
| **Middleware** | `middleware.ts` racine — intercepte les requêtes avant le rendu. |
| **`generateMetadata`** | Function async qui retourne les metadata (title, description, OG) par page. |
| **Server Action** | Function `'use server'` appelable depuis client. |
| **`use client`** | Directive pour composant client-side. |
| **`headers()` / `cookies()`** | API server pour lire request headers / cookies. |
| **Dynamic route segment** | `app/[locale]/page.tsx` — `locale` est un param dynamic. |

## G — Concepts SEO

| Terme | Définition |
|---|---|
| **hreflang** | Attribute `<link rel="alternate" hreflang="ar">` — signale les variantes linguistiques à Google. |
| **`x-default`** | Valeur `hreflang` pour la version par défaut si aucune détectée. |
| **Canonical URL** | URL "officielle" d'une page pour éviter duplicate content. |
| **Sitemap multi-lang** | XML sitemap listant toutes les URLs par locale. |
| **JSON-LD `inLanguage`** | Propriété Schema.org pour indiquer la langue d'une entity. |

## H — Concepts performance

| Terme | Définition |
|---|---|
| **Code splitting** | Découper le JS pour ne charger que la locale active. |
| **Lazy loading** | Charger les messages à la demande (vs build-time). |
| **SSR translation** | Traduction rendue côté serveur (vs hydratation client). |
| **Streaming SSR** | Next.js stream les composants au fur et à mesure (RSC). |

## I — Termes business

| Terme | Définition |
|---|---|
| **Source language** | Langue d'origine du contenu (FemiGlow : FR). |
| **Target language** | Langue de traduction cible. |
| **Translation coverage** | % des messages traduits par locale (cible : 100% pour locales actives). |
| **Translation freshness** | Date dernière revue d'une traduction (utile si le source FR change). |
| **In-context translation** | Traduire en voyant le rendu UI (pas juste les strings isolées). |

## J — Sigles courants

- **i18n** — Internationalization
- **l10n** — Localization
- **g11n** — Globalization
- **a11y** — Accessibility
- **TMS** — Translation Management System
- **ICU** — International Components for Unicode
- **CLDR** — Common Locale Data Repository
- **BCP-47** — Best Current Practice 47 (locale tag standard)
- **ISO 639-1** — Standard codes langue (2 lettres)
- **ISO 3166-1** — Standard codes pays (2 lettres)
- **UTF-8** — Encoding Unicode universel
- **RTL** — Right-to-Left
- **BiDi** — Bidirectional
- **SSR** — Server-Side Rendering
- **RSC** — React Server Components
- **OG** — Open Graph (meta tags social)
