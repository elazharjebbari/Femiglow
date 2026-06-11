# 04 — Frontend i18n FemiGlow

> **Mission** : décrire comment les composants React (RSC + Client) consomment, formattent et basculent les traductions servies par `next-intl`. Tout ce qui se passe **au-dessus** du middleware (cf. `02-design-conception/`) et **en-dessous** du workflow translateur (cf. `06-data-strategy/`).

## TL;DR frontend i18n

| Question | Réponse |
|---|---|
| Library | `next-intl` v3.x — déjà acté (ADR-001) |
| Récupération des messages | RSC : `getTranslations` / Client : `useTranslations` |
| Provider | `<NextIntlClientProvider>` posé dans `src/app/[locale]/layout.tsx` |
| Type-safety | Module augmentation `IntlMessages` depuis `messages/fr.json` |
| Switcher | Composant `<LocaleSwitcher />` dans `Header` + footer mobile, preserve pathname |
| Pluralization | ICU MessageFormat natif `next-intl` (gestion des 6 formes arabes) |
| Formatting | `useFormatter()` next-intl + helpers `Intl.DateTimeFormat` / `Intl.NumberFormat` |
| Bundle | Chunks per-locale via `dynamic import('@/messages/[locale].json')` + preload critical |
| RTL | `<html dir="rtl">` injecté par layout + Tailwind logical (`ms-*`, `me-*`) |
| Wizard checkout | Garde `WizardDictionary` existant (CHA-231) — ne pas régresser |

## Diagramme — flux de traduction côté client

```
┌──────────────────────────────────────────────────────────┐
│ middleware.ts (next-intl)                                │
│  - Détecte locale (path / cookie / Accept-Language)      │
│  - Rewrite → /[locale]/*                                  │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ src/app/[locale]/layout.tsx (RSC)                         │
│  - getMessages() depuis /messages/[locale].json          │
│  - <html lang dir> par locale config                     │
│  - <NextIntlClientProvider messages>                     │
└──────────────────────┬───────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌──────────────────┐         ┌──────────────────────┐
│ RSC pages         │         │ Client Components    │
│  getTranslations  │         │  useTranslations     │
│  getFormatter     │         │  useFormatter        │
└────────┬─────────┘         └──────────┬───────────┘
         │                              │
         ▼                              ▼
┌──────────────────────────────────────────────────────────┐
│ <h1>{t('marketing.hero.title')}</h1>                      │
│ <LocaleSwitcher />                                        │
│ {format.dateTime(date, { dateStyle: 'medium' })}          │
└──────────────────────────────────────────────────────────┘
```

## Table of contents

| # | Fichier | Sujet | Pour qui |
|---|---|---|---|
| 1 | [`component-strategy.md`](./component-strategy.md) | Patterns RSC vs Client, refactor pas-à-pas, props vs provider | Devs |
| 2 | [`translation-keys.md`](./translation-keys.md) | Workflow ajout clé, codegen, ESLint, IDE setup | Devs + tooling |
| 3 | [`locale-switcher.md`](./locale-switcher.md) | Composant switcher complet (TSX + tests + a11y) | Devs + UX |
| 4 | [`pluralization.md`](./pluralization.md) | ICU MessageFormat, formes arabes, fallback | Devs + traducteurs |
| 5 | [`date-currency-formatting.md`](./date-currency-formatting.md) | `useFormatter`, MAD/EUR/USD, dates FR/AR/EN | Devs |
| 6 | [`lazy-loading.md`](./lazy-loading.md) | Bundle splitting, dynamic import, Lighthouse | Perf engineers |

## Principes directeurs

### Principe 1 — RSC first

Les pages publiques sont **RSC par défaut**. On bascule en Client **uniquement** quand :
- Interactivité (`onClick`, `onChange`, state local)
- Hook React (`useState`, `useEffect`)
- API navigateur (`window`, `localStorage`)

→ Conséquence : utiliser `getTranslations` (server-only) chaque fois que possible. `useTranslations` reste pour les feuilles interactives (boutons, formulaires).

### Principe 2 — Aucun string hardcoded

Toute chaîne lisible utilisateur > 2 mots passe par `t('namespace.key')`. ESLint custom rule `i18n/no-hardcoded-strings` bloque les régressions en CI (cf. `translation-keys.md` §4).

Exceptions tolérées :
- Strings purement techniques (`'utf-8'`, `'application/json'`)
- Noms propres (`'FemiGlow'`, `'CMI'`, `'WhatsApp'`)
- Tests / mocks / fixtures

### Principe 3 — Type-safety bout en bout

`messages/fr.json` est la source de vérité. Un fichier `src/types/next-intl.d.ts` augmente le module pour que TS connaisse toutes les clés. Conséquence :

```tsx
const t = useTranslations('marketing.hero');
t('title');           // OK
t('non_existent');    // ERROR TS2345
```

### Principe 4 — Pas de provider client global custom

On utilise `<NextIntlClientProvider>` posé une seule fois dans le layout `[locale]`. Pas d'autre Context custom pour i18n — sinon double source de vérité.

Exception : `WizardDictionary` reste séparé (déjà éprouvé CHA-231) car il sert un domaine fonctionnel autonome (tunnel checkout) avec son propre cycle de vie.

### Principe 5 — Pluralization via ICU, jamais via if/else

```tsx
// MAUVAIS
{count === 0 ? 'Panier vide' : count === 1 ? '1 article' : `${count} articles`}

// BON
{t('cart.items_count', { count })}
// messages/fr.json : "{count, plural, =0 {Panier vide} =1 {1 article} other {# articles}}"
```

Notamment **obligatoire pour l'arabe** qui a 6 formes (zero, one, two, few, many, other).

### Principe 6 — Formats via `useFormatter`, jamais via concat

```tsx
// MAUVAIS
<span>Prix : {price} MAD</span>

// BON
const format = useFormatter();
<span>{format.number(price, { style: 'currency', currency: 'MAD' })}</span>
// FR : "199,00 MAD"
// AR : "199,00 د.م."  (avec chiffres arabes si numberingSystem='arab')
// EN : "MAD 199.00"
```

## Périmètre couvert vs hors périmètre

### Couvert dans ce dossier

- Patterns RSC/Client avec `next-intl`
- Workflow dev pour ajouter / renommer une clé
- Composant `<LocaleSwitcher />` complet
- Pluralization ICU et particularités AR
- Formatting (date, currency, relative time)
- Bundle splitting et stratégies de chargement

### Hors périmètre (voir autres dossiers)

| Sujet | Dossier |
|---|---|
| Middleware locale + routing | `02-design-conception/url-strategy.md` |
| API routes admin i18n | `03-backend/` |
| Locale switcher UX (mockups) | `05-ui-ux-design/` |
| Workflow translateur (Crowdin) | `06-data-strategy/` |
| Tests E2E i18n | `07-tests/` |
| Phases d'implémentation | `08-plan-action/` |

## Conventions du sous-dossier

- **Code TSX** : tous les exemples sont compilables (pas de pseudo-code). Imports complets en tête de fichier.
- **Langue commentaires** : commentaires TS en anglais (cohérent avec base actuelle), explications hors-code en français.
- **Anti-patterns** : marqués avec section dédiée par fichier. Toujours montrer "MAUVAIS" et "BON" côte à côte.
- **Checklists** : à la fin de chaque fichier — pour code review et onboarding.

## Statut

| Fichier | Statut | Pages | Dernière revue |
|---|---|---|---|
| `README.md` | Draft | ~6 KB | 2026-05-27 |
| `component-strategy.md` | Draft | ~12 KB | 2026-05-27 |
| `translation-keys.md` | Draft | ~10 KB | 2026-05-27 |
| `locale-switcher.md` | Draft | ~14 KB | 2026-05-27 |
| `pluralization.md` | Draft | ~10 KB | 2026-05-27 |
| `date-currency-formatting.md` | Draft | ~11 KB | 2026-05-27 |
| `lazy-loading.md` | Draft | ~10 KB | 2026-05-27 |

À valider avec lead technique avant phase 1 du plan d'action (`08-plan-action/phases.md`).
