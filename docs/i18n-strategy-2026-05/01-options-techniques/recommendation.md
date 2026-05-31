# Recommandation finale

> Synthèse argumentée pour décision.

## TL;DR

**Pour FemiGlow** : **`next-intl`** (path-based routing) + **JSON files** + **DB pour CMS dynamique** + **Tailwind logical properties pour RTL** + **WizardDictionary CHA-231 conservé**.

## Justification courte

1. **next-intl** = best fit Next.js 14 App Router (RSC natif)
2. **Path-based** = SEO optimal + partageabilité
3. **JSON** = cohérent stack actuelle, gratuit, git workflow
4. **DB** existante pour CMS = pas refonte
5. **Tailwind logical properties** = 0 dépendance plugin
6. **Wizard CHA-231** conservé = pas de régression

## Détail de la recommandation

### Architecture cible

```
┌──────────────────────────────────────────────────────────┐
│                  CLIENT (Browser)                         │
│  GET /fr/kit                                              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│         Next.js Edge Middleware (middleware.ts)           │
│   - next-intl/middleware                                  │
│   - Resolve locale (path > cookie > Accept-Language)      │
│   - Set request context                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│         app/[locale]/(marketing)/page.tsx (RSC)           │
│   - getTranslations() server                              │
│   - generateMetadata() localized                          │
└──────────────────┬──────────────────────────────────────┘
                   │           │
              ┌────┴────┐      └────────┐
              ▼         ▼               ▼
   ┌──────────────┐ ┌──────────┐ ┌────────────┐
   │ messages/    │ │ Postgres │ │ Wizard     │
   │ fr.json      │ │ DB       │ │ Dictionary │
   │ ar.json      │ │ (CMS)    │ │ (CHA-231)  │
   │ en.json      │ │ locale=fr│ │ FR/AR      │
   └──────────────┘ └──────────┘ └────────────┘
```

### Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Library i18n | **next-intl v3** | RSC + routing + ICU |
| Routing | **Path-based** (`/[locale]/`) | SEO + partageable |
| Messages static | **JSON in `messages/`** | Git workflow + simplicité |
| Messages dynamiques (CMS) | **DB Drizzle (locale column)** | Schema existe déjà |
| Wizard | **WizardDictionary (CHA-231)** | Préserver type-safety actuelle |
| Pluralization | **Intl.PluralRules natif** | next-intl wrap |
| Date/number/currency | **Intl.* natif via next-intl** | Standard |
| RTL CSS | **Tailwind logical properties** | Pas de dep |
| RTL HTML | **`<html dir="rtl">` dynamic** | next-intl helper |
| Locale detection | **Path → Cookie → Accept-Language → IP** | next-intl middleware |
| TypeScript | **Module augmentation** | Type-safe `t('hero.title')` |
| Validation locale | **Zod enum** | Runtime check |
| Workflow translateur | **PR GitHub + template** | Gratuit, simple |
| TMS optionnel | **Crowdin Free Plan** si volume | Plan tier 0$ |

### Roadmap technique 11 semaines

| Semaine | Objectif |
|---|---|
| S0 | Étude validée + ADRs signés |
| S1 | Setup next-intl + middleware + 1 page test (`/fr/kit` → `/en/kit`) |
| S2 | Extraction strings `/kit` + traduction EN |
| S3 | Extraction strings `/maison` + `/rituel` |
| S4 | Extraction `/contact` + `/journal` + ESLint rule |
| S5 | UI Admin onglets locale pour CMS |
| S6 | Activation AR + RTL + audit Tailwind |
| S7 | Pages légales multilangues + emails |
| S8 | Tests denses (unit + integration + E2E + a11y) |
| S9 | Tests visual regression + perf |
| S10 | Pré-prod staging + smoke |
| S11 | Deploy prod + monitoring |

## Alternative considérée mais rejetée

### Pourquoi PAS `paraglide-js` (option C, score 75)

Bien que techniquement supérieur en perf (1kB vs 5kB), paraglide perd sur :
- Doc plus difficile (en évolution)
- Communauté plus petite
- Pas de helper `Link` aussi mature
- Risque pivot library

→ Trop tôt pour FemiGlow (1-2 ans encore).

### Pourquoi PAS `next-i18next` (score 65)

App Router orienté de force → fork ou tricks. Risque maintenance long terme.

### Pourquoi PAS maison (score 55)

Trop de réinvention :
- Middleware locale
- Sitemap multi-lang
- hreflang auto
- Pluralization
- Date/number formatters
- TypeScript codegen

→ ~2-3 sprints juste pour réinventer la roue. ROI faible.

### Pourquoi PAS subdomain

- DNS config trop complexe pour FemiGlow seule
- Cookie auth cross-subdomain (`.femiglow.ma`) possible mais brittle
- Coût admin > bénéfice SEO

→ Path-based suffit largement.

## Risques identifiés et mitigations

| # | Risque | Impact | Mitigation |
|---|---|---|---|
| R1 | Migration progressive crée des routes bilingues partielles | Moyen | Feature flag + checklist par route |
| R2 | next-intl v4 breaking changes | Moyen | Pin version, lire CHANGELOG, ne pas upgrader hâtivement |
| R3 | Strings hardcoded oubliés | Élevé | ESLint plugin `eslint-plugin-formatjs` ou custom rule |
| R4 | RTL break composants admin | Moyen | Tests visuels Playwright + audit Tailwind |
| R5 | Traduction AR auto IA = qualité médiocre | Élevé | Review humaine obligatoire avant publish |

## Décisions ouvertes pour validation fondatrice/lead

| # | Question | Recommandation |
|---|---|---|
| Q1 | Path-based routing OK ? | ✅ Oui |
| Q2 | next-intl OK ? | ✅ Oui |
| Q3 | JSON files dans repo OK ? | ✅ Oui |
| Q4 | DB pour CMS (component_field_bindings.locale) ? | ✅ Oui (schema existe) |
| Q5 | Crowdin Free Plan ou PR GitHub ? | PR GitHub V1, Crowdin si volume > 5000 strings |
| Q6 | Wizard CHA-231 conservé OK ? | ✅ Oui |
| Q7 | RTL via Tailwind logical OK ? | ✅ Oui |
| Q8 | Default locale `fr` (vs `fr-MA`) ? | ✅ `fr` (simple) |
| Q9 | Locales V1 : FR + AR + EN ? | ✅ Oui |
| Q10 | Migration progressive route par route ? | ✅ Oui |

## Prochaines étapes

1. **Validation ADRs** par fondatrice + lead technique (1 réunion 30 min)
2. **Création branche `feat/i18n-foundation`** et plan d'action détaillé
3. **Phase 1 (semaine 1)** : install next-intl + middleware + 1 page test
4. **Plan d'action complet** dans [`08-plan-action/phases.md`](../08-plan-action/phases.md)
