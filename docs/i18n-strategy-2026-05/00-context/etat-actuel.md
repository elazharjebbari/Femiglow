# État actuel — audit i18n du projet FemiGlow

> **Date audit** : 27 mai 2026 — branche `fix/legal-pages-pollution-and-privacy` (cohérent avec master).

## 1. Stack actuelle

| Composant | Version | Notes |
|---|---|---|
| Next.js | 14.x (App Router) | RSC + Server Actions activés |
| React | 18.x | Strict mode actif |
| TypeScript | 5.9.x | Strict mode |
| Drizzle ORM | 0.45 | PostgreSQL (Neon en prod, local Postgres en dev) |
| Tailwind CSS | 3.x | Pas de plugin RTL actuel |
| Zod | 3.x | Validation runtime |
| Vitest | 2.1.9 | 7159+ tests unit |
| Playwright | dernière | ~50 specs E2E |

## 2. Infrastructure i18n existante

### 2.1 ✅ Wizard checkout — `src/lib/checkout/i18n/` (CHA-231)

**Architecture en place** :

```
src/lib/checkout/i18n/
├── dictionary.ts              # Interface WizardDictionary type-safe
├── use-wizard-translation.ts  # Hook React
└── locales/
    ├── fr.ts                  # 100% complet — voix FemiGlow
    └── ar.ts                  # Existant mais désactivé côté UI
```

**Pattern** :

```typescript
// dictionary.ts
export interface WizardDictionary {
  common: {
    back: string;
    continue: string;
    cancel: string;
    // ...
  };
  lead: { /* ... */ };
  // ...
}

// locales/fr.ts
export const dictionaryFr: WizardDictionary = {
  common: { back: 'Retour', continue: 'Continuer', /* ... */ },
  lead: { /* ... */ },
};
```

**Forces** :
- ✅ Type-safe (TS compile erreur si clé manque entre locales)
- ✅ Pas de dépendance externe
- ✅ Voix FemiGlow respectée (sobre, posée, pas d'urgence factice)

**Limites** :
- ❌ Couvre uniquement le wizard checkout (PAS les pages marketing)
- ❌ Pas de routing locale-aware
- ❌ Pas de pluralization avancée (mentionné dans le code comme "à faire si besoin")
- ❌ Pas de fallback chain (si AR manque une clé → crash compilation, pas fallback FR runtime)
- ❌ AR existant mais **`formContext.language === 'fr'` toujours forcé** dans le code

### 2.2 ✅ Catégories i18n — `src/lib/i18n/categories.ts`

Existe mais minimal — catégories produits localisées seulement.

### 2.3 ✅ Champs `language` / `locale` en DB

15+ tables ont déjà un champ de langue :

| Table | Champ | Type | Usage |
|---|---|---|---|
| `chat_session` | `language` | text default 'fr' | Langue de la conversation chat |
| `chat_message` | `language` | text | Langue détectée du message |
| `chat_lead` | `language` | text | Langue capture lead |
| `chat_faq_entry` | `language` | text | FAQ multilingue chat |
| `chat_knowledge_source` | `language` | text | Source de connaissance chat |
| `chat_intent_centroid` | `language` | text | Centroid intent par langue |
| `chat_intent_example` | `language` | text | Exemple intent |
| `component_field_bindings` | `locale` | text default 'fr' | **CMS — clé pour multilingue** |
| `component_field_history` | `locale` | text | Historique CMS |
| `legal_pages` | `locale` | text | **Pages légales par langue** |
| `seo_audit_snapshots` | `locale` | text | SEO multi-langue |
| `seo_overrides` | `locale` | text | Override SEO par langue |
| `ritual_testimonials` | `language` | text | Testimonials multilingues |
| `insights_event_daily` | `locale` | text | Analytics par langue |
| `tracking_events_log` | `locale` | text | Tracking multilingue |

**Implication** : le **schéma DB est déjà préparé** pour le multilingue. Il manque uniquement le code applicatif pour exploiter ces champs.

### 2.4 ✅ Langues détectées dans le code

```bash
# Recherche des codes BCP-47 ou ISO 639-1
grep -rE "'fr'|'ar'|'en'|'ar-MA'" apps/web/src --include="*.ts" --include="*.tsx" 2>&1 | wc -l
# ~150 occurrences (config + types)
```

**Codes utilisés** :
- `fr` — français (par défaut)
- `ar` — arabe standard
- `ar-MA` — darija marocain (langue chat principalement)
- `en` — anglais (mentionné dans `ChatLanguage` type mais non câblé)

## 3. Strings hardcoded — l'inventaire

### 3.1 Pages marketing publiques

| Page | Strings FR hardcoded | Multilingue ? |
|---|---|---|
| `/` (home) | ~80 strings | ❌ |
| `/maison` | ~50 strings (+ metadata FR) | ❌ |
| `/kit` | ~120 strings (wizard inclus) | Wizard ✅, reste ❌ |
| `/rituel` | ~60 strings | ❌ |
| `/contact` | ~30 strings (FAQ) | ❌ |
| `/journal` | ~20 strings | ❌ |
| `/journal/[slug]` | depends content | ❌ |

**Total estimé** : **~400 strings dans les pages marketing** (sans compter le wizard déjà fait).

### 3.2 Composants UI

| Catégorie | Volume strings | Détails |
|---|---|---|
| Headers / footers | ~30 | Navigation, copyright, social |
| Sections marketing (`(marketing)/sections/`) | ~100 | Titles + paragraphs réutilisables |
| Admin pages (`admin/`) | ~500+ | Pas prioritaire — admin reste FR |
| Components UI (`components/ui/`) | ~20 | "Charger plus", "Confirmer", etc. |
| Chat widget (`components/chat/`) | ~50 | Greeting, placeholder, etc. |
| Wizard (`components/checkout/`) | 0 (déjà i18n) | ✅ |

### 3.3 Content statique markdown

| Source | Localisation actuelle |
|---|---|
| `docs/legal-pages/60-content/*.md` (9 templates) | 100% FR |
| `apps/web/content/chat-knowledge/*.md` | FR |
| Articles journal (`data/mock/articles.ts`) | FR |
| Body des `legal_pages` en DB | 100% FR |

### 3.4 Metadata SEO

| Type | Status |
|---|---|
| `generateMetadata()` per page | Tout FR hardcoded |
| JSON-LD (`src/lib/seo/json-ld.tsx`) | Tout FR |
| OG images alt | Tout FR (`data/mock/maison.ts`, etc.) |
| `<html lang="fr">` | Hardcoded `fr` |

### 3.5 Emails transactionnels

| Template | Localisation |
|---|---|
| `src/lib/mail/templates/*.tsx` | Tout FR |
| Confirmation commande | FR |
| Notification stock | FR |
| Newsletter | FR |

**Total estimé strings** : **~600-800 strings** à externaliser pour avoir un site multilingue complet (hors admin).

## 4. CMS — composants dynamiques

### 4.1 Architecture actuelle

Le CMS FemiGlow utilise une table `component_field_bindings` :

```sql
component_field_bindings:
  - component_id (référence un site_component)
  - field_key (ex: 'title', 'description', 'cta_label')
  - locale (text default 'fr')   ← ✅ MULTILINGUE READY
  - value (jsonb)
  - status (draft/published/archived)
  - version
```

**Excellent !** Le champ `locale` existe DÉJÀ. Il faut juste :
1. UI admin pour saisir par langue (actuellement implicit FR)
2. Repo updates pour `getByLocale(componentId, fieldKey, locale, fallback)`
3. Frontend appelle repo avec `useLocale()`

### 4.2 Composants concernés

Estimation : ~200 composants CMS (sections, headers, CTAs) — tous traduits si on traduit `component_field_bindings`.

## 5. Routing actuel

```
src/app/
├── (marketing)/
│   ├── page.tsx         # /
│   ├── maison/page.tsx  # /maison
│   ├── kit/page.tsx     # /kit
│   └── ...
├── admin/...
└── legal/[slug]/page.tsx
```

**Aucun routing par locale**. Pour passer en multilingue, plusieurs options :
- `app/[locale]/(marketing)/...` (path-based)
- `app/(marketing)/...` + middleware locale resolver (cookie/header)
- Subdomain (`fr.femiglow.ma`)

Cf. [`02-design-conception/url-strategy.md`](../02-design-conception/url-strategy.md).

## 6. Outils dev déjà en place utiles

- ✅ **Drizzle migrations** — pour ajouter colonnes locale si manque
- ✅ **Vitest + RTL** — testing infra OK
- ✅ **MSW** — mocks pour tests intégration
- ✅ **Playwright** — E2E configuré
- ✅ **GitHub Actions** — CI/CD pipeline
- ❌ **Pas de Crowdin/Lokalise** — workflow translateur à choisir
- ❌ **Pas de ESLint i18n rule** — pas de détection auto des strings hardcoded

## 7. Gap analysis — résumé

| Domaine | Existant | Manquant | Effort estimé |
|---|---|---|---|
| **Wizard checkout** | ✅ FR+AR type-safe (CHA-231) | Activation UI AR + RTL | 1 sem |
| **Pages marketing** | ❌ 100% FR hardcoded | Library + extraction + traduction | 4 sem |
| **CMS components** | ✅ Schema multilingue | UI admin + repo + frontend | 1.5 sem |
| **Pages légales** | ❌ FR seul | Variantes par locale | 1 sem |
| **Emails transactionnels** | ❌ FR seul | Templates multilingues | 1 sem |
| **JSON-LD / SEO** | ❌ FR seul | `generateMetadata` localisé | 0.5 sem |
| **RTL (AR)** | ❌ Aucun | dir="rtl" + audit Tailwind | 1 sem |
| **Routing locale-aware** | ❌ Aucun | Middleware + `[locale]` prefix | 1 sem |
| **Workflow translateur** | ❌ Aucun | Choix outil + setup | 1 sem |
| **Tests denses + QA** | ❌ Aucun | Pyramide + a11y RTL + visual regr | 2 sem |
| **Monitoring i18n** | ❌ Aucun | Locale detection analytics | 0.5 sem |

**Total estimé** : ~13.5 semaines (cohérent avec l'estimation README de ~11 semaines, ~marge 20%).

## 8. Forces et faiblesses à connaître

### Forces

- ✅ Schema DB déjà préparé (champs `locale`/`language` partout)
- ✅ Wizard prouvé que l'équipe sait faire du type-safe i18n
- ✅ Stack moderne (Next 14 App Router, RSC) compatible toutes les options
- ✅ Tests existants comme base
- ✅ Pas de legacy à respecter — sprint encore vert

### Faiblesses

- ❌ ~600 strings dispersés dans le code (work-heavy extraction)
- ❌ Pas de plugin ESLint i18n (régression facile)
- ❌ Pas d'outil de TMS/Crowdin établi
- ❌ Pas de personne dédiée traduction (besoin d'externe)
- ❌ Tailwind pas configuré pour RTL (besoin `tailwindcss-rtl` plugin ou logical properties)

## 9. Conclusion audit

Le projet est **bien préparé schématiquement** pour l'i18n (champs DB, wizard prouvé) mais **a tout à faire côté code applicatif** pour les pages publiques et CMS.

**Bonne nouvelle** : l'effort est principalement de l'**extraction** (méthodique) + **mise en place library** (one-shot) + **workflow** (process), pas de la refonte architecturale.

**Choix critiques** :
1. Quelle library i18n choisir ? (cf. `01-options-techniques/`)
2. Path-based ou cookie-based routing ? (cf. `02-design-conception/url-strategy.md`)
3. CMS dynamique : traduction manuelle ou auto + review ? (cf. `06-data-strategy/workflow-translation.md`)
4. TMS (Crowdin/Lokalise) ou git-based (PRs traducteur sur GitHub) ?
