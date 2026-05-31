# Naming conventions — Clés de traduction

> Règles strictes pour nommer les clés i18n FemiGlow. Une convention partagée évite les drift entre devs, traducteurs et CMS.

## 1. Principes fondamentaux

### 1.1 Objectifs

1. **Prévisible** : un dev qui découvre la base doit deviner où poser une nouvelle clé sans demander.
2. **Stable** : renommer une clé = renommer dans 3 locales + breaking dans le code → faire le moins possible.
3. **Recherchable** : `grep "marketing.hero.title"` → unique résultat, idéalement.
4. **Hiérarchique** : namespace `marketing` < section `hero` < élément `title`.
5. **Multilingue-agnostique** : la clé ne décrit pas la langue (`bouton_retour` est mauvais, `common.back` est bon).

### 1.2 Anti-pattern à éviter

❌ Clés génériques anonymes : `text1`, `string2`, `msg_a`
❌ Clés franglais : `hero_titre_principal`
❌ Inclure la langue dans la clé : `hero_title_fr`
❌ Clés "techniques" non lisibles : `t_hk_001`, `KEY_42`
❌ Trop plat : `welcome_back_to_femiglow_home`
❌ Trop profond : `marketing.pages.home.sections.hero.elements.headline.text.fr`

## 2. Format général

### 2.1 Pattern

```
<namespace>.<section>.<element>[.<modifier>]
```

- **namespace** : domaine fonctionnel (`common`, `navigation`, `marketing`, `wizard`, `legal`, `admin`, `email`, `errors`, `seo`)
- **section** : page ou regroupement (`hero`, `kit`, `manifest`, `contact`)
- **element** : item précis (`title`, `subtitle`, `cta`, `body`)
- **modifier** (optionnel) : variante (`short`, `long`, `mobile`, `v2`)

### 2.2 Exemples corrects

```ts
common.back                          // Strings communs
common.continue
common.loading

navigation.home                      // Menu
navigation.kit
navigation.contact

marketing.hero.title                 // Page d'accueil
marketing.hero.subtitle
marketing.hero.cta_primary
marketing.kit.title
marketing.kit.bullets.0
marketing.kit.bullets.1

wizard.shipping.title                // Checkout wizard
wizard.shipping.fields.address
wizard.shipping.errors.required

legal.cgv.section_1.title            // Page légale CGV
legal.cgv.section_1.body

errors.404.title                     // Page d'erreur
errors.404.cta
errors.network.retry

seo.kit.title                        // Metadata HTML
seo.kit.description
seo.kit.og_title

email.welcome.subject                // Email transactionnel
email.welcome.greeting
```

## 3. Règles de casse

| Élément | Casse | Exemple |
|---|---|---|
| **namespace** | lowercase, single word | `marketing`, `wizard` |
| **section** | lowercase, single word ou snake_case si nécessaire | `hero`, `cart_recap`, `lead_form` |
| **element** | lowercase, snake_case si multi-mots | `cta_primary`, `error_message` |
| **modifier** | lowercase, suffix | `_mobile`, `_v2`, `_short` |
| **séparateur** | point `.` | jamais d'underscore en hiérarchie |

❌ `Marketing.Hero.Title` (PascalCase)
❌ `marketing-hero-title` (kebab-case)
❌ `marketing_hero_title` (snake aplati)
✅ `marketing.hero.title`

## 4. Conventions par namespace

### 4.1 `common.*`

Strings réutilisés partout. Maximum **30 clés**.

```ts
common.back
common.continue
common.cancel
common.save
common.loading
common.error
common.required
common.optional
common.yes
common.no
common.confirm
common.close
```

→ Si une string est utilisée dans 1 seul endroit, **ne pas la mettre dans `common`** mais dans son namespace propre.

### 4.2 `navigation.*`

Labels des liens primaires (header, footer, menu).

```ts
navigation.home
navigation.kit
navigation.maison
navigation.rituel
navigation.journal
navigation.contact
navigation.legal_menu
navigation.account
```

### 4.3 `marketing.<page>.*`

Pages marketing publiques. Chaque page = section dédiée.

```ts
marketing.hero.title             // Page d'accueil section hero
marketing.hero.subtitle
marketing.hero.cta_primary
marketing.hero.cta_secondary

marketing.kit.title              // Page /kit
marketing.kit.description
marketing.kit.bullets.0
marketing.kit.cta

marketing.maison.title           // Page /maison
marketing.maison.subtitle

marketing.manifest.statement_1   // Manifesto (réutilisé)
marketing.manifest.statement_2
```

### 4.4 `wizard.*`

Tunnel checkout. Synchronisé avec `WizardDictionary` (CHA-231).

```ts
wizard.step_1.title              // Step 1 = produit
wizard.step_2.title              // Step 2 = livraison
wizard.shipping.fields.first_name
wizard.shipping.fields.last_name
wizard.shipping.fields.address
wizard.shipping.errors.required
wizard.payment.method.cmi
wizard.payment.method.cod
wizard.confirmation.title
```

### 4.5 `legal.<slug>.*`

Pages légales. Slug = identifiant URL (`cgv`, `mentions-legales`).

```ts
legal.cgv.section_1.title
legal.cgv.section_1.body
legal.mentions_legales.editor.name
legal.mentions_legales.editor.address
legal.confidentialite.intro
```

⚠️ Pour pages avec sections nombreuses, préférer le **markdown stocké en CMS** (`legal_pages.body_md`) plutôt que dans messages.json. Garder en messages.json seulement le titre et les liens.

### 4.6 `errors.*`

Messages d'erreurs utilisateurs (404, 500, validation).

```ts
errors.404.title
errors.404.description
errors.404.cta_home

errors.500.title
errors.500.description

errors.validation.required
errors.validation.email_invalid
errors.validation.phone_invalid

errors.network.offline
errors.network.timeout
errors.network.retry
```

### 4.7 `seo.<page>.*`

Metadata HTML par page. Objets avec sous-clés normalisées.

```ts
seo.home.title                   // <title>
seo.home.description             // <meta name="description">
seo.home.og_title                // <meta property="og:title">
seo.home.og_description
seo.home.twitter_card

seo.kit.title
seo.kit.description
```

→ Contraintes : `title` max 70 chars, `description` max 160 chars (cf. translation-keys-schema.json).

### 4.8 `email.<template>.*`

Templates emails transactionnels.

```ts
email.welcome.subject
email.welcome.greeting
email.welcome.body
email.welcome.cta

email.order_confirmation.subject
email.order_confirmation.greeting
email.order_confirmation.summary
```

### 4.9 `admin.*` (V1 — out of scope)

Console admin reste 100% FR en V1. Pas de clés admin.

→ V2+ : si admin doit être multilingue, créer namespace dédié.

## 5. Pluralization keys

Pour les pluriels (ICU MessageFormat), utiliser un seul namespace avec un sélecteur :

```ts
// Mauvais :
marketing.cart.0_item
marketing.cart.1_item
marketing.cart.n_items

// Bon (ICU MessageFormat) :
marketing.cart.items_count
// Valeur :
// "{count, plural, =0 {Panier vide} =1 {1 article} other {# articles}}"
```

Avec next-intl :
```tsx
t('marketing.cart.items_count', { count: 3 });
// → "3 articles"
```

## 6. Interpolations / variables

Conventions pour les placeholders :

### 6.1 Snake_case variables

```json
"marketing.welcome.greeting": "Bonjour {user_name}, bienvenue chez FemiGlow !"
```

### 6.2 Rich text (HTML safe)

Pour gras / italique, utiliser les tags rich text de next-intl :

```json
"marketing.kit.description": "<bold>3 gestes</bold>, <italic>une saison</italic>"
```

Render :
```tsx
t.rich('marketing.kit.description', {
  bold: (chunks) => <strong>{chunks}</strong>,
  italic: (chunks) => <em>{chunks}</em>,
});
```

### 6.3 Variables numériques avec format

```json
"marketing.kit.price": "À partir de {price, number, ::currency/MAD}"
```

## 7. Modifiers (suffixes)

Variantes contextuelles d'une clé :

| Suffixe | Usage |
|---|---|
| `_mobile` | Version mobile (texte plus court) |
| `_desktop` | Version desktop (texte plus long) |
| `_short` | Version courte (badge, tooltip) |
| `_long` | Version longue (description, body) |
| `_aria` | Texte pour aria-label (a11y) |
| `_v2` | Version A/B test |

Exemples :
```ts
marketing.hero.cta_primary         // Version standard
marketing.hero.cta_primary_mobile  // Version mobile compactée
marketing.hero.cta_primary_aria    // Pour aria-label
common.back_aria                   // "Revenir à la page précédente"
```

## 8. Ordre des langues dans le fichier source

Standard : ordre alphabétique des clés au sein de chaque section.

```json
{
  "marketing": {
    "hero": {
      "cta_primary": "...",
      "cta_secondary": "...",
      "subtitle": "...",
      "title": "..."
    },
    "kit": { ... }
  }
}
```

→ Faciliter les diffs Git et le merge avec traducteur.

## 9. Versioning des clés

### 9.1 Quand renommer une clé

❌ NE PAS renommer pour : préférence stylistique, refactor cosmétique, déplacement de section.
✅ Renommer SI : la clé devient sémantiquement obsolète, breaking change UX.

### 9.2 Procédure de rename

1. Créer la nouvelle clé `marketing.hero.cta_primary_v2` (avec suffix `_v2`)
2. Migrer les sites d'appel
3. Sentry log si l'ancienne clé est encore utilisée pendant 2 semaines
4. Supprimer l'ancienne clé après validation

### 9.3 Déprécation soft

Si une clé sera supprimée :
```json
{
  "_deprecated": {
    "marketing.hero.old_cta": {
      "value": "Découvrir",
      "deprecated_at": "2026-05-27",
      "replaced_by": "marketing.hero.cta_primary"
    }
  }
}
```

## 10. Validation automatique

### 10.1 Schéma JSON (cf. `translation-keys-schema.json`)

Le schéma JSON valide :
- Namespaces autorisés
- Profondeur max (5 niveaux)
- Caractères autorisés dans clés (`a-z0-9_`)
- Longueur max des valeurs SEO

### 10.2 ESLint rule custom

Règle `i18n/no-hardcoded-strings` :
- Détecte les strings JSX littéraux > 3 mots
- Suggère extraction vers messages.json
- Force le pattern `t('namespace.section.element')`

### 10.3 Pre-commit hook

```bash
# .husky/pre-commit
pnpm i18n:validate-keys      # Lint messages.json structure
pnpm i18n:check-coverage     # Verify 100% FR, warn AR/EN missing
pnpm i18n:no-orphan-keys     # No keys defined but never used
```

### 10.4 CI gates

| Gate | Action si fail |
|---|---|
| `i18n:validate-schema` | ❌ Block PR |
| `i18n:no-hardcoded` | ❌ Block PR |
| `i18n:coverage-fr=100%` | ❌ Block PR |
| `i18n:coverage-ar>=90%` | ⚠️ Warn |
| `i18n:coverage-en>=90%` | ⚠️ Warn |
| `i18n:no-orphan` | ⚠️ Warn |

## 11. Migration des strings existants

Quand on extrait une string hardcoded existante :

### 11.1 Étape 1 — Identifier le composant

```tsx
// Avant :
<h1>Le rituel ongles, en cinq minutes.</h1>
```

### 11.2 Étape 2 — Choisir la clé

Question : c'est sur quelle page ? section ? élément ?
→ `marketing.hero.title`

### 11.3 Étape 3 — Ajouter au messages/fr.json

```json
{
  "marketing": {
    "hero": {
      "title": "Le rituel ongles, en cinq minutes."
    }
  }
}
```

### 11.4 Étape 4 — Remplacer

```tsx
import { useTranslations } from 'next-intl';

const t = useTranslations('marketing.hero');
<h1>{t('title')}</h1>
```

### 11.5 Étape 5 — Tester

- TypeScript : ✅ key inferred
- Visual : ✅ rendu identique
- Test snapshot : ✅ pas de drift

## 12. Glossaire / vocabulaire FemiGlow

Pour cohérence terminologique, voir `06-data-strategy/content-style-guide.csv`.

Termes clés FemiGlow à garder cohérents en traduction :
- **Le kit** → `the kit` (EN) / `الكيت` (AR)
- **Le rituel** → `the ritual` (EN) / `الطقوس` (AR)
- **Maison FemiGlow** → `Maison FemiGlow` (intraduisible, marque)
- **Rituel ongles** → `nail ritual` (EN) / `طقوس الأظافر` (AR)
