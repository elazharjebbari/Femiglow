# Stratégie feature flags i18n FemiGlow

> Définition, implémentation et matrice de tests des 4 feature flags qui pilotent le rollout i18n.
>
> **Principe** : un seul module source de vérité (`apps/web/src/lib/feature-flags/i18n.ts`), lu une fois au boot et exposé via API typée. Pas de `process.env.I18N_*` dispersé dans le code.
>
> **Document parent** : [`README.md`](./README.md)

## Sommaire

- [Vue d'ensemble](#vue-densemble)
- [Les 4 flags](#les-4-flags)
- [Combinations valides](#combinations-valides)
- [Implementation TypeScript](#implementation-typescript)
- [Setup Vercel env vars](#setup-vercel-env-vars)
- [Tests par combinaison](#tests-par-combinaison)
- [Lifecycle des flags](#lifecycle-des-flags)
- [Anti-patterns](#anti-patterns)

---

## Vue d'ensemble

Les feature flags permettent :

1. **Rollback rapide** sans redeploy (toggle env var + redeploy)
2. **Dégradation progressive** (désactiver locale AR uniquement, garder FR+EN)
3. **Debug en prod** (forcer LTR sur AR pour reproduire un bug)
4. **Tests A/B** sur un sous-ensemble (canary 10%)
5. **Migration progressive** (activer CMS multilang sans toucher routing)

Les 4 flags forment un système hiérarchique : `I18N_ENABLED` est master, les autres sont sub-flags.

```
I18N_ENABLED (master)
├── true
│   ├── I18N_LOCALES_ACTIVE (sélection langues)
│   ├── I18N_RTL_ENABLED (pour AR)
│   └── I18N_CMS_BINDINGS_ENABLED (CMS DB multilang)
└── false → site monolingue FR legacy
```

---

## Les 4 flags

### 1. `I18N_ENABLED` (Master flag)

| Champ | Valeur |
|---|---|
| Type | Boolean |
| Default | `false` (rollback safety) |
| Valeurs | `true`, `false` |
| Scope | Production, Staging, Preview, Dev |
| Owner | Lead technique |

**Comportement** :
- `true` : middleware `next-intl` actif, routing `/[locale]/`, LocaleSwitcher visible
- `false` : middleware bypass, routes legacy `/contact` (sans `[locale]`), pas de switcher

**Quand toggle** :
- Dev local : `true` toujours
- Staging : `true` toujours
- Preview (PR) : `true` toujours
- Production : `false` au démarrage, `true` après canary 100%

### 2. `I18N_LOCALES_ACTIVE` (Sélection langues)

| Champ | Valeur |
|---|---|
| Type | CSV string |
| Default | `fr` (safe fallback) |
| Valeurs | `fr`, `fr,en`, `fr,ar`, `fr,ar,en` |
| Scope | Production, Staging, Preview |
| Owner | Lead technique + fondatrice |

**Comportement** :
- Liste les locales activées dans le LocaleSwitcher
- Middleware retourne 404 pour `/<locale>/*` si locale absente de la liste
- Cookie `NEXT_LOCALE` ignoré si locale pas dans la liste

**Valeurs typiques** :
- Phase 1 : `fr,en` (AR pas encore traduit)
- Phase 5+ : `fr,ar,en`
- Rollback partiel AR : `fr,en`
- Rollback partiel EN : `fr,ar`

**Validation** :
- `fr` doit toujours être présent (default locale)
- Locales doivent être dans `locales` const (`fr`, `ar`, `en`)
- Pas de doublons

### 3. `I18N_RTL_ENABLED` (Force LTR ou RTL)

| Champ | Valeur |
|---|---|
| Type | Boolean |
| Default | `true` |
| Valeurs | `true`, `false` |
| Scope | Production, Staging, Preview, Dev |
| Owner | Lead technique |

**Comportement** :
- `true` : `<html dir="rtl">` pour locale AR
- `false` : `<html dir="ltr">` même pour AR (mode dégradé / debug)

**Quand toggle** :
- Production : `true` par défaut
- Si bug RTL critique en prod : `false` temporairement
- Dev/debug local : `false` peut aider à isoler bugs RTL vs RTL-independent

**⚠️ Important** : `false` sur AR donnera un rendu cassé visuellement (texte droite sur layout LTR), c'est uniquement un mode dégradé d'urgence.

### 4. `I18N_CMS_BINDINGS_ENABLED` (CMS DB multilang)

| Champ | Valeur |
|---|---|
| Type | Boolean |
| Default | `false` (jusqu'à phase 3 OK) |
| Valeurs | `true`, `false` |
| Scope | Production, Staging, Preview, Dev |
| Owner | Lead technique |

**Comportement** :
- `true` : `componentFieldBindings.getByLocale(locale)` utilise locale courante avec fallback FR
- `false` : ignore le param locale, lit toujours `locale='fr'` (comportement legacy)

**Quand toggle** :
- Avant phase 3 : `false`
- Pendant phase 3 dev : `true` sur staging, `false` sur prod
- Après phase 3 deploy : `true` partout
- Rollback phase 3 : `false`

---

## Combinations valides

| `I18N_ENABLED` | `I18N_LOCALES_ACTIVE` | `I18N_RTL_ENABLED` | `I18N_CMS_BINDINGS_ENABLED` | Cas d'usage |
|---|---|---|---|---|
| `false` | `fr` | `*` | `*` | Site legacy monolingue (rollback complet) |
| `true` | `fr` | `*` | `false` | i18n actif mais 1 langue (transition) |
| `true` | `fr,en` | `true` | `false` | Phase 1-2 : FR + EN sans CMS multilang |
| `true` | `fr,en` | `true` | `true` | Phase 3 : FR + EN avec CMS multilang |
| `true` | `fr,ar` | `true` | `true` | Bypass EN (si bug EN) |
| `true` | `fr,ar,en` | `true` | `true` | **État cible production V1** |
| `true` | `fr,ar,en` | `false` | `true` | Mode debug RTL (rendu AR cassé acceptable) |
| `true` | `fr` | `true` | `true` | Rollback partiel : seul FR mais infra prête |

### Combinaisons interdites (erreurs validation)

| Combinaison | Erreur |
|---|---|
| `I18N_ENABLED=false` + autres flags actifs | Warning : flags ignorés (master off) |
| `I18N_LOCALES_ACTIVE=ar` (sans fr) | Error : `fr` obligatoire (default locale) |
| `I18N_LOCALES_ACTIVE=xx` (locale inconnue) | Error : locale pas dans `locales` const |
| `I18N_LOCALES_ACTIVE=fr,,en` | Error : entrée vide |
| `I18N_LOCALES_ACTIVE=fr,en,fr` | Error : doublon |

---

## Implementation TypeScript

### Module central — `apps/web/src/lib/feature-flags/i18n.ts`

> Note : ceci est un **document de référence**, pas du code à appliquer maintenant. Le vrai fichier sera créé en Phase 1 (T1.7).

```typescript
import { z } from 'zod';

// Schema flags
const i18nFlagsSchema = z.object({
  enabled: z.boolean(),
  localesActive: z.array(z.enum(['fr', 'ar', 'en'])).nonempty(),
  rtlEnabled: z.boolean(),
  cmsBindingsEnabled: z.boolean(),
});

export type I18nFlags = z.infer<typeof i18nFlagsSchema>;

const ALL_LOCALES = ['fr', 'ar', 'en'] as const;
type Locale = (typeof ALL_LOCALES)[number];

// Parse ENV — appelé une seule fois (lazy + cached)
function parseLocalesActive(raw: string | undefined): Locale[] {
  if (!raw) return ['fr'];
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  
  // Validations
  const validParts = parts.filter((p): p is Locale =>
    (ALL_LOCALES as readonly string[]).includes(p)
  );
  if (validParts.length === 0) return ['fr'];
  if (!validParts.includes('fr')) {
    // Forcer fr toujours présent
    return ['fr', ...validParts.filter(p => p !== 'fr')];
  }
  
  // Dédupliquer
  return Array.from(new Set(validParts));
}

let cachedFlags: I18nFlags | undefined;

export function getI18nFlags(): I18nFlags {
  if (cachedFlags) return cachedFlags;
  
  const flags: I18nFlags = {
    enabled: process.env.I18N_ENABLED === 'true',
    localesActive: parseLocalesActive(process.env.I18N_LOCALES_ACTIVE),
    rtlEnabled: process.env.I18N_RTL_ENABLED !== 'false', // default true
    cmsBindingsEnabled: process.env.I18N_CMS_BINDINGS_ENABLED === 'true',
  };
  
  // Validation finale
  const parsed = i18nFlagsSchema.safeParse(flags);
  if (!parsed.success) {
    console.error('[i18n flags] Invalid config:', parsed.error);
    // Fallback safe
    cachedFlags = {
      enabled: false,
      localesActive: ['fr'],
      rtlEnabled: false,
      cmsBindingsEnabled: false,
    };
  } else {
    cachedFlags = parsed.data;
  }
  
  return cachedFlags;
}

// API typée (pas de lecture process.env ailleurs)
export const i18nFlags = {
  isEnabled: () => getI18nFlags().enabled,
  getActiveLocales: () => getI18nFlags().localesActive,
  isLocaleActive: (locale: Locale) => getI18nFlags().localesActive.includes(locale),
  isRtlEnabled: () => getI18nFlags().rtlEnabled,
  isCmsBindingsEnabled: () => getI18nFlags().cmsBindingsEnabled,
};
```

### Usages dans le code

**Middleware** :

```typescript
// middleware.ts
import { i18nFlags } from '@/lib/feature-flags/i18n';
import createMiddleware from 'next-intl/middleware';

const i18nMiddleware = createMiddleware({
  locales: i18nFlags.getActiveLocales(),
  defaultLocale: 'fr',
  localePrefix: 'always',
});

export function middleware(req: Request) {
  if (!i18nFlags.isEnabled()) {
    return NextResponse.next(); // Bypass complet
  }
  return i18nMiddleware(req);
}
```

**Layout** :

```typescript
// app/[locale]/layout.tsx
import { i18nFlags } from '@/lib/feature-flags/i18n';

export default function LocaleLayout({ children, params: { locale } }) {
  const dir = i18nFlags.isRtlEnabled() && locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
```

**CMS** :

```typescript
// lib/cms/queries.ts
import { i18nFlags } from '@/lib/feature-flags/i18n';

export async function loadCmsField(componentId: string, fieldKey: string, locale: Locale) {
  if (!i18nFlags.isCmsBindingsEnabled()) {
    // Legacy : toujours FR
    return componentFieldBindingsRepo.getByLocale({
      componentId,
      fieldKey,
      locale: 'fr',
    });
  }
  
  return componentFieldBindingsRepo.getByLocale({
    componentId,
    fieldKey,
    locale,
    fallbackLocale: 'fr',
  });
}
```

**LocaleSwitcher** :

```typescript
// components/i18n/LocaleSwitcher.tsx
import { i18nFlags } from '@/lib/feature-flags/i18n';

export function LocaleSwitcher() {
  const locales = i18nFlags.getActiveLocales();
  
  if (locales.length <= 1) return null; // Pas la peine de switcher si 1 locale
  
  return (
    <select>
      {locales.map(loc => <option key={loc} value={loc}>{getNativeName(loc)}</option>)}
    </select>
  );
}
```

### Tests unit du module

```typescript
// lib/feature-flags/__tests__/i18n.test.ts
describe('i18nFlags', () => {
  beforeEach(() => {
    vi.resetModules(); // Reset cache
    delete process.env.I18N_ENABLED;
    delete process.env.I18N_LOCALES_ACTIVE;
    delete process.env.I18N_RTL_ENABLED;
    delete process.env.I18N_CMS_BINDINGS_ENABLED;
  });

  it('defaults to disabled', () => {
    expect(i18nFlags.isEnabled()).toBe(false);
  });

  it('parses I18N_ENABLED=true', () => {
    process.env.I18N_ENABLED = 'true';
    expect(i18nFlags.isEnabled()).toBe(true);
  });

  it('parses I18N_LOCALES_ACTIVE csv', () => {
    process.env.I18N_LOCALES_ACTIVE = 'fr,ar,en';
    expect(i18nFlags.getActiveLocales()).toEqual(['fr', 'ar', 'en']);
  });

  it('forces fr if not in I18N_LOCALES_ACTIVE', () => {
    process.env.I18N_LOCALES_ACTIVE = 'ar,en';
    expect(i18nFlags.getActiveLocales()).toContain('fr');
  });

  it('dedupes I18N_LOCALES_ACTIVE', () => {
    process.env.I18N_LOCALES_ACTIVE = 'fr,fr,ar';
    expect(i18nFlags.getActiveLocales()).toEqual(['fr', 'ar']);
  });

  it('ignores invalid locales', () => {
    process.env.I18N_LOCALES_ACTIVE = 'fr,xx,ar';
    expect(i18nFlags.getActiveLocales()).toEqual(['fr', 'ar']);
  });

  it('defaults RTL to true', () => {
    expect(i18nFlags.isRtlEnabled()).toBe(true);
  });

  it('I18N_RTL_ENABLED=false disables RTL', () => {
    process.env.I18N_RTL_ENABLED = 'false';
    expect(i18nFlags.isRtlEnabled()).toBe(false);
  });

  it('isLocaleActive returns true for active locale', () => {
    process.env.I18N_LOCALES_ACTIVE = 'fr,ar';
    expect(i18nFlags.isLocaleActive('ar')).toBe(true);
    expect(i18nFlags.isLocaleActive('en')).toBe(false);
  });

  it('cache results across calls', () => {
    process.env.I18N_ENABLED = 'true';
    const r1 = i18nFlags.isEnabled();
    process.env.I18N_ENABLED = 'false'; // changement env post-cache
    const r2 = i18nFlags.isEnabled();
    expect(r1).toBe(r2); // cache => même résultat
  });
});
```

---

## Setup Vercel env vars

### Variables à créer

Dans Vercel Dashboard → Project femiglow → Settings → Environment Variables :

| Variable | Environments | Valeur initiale | Notes |
|---|---|---|---|
| `I18N_ENABLED` | Production | `false` | Toggler après canary 100% |
| `I18N_ENABLED` | Preview | `true` | Toujours actif pour tests PR |
| `I18N_ENABLED` | Development | `true` | Pour `.env.local` |
| `I18N_LOCALES_ACTIVE` | Production | `fr,ar,en` | État cible V1 |
| `I18N_LOCALES_ACTIVE` | Preview | `fr,ar,en` | Tests complets |
| `I18N_LOCALES_ACTIVE` | Development | `fr,ar,en` | — |
| `I18N_RTL_ENABLED` | Production | `true` | Default actif |
| `I18N_RTL_ENABLED` | Preview | `true` | — |
| `I18N_RTL_ENABLED` | Development | `true` | — |
| `I18N_CMS_BINDINGS_ENABLED` | Production | `false` | À toggle après phase 3 deploy |
| `I18N_CMS_BINDINGS_ENABLED` | Preview | `true` | Tests phase 3 |
| `I18N_CMS_BINDINGS_ENABLED` | Development | `true` | — |

### Commandes Vercel CLI

```bash
# Setup initial
vercel env add I18N_ENABLED production
# entrer : false (puis Y)

vercel env add I18N_ENABLED preview
# entrer : true

vercel env add I18N_LOCALES_ACTIVE production
# entrer : fr,ar,en

# ... etc pour tous les flags
```

### `.env.example` à mettre à jour

```bash
# i18n feature flags
I18N_ENABLED=true
I18N_LOCALES_ACTIVE=fr,ar,en
I18N_RTL_ENABLED=true
I18N_CMS_BINDINGS_ENABLED=true
```

### Workflow modification flag en prod

1. Lead annonce dans Slack : "Toggle I18N_RTL_ENABLED=false pour X raison"
2. Lead toggle via Vercel Dashboard ou CLI
3. Vercel propose "Redeploy to apply" → click
4. Vercel redéploie (~2 min)
5. Lead vérifie : ouvrir `/ar/kit` en navigation privée et inspecter `<html dir>`
6. Slack confirme : "Toggle effectif"
7. Documenter dans `docs/i18n-strategy-2026-05/00-context/log-toggle-flags.md`

---

## Tests par combinaison

Matrice de tests à exécuter avant chaque deploy majeur :

### Combinaison 1 : Full rollback (master off)

```bash
I18N_ENABLED=false
I18N_LOCALES_ACTIVE=fr
I18N_RTL_ENABLED=true
I18N_CMS_BINDINGS_ENABLED=false
```

**Tests** :
- [ ] `/` rend home FR legacy
- [ ] `/contact` rend contact FR legacy (pas de redirect)
- [ ] `/fr/contact` n'existe pas (404)
- [ ] Pas de LocaleSwitcher visible
- [ ] CMS lit FR uniquement
- [ ] Performance baseline LCP < 2.5s

### Combinaison 2 : FR seul (transition)

```bash
I18N_ENABLED=true
I18N_LOCALES_ACTIVE=fr
I18N_RTL_ENABLED=true
I18N_CMS_BINDINGS_ENABLED=true
```

**Tests** :
- [ ] `/contact` redirige vers `/fr/contact`
- [ ] `/fr/contact` rend OK
- [ ] `/en/contact` rend 404
- [ ] `/ar/contact` rend 404
- [ ] Pas de LocaleSwitcher (1 seule locale)
- [ ] CMS lit FR avec infra multilang

### Combinaison 3 : FR + EN (sans AR)

```bash
I18N_ENABLED=true
I18N_LOCALES_ACTIVE=fr,en
I18N_RTL_ENABLED=true
I18N_CMS_BINDINGS_ENABLED=true
```

**Tests** :
- [ ] `/fr/contact` OK
- [ ] `/en/contact` OK
- [ ] `/ar/contact` 404
- [ ] LocaleSwitcher montre 2 options
- [ ] Pas de Cairo font chargée

### Combinaison 4 : État cible V1

```bash
I18N_ENABLED=true
I18N_LOCALES_ACTIVE=fr,ar,en
I18N_RTL_ENABLED=true
I18N_CMS_BINDINGS_ENABLED=true
```

**Tests** :
- [ ] 3 locales rendues OK
- [ ] LocaleSwitcher montre 3 options
- [ ] `/ar/*` a `<html dir="rtl">`
- [ ] Cairo font chargée sur AR
- [ ] CMS fallback FR si traduction manque

### Combinaison 5 : RTL disabled (debug mode)

```bash
I18N_ENABLED=true
I18N_LOCALES_ACTIVE=fr,ar,en
I18N_RTL_ENABLED=false
I18N_CMS_BINDINGS_ENABLED=true
```

**Tests** :
- [ ] `/ar/*` a `<html dir="ltr">` (forcé)
- [ ] Rendu visuellement cassé mais charge OK
- [ ] À utiliser uniquement pour debug

### Combinaison 6 : CMS bindings off (rollback phase 3)

```bash
I18N_ENABLED=true
I18N_LOCALES_ACTIVE=fr,ar,en
I18N_RTL_ENABLED=true
I18N_CMS_BINDINGS_ENABLED=false
```

**Tests** :
- [ ] Pages marketing affichent contenus CMS en FR (sur toutes locales)
- [ ] Strings statiques (messages JSON) restent localisées
- [ ] Admin UI peut toujours saisir AR (DB indépendante)

---

## Lifecycle des flags

### Phase 0 (avant kickoff)

Aucun flag actif. Site monolingue FR.

### Phase 1 (semaine 1-2)

- Création `lib/feature-flags/i18n.ts`
- Local : `I18N_ENABLED=true`
- Preview : `I18N_ENABLED=true`
- Production : pas encore touchée
- `I18N_LOCALES_ACTIVE=fr,en`

### Phase 2 (semaines 3-4)

- Local + preview : `I18N_LOCALES_ACTIVE=fr,en`
- AR reste copie FR (pas dans LOCALES_ACTIVE encore)
- `I18N_CMS_BINDINGS_ENABLED=false`

### Phase 3 (semaine 5)

- Local + preview : `I18N_CMS_BINDINGS_ENABLED=true`
- Production : reste `false` jusqu'à phase 7

### Phase 4 (semaine 6)

- Local + preview : `I18N_RTL_ENABLED=true`
- AR pas encore dans `LOCALES_ACTIVE` mais infra prête

### Phase 5 (semaine 7)

- Local + preview : `I18N_LOCALES_ACTIVE=fr,ar,en` (AR ajouté)

### Phase 6 (semaines 8-9)

- Tests sur toutes combinaisons
- Production : reste off

### Phase 7 (semaine 10)

- **Canary 10%** : Vercel Edge Config split + `I18N_ENABLED=true` pour 10%
- **Canary 50%** : split à 50%
- **Canary 100%** : `I18N_ENABLED=true` partout sur prod
- `I18N_LOCALES_ACTIVE=fr,ar,en`
- `I18N_RTL_ENABLED=true`
- `I18N_CMS_BINDINGS_ENABLED=true`

### Phase 8 (semaine 11)

- Stabilisation : flags figés sur prod
- Drill rollback testé

### Post-projet (long terme)

Une fois l'i18n stable depuis 3-6 mois :
- **Option A** : flags figés (jamais togglés) → `enabled=true` hardcoded, autres flags supprimés
- **Option B** : flags maintenus pour flexibilité (recommandé pour 1 an minimum)

**Quand supprimer un flag** :
- Plus toggle depuis 6 mois
- Combinaison alternative jamais utile
- Code mort

---

## Anti-patterns

### 1. Lire `process.env` partout

❌ **À éviter** :

```typescript
// component.tsx
if (process.env.I18N_ENABLED === 'true') {
  // ...
}
```

✅ **À faire** :

```typescript
import { i18nFlags } from '@/lib/feature-flags/i18n';

if (i18nFlags.isEnabled()) {
  // ...
}
```

**Raison** : centralisation, type-safety, testabilité, validation.

### 2. Flag conditional autour de tout

❌ **À éviter** :

```typescript
// 50 endroits dans le code
{i18nFlags.isEnabled() && <LocaleSwitcher />}
```

✅ **À faire** :

```typescript
// LocaleSwitcher.tsx interne
export function LocaleSwitcher() {
  if (!i18nFlags.isEnabled()) return null;
  // ...
}
```

**Raison** : encapsulation, single source of truth.

### 3. Flag = config permanente

❌ **À éviter** : flags comme config produit (`SHOW_HEADER=true`).

✅ **À faire** : flags pour rollout temporaire, supprimer après stabilisation.

### 4. Trop de flags

❌ **À éviter** : `I18N_AR_KIT_PAGE_ENABLED`, `I18N_FR_CONTACT_ENABLED`, `I18N_LOCALE_SWITCHER_MOBILE_ENABLED`...

✅ **À faire** : 4 flags suffisent. Si on a besoin de plus de granularité, repenser l'architecture.

### 5. Logique métier dans le flag

❌ **À éviter** :

```typescript
export function getActiveLocales() {
  const env = process.env.ENV;
  if (env === 'staging' && new Date().getDay() === 1) return ['fr'];
  return ['fr', 'ar', 'en'];
}
```

✅ **À faire** : flag = simple toggle binaire ou liste figée. Logique métier ailleurs.

### 6. Flag non documenté

❌ **À éviter** : ajouter `I18N_NEW_FEATURE_X=true` sans rien dans `.env.example` ni ce document.

✅ **À faire** : tout nouveau flag = doc + tests + lifecycle.

---

## Liens

- [`README.md`](./README.md) — TL;DR
- [`phases.md`](./phases.md) — Plan détaillé
- [`rollback.md`](./rollback.md) — Procédures rollback
- [`checklist.md`](./checklist.md) — Checklists
- [`../03-backend/locale-resolver.md`](../03-backend/locale-resolver.md) — Détails locale resolution
- [`../00-context/etat-actuel.md`](../00-context/etat-actuel.md) — Audit existant

---

## Statut

- ⏳ **Draft** — à valider lead avant phase 1 (T1.7)
- Implementation prévue : Phase 1, T1.7
