# Date, currency, number formatting

> `useFormatter()` next-intl + APIs natives `Intl.*`. Comment afficher prix, dates, durées relatives, pourcentages dans les 3 locales FemiGlow sans bug ni divergence.

## 1. Vue d'ensemble — APIs disponibles

| Besoin | API recommandée | Côté |
|---|---|---|
| Date courte / longue | `useFormatter().dateTime` ou `Intl.DateTimeFormat` | RSC + Client |
| Nombre simple | `useFormatter().number` ou `Intl.NumberFormat` | RSC + Client |
| Devise (MAD, EUR, USD) | `useFormatter().number` style currency | RSC + Client |
| Pourcentage | `useFormatter().number` style percent | RSC + Client |
| Date relative ("il y a 2 jours") | `useFormatter().relativeTime` ou `Intl.RelativeTimeFormat` | RSC + Client |
| Liste ("FR, AR et EN") | `Intl.ListFormat` natif | RSC + Client |
| Range ("de 10 à 20") | `Intl.NumberFormat#formatRange` (Node 18+) | RSC + Client |
| Unités physiques | `Intl.NumberFormat` style unit | RSC + Client |

`useFormatter` est un wrapper next-intl qui :
- Récupère automatiquement la locale courante
- Permet de définir des presets dans `i18n.ts` (réutilisables)
- Sert RSC (`getFormatter`) + Client (`useFormatter`)

## 2. Configuration globale `next-intl`

### 2.1 Presets dans `src/i18n.ts`

```ts
// src/i18n.ts
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALES } from '@/lib/i18n/config';

export default getRequestConfig(async ({ locale }) => {
  if (!LOCALES.includes(locale as never)) {
    locale = DEFAULT_LOCALE;
  }
  return {
    messages: (await import(`@/messages/${locale}.json`)).default,
    timeZone: 'Africa/Casablanca',
    now: new Date(),
    formats: {
      dateTime: {
        short: {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        },
        long: {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        },
        timeOnly: {
          hour: '2-digit',
          minute: '2-digit',
        },
      },
      number: {
        priceMAD: {
          style: 'currency',
          currency: 'MAD',
          maximumFractionDigits: 2,
        },
        priceEUR: {
          style: 'currency',
          currency: 'EUR',
          maximumFractionDigits: 2,
        },
        priceUSD: {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2,
        },
        percent: {
          style: 'percent',
          maximumFractionDigits: 0,
        },
      },
    },
  };
});
```

Avantages :
- Tous les composants utilisent les mêmes formats (cohérence visuelle)
- Changement de preset = 1 endroit
- Type-safe : `format.dateTime(date, 'short')` au lieu de répéter les options

### 2.2 Utilisation des presets

```tsx
'use client';
import { useFormatter } from 'next-intl';

export function KitCard({ price, releasedAt }: { price: number; releasedAt: Date }) {
  const format = useFormatter();
  return (
    <article>
      <p>{format.dateTime(releasedAt, 'long')}</p>
      <p>{format.number(price, 'priceMAD')}</p>
    </article>
  );
}
```

Render FR : "27 mai 2026" / "199,00 MAD"
Render AR : "27 مايو 2026" / "199,00 د.م."
Render EN : "May 27, 2026" / "MAD 199.00"

### 2.3 Côté RSC : `getFormatter`

```tsx
import { getFormatter } from 'next-intl/server';

export async function KitPrice({ price }: { price: number }) {
  const format = await getFormatter();
  return <span>{format.number(price, 'priceMAD')}</span>;
}
```

## 3. Format des dates

### 3.1 Formats par locale

| Format preset | FR | AR | EN |
|---|---|---|---|
| `short` | 27 mai 2026 | 27 مايو 2026 | May 27, 2026 |
| `long` | 27 mai 2026 | 27 مايو 2026 | May 27, 2026 |
| `timeOnly` | 14:30 | 14:30 | 2:30 PM |
| Avec weekday | mardi 27 mai 2026 | الثلاثاء 27 مايو 2026 | Tuesday, May 27, 2026 |

### 3.2 Date courte (journal, blog)

```tsx
<time dateTime={article.publishedAt.toISOString()}>
  {format.dateTime(article.publishedAt, { day: '2-digit', month: 'long', year: 'numeric' })}
</time>
```

→ Attribut `dateTime` machine-readable (ISO 8601), texte lisible localisé.

### 3.3 Numerals arabes (٠١٢٣٤٥٦٧٨٩)

Par défaut, `Intl.DateTimeFormat('ar')` renvoie des chiffres latins (1, 2, 3) car c'est l'usage courant au Maroc/Maghreb.

Pour forcer les chiffres arabes orientaux (٠١٢٣) :

```ts
new Intl.DateTimeFormat('ar', { numberingSystem: 'arab', day: 'numeric', month: 'long', year: 'numeric' })
  .format(new Date('2026-05-27'));
// → "٢٧ مايو ٢٠٢٦"
```

**Décision FemiGlow V1** : on garde les chiffres latins (`numberingSystem: 'latn'`) car ils sont plus lisibles au Maroc et plus universels pour les prix. La logique est dans le preset :

```ts
ar: { numberingSystem: 'latn' } // par défaut
```

Si plus tard on cible Arabie Saoudite/EAU, on switcher à `'arab'`.

### 3.4 Timezone Casablanca

`timeZone: 'Africa/Casablanca'` est forcé dans `i18n.ts` (cf. §2.1).

Conséquence :
- Toute date affichée est en heure marocaine (UTC+1 ou +0 selon DST)
- Les dates serveur en UTC sont converties automatiquement
- Cohérence entre RSC et Client

```ts
const utcDate = new Date('2026-05-27T22:00:00Z');
format.dateTime(utcDate, 'short');
// FR (Casablanca UTC+1) : "27 mai 2026 23:00"
```

## 4. Format des nombres

### 4.1 Séparateurs par locale

| Format | FR | AR | EN |
|---|---|---|---|
| Millier | 1 234 567 | 1٬234٬567 | 1,234,567 |
| Décimal | 199,00 | 199٫00 | 199.00 |

`Intl.NumberFormat` gère ça automatiquement selon la locale.

### 4.2 Nombre simple

```ts
const format = useFormatter();
format.number(1234567);
// FR : "1 234 567"
// AR : "1٬234٬567"
// EN : "1,234,567"
```

### 4.3 Pourcentage

```ts
format.number(0.15, 'percent');
// FR : "15 %"
// AR : "15%"
// EN : "15%"
```

(Note espace avant `%` en FR, pas en AR/EN.)

### 4.4 Unités physiques

```ts
format.number(2.5, { style: 'unit', unit: 'kilogram' });
// FR : "2,5 kg"
// EN : "2.5 kg"
```

Use case FemiGlow : pas d'unités physiques en V1 (cosmétique au flacon), mais utile pour le journal blog ("voyage de 1 200 km").

## 5. Format des devises

### 5.1 MAD, EUR, USD

```ts
format.number(199, 'priceMAD');
// FR : "199,00 MAD"
// AR : "199,00 د.م."
// EN : "MAD 199.00"

format.number(19.90, 'priceEUR');
// FR : "19,90 €"
// AR : "19,90 €"
// EN : "€19.90"

format.number(20, 'priceUSD');
// FR : "20,00 $US"
// AR : "20,00 US$"
// EN : "$20.00"
```

### 5.2 Symbol-only vs code

Par défaut, `currency` affiche selon les conventions locales.

Pour forcer le code (3 lettres) :
```ts
format.number(199, { style: 'currency', currency: 'MAD', currencyDisplay: 'code' });
// "MAD 199.00" partout
```

Pour symbol seul :
```ts
format.number(199, { style: 'currency', currency: 'MAD', currencyDisplay: 'symbol' });
// "199,00 MAD" en FR, "199,00 د.م." en AR
```

Pour nom complet :
```ts
format.number(199, { style: 'currency', currency: 'MAD', currencyDisplay: 'name' });
// "199,00 dirhams marocains" en FR
```

### 5.3 Cas FemiGlow concret : prix du kit

```tsx
// src/components/marketing/KitPriceTag.tsx
import { useFormatter } from 'next-intl';

interface KitPriceTagProps {
  priceMAD: number;          // 199
  priceEUR?: number;         // 19.90 (optionnel, V2)
  comparePrice?: number;     // 249 (prix barré)
}

export function KitPriceTag({ priceMAD, priceEUR, comparePrice }: KitPriceTagProps) {
  const format = useFormatter();
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-semibold">
        {format.number(priceMAD, 'priceMAD')}
      </span>
      {comparePrice && (
        <span className="text-sm text-muted-foreground line-through">
          {format.number(comparePrice, 'priceMAD')}
        </span>
      )}
      {priceEUR !== undefined && (
        <span className="text-xs text-muted-foreground">
          ≈ {format.number(priceEUR, 'priceEUR')}
        </span>
      )}
    </div>
  );
}
```

Render FR :
```
199,00 MAD  249,00 MAD  ≈ 19,90 €
              (barré)
```

Render AR (RTL) :
```
≈ 19,90 €  249,00 د.م.  199,00 د.م.
            (barré)
```

### 5.4 Calculs côté serveur, formatage côté client

Bonne pratique : stocker en DB un nombre brut (e.g. 19900 en centimes), formater au moment de l'affichage.

```ts
// DB : price_cents = 19900
// Composant
const priceMAD = product.price_cents / 100;
<span>{format.number(priceMAD, 'priceMAD')}</span>
```

Évite les arrondis et les bugs de fractions.

## 6. Format dates relatives

### 6.1 `formatRelativeTime`

```ts
format.relativeTime(new Date(Date.now() - 86_400_000));
// FR : "il y a 1 jour"
// AR : "قبل يوم واحد"
// EN : "1 day ago"

format.relativeTime(new Date(Date.now() + 3_600_000));
// FR : "dans 1 heure"
// AR : "خلال ساعة واحدة"
// EN : "in 1 hour"
```

### 6.2 Avec `now` figé pour stabilité

Si on veut éviter les re-renders dus à `new Date()` qui change à chaque tick :

```ts
format.relativeTime(article.publishedAt, fixedNow);
```

`useNow` next-intl renvoie un `Date` stable (sync RSC/Client) :

```tsx
'use client';
import { useFormatter, useNow } from 'next-intl';

export function PublishedLabel({ date }: { date: Date }) {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60 * 1000 }); // refresh chaque minute
  return <time dateTime={date.toISOString()}>{format.relativeTime(date, now)}</time>;
}
```

### 6.3 Unités contrôlées

Par défaut, next-intl choisit l'unité (`now - 30 min` → "il y a 30 minutes").

Pour forcer une unité :
```ts
format.relativeTime({ value: -2, unit: 'day' });
// "il y a 2 jours"
```

### 6.4 Cas FemiGlow : "Publié il y a..."

```tsx
// src/components/journal/ArticleMeta.tsx
'use client';
import { useFormatter, useNow, useLocale } from 'next-intl';

export function ArticleMeta({ publishedAt }: { publishedAt: Date }) {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const diffMs = now.getTime() - publishedAt.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  return (
    <time dateTime={publishedAt.toISOString()} className="text-sm text-muted-foreground">
      {diffDays < 7
        ? format.relativeTime(publishedAt, now)
        : format.dateTime(publishedAt, 'long')}
    </time>
  );
}
```

→ < 7 jours : "il y a 2 jours". ≥ 7 jours : "27 mai 2026".

## 7. ETA livraison

### 7.1 Période "2–4 jours ouvrés"

```tsx
import { useTranslations, useFormatter } from 'next-intl';

export function ShippingEta({ minDays, maxDays }: { minDays: number; maxDays: number }) {
  const t = useTranslations('shipping');
  // L'ICU plural gère l'accord min/max
  return <p>{t('eta_range', { min: minDays, max: maxDays })}</p>;
}
```

Messages :
```json
{
  "fr": { "shipping.eta_range": "Livraison sous {min}–{max} {max, plural, one {jour ouvré} other {jours ouvrés}}" },
  "ar": { "shipping.eta_range": "التوصيل خلال {min}–{max} {max, plural, one {يوم عمل} other {أيام عمل}}" },
  "en": { "shipping.eta_range": "Delivery in {min}–{max} business days" }
}
```

### 7.2 Date arrivée probable

```tsx
function EtaArrival({ daysFromNow }: { daysFromNow: number }) {
  const format = useFormatter();
  const arrivalDate = new Date();
  arrivalDate.setDate(arrivalDate.getDate() + daysFromNow);
  return <span>Arrivée probable : {format.dateTime(arrivalDate, 'long')}</span>;
}
```

## 8. Cas combinés FemiGlow

### 8.1 Récap commande (wizard checkout)

(Ce composant utilise `WizardDictionary`, mais le formatage de date/devise s'appuie sur `Intl` natif puisque pas dans le namespace next-intl.)

```tsx
// src/components/checkout/OrderRecap.tsx
'use client';
import { useWizardTranslation } from '@/lib/checkout/i18n/use-wizard-translation';

export function OrderRecap({ orderTotal, deliveryDate }: { orderTotal: number; deliveryDate: Date }) {
  const { dictionary, locale } = useWizardTranslation();
  const priceFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'MAD',
  });
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'Africa/Casablanca',
  });
  return (
    <dl>
      <dt>{dictionary.recap.total_label}</dt>
      <dd>{priceFormatter.format(orderTotal)}</dd>
      <dt>{dictionary.recap.delivery_label}</dt>
      <dd>{dateFormatter.format(deliveryDate)}</dd>
    </dl>
  );
}
```

→ Cohabitation `WizardDictionary` (strings) + `Intl.*` natif (formatage). Pas de conflit.

### 8.2 Hero kit avec date saisonnière

```tsx
// src/components/marketing/kit-layout/KitHeroDate.tsx
import { getFormatter, getTranslations } from 'next-intl/server';

export async function KitHeroDate({ seasonEnd }: { seasonEnd: Date }) {
  const t = await getTranslations('marketing.kit.hero');
  const format = await getFormatter();
  return (
    <p>
      {t('season_offer', { date: format.dateTime(seasonEnd, 'long') })}
    </p>
  );
}
```

Messages :
```json
{
  "fr": { "marketing.kit.hero.season_offer": "Offre rituel saisonnier jusqu'au {date}" }
}
```

Render FR : "Offre rituel saisonnier jusqu'au 30 juin 2026"

### 8.3 Journal article avec date + reading time

```tsx
'use client';
import { useFormatter, useTranslations } from 'next-intl';

export function ArticleHeader({ title, publishedAt, readingMinutes }: {
  title: string;
  publishedAt: Date;
  readingMinutes: number;
}) {
  const t = useTranslations('marketing.journal');
  const format = useFormatter();
  return (
    <header>
      <h1>{title}</h1>
      <p className="text-sm text-muted-foreground">
        {format.dateTime(publishedAt, 'long')} · {t('reading_time', { minutes: readingMinutes })}
      </p>
    </header>
  );
}
```

Messages :
```json
{
  "fr": { "marketing.journal.reading_time": "{minutes, plural, one {# minute de lecture} other {# minutes de lecture}}" }
}
```

## 9. Format de listes — `Intl.ListFormat`

Pour "FR, AR et EN" / "FR, AR و EN" / "FR, AR, and EN" :

```ts
const lf = new Intl.ListFormat('fr', { style: 'long', type: 'conjunction' });
lf.format(['FR', 'AR', 'EN']); // "FR, AR et EN"

const lfAr = new Intl.ListFormat('ar', { style: 'long', type: 'conjunction' });
lfAr.format(['FR', 'AR', 'EN']); // "FR، AR، وEN"
```

Cas FemiGlow : indication "Paiement par CMI, COD et virement" dans le wizard.

```tsx
const lf = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
const methods = [t('payment.cmi'), t('payment.cod'), t('payment.transfer')];
<p>{lf.format(methods)}</p>
```

## 10. Anti-patterns

### 10.1 Concat de chiffres et de strings

```tsx
// MAUVAIS
<span>{price} MAD</span>
// FR : "199 MAD" (manque séparateur décimal et accord)
```

**Bon** : `format.number(price, 'priceMAD')`.

### 10.2 `toLocaleString` direct au lieu du formatter centralisé

```tsx
// MAUVAIS (incohérent : peut diverger entre composants)
new Date().toLocaleString('fr');
```

**Bon** : `format.dateTime(date, 'long')` (utilise le preset défini une fois).

### 10.3 Dates timezone naïves

```ts
// MAUVAIS
const date = new Date('2026-05-27 14:00'); // timezone locale du client
```

**Bon** : ISO 8601 + timezone Casablanca dans le formatter.

```ts
const date = new Date('2026-05-27T14:00:00+01:00');
format.dateTime(date, 'long'); // utilise timeZone: 'Africa/Casablanca'
```

### 10.4 Hardcoder le séparateur

```tsx
// MAUVAIS
<span>1{count > 999 && ' '}234</span>
```

**Bon** : `format.number(1234)`.

### 10.5 Prix avec virgule manuelle

```tsx
// MAUVAIS
<span>{`${price.toFixed(2)} MAD`.replace('.', ',')}</span>
// → casse en EN où le point est correct
```

**Bon** : `format.number(price, 'priceMAD')`.

### 10.6 Devise EUR pour visiteur marocain

Logique business à clarifier :
- Si le store FemiGlow ne facture qu'en MAD, on affiche en MAD partout (et optionnellement une équivalence EUR informative)
- Si on a multi-devise (V2), `format.number(price, 'priceEUR')` selon locale ou préférence user

Pas de règle frontend universelle ; suivre la spec produit.

## 11. Tests recommandés

### 11.1 Vitest unit — par locale

```ts
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';
import messagesAr from '@/messages/ar.json';
import messagesEn from '@/messages/en.json';
import { KitPriceTag } from '../KitPriceTag';

function renderWith(locale: 'fr' | 'ar' | 'en', price: number) {
  const messages = { fr: messagesFr, ar: messagesAr, en: messagesEn }[locale];
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Africa/Casablanca"
      formats={{
        number: {
          priceMAD: { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 },
        },
      }}
    >
      <KitPriceTag priceMAD={price} />
    </NextIntlClientProvider>,
  );
}

describe('KitPriceTag', () => {
  it('FR shows "199,00 MAD"', () => {
    renderWith('fr', 199);
    expect(screen.getByText(/199,00\s*MAD/)).toBeVisible();
  });
  it('EN shows "MAD 199.00"', () => {
    renderWith('en', 199);
    expect(screen.getByText(/MAD\s*199\.00/)).toBeVisible();
  });
  it('AR shows MAD currency symbol', () => {
    renderWith('ar', 199);
    expect(screen.getByText(/199,00/)).toBeVisible();
  });
});
```

### 11.2 Vitest unit — dates

```ts
describe('ArticleMeta date format', () => {
  const date = new Date('2026-05-27T12:00:00Z');

  it('FR renders "27 mai 2026"', () => {
    renderWith('fr', <ArticleMeta publishedAt={date} />);
    expect(screen.getByRole('time')).toHaveTextContent(/27 mai 2026/);
  });
  it('EN renders "May 27, 2026"', () => {
    renderWith('en', <ArticleMeta publishedAt={date} />);
    expect(screen.getByRole('time')).toHaveTextContent(/May 27, 2026/);
  });
  it('time element has ISO dateTime attribute', () => {
    renderWith('fr', <ArticleMeta publishedAt={date} />);
    expect(screen.getByRole('time')).toHaveAttribute('dateTime', '2026-05-27T12:00:00.000Z');
  });
});
```

### 11.3 Playwright — visuel multilingue

```ts
test('KitPriceTag visual per locale', async ({ page }) => {
  for (const locale of ['fr', 'ar', 'en'] as const) {
    await page.goto(`/${locale}/kit`);
    const priceEl = page.getByTestId('kit-price');
    await expect(priceEl).toBeVisible();
    await priceEl.screenshot({ path: `e2e/screens/price-${locale}.png` });
  }
});
```

### 11.4 Tests timezone

```ts
it('formats dates in Africa/Casablanca timezone', () => {
  const utc = new Date('2026-05-27T22:00:00Z'); // 23:00 Casablanca
  renderWith('fr', <ArticleMeta publishedAt={utc} />);
  // Should show 27 mai (not 28 mai) and 23:00 time
  expect(screen.getByRole('time')).toHaveTextContent(/27 mai/);
});
```

## 12. Performance

### 12.1 `Intl.*` est natif et rapide

Pas besoin de polyfills, Node 18+ et browsers modernes incluent ICU complet (~5MB côté Node, déjà bundlé).

### 12.2 Memoize les formatters si appelés en boucle

```tsx
// Dans une liste de 100 prix, ne pas créer 100 instances
'use client';
import { useMemo } from 'react';
import { useLocale } from 'next-intl';

export function PriceList({ prices }: { prices: number[] }) {
  const locale = useLocale();
  const formatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'MAD' }),
    [locale],
  );
  return (
    <ul>
      {prices.map((p, i) => <li key={i}>{formatter.format(p)}</li>)}
    </ul>
  );
}
```

`useFormatter` next-intl le fait déjà sous le capot — mais avec `Intl.NumberFormat` direct, memoize-le.

### 12.3 Pas de re-render pour timezone

`Intl.DateTimeFormat` avec `timeZone` est aussi rapide qu'sans. Pas d'impact perf.

## 13. Checklist formatage

- [ ] Tous les prix passent par `format.number(price, 'priceMAD')` ou preset équivalent
- [ ] Toutes les dates passent par `format.dateTime(date, 'short'|'long')` (pas `toLocaleString`)
- [ ] Dates UTC en DB, conversion timezone via `i18n.ts` preset
- [ ] `timeZone: 'Africa/Casablanca'` configuré globalement
- [ ] `numberingSystem: 'latn'` pour AR (V1 — chiffres latins)
- [ ] Pas de concat manuelle (`${price} MAD`)
- [ ] Pas de `toFixed(2).replace('.', ',')` (hack séparateur)
- [ ] Composants liste utilisent `useMemo` pour formatter
- [ ] Element `<time>` avec attribut `dateTime` ISO
- [ ] Tests Vitest : 3 locales × 3 valeurs typiques
- [ ] Tests Playwright : screenshot prix + date par locale
- [ ] Pas de divergence : presets centralisés dans `i18n.ts`
- [ ] Wizard checkout : `Intl.*` natif (cohabitation `WizardDictionary` OK)
