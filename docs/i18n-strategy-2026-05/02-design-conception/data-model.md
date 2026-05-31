# Data model — schemas DB et messages

## 1. Schémas DB (extensions)

Le projet a déjà 15+ tables avec `locale`/`language` (cf. `00-context/etat-actuel.md`). Pas de nouvelle table majeure, mais des extensions UI.

### 1.1 Configuration locales (nouvelle table)

```sql
-- Migration 0076_i18n_locales.sql

CREATE TABLE i18n_locales (
  code TEXT PRIMARY KEY,                  -- BCP-47, ex: 'fr', 'ar', 'en', 'es'
  display_name TEXT NOT NULL,             -- 'Français', 'العربية', 'English'
  display_name_native TEXT NOT NULL,      -- 'Français' (même en fr), 'العربية'
  direction TEXT NOT NULL DEFAULT 'ltr' CHECK (direction IN ('ltr', 'rtl')),
  enabled BOOLEAN NOT NULL DEFAULT false, -- Toggle pour activer/désactiver
  is_default BOOLEAN NOT NULL DEFAULT false,
  fallback_locale TEXT REFERENCES i18n_locales(code), -- Fallback si missing key
  date_format TEXT NOT NULL DEFAULT 'dd MMM yyyy',
  number_format TEXT NOT NULL DEFAULT 'fr-FR',
  currency_code TEXT NOT NULL DEFAULT 'MAD',
  sort_order INTEGER NOT NULL DEFAULT 100,
  flag_emoji TEXT,                        -- '🇫🇷', '🇲🇦', '🇬🇧'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique : exactly 1 default
CREATE UNIQUE INDEX idx_i18n_locales_one_default
  ON i18n_locales (is_default) WHERE is_default = true;

-- Seed
INSERT INTO i18n_locales (code, display_name, display_name_native, direction, enabled, is_default, fallback_locale, currency_code, flag_emoji, sort_order)
VALUES
  ('fr', 'French', 'Français', 'ltr', true, true, NULL, 'MAD', '🇫🇷', 10),
  ('ar', 'Arabic', 'العربية', 'rtl', true, false, 'fr', 'MAD', '🇲🇦', 20),
  ('en', 'English', 'English', 'ltr', true, false, 'fr', 'MAD', '🇬🇧', 30);
```

**Avantages** :
- Activer/désactiver locale sans deploy
- Configurer fallback chain
- Liste pilotable depuis `/admin/i18n/languages`

### 1.2 Translation keys catalog (nouvelle table)

```sql
-- Catalog des clés de traduction utilisées
-- Permet de tracker la coverage par locale et détecter les missing keys
CREATE TABLE i18n_translation_keys (
  key TEXT PRIMARY KEY,                   -- 'marketing.hero.title'
  namespace TEXT NOT NULL,                -- 'marketing'
  description TEXT,                       -- Hint pour le traducteur
  context TEXT,                           -- Page / component qui utilise
  type TEXT NOT NULL DEFAULT 'static'     -- 'static' | 'pluralized' | 'rich'
    CHECK (type IN ('static', 'pluralized', 'rich')),
  source_value TEXT NOT NULL,             -- Valeur dans la locale source (FR)
  is_active BOOLEAN NOT NULL DEFAULT true,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_i18n_keys_namespace ON i18n_translation_keys(namespace);
CREATE INDEX idx_i18n_keys_active ON i18n_translation_keys(is_active);
```

### 1.3 Translation values (nouvelle table)

```sql
-- Valeurs traduites par clé + locale
-- (Optionnel — peut rester dans JSON files si pas besoin admin UI)
CREATE TABLE i18n_translation_values (
  key TEXT NOT NULL REFERENCES i18n_translation_keys(key) ON DELETE CASCADE,
  locale TEXT NOT NULL REFERENCES i18n_locales(code) ON DELETE CASCADE,
  value TEXT NOT NULL,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key, locale)
);

CREATE INDEX idx_i18n_values_locale ON i18n_translation_values(locale);
CREATE INDEX idx_i18n_values_reviewed ON i18n_translation_values(reviewed);
```

**Note** : ce tableau est **optionnel**. Stratégie hybride :
- JSON files = source of truth en build
- DB = miroir pour admin UI et coverage tracking
- Sync via CLI ou import lors d'updates

### 1.4 Extensions tables existantes

Les tables suivantes ont déjà `locale` ou `language` :

- ✅ `component_field_bindings(locale)` — CMS (utiliser tel quel)
- ✅ `legal_pages(locale)` — pages légales (utiliser tel quel)
- ✅ `seo_overrides(locale)` — SEO (utiliser tel quel)
- ✅ `ritual_testimonials(language)` — testimonials
- ✅ `chat_session(language)` — chat (déjà i18n CHA-231)
- ✅ `chat_message(language)` — chat
- ✅ `chat_lead(language)` — chat

**Aucune modification** nécessaire à ces tables — elles sont déjà prêtes.

## 2. Format messages JSON

### 2.1 Structure

**File** : `messages/fr.json`

```json
{
  "$schema": "../messages/_schema.json",
  "common": {
    "back": "Retour",
    "continue": "Continuer",
    "loading": "Chargement…",
    "error": "Une erreur est survenue",
    "retry": "Réessayer"
  },
  "navigation": {
    "home": "Accueil",
    "kit": "Le kit",
    "rituel": "Le rituel",
    "maison": "La maison",
    "journal": "Journal",
    "contact": "Contact"
  },
  "marketing": {
    "hero": {
      "title": "Le rituel ongles, en cinq minutes.",
      "subtitle": "Trois gestes, une saison. Une beauté lente, ancrée au Maroc.",
      "cta_discover": "Découvrir le rituel",
      "cta_kit": "Voir le kit"
    },
    "kit": {
      "title": "Pack FemiGlow",
      "price_label": "{price, number, ::currency/MAD}",
      "stock_count": "{count, plural, =0 {Rupture} one {Plus qu'un en stock} other {# disponibles}}"
    }
  },
  "wizard": {
    "_comment": "Wizard checkout reste sur WizardDictionary CHA-231 (séparé)"
  }
}
```

### 2.2 ICU MessageFormat usage

**Plurals** :
```json
{
  "reviews_count": "{count, plural, =0 {Aucun avis} one {1 avis} other {# avis}}"
}
```

**Selects** :
```json
{
  "greeting": "{gender, select, female {Bienvenue, chère cliente} male {Bienvenue, cher client} other {Bienvenue}}"
}
```

**Numbers** :
```json
{
  "price": "{price, number, ::currency/MAD}",
  "percentage": "{value, number, ::percent}"
}
```

**Dates** :
```json
{
  "last_updated": "Mis à jour le {date, date, medium}",
  "relative": "{when, date, relative}"
}
```

### 2.3 Conventions naming

Cf. [`naming-conventions.md`](./naming-conventions.md).

**Règles** :
- Namespace en kebab-case ou snake_case lower (`marketing`, `wizard`, `legal`)
- Sub-keys descriptifs (`hero.title`, pas `h.t`)
- `_comment` pour notes traducteur (préfixé `_`)
- `$schema` au top du JSON
- Préférer la verbosité à l'ambiguïté

## 3. Fallback chain

Si une clé manque dans la locale active, suivre le chain :

```
locale active (ex: ar)
  ↓ (clé manque)
fallback_locale (ex: fr, défini en DB i18n_locales)
  ↓ (clé manque)
default_locale (fr)
  ↓ (clé manque)
SHOW KEY itself (e.g., "marketing.hero.title") + log warning Sentry
```

**Code helper** :

```ts
// src/lib/i18n/get-message.ts
export function getMessageWithFallback(
  key: string,
  locale: Locale,
  messages: Record<Locale, Messages>
): string {
  const direct = getNestedValue(messages[locale], key);
  if (direct !== undefined) return direct;

  const localeConfig = getLocaleConfig(locale);
  if (localeConfig.fallback_locale) {
    const fallback = getNestedValue(messages[localeConfig.fallback_locale], key);
    if (fallback !== undefined) {
      logger.warn('i18n.fallback_used', { key, locale, fallback: localeConfig.fallback_locale });
      return fallback;
    }
  }

  const def = getNestedValue(messages[DEFAULT_LOCALE], key);
  if (def !== undefined) return def;

  logger.error('i18n.missing_key', { key, locale });
  return key; // Affichage technique pour debug
}
```

→ next-intl gère ce fallback nativement via `defaultLocale` config.

## 4. Migration data

### 4.1 Pages légales existantes (FR seul)

```sql
-- Toutes les pages actuelles ont locale='fr' implicite
UPDATE legal_pages SET locale = 'fr' WHERE locale IS NULL;

-- Pour chaque page publiée, on crée la variante AR/EN en draft à traduire
INSERT INTO legal_pages (id, slug, title, body_md, status, locale, ...)
SELECT
  'lp_' || gen_random_uuid()::text,
  slug,
  '[AR] ' || title,  -- À traduire
  body_md,           -- À traduire
  'draft',
  'ar',
  ...
FROM legal_pages WHERE locale = 'fr' AND status = 'published';
```

### 4.2 Component bindings existants

```sql
-- Tous les bindings actuels sont 'fr' implicitement
UPDATE component_field_bindings SET locale = 'fr' WHERE locale IS NULL OR locale = '';

-- Pour les composants existants, l'admin pourra ajouter AR/EN via UI
-- Pas de migration automatique (traduction manuelle requise)
```

### 4.3 Seed initial des locales

```sql
-- Si i18n_locales table existe
INSERT INTO i18n_locales (code, display_name, display_name_native, direction, enabled, is_default, fallback_locale, currency_code, flag_emoji, sort_order)
VALUES
  ('fr', 'French', 'Français', 'ltr', true, true, NULL, 'MAD', '🇫🇷', 10),
  ('ar', 'Arabic', 'العربية', 'rtl', true, false, 'fr', 'MAD', '🇲🇦', 20),
  ('en', 'English', 'English', 'ltr', false, false, 'fr', 'MAD', '🇬🇧', 30)
ON CONFLICT (code) DO NOTHING;
```

## 5. Performance considérations

### 5.1 JSON files
- Bundle au build time par locale → 1 chunk de ~12 kB par locale
- Code splitting auto via next-intl (charge seulement la locale active)
- Edge cache Vercel

### 5.2 DB queries
- `component_field_bindings` filtré par `locale` à chaque page render
- Cache Next.js `unstable_cache` avec tag `i18n-{locale}`
- Revalidate sur edit admin via `revalidateTag('i18n-fr')`

### 5.3 Lazy loading
- Pour 10+ locales : charger uniquement la locale active
- `dynamic import` de `messages/${locale}.json` dans `getRequestConfig`

## 6. Rollback strategy

Si pour une raison i18n cause un blocage prod :

```bash
# Feature flag off
vercel env add I18N_ENABLED production
# Saisir: false

# Re-deploy → middleware redirige tout vers /fr/ legacy comportement
```

→ Détaillé dans [`08-plan-action/rollback.md`](../08-plan-action/rollback.md).
