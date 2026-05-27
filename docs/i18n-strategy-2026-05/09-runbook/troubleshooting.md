# Troubleshooting i18n FemiGlow

> FAQ et procédures de diagnostic / fix pour les **erreurs fréquentes** rencontrées en développement, déploiement et opération de l'i18n FemiGlow.
>
> **Audience** : dev (debug), lead (incidents), support (escalation).
>
> **Comment utiliser** : recherche `Cmd+F` par symptôme (route 404, build fail, locale wrong…). Chaque entrée a : symptôme, cause, fix, prévention.

---

## Sommaire

- [Routing et locales](#routing-et-locales)
- [Build et types](#build-et-types)
- [Performance et bundle](#performance-et-bundle)
- [RTL et layout](#rtl-et-layout)
- [SEO et metadata](#seo-et-metadata)
- [Wizard CHA-231](#wizard-cha-231)
- [Coverage et traductions](#coverage-et-traductions)
- [Tests et CI](#tests-et-ci)
- [Production et monitoring](#production-et-monitoring)
- [Erreurs TS / runtime fréquentes](#erreurs-ts--runtime-fréquentes)

---

## Routing et locales

### Q1 — User voit `/fr/kit` au lieu de `/ar/kit` malgré navigateur AR

**Symptôme** : un utilisateur avec navigateur en arabe (`Accept-Language: ar`) atterrit sur `/fr/kit` au lieu de `/ar/kit`.

**Cause possible 1** : Le cookie `NEXT_LOCALE=fr` est posé d'une visite précédente et override la détection `Accept-Language`.

**Cause possible 2** : `localeDetection` est désactivé dans la config next-intl.

**Cause possible 3** : `Accept-Language` n'est pas correctement parsé (ex: `ar` vs `ar-MA`).

**Fix** :

1. Vérifier le cookie côté navigateur :
   ```bash
   curl -I https://femiglow.ma/ -H "Accept-Language: ar"
   # Cherche Set-Cookie: NEXT_LOCALE=
   ```

2. Vérifier la config :
   ```typescript
   // apps/web/src/i18n/routing.ts
   export const routing = defineRouting({
     locales: ['fr', 'ar', 'en'],
     defaultLocale: 'fr',
     localePrefix: 'always',
     localeDetection: true,  // ← doit être true
   });
   ```

3. Vérifier l'ordre de priorité dans next-intl :
   1. Path prefix (ex: `/ar/...`)
   2. Cookie `NEXT_LOCALE`
   3. `Accept-Language` header
   4. Default locale

**Prévention** : Documenter dans la FAQ utilisateur qu'il peut switcher via LocaleSwitcher. Tester avec `vercel logs` pour voir comment la résolution se passe en prod.

---

### Q2 — Route `/fr/inexistant` retourne 200 au lieu de 404

**Symptôme** : taper une route qui n'existe pas en FR retourne 200 avec page vide au lieu de 404.

**Cause** : `app/[locale]/not-found.tsx` manquant ou mal configuré.

**Fix** :

```bash
# Créer le 404 par locale
touch apps/web/src/app/\[locale\]/not-found.tsx
```

Contenu :

```typescript
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('errors.notFound');
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

Ajouter dans `messages/{fr,ar,en}.json` :

```json
{
  "errors": {
    "notFound": {
      "title": "Page introuvable",
      "description": "La page demandée n'existe pas ou plus."
    }
  }
}
```

---

### Q3 — Middleware boucle infinie (CPU 100%)

**Symptôme** : `pnpm dev` consomme 100% CPU, browser hangs, logs montrent middleware appelé en boucle.

**Cause** : Middleware trop permissif qui intercepte les requêtes `/api/*`, `/_next/static/*`, etc.

**Fix** : vérifier le `matcher` dans `middleware.ts` :

```typescript
// apps/web/src/middleware.ts
export const config = {
  matcher: [
    // Skip all API routes, _next, static files
    '/((?!api|_next|.*\\..*|admin|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
```

**Test rapide** :

```bash
# Lancer dev avec logs verbose
DEBUG=next-intl* pnpm -F web dev
# Observer si middleware s'auto-appelle
```

**Prévention** : tester en local avec navigation entre routes, vérifier que le middleware est appelé **une seule fois** par request (pas par sub-resource).

---

### Q4 — Cookie `NEXT_LOCALE` pas posé après switch

**Symptôme** : user clique sur le LocaleSwitcher, URL change vers `/ar/...` mais après refresh, retour à `/fr/...`.

**Cause** : `localeDetection` désactivé OU cookie SameSite trop restrictif OU domaine cookie mal configuré.

**Fix** :

1. Vérifier `localeDetection: true` dans routing config.

2. Vérifier les attributs du cookie (devtools → Application → Cookies) :
   - `Name` : `NEXT_LOCALE`
   - `Path` : `/`
   - `SameSite` : `Lax` (pas `Strict`)
   - `Secure` : `true` en HTTPS, `false` en local
   - `Expires` : 1 an

3. Si custom domain : vérifier que le cookie est posé sur le bon domaine (`.femiglow.ma`, pas `staging-xyz.vercel.app`).

**Prévention** : test E2E qui clique sur switcher + refresh + vérifie URL.

---

### Q5 — Switch locale perd la querystring (`?utm=xyz`)

**Symptôme** : sur `/fr/kit?utm_source=instagram`, click "EN" → arrive sur `/en/kit` (sans utm).

**Cause** : `LocaleSwitcher` reconstruit l'URL sans préserver la querystring.

**Fix** : utiliser `useRouter` + `usePathname` + `useSearchParams` :

```typescript
'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  function switchLocale(newLocale: string) {
    const segments = pathname.split('/');
    segments[1] = newLocale;  // remplace le segment locale
    const newPath = segments.join('/');
    const qs = searchParams.toString();
    router.push(qs ? `${newPath}?${qs}` : newPath);
  }
  // ...
}
```

**Prévention** : test E2E qui fait switch sur URL avec querystring.

---

## Build et types

### Q6 — Build fail "Type error in messages"

**Symptôme** :

```
Type error: Type '{ ... }' is not assignable to type 'IntlMessages'.
```

**Cause** : `messages.d.ts` augmente `IntlMessages` mais une clé manque dans un fichier (ex: AR n'a pas `contact.newSection` alors que FR oui).

**Fix** :

1. Lancer le diff de clés :
   ```bash
   pnpm -F web exec tsx scripts/i18n/diff-keys.ts \
     --source messages/fr.json \
     --target messages/ar.json
   ```

2. Ajouter les clés manquantes dans toutes les locales :
   ```json
   // messages/ar.json
   {
     "contact": {
       "newSection": "[TODO-AR] Nouvelle section"
     }
   }
   ```

3. Re-build :
   ```bash
   pnpm -F web typecheck
   pnpm -F web build
   ```

**Prévention** : ESLint rule custom qui vérifie l'alignement des clés. CI step.

---

### Q7 — Build fail "Cannot find module 'next-intl/middleware'"

**Symptôme** :

```
Module not found: Can't resolve 'next-intl/middleware'
```

**Cause** : version next-intl trop ancienne (< 3.x) ou conflit Next.js / next-intl.

**Fix** :

```bash
# Vérifier les versions
pnpm -F web list next next-intl
# Doit être : next ≥ 14, next-intl ≥ 3.x

# Upgrade
pnpm -F web add next-intl@^3
pnpm -F web build
```

Si conflit persistant : voir issue tracker https://github.com/amannn/next-intl/issues

---

### Q8 — `useTranslations` returns `unknown` au lieu de string

**Symptôme** : `const t = useTranslations(); t('hello')` retourne `unknown` au lieu de string en TS.

**Cause** : `IntlMessages` augmentation pas dans `tsconfig.include`.

**Fix** : vérifier `apps/web/tsconfig.json` :

```json
{
  "include": [
    "src/**/*",
    "messages/**/*.json",
    "src/i18n/messages.d.ts"
  ]
}
```

Vérifier que `messages.d.ts` augmente bien le namespace global :

```typescript
// apps/web/src/i18n/messages.d.ts
import type messages from '../../messages/fr.json';

declare global {
  interface IntlMessages extends typeof messages {}
}
```

**Fix alternatif** : reset le langserver TS :

```bash
# VS Code : Cmd+Shift+P → "TypeScript: Restart TS Server"
# Ou en CLI :
rm -rf apps/web/.next apps/web/.turbo
pnpm -F web typecheck
```

---

### Q9 — Build OK en local, fail en CI

**Symptôme** : `pnpm build` OK sur Mac, fail sur GitHub Actions.

**Causes possibles** :

1. **Différence de version Node** : local sur 20.x, CI sur 18.x.
2. **Différence pnpm** : lockfile pas à jour.
3. **Env vars différentes** : `I18N_*` manquantes en CI.
4. **Case-sensitivity** : Mac case-insensitive, Linux case-sensitive (import `./Component` vs `./component`).

**Fix** :

1. Vérifier `.nvmrc` et workflows GitHub Actions :
   ```yaml
   # .github/workflows/test.yml
   - uses: actions/setup-node@v4
     with:
       node-version-file: '.nvmrc'
   ```

2. Vérifier les env vars CI :
   ```yaml
   env:
     I18N_ENABLED: 'true'
     I18N_LOCALES_ACTIVE: 'fr,ar,en'
     I18N_RTL_ENABLED: 'true'
     I18N_CMS_BINDINGS_ENABLED: 'true'
   ```

3. Vérifier les imports case-sensitive :
   ```bash
   # Scanner les imports
   grep -r "from '\./[A-Z]" apps/web/src
   # Vérifier que chaque fichier a la bonne casse
   ```

---

## Performance et bundle

### Q10 — Bundle size +50% après ajout i18n

**Symptôme** : Lighthouse report montre bundle qui passe de 200kB à 300kB après ajout next-intl.

**Cause** : tous les `messages/*.json` chargés d'un coup (pas de lazy load par locale).

**Fix** : utiliser `getRequestConfig` pour charger seulement la locale active :

```typescript
// apps/web/src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => {
  return {
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

Vérifier que les imports ne sont **pas** top-level :

```typescript
// ❌ MAUVAIS — tous les fichiers chargés au build
import fr from '../messages/fr.json';
import ar from '../messages/ar.json';
import en from '../messages/en.json';

// ✓ BON — dynamic import par locale active
const messages = await import(`../messages/${locale}.json`);
```

**Vérif bundle size** :

```bash
pnpm -F web build
pnpm -F web exec next-bundle-analyzer
# Ou : ANALYZE=true pnpm -F web build
```

**Prévention** : Lighthouse CI avec budget de bundle size (cf. Phase 6).

---

### Q11 — LCP > 4s sur `/ar/*`

**Symptôme** : Lighthouse montre LCP médian à 4.5s pour `/ar/kit`, vs 2.1s pour `/fr/kit`.

**Causes possibles** :

1. **Font Cairo** charge en blocking (FOIT).
2. **Images** pas optimisées pour viewport AR.
3. **JS bundle** plus gros sur AR (à cause de plural rules ICU).

**Fix font** :

```typescript
// apps/web/src/app/[locale]/layout.tsx
import { Cairo } from 'next/font/google';

const cairo = Cairo({
  subsets: ['arabic'],
  variable: '--font-arabic',
  display: 'swap',  // ← critique pour LCP
  preload: true,
});
```

**Fix images** : utiliser `next/image` avec `priority` sur le hero.

**Fix bundle ICU** :

```typescript
// Lazy load polyfill si nécessaire
// Mais en V1, Intl natif suffit pour FR/AR/EN
```

**Mesurer après fix** :

```bash
pnpm -F web exec lhci collect --url=https://femiglow.ma/ar/kit
# Comparer LCP avant/après
```

---

### Q12 — Mémoire serveur Vercel explose sur prod

**Symptôme** : Vercel function logs montrent OOM (out of memory) sur les requêtes i18n.

**Cause** : messages JSON re-parsé à chaque requête (pas cache).

**Fix** : next-intl met en cache automatiquement, mais vérifier qu'on ne re-import pas manuellement :

```typescript
// ❌ MAUVAIS — re-parsé chaque request
function getMessages(locale: string) {
  return JSON.parse(fs.readFileSync(`messages/${locale}.json`));
}

// ✓ BON — utiliser le mécanisme next-intl
import { getMessages } from 'next-intl/server';
const messages = await getMessages();
```

---

## RTL et layout

### Q13 — AR layout cassé (texte aligné à gauche au lieu de droite)

**Symptôme** : sur `/ar/contact`, le texte du formulaire est aligné à gauche, le bouton à gauche, ça ressemble à du LTR.

**Cause** : `<html dir>` pas dynamique OU les composants utilisent `ml-*` au lieu de `ms-*`.

**Fix** :

1. Vérifier le `<html dir>` :
   ```typescript
   // apps/web/src/app/[locale]/layout.tsx
   const dir = i18nFlags.isRtlEnabled() && locale === 'ar' ? 'rtl' : 'ltr';
   return <html lang={locale} dir={dir}>...</html>;
   ```

2. Vérifier dans devtools : `<html dir="rtl">` doit être présent.

3. Auditer Tailwind classes :
   ```bash
   rg -t tsx '\bm[lr]-|p[lr]-|text-(left|right)|border-[lr]' apps/web/src
   # Remplacer ml-* → ms-*, mr-* → me-*, etc.
   ```

Mappings (cf. [`execution-pas-a-pas.md`](./execution-pas-a-pas.md) § Phase 4) :

| Direction-aware | Logical |
|---|---|
| `ml-4` | `ms-4` |
| `text-left` | `text-start` |
| `border-l` | `border-s` |

**Prévention** : ESLint rule `tailwindcss/no-arbitrary-value` + audit visual regression dédié RTL.

---

### Q14 — Icônes ne flippent pas en RTL (flèches gauche/droite)

**Symptôme** : flèche "→" dans le bouton "Suivant" pointe vers la droite même sur `/ar/*` (incorrect en RTL, doit pointer vers la gauche `←`).

**Cause** : icône SVG pas flippée automatiquement.

**Fix** : utiliser `rtl:rotate-180` Tailwind sur les icônes directionnelles :

```tsx
<svg className="rtl:rotate-180">
  {/* SVG flèche */}
</svg>
```

Ou bien utiliser des icônes avec `dir="auto"` :

```tsx
<svg dir="auto" style={{ transform: 'var(--icon-flip)' }} />
```

Et dans le CSS :

```css
:dir(rtl) {
  --icon-flip: scaleX(-1);
}
```

**Prévention** : audit des icônes lors du refactor RTL Phase 4.

---

### Q15 — Inputs ne marchent pas correctement en RTL

**Symptôme** : champ "Email" en `/ar/contact` — l'utilisateur tape, mais le texte commence à droite avec curseur à gauche, comportement étrange.

**Cause** : `dir` attribute manquant sur l'input.

**Fix** : forcer `dir="auto"` ou `dir="rtl"` sur les inputs :

```tsx
<input
  type="email"
  dir="auto"  // ← détecte auto selon contenu
  className="text-start"
/>
```

⚠️ Cas spécial : un champ "Email" doit être en LTR même en page AR (les emails sont en alphabet latin). Utiliser :

```tsx
<input type="email" dir="ltr" className="text-start" />
```

---

### Q16 — Carousel images glisse dans la mauvaise direction en RTL

**Symptôme** : sur `/ar/journal`, le carousel "Suivant" glisse vers la droite au lieu de la gauche.

**Cause** : librairie carousel pas RTL-aware (Swiper, embla-carousel, etc.).

**Fix** : configurer la direction selon `dir` :

```tsx
import { useLocale } from 'next-intl';

function Carousel() {
  const locale = useLocale();
  const isRtl = locale === 'ar';
  
  return (
    <Swiper
      dir={isRtl ? 'rtl' : 'ltr'}
      // ... autres options
    />
  );
}
```

---

## SEO et metadata

### Q17 — SEO duplicate content warning Google

**Symptôme** : Google Search Console alerte "Duplicate content" sur `/fr/contact` et `/contact`.

**Cause** : route legacy `/contact` toujours indexée OU canonical mal configuré.

**Fix** :

1. **Si Phase 1+** : `/contact` doit redirect 308 vers `/fr/contact`. Vérifier dans middleware :

   ```typescript
   if (pathname === '/contact') {
     return NextResponse.redirect(new URL('/fr/contact', req.url), 308);
   }
   ```

2. **Canonical** : chaque page locale doit avoir `<link rel="canonical">` pointant vers elle-même :

   ```tsx
   export async function generateMetadata({ params: { locale } }) {
     return {
       alternates: {
         canonical: `https://femiglow.ma/${locale}/contact`,
         languages: {
           fr: 'https://femiglow.ma/fr/contact',
           ar: 'https://femiglow.ma/ar/contact',
           en: 'https://femiglow.ma/en/contact',
           'x-default': 'https://femiglow.ma/fr/contact',
         },
       },
     };
   }
   ```

3. **Sitemap** : retirer `/contact` legacy du sitemap, ajouter les versions locales.

**Vérification** :

```bash
curl -s https://femiglow.ma/fr/contact | grep -E '(canonical|hreflang)'
```

---

### Q18 — hreflang pas reconnu par Google

**Symptôme** : Google Search Console rapporte "hreflang invalides".

**Causes** :

1. Codes locale invalides (BCP-47).
2. Hreflang asymétriques (FR pointe vers AR, AR ne pointe pas vers FR).
3. URLs absolues manquantes.

**Fix** : vérifier les codes BCP-47 :

| Locale FemiGlow | BCP-47 standard |
|---|---|
| `fr` | `fr` ou `fr-MA` |
| `ar` | `ar` ou `ar-MA` |
| `en` | `en` ou `en-MA` (si tier-1 MA) |

Vérifier la symétrie : chaque page doit lister TOUTES les locales (y compris elle-même).

```html
<!-- Sur /fr/contact -->
<link rel="alternate" hreflang="fr" href="https://femiglow.ma/fr/contact">
<link rel="alternate" hreflang="ar" href="https://femiglow.ma/ar/contact">
<link rel="alternate" hreflang="en" href="https://femiglow.ma/en/contact">
<link rel="alternate" hreflang="x-default" href="https://femiglow.ma/fr/contact">
```

**Outils de validation** :

- Google Search Console
- https://technicalseo.com/tools/hreflang/

---

### Q19 — JSON-LD `inLanguage` manquant

**Symptôme** : audit SEO indique que les Schema.org entities n'ont pas la propriété `inLanguage`.

**Fix** : ajouter dans chaque JSON-LD :

```tsx
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  inLanguage: locale,  // ← critique
  // ... autres props
};
```

Pour les locales BCP-47 complets : `inLanguage: 'fr-MA'`, `inLanguage: 'ar-MA'`.

---

## Wizard CHA-231

### Q20 — Wizard ne passe plus en AR malgré ouverture site en AR

**Symptôme** : sur `/ar/kit`, click "Démarrer le rituel" → wizard s'ouvre en FR au lieu de AR.

**Cause** : `WizardDictionary` (cf. ADR-007) utilise une logique séparée de `next-intl`. La locale doit lui être passée explicitement.

**Fix** : vérifier que le wizard reçoit la locale :

```tsx
// apps/web/src/components/wizard/WizardEntry.tsx
import { useLocale } from 'next-intl';
import { getWizardDictionary } from '@/lib/wizard/dictionary';

function WizardEntry() {
  const locale = useLocale();
  const dictionary = getWizardDictionary(locale);
  
  return <Wizard dictionary={dictionary} />;
}
```

Vérifier que `getWizardDictionary` supporte la locale :

```typescript
// apps/web/src/lib/wizard/dictionary/index.ts
export function getWizardDictionary(locale: string) {
  switch (locale) {
    case 'ar': return wizardDictionaryAr;
    case 'en': return wizardDictionaryEn;
    case 'fr':
    default: return wizardDictionaryFr;
  }
}
```

🚨 **Ne pas casser** le WizardDictionary existant — c'est ADR-007 strict. Si la locale n'existe pas en wizard, fallback FR (pas crash).

---

### Q21 — Tests CHA-231 wizard cassés après une PR i18n

**Symptôme** : `pnpm test apps/web/src/lib/wizard/` retourne 5 tests rouges après merge d'une PR i18n.

**Cause** : la PR a touché `WizardDictionary` ou ses imports (interdit par ADR-007).

**Fix immédiat** :

```bash
git log --all --oneline -- apps/web/src/lib/wizard/dictionary/ | head -5
# Identifier le commit fautif

git revert <commit-sha>
# Ou si possible : restaurer les fichiers
git checkout master -- apps/web/src/lib/wizard/dictionary/
```

**Prévention** : ESLint rule `i18n/wizard-dictionary-immutable` qui bloque les modifs sur ces fichiers (cf. CHA-231).

---

## Coverage et traductions

### Q22 — Coverage drop AR < 90%

**Symptôme** : rapport weekly montre que `messages/ar.json` n'a que 87% des clés FR.

**Cause** : dev a ajouté des nouvelles clés FR sans demander trad AR.

**Fix** :

1. Identifier les clés manquantes :
   ```bash
   pnpm -F web exec tsx scripts/i18n/diff-keys.ts \
     --source messages/fr.json \
     --target messages/ar.json
   # Liste les ~70 clés manquantes
   ```

2. Décision :
   - Si urgent : DeepL + review native rapide (1j)
   - Si peut attendre : exporter CSV, briefer translateur (5-7j)

3. Workflow rapide DeepL fallback :
   ```bash
   pnpm -F web exec tsx scripts/i18n/auto-translate.ts \
     --source messages/fr.json \
     --target messages/ar.json \
     --keys-only-missing
   # Génère un fichier avec préfixe [DEEPL-TODO] pour clarifier qu'à réviser
   ```

**Prévention** : weekly review W1 (cf. [`operations-quotidiennes.md`](./operations-quotidiennes.md)).

---

### Q23 — Strings affichent `[TODO-AR]` en prod

**Symptôme** : sur `/ar/contact`, un titre affiche `[TODO-AR] Contactez-nous` au lieu de la trad arabe.

**Cause** : le translateur a oublié de remplacer le placeholder OU l'import s'est mal passé.

**Fix immédiat** :

1. Identifier la clé :
   ```bash
   grep -n "TODO-AR" apps/web/messages/ar.json
   ```

2. Corriger soit manuellement, soit re-demander au translateur :
   ```bash
   # Quick fix dans l'admin UI (si CMS multilang active)
   # OU mini-PR
   ```

3. Push hotfix :
   ```bash
   git checkout -b hotfix/i18n-ar-todo-strings
   # Éditer messages/ar.json
   git commit -m "hotfix(i18n): replace remaining [TODO-AR] strings"
   git push
   gh pr create --title "hotfix(i18n): replace TODO-AR placeholders"
   ```

**Prévention** : ESLint rule custom qui détecte `[TODO-` dans `messages/*.json` et fait fail le build en prod.

---

### Q24 — ICU pluralization broken en AR

**Symptôme** : `"items": "{count, plural, one {# item} other {# items}}"` rend `"5 items"` même en AR (devrait avoir 6 formes).

**Cause** : la traduction AR n'inclut que `one` et `other`, pas `zero/two/few/many`.

**Fix** : AR a 6 formes plurielles obligatoires :

```json
{
  "items": "{count, plural, =0 {لا عناصر} one {عنصر واحد} two {عنصران} few {# عناصر} many {# عنصراً} other {# عنصر}}"
}
```

Tester :

```typescript
import { useTranslations } from 'next-intl';
const t = useTranslations('cart');
t('items', { count: 0 });   // لا عناصر
t('items', { count: 1 });   // عنصر واحد
t('items', { count: 2 });   // عنصران
t('items', { count: 5 });   // 5 عناصر
t('items', { count: 50 });  // 50 عنصراً
t('items', { count: 100 }); // 100 عنصر
```

**Prévention** : tests unit dédiés à la pluralization AR (cf. Phase 6 T6.1).

---

### Q25 — Format date différent entre locales casse les tests

**Symptôme** : tests E2E qui assert `15/05/2026` échouent sur `/ar/journal` car AR affiche `٢٠٢٦/٠٥/١٥`.

**Cause** : `Intl.DateTimeFormat` change selon locale.

**Fix** : tests doivent être locale-aware :

```typescript
// ❌ MAUVAIS — assume format FR
await expect(page.locator('.date')).toHaveText('15/05/2026');

// ✓ BON — utiliser Intl.DateTimeFormat dans le test
const expectedDate = new Intl.DateTimeFormat(locale).format(new Date('2026-05-15'));
await expect(page.locator('.date')).toHaveText(expectedDate);

// ✓ OU — masquer dates dans visual regression
await expect(page).toHaveScreenshot({
  mask: [page.locator('.date')],
});
```

---

## Tests et CI

### Q26 — Tests E2E flaky uniquement sur `/ar/*`

**Symptôme** : la suite Playwright pour AR échoue 30% du temps en CI, marche en local.

**Cause** : font Cairo charge lentement, ralentit l'hydration, race condition sur les assertions.

**Fix** :

1. Attendre le réseau idle :
   ```typescript
   await page.goto('/ar/contact');
   await page.waitForLoadState('networkidle');
   await expect(page.locator('h1')).toBeVisible();
   ```

2. Précharger les fonts dans Playwright config :
   ```typescript
   // playwright.config.ts
   use: {
     extraHTTPHeaders: { 'Accept-Language': 'ar' },
     // Force la font ASAP
   }
   ```

3. Si vraiment flaky, retry 1 fois :
   ```typescript
   // playwright.config.ts
   retries: process.env.CI ? 2 : 0,
   ```

**Prévention** : run les tests E2E 3 fois en CI pour détecter flaky tôt.

---

### Q27 — Visual regression diff sur dates dynamiques

**Symptôme** : snapshots Playwright changent à chaque run car la date "Aujourd'hui" change.

**Fix** : masquer les éléments dynamiques :

```typescript
await expect(page).toHaveScreenshot('home.png', {
  mask: [
    page.locator('[data-testid="current-date"]'),
    page.locator('[data-testid="last-update"]'),
    page.locator('[data-testid="dynamic-price"]'),
  ],
  animations: 'disabled',
  caret: 'hide',
});
```

Ou freeze le timestamp côté serveur en mode test :

```typescript
// apps/web/src/lib/datetime.ts
export function now() {
  return process.env.NODE_ENV === 'test' && process.env.TEST_FROZEN_TIME
    ? new Date(process.env.TEST_FROZEN_TIME)
    : new Date();
}
```

---

### Q28 — A11y violation "Document has no `<html lang>` attribute"

**Symptôme** : axe-playwright remonte violation `html-has-lang` sur les 3 locales.

**Cause** : `<html lang>` manquant ou hardcodé `lang="fr"` sur les pages AR/EN.

**Fix** : layout root doit avoir `lang` dynamique :

```tsx
// apps/web/src/app/[locale]/layout.tsx
export default function LocaleLayout({ children, params: { locale } }) {
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>{children}</body>
    </html>
  );
}
```

**Test rapide** :

```bash
curl -s https://femiglow.ma/ar/ | grep '<html'
# Doit montrer : <html lang="ar" dir="rtl">
```

---

## Production et monitoring

### Q29 — Erreurs Sentry pas taguées avec locale

**Symptôme** : sur Sentry, impossible de filtrer les errors par locale.

**Cause** : instrumentation Sentry pas configurée pour tagger.

**Fix** : dans `sentry.client.config.ts` :

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend(event) {
    // Tagger avec la locale courante
    if (typeof window !== 'undefined') {
      const locale = document.documentElement.lang;
      event.tags = { ...event.tags, locale };
    }
    return event;
  },
});
```

Et `sentry.server.config.ts` pour les RSC / Server Actions :

```typescript
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';

export function setLocaleSentryTag() {
  const locale = headers().get('x-locale');
  if (locale) {
    Sentry.setTag('locale', locale);
  }
}
```

---

### Q30 — Locale distribution anormale (0% AR en prod)

**Symptôme** : analytics montre 80% FR, 20% EN, 0% AR — alors qu'on attendait ~10% AR.

**Causes possibles** :

1. **Bug RTL** qui crashe immédiatement sur AR → users rebondissent.
2. **Cookie `NEXT_LOCALE=fr`** posé par défaut, AR users forcés en FR.
3. **Géo-redirect** mal configuré, MA users → FR.

**Investigation** :

1. Tester manuellement `/ar/` en navigation privée :
   ```bash
   curl -I https://femiglow.ma/ar/
   # Status doit être 200
   ```

2. Vérifier Sentry sur tag `locale:ar` :
   - Si beaucoup d'erreurs → bug RTL probable
   - Si peu de hits du tout → cookie ou détection

3. Logs Vercel pour comprendre le routing :
   ```bash
   vercel logs https://femiglow.ma --since=1h | grep "/ar"
   ```

**Fix** : selon cause.

---

### Q31 — Sitemap ne contient pas toutes les locales

**Symptôme** : `https://femiglow.ma/sitemap.xml` n'a que les URLs FR.

**Cause** : sitemap generator pas locale-aware.

**Fix** :

```typescript
// apps/web/src/app/sitemap.ts
import { MetadataRoute } from 'next';

const locales = ['fr', 'ar', 'en'];
const routes = ['', 'contact', 'kit', 'maison', 'rituel', 'journal'];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.flatMap(route =>
    locales.map(locale => ({
      url: `https://femiglow.ma/${locale}/${route}`,
      lastModified: new Date(),
      alternates: {
        languages: Object.fromEntries(
          locales.map(l => [l, `https://femiglow.ma/${l}/${route}`])
        ),
      },
    }))
  );
}
```

**Vérification** :

```bash
curl -s https://femiglow.ma/sitemap.xml | grep -c '<url>'
# Attendu : 18 (3 locales × 6 routes)
```

---

## Erreurs TS / runtime fréquentes

### Q32 — `Error: Failed to call useTranslations outside a NextIntlClientProvider`

**Symptôme** : runtime error dans le browser.

**Cause** : composant client (`'use client'`) qui utilise `useTranslations` mais pas wrappé dans `NextIntlClientProvider`.

**Fix** :

```tsx
// apps/web/src/app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function LocaleLayout({ children, params: { locale } }) {
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

---

### Q33 — `Error: Couldn't find next-intl config file`

**Symptôme** : build fail.

**Cause** : `next.config.js` pas configuré pour next-intl.

**Fix** : `apps/web/next.config.js` :

```javascript
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {
  // ... config existante
};

module.exports = withNextIntl(nextConfig);
```

---

### Q34 — `Error: MISSING_MESSAGE: Could not resolve 'contact.title' in messages for locale 'ar'`

**Symptôme** : runtime error en prod sur `/ar/contact`.

**Cause** : clé `contact.title` existe dans `fr.json` mais pas dans `ar.json`.

**Fix immédiat** : ajouter la clé dans `ar.json`.

**Fix défensif** : fallback configurable dans next-intl :

```typescript
// apps/web/src/i18n/request.ts
export default getRequestConfig(async ({ locale }) => {
  return {
    messages: (await import(`../../messages/${locale}.json`)).default,
    onError(error) {
      if (error.code === 'MISSING_MESSAGE') {
        // Log to Sentry mais ne pas crasher
        console.warn(`Missing key for ${locale}: ${error.message}`);
        return;
      }
      throw error;
    },
    getMessageFallback({ key, locale }) {
      return `[${locale}-MISSING:${key}]`;
    },
  };
});
```

---

### Q35 — `TypeError: Cannot read property 'split' of undefined` dans LocaleSwitcher

**Symptôme** : crash quand l'user click le switcher.

**Cause** : `usePathname()` retourne `null` dans certains contextes SSR.

**Fix** :

```tsx
const pathname = usePathname();

function switchLocale(newLocale: string) {
  if (!pathname) return;  // ← guard
  const segments = pathname.split('/');
  // ...
}
```

---

## Annexe — Diagnostic rapide

### Checklist 5 min pour identifier un bug i18n

1. **Quelle locale ?** `fr`, `ar`, `en` ?
2. **Quel symptôme ?** 404, 500, layout cassé, string manquante ?
3. **Reproductible ?** En local oui/non, sur prod oui/non
4. **Browser ?** Chrome, Safari, Firefox
5. **Cookie `NEXT_LOCALE` ?** Présent et valeur
6. **`<html lang>` et `dir` ?** Inspecter devtools
7. **Sentry tag locale ?** Filtrer dans Sentry
8. **Last deploy ?** Vercel deployment ID

### Commandes diagnostic rapides

```bash
# Status site par locale
for locale in fr ar en; do
  echo "=== /$locale/ ==="
  curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" "https://femiglow.ma/$locale/"
done

# Vérifier <html lang> et dir
curl -s https://femiglow.ma/ar/contact | grep -E '<html'

# Vérifier hreflang
curl -s https://femiglow.ma/fr/contact | grep -E 'hreflang'

# Vérifier sitemap
curl -s https://femiglow.ma/sitemap.xml | head -50

# Logs Vercel temps réel
vercel logs https://femiglow.ma --follow

# Sentry CLI events récents
sentry-cli releases list
```

---

## Si rien ne marche

### Escalation

1. **Niveau 1** : ce document `troubleshooting.md`
2. **Niveau 2** : [`execution-pas-a-pas.md`](./execution-pas-a-pas.md) § Erreurs courantes
3. **Niveau 3** : Slack #team-femiglow @lead
4. **Niveau 4** : Issue GitHub avec label `i18n` + `urgent` + reproduction steps
5. **Niveau 5** : Rollback selon [`../08-plan-action/rollback.md`](../08-plan-action/rollback.md)

### Avant de paniquer

90% des problèmes i18n viennent de :

1. Cache navigateur (essayer navigation privée)
2. Cookie `NEXT_LOCALE` (clear cookies)
3. Env var Vercel pas appliquée (redeploy)
4. Type augmentation manquante (rebuild TS)
5. Translation key oubliée dans une locale

Vérifier ces 5 points avant d'investigation profonde.

---

## Liens utiles

- [`execution-pas-a-pas.md`](./execution-pas-a-pas.md) — Erreurs courantes par phase
- [`deploiement.md`](./deploiement.md) — Procédure deploy + rollback express
- [`operations-quotidiennes.md`](./operations-quotidiennes.md) — Monitoring routine
- [`../08-plan-action/rollback.md`](../08-plan-action/rollback.md) — Procédures rollback détaillées
- [`../08-plan-action/feature-flags.md`](../08-plan-action/feature-flags.md) — Flags i18n

---

**Auteur** : Claude — 27 mai 2026
**Version** : 1.0
**À enrichir** : à chaque nouvelle erreur rencontrée, ajouter une Q/A.
