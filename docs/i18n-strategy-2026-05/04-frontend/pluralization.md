# Pluralization — ICU MessageFormat

> Comment gérer les pluriels en français, anglais et **arabe (6 formes !)** sans casser. ICU MessageFormat est l'outil natif `next-intl`, on l'utilise systématiquement.

## 1. Pourquoi un système formel

### 1.1 Le piège du français

```
0 article  → "0 article" (singulier en FR)
1 article  → "1 article"
2 articles → "2 articles"
```

En FR, la règle est : 0 et 1 = singulier, ≥ 2 = pluriel. Mais pas en anglais (0 = plural), ni en arabe (6 formes différentes).

### 1.2 Le piège de l'arabe

Le CLDR (Common Locale Data Repository) reconnaît 6 catégories pour l'arabe :

| Forme | Quand | Exemple |
|---|---|---|
| `zero` | n = 0 | 0 = صفر مقالات |
| `one` | n = 1 | 1 = مقال واحد |
| `two` | n = 2 | 2 = مقالان |
| `few` | n mod 100 ∈ [3, 10] | 3–10 = 3 مقالات |
| `many` | n mod 100 ∈ [11, 99] | 11+ = 11 مقالة |
| `other` | autres (souvent 100+) | 100 = 100 مقال |

Soit **6 phrases différentes pour traduire "X articles"**. Aucun if/else manuel ne tient. Il faut un système.

### 1.3 ICU MessageFormat

ICU = standard CLDR Unicode. Pattern :

```
{var, plural,
  =0 {message si exactement 0}
  =1 {message si exactement 1}
  one {forme one CLDR}
  two {forme two CLDR}
  few {forme few CLDR}
  many {forme many CLDR}
  other {forme par défaut}
}
```

Les keywords `one|two|few|many|other` correspondent aux catégories CLDR par locale. `=N` est un override exact (priorité sur le keyword).

## 2. Intégration `next-intl`

### 2.1 Côté messages JSON

```json
{
  "marketing": {
    "cart": {
      "items_count": "{count, plural, =0 {Panier vide} =1 {1 article} other {# articles}}"
    }
  }
}
```

### 2.2 Côté composant

```tsx
import { useTranslations } from 'next-intl';

function CartBadge({ count }: { count: number }) {
  const t = useTranslations('marketing.cart');
  return <span>{t('items_count', { count })}</span>;
}
```

Render :

| count | FR | EN | AR |
|---|---|---|---|
| 0 | Panier vide | 0 items | السلة فارغة |
| 1 | 1 article | 1 item | 1 مقال |
| 2 | 2 articles | 2 items | مقالان |
| 5 | 5 articles | 5 items | 5 مقالات |
| 12 | 12 articles | 12 items | 12 مقالة |

### 2.3 Pattern `#` pour insérer le nombre

Dans ICU, `#` est remplacé par la valeur numérique passée :

```
"{count, plural, one {# article} other {# articles}}"
```

Si `count = 5`, render = "5 articles". `#` est formatté selon la locale (voir `date-currency-formatting.md` §3 pour la numérotation arabe).

## 3. Exemples par locale

### 3.1 Français (catégories CLDR : one, other)

```json
{
  "fr": {
    "cart": {
      "items_count": "{count, plural, =0 {Panier vide} one {# article} other {# articles}}"
    }
  }
}
```

| count | Render |
|---|---|
| 0 | Panier vide |
| 1 | 1 article |
| 2 | 2 articles |
| 12 | 12 articles |

Note : en FR moderne, 0 et 1 vont au singulier, ≥ 2 au pluriel. CLDR `one` couvre 0 et 1 en FR. Pour distinguer, utiliser `=0`.

### 3.2 Anglais (catégories : one, other)

```json
{
  "en": {
    "cart": {
      "items_count": "{count, plural, =0 {Cart is empty} one {# item} other {# items}}"
    }
  }
}
```

| count | Render |
|---|---|
| 0 | Cart is empty |
| 1 | 1 item |
| 2 | 2 items |
| 12 | 12 items |

### 3.3 Arabe (catégories : zero, one, two, few, many, other)

```json
{
  "ar": {
    "cart": {
      "items_count": "{count, plural, zero {السلة فارغة} one {مقال واحد} two {مقالان} few {# مقالات} many {# مقالة} other {# مقال}}"
    }
  }
}
```

| count | Catégorie | Render |
|---|---|---|
| 0 | zero | السلة فارغة |
| 1 | one | مقال واحد |
| 2 | two | مقالان |
| 5 | few | 5 مقالات |
| 12 | many | 12 مقالة |
| 100 | other | 100 مقال |

**Important** : si une forme manque (ex: traducteur a oublié `two`), ICU fallback sur `other`. C'est gracieux mais peut introduire du faux pluriel — donc à valider dans les tests.

### 3.4 Comparaison tableau complet — "X jours restants"

| count | FR | EN | AR |
|---|---|---|---|
| 0 | Aucun jour restant | No days remaining | لم تبق أيام |
| 1 | 1 jour restant | 1 day remaining | يوم واحد متبقي |
| 2 | 2 jours restants | 2 days remaining | يومان متبقيان |
| 3 | 3 jours restants | 3 days remaining | 3 أيام متبقية |
| 11 | 11 jours restants | 11 days remaining | 11 يوماً متبقياً |
| 100 | 100 jours restants | 100 days remaining | 100 يوم متبقي |

## 4. Cas FemiGlow concrets

### 4.1 Compteur panier (Header)

```tsx
'use client';
import { useTranslations } from 'next-intl';
import { useCartStore } from '@/lib/cart/store';

export function CartBadge() {
  const t = useTranslations('marketing.cart');
  const count = useCartStore((s) => s.itemsCount);
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={t('items_count', { count })}
    >
      {count > 0 ? count : ''}
    </span>
  );
}
```

Messages :
```json
{
  "marketing.cart.items_count": "{count, plural, =0 {Panier vide} one {# article dans le panier} other {# articles dans le panier}}"
}
```

### 4.2 Nombre d'articles journal

```tsx
import { getTranslations } from 'next-intl/server';

export async function JournalCount({ count }: { count: number }) {
  const t = await getTranslations('marketing.journal');
  return <p className="text-muted-foreground">{t('articles_count', { count })}</p>;
}
```

Messages :
```json
{
  "fr": { "marketing.journal.articles_count": "{count, plural, =0 {Aucun article publié} one {1 article publié} other {# articles publiés}}" },
  "ar": { "marketing.journal.articles_count": "{count, plural, zero {لا مقالات منشورة} one {مقال منشور} two {مقالان منشوران} few {# مقالات منشورة} many {# مقالة منشورة} other {# مقال منشور}}" },
  "en": { "marketing.journal.articles_count": "{count, plural, =0 {No articles published} one {1 article published} other {# articles published}}" }
}
```

### 4.3 Délai de livraison (combiné plural + nested)

Pour "Livraison sous 2–4 jours ouvrés", on peut nester :

```json
{
  "fr": { "shipping.eta": "Livraison sous {min}–{max} {max, plural, one {jour ouvré} other {jours ouvrés}}" }
}
```

Render :
- `{ min: 2, max: 4 }` → "Livraison sous 2–4 jours ouvrés"
- `{ min: 1, max: 1 }` → "Livraison sous 1–1 jour ouvré"

### 4.4 Notification stock faible

```json
{
  "fr": { "kit.stock_low": "Plus que {count, plural, =0 {aucun kit} one {1 kit} other {# kits}} en stock." }
}
```

```tsx
const t = useTranslations('kit');
<p>{t('stock_low', { count: stockCount })}</p>
```

### 4.5 Reviews count

```json
{
  "fr": { "kit.reviews_count": "{count, plural, =0 {Aucun avis} one {1 avis} other {# avis}}" },
  "ar": { "kit.reviews_count": "{count, plural, zero {لا توجد تقييمات} one {تقييم واحد} two {تقييمان} few {# تقييمات} many {# تقييماً} other {# تقييم}}" },
  "en": { "kit.reviews_count": "{count, plural, =0 {No reviews} one {1 review} other {# reviews}}" }
}
```

## 5. Pluralization avancée — ordinal et select

### 5.1 Ordinal (1er, 2ème, 3ème…)

ICU supporte aussi les ordinaux :

```json
{
  "fr": { "wizard.step_label": "Étape {position, selectordinal, one {#er} other {#e}}" }
}
```

Render :
- `position = 1` → "Étape 1er"
- `position = 2` → "Étape 2e"
- `position = 3` → "Étape 3e"

Pour l'anglais :
```json
{
  "en": { "wizard.step_label": "Step {position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}" }
}
```

Render :
- 1 → "Step 1st"
- 2 → "Step 2nd"
- 3 → "Step 3rd"
- 4 → "Step 4th"

L'arabe a sa propre logique (peu d'ordinaux en usage moderne, souvent omis).

### 5.2 Select (genre, type)

Pour switcher selon une valeur non-numérique (genre, plan, statut) :

```json
{
  "fr": { "user.welcome": "{gender, select, female {Bienvenue Madame {name}} male {Bienvenue Monsieur {name}} other {Bienvenue {name}}}" }
}
```

```tsx
t('user.welcome', { gender: 'female', name: 'Karima' });
// → "Bienvenue Madame Karima"
```

Use case FemiGlow : politesse genre dans les emails transactionnels.

### 5.3 Combinaison select + plural

```json
{
  "fr": { "cart.user_items": "{gender, select, female {Madame} male {Monsieur} other {Cher.e client.e}}, vous avez {count, plural, one {# article} other {# articles}} en attente." }
}
```

```tsx
t('cart.user_items', { gender: 'female', count: 3 });
// → "Madame, vous avez 3 articles en attente."
```

À utiliser parcimonieusement (lisibilité du JSON pour traducteurs).

## 6. API `Intl.PluralRules` native

Pour les cas où on a besoin de la catégorie sans message :

```ts
const pr = new Intl.PluralRules('ar');
pr.select(0);   // 'zero'
pr.select(1);   // 'one'
pr.select(2);   // 'two'
pr.select(5);   // 'few'
pr.select(12);  // 'many'
pr.select(100); // 'other'
```

Utile pour brancher des composants conditionnels :

```tsx
const pr = useMemo(() => new Intl.PluralRules(locale), [locale]);
const category = pr.select(count);

return (
  <>
    <span>{count}</span>
    {category === 'zero' && <span className="text-gray-500">·</span>}
    {category === 'one' && <span className="text-yellow-500">·</span>}
    {category !== 'zero' && category !== 'one' && <span className="text-green-500">·</span>}
  </>
);
```

> Le plus souvent, ICU `plural` suffit. `Intl.PluralRules` natif sert pour les cas où on a besoin de logique conditionnelle au-delà du texte (icônes, styles).

## 7. Fallback graceful

### 7.1 Si une forme manque dans la traduction

```json
{
  "ar": { "cart.items_count": "{count, plural, one {مقال واحد} other {# مقال}}" }
}
```

(Le traducteur a oublié zero/two/few/many.)

Render :
- count = 0 → tombe sur `other` → "0 مقال" (gracieux mais imparfait)
- count = 2 → tombe sur `other` → "2 مقال" (devrait être "مقالان")

→ Pas de crash, mais texte incorrect. Tests doivent couvrir les 6 formes en AR.

### 7.2 Si la clé entière manque

```tsx
t('cart.items_count', { count: 5 });
// FR : "5 articles"
// AR : ??? si messages/ar.json ne contient pas la clé
```

next-intl fallback :
- Affiche la **clé brute** (`cart.items_count`) en dev (warning console)
- Affiche **vide** ou clé brute en prod

Pour fallback sur FR :

```ts
// src/i18n.ts
export default getRequestConfig(async ({ locale }) => ({
  messages: {
    ...(await import(`@/messages/fr.json`)).default, // fallback
    ...(await import(`@/messages/${locale}.json`)).default, // overlay
  },
}));
```

→ AR/EN héritent de FR pour les clés manquantes, jamais de page vide.

### 7.3 Tests de coverage par forme

```ts
import { describe, it, expect } from 'vitest';
import { format } from 'date-fns'; // unused, exemple
import { createIntl } from 'next-intl/_internal';
import arMessages from '@/messages/ar.json';

describe('AR plural coverage', () => {
  it('covers all 6 forms for cart.items_count', () => {
    const intl = createIntl({ locale: 'ar', messages: arMessages });
    expect(intl.formatMessage('marketing.cart.items_count', { count: 0 })).not.toMatch(/cart\.items_count/);
    expect(intl.formatMessage('marketing.cart.items_count', { count: 1 })).not.toMatch(/cart\.items_count/);
    expect(intl.formatMessage('marketing.cart.items_count', { count: 2 })).not.toMatch(/cart\.items_count/);
    expect(intl.formatMessage('marketing.cart.items_count', { count: 5 })).not.toMatch(/cart\.items_count/);
    expect(intl.formatMessage('marketing.cart.items_count', { count: 12 })).not.toMatch(/cart\.items_count/);
    expect(intl.formatMessage('marketing.cart.items_count', { count: 100 })).not.toMatch(/cart\.items_count/);
  });
});
```

(Variante simplifiée : pour chaque count représentatif, vérifier que la sortie n'est pas la clé brute.)

## 8. Validation linter ICU

### 8.1 Outil

`@formatjs/cli` linte les messages ICU et détecte syntaxe invalide :

```bash
npx formatjs lint apps/web/messages/*.json
```

Détecte :
- Pluriels mal formatés (manque accolade, keyword inconnu)
- Variables non déclarées
- Inégalités structurelles entre locales (ex: FR a 5 placeholders, AR n'en a que 3)

### 8.2 Integration CI

```yaml
# .github/workflows/i18n.yml
- name: Lint ICU
  run: npx formatjs lint apps/web/messages/*.json
```

Bloque le PR si syntaxe ICU cassée.

### 8.3 Validation des formes par locale

```ts
// scripts/i18n/validate-plurals.ts
import messagesAr from '@/messages/ar.json';

const REQUIRED_AR_FORMS: Array<'zero' | 'one' | 'two' | 'few' | 'many' | 'other'> = [
  'zero', 'one', 'two', 'few', 'many', 'other',
];

function flatPlural(obj: unknown, path: string[] = []): Array<{ key: string; value: string }> {
  const result: Array<{ key: string; value: string }> = [];
  if (typeof obj === 'string' && obj.includes(', plural,')) {
    result.push({ key: path.join('.'), value: obj });
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [k, v] of Object.entries(obj)) {
      result.push(...flatPlural(v, [...path, k]));
    }
  }
  return result;
}

const plurals = flatPlural(messagesAr);
for (const { key, value } of plurals) {
  const missing = REQUIRED_AR_FORMS.filter((form) => !new RegExp(`${form}\\s*{`).test(value));
  if (missing.length > 0) {
    console.warn(`[ar] ${key} missing forms: ${missing.join(', ')}`);
  }
}
```

→ Lance ce script en pre-commit pour catch les oublis traducteur.

## 9. Anti-patterns

### 9.1 Anti-pattern : concat strings

```tsx
// MAUVAIS
<span>{count} {count > 1 ? 'articles' : 'article'}</span>
```

→ Marche en FR/EN mais casse en AR (logique différente).

**Bon** : ICU plural.

```tsx
<span>{t('cart.items_count', { count })}</span>
```

### 9.2 Anti-pattern : if/else dans le composant

```tsx
// MAUVAIS
function Cart({ count }) {
  let text;
  if (count === 0) text = t('cart.empty');
  else if (count === 1) text = t('cart.one');
  else text = t('cart.many', { count });
  return <span>{text}</span>;
}
```

→ Verbeux, ne supporte pas zero/two/few/many AR.

**Bon** : ICU plural dans une seule clé.

### 9.3 Anti-pattern : pluriels dans variables séparées

```json
{
  "MAUVAIS": {
    "cart_singular": "1 article",
    "cart_plural": "{count} articles"
  }
}
```

**Bon** : une seule clé ICU.

```json
{
  "cart.items_count": "{count, plural, one {# article} other {# articles}}"
}
```

### 9.4 Anti-pattern : oublier `=0`

```json
{ "fr": { "cart.count": "{count, plural, one {1 article} other {# articles}}" } }
```

→ count = 0 render "0 articles". Acceptable mais "Panier vide" est plus UX-friendly.

**Bon** : ajouter `=0`.

```json
{ "fr": { "cart.count": "{count, plural, =0 {Panier vide} one {1 article} other {# articles}}" } }
```

### 9.5 Anti-pattern : variable count mal passée

```tsx
// MAUVAIS — passes un string au lieu d'un number
t('cart.count', { count: '5' });
// ICU peut ne pas matcher correctement
```

**Bon** : type number.

```tsx
t('cart.count', { count: 5 });
// ou parse explicite
t('cart.count', { count: Number(input) });
```

## 10. Tests recommandés

### 10.1 Vitest unit — couvrir les 3 locales × 6 valeurs

```ts
// pluralization.test.tsx
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';
import messagesAr from '@/messages/ar.json';
import messagesEn from '@/messages/en.json';
import { CartBadge } from '@/components/cart/CartBadge';

function renderWith(locale: 'fr' | 'ar' | 'en', count: number) {
  const messages = { fr: messagesFr, ar: messagesAr, en: messagesEn }[locale];
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CartBadge initialCount={count} />
    </NextIntlClientProvider>,
  );
}

describe('CartBadge plural', () => {
  describe.each(['fr', 'ar', 'en'] as const)('locale %s', (locale) => {
    it.each([0, 1, 2, 5, 12, 100])('renders for count %i without leaking key', (count) => {
      renderWith(locale, count);
      const status = screen.getByRole('status');
      expect(status.textContent).not.toMatch(/cart\.items_count/);
      expect(status.textContent).not.toBe('');
    });
  });
});
```

### 10.2 Tests sémantiques par locale

```ts
describe('FR cart plural semantics', () => {
  it('shows "Panier vide" for 0', () => {
    renderWith('fr', 0);
    expect(screen.getByRole('status')).toHaveAccessibleName('Panier vide');
  });
  it('shows "1 article" for 1', () => {
    renderWith('fr', 1);
    expect(screen.getByRole('status')).toHaveAccessibleName(/1 article/);
  });
  it('shows "5 articles" for 5', () => {
    renderWith('fr', 5);
    expect(screen.getByRole('status')).toHaveAccessibleName(/5 articles/);
  });
});

describe('AR cart plural semantics', () => {
  it('uses "two" form for count=2', () => {
    renderWith('ar', 2);
    expect(screen.getByRole('status')).toHaveAccessibleName(/مقالان/);
  });
  it('uses "few" form for count=5', () => {
    renderWith('ar', 5);
    expect(screen.getByRole('status')).toHaveAccessibleName(/5 مقالات/);
  });
});
```

### 10.3 Playwright — visuel

```ts
test('AR cart badge renders 6 plural forms correctly', async ({ page }) => {
  await page.goto('/ar/');
  // Inject mock cart counts via testid hooks
  for (const count of [0, 1, 2, 5, 12, 100]) {
    await page.evaluate((c) => window.__setMockCartCount?.(c), count);
    await expect(page.getByTestId('cart-badge')).not.toContainText('items_count');
    await page.screenshot({ path: `e2e/screens/ar-cart-${count}.png` });
  }
});
```

## 11. Documentation pour traducteur (extrait)

À mettre dans le brief Crowdin :

> **Pluriels en arabe** : 6 formes possibles (zero, one, two, few, many, other). Merci de remplir toutes les formes quand le source FR utilise `{count, plural, …}`. Si vous n'êtes pas sûr de la forme exacte, utiliser `other` et marquer `[VERIFY]` en commentaire.
>
> Exemples :
> - 0 → zero : "السلة فارغة" / "لا توجد مقالات"
> - 1 → one : "مقال واحد"
> - 2 → two : "مقالان"
> - 3 à 10 → few : "3 مقالات"
> - 11 à 99 → many : "11 مقالة"
> - 100+ → other : "100 مقال"

## 12. Checklist pluralization

- [ ] Toute string avec un compteur utilise `{count, plural, ...}` (jamais if/else)
- [ ] FR : `=0` + `one` + `other` (minimum 3 formes)
- [ ] EN : `=0` + `one` + `other` (minimum 3 formes)
- [ ] AR : `zero` + `one` + `two` + `few` + `many` + `other` (6 formes)
- [ ] Variable `count` typée `number` (pas `string`)
- [ ] `#` utilisé dans les formes ≥ one pour insérer le nombre
- [ ] Tests Vitest : 3 locales × 6 valeurs de count
- [ ] Tests sémantiques AR (vérifier two, few, many)
- [ ] Lint ICU CI : `npx formatjs lint`
- [ ] Validation script : `pnpm i18n:validate-plurals`
- [ ] Brief traducteur inclut explication 6 formes AR
- [ ] Fallback : si forme manque, chain sur `other` (gracieux)
- [ ] Aucune string render = clé brute en prod (warning Sentry)
