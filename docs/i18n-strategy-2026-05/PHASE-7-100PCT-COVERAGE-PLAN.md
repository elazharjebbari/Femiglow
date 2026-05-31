# Phase 7 — Plan d'action 100 % de couverture i18n FemiGlow

> Objectif : zéro caractère FR sur `/ar/*`, zéro caractère arabe sur `/fr/*`, switcher visible partout, seed AR/EN exécuté. Aucun regression sur les routes legacy.

> Référence audit : `docs/i18n-strategy-2026-05/PHASE-7-AUDIT.md`.

---

## Cadre opérationnel

- **Priorité** : P0 = bloquant pour la promesse i18n V1 ; P1 = visible UX ; P2 = chrome.
- **Découpage** : 1 commit par phase. Build + tests vitest doivent passer entre chaque commit.
- **Charte FemiGlow non négociable** : sauge / crème / encre / pétale, Pinyon wordmark only, Cormorant Garamond titres, Inter UI, AUCUN emoji, pas de `!` marketing.
- **TypeScript strict** : `Locale` partout, jamais `string` libre. `isLocale()` validation à l'entrée des pages.
- **Performance** : SSG préservé (`generateStaticParams` côté `[locale]`), pas de SSR runtime ajouté.
- **Sécurité** : pas de mutation middleware, pas de mutation root layout, pas de `dangerouslySetInnerHTML` ajouté.

---

## Phase 7A — Quick wins UX visibility (P0)

### 7A.1 — Rendre `Header` + `Footer` sur `/{locale}/*`

Fichier : `apps/web/src/app/[locale]/layout.tsx`.

Action : importer `Header` et `Footer`, les monter autour de `{children}`. Cela fait apparaître le switcher (qui est déjà dans le Header lignes 99-102) sur toutes les routes localisées.

```tsx
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
// …
<NextIntlClientProvider …>
  <script … />
  <Header />
  <main id="main" tabIndex={-1}>{children}</main>
  <Footer />
</NextIntlClientProvider>
```

Risques :
- Le Header utilise `useChatStore` et `SommaireOverlay` (client). Comme `[locale]/layout.tsx` n'est PAS un client component, on importe un client component depuis un server component : pattern Next.js standard, OK.
- Le Header a un `<Link href="/">` qui pointe vers la home FR (legacy). On accepte temporairement pour ne pas casser ce qui marche. Phase 7C+ : `useLocale()` pour reconstruire.

### 7A.2 — Garantir un switcher dans le `Footer`

`Footer.tsx` peut accueillir un `<LocaleSwitcher variant="inline" />`. Si l'utilisateur scroll, il a un deuxième point d'entrée. **Différé Phase 7C** (pas P0).

### 7A.3 — Vérification dev console

Lancer `pnpm dev`, ouvrir `/fr/`, vérifier qu'aucune erreur React `Cannot read properties of null` n'apparaît côté Header/Footer en SSG.

---

## Phase 7B — Composants Bound locale-aware (P0)

### 7B.1 — Étendre la signature `HeroBound`

Fichier : `apps/web/src/components/sections/HeroBound.tsx`.

```tsx
import type { Locale } from '@/i18n.config';

interface HeroBoundProps {
  data: HeroData;
  priority?: boolean;
  componentKey: string;
  locale?: Locale; // ← nouveau, optionnel pour compat
}

export async function HeroBound({
  data,
  priority = true,
  componentKey,
  locale,
}: HeroBoundProps) {
  const [resolved, fields] = await Promise.all([
    resolveComponentSlot(componentKey, 'primary'),
    resolveComponentFields(componentKey, locale ?? 'fr'),
  ]);
  const merged = mergeHeroFields(data, fields, { locale });
  // …
}
```

### 7B.2 — Modifier `mergeHeroFields` pour ne pas écraser data en non-default locale

Fichier : `apps/web/src/components/sections/hero-fields.ts`.

Ajouter un paramètre `options?: { locale?: Locale; defaultLocale?: Locale }`. Comportement :
- Si `locale` absente OU égale à `defaultLocale` (= `'fr'`) → comportement actuel (accepte binding ET default).
- Sinon → accepte uniquement `source === 'binding'`. Cela protège l'AR/EN tant que le seed n'a pas inséré.

### 7B.3 — Étendre `HeroProduitBound` et `HeroMaisonBound`

Même pattern : prop `locale`, propagé à `resolveComponentFields`.

### 7B.4 — Étendre les Bound qui appellent uniquement `resolveComponentSlot`

Non urgent : les slots média sont les mêmes assets toutes locales (cf. ADR Component-Media). On ne propage `locale` que si on en a besoin pour les `alt` localisés. **Différé Phase 7E.**

### 7B.5 — Modifier les pages `[locale]/*` pour passer `locale`

- `apps/web/src/app/[locale]/page.tsx` → `<HeroBound data={…} componentKey="home-hero" locale={locale} />`
- `apps/web/src/app/[locale]/maison/page.tsx` → `<HeroMaisonBound … locale={locale} />`
- `apps/web/src/app/[locale]/kit/page.tsx` → `<HeroProduitBound … locale={locale} />`
- `apps/web/src/app/[locale]/rituel/page.tsx` → `<HeroLifestyleBound … locale={locale} />` (à voir, dépend des fields CMS)

---

## Phase 7C — Composants enfants hardcodés (P1)

### 7C.1 — `ContactHero` → `useTranslations`

Fichier : `apps/web/src/components/sections/ContactHero.tsx`. Devient client minimal ou conserve server avec `getTranslations`. Préférence : **server component** avec `getTranslations({ locale, namespace: 'marketing.contact.hero' })` pour préserver SSG.

```tsx
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n.config';

interface ContactHeroProps {
  email: string;
  locale: Locale;
}

export async function ContactHero({ email, locale }: ContactHeroProps) {
  const t = await getTranslations({ locale, namespace: 'marketing.contact.hero' });
  return (
    <section …>
      <Kicker>{t('kicker')}</Kicker>
      <Heading as="h1" size="display-md">{t('title')}</Heading>
      <Text size="lead" tone="secondary">{t('subtitle')}</Text>
      <Text>…<a href={`mailto:${email}`}>{email}</a></Text>
    </section>
  );
}
```

Page consommatrice `[locale]/contact/page.tsx` : `<ContactHero email={CONTACT_EMAIL} locale={locale} />`. La route legacy `(marketing)/contact/page.tsx` reste avec l'ancienne signature **sans rupture** car on garde le default props.

Stratégie compat : remplacer le composant existant mais le rendre **dual mode** :
- si `locale` non fourni → fallback FR hardcodé (legacy)
- si `locale` fourni → `getTranslations`

Cette approche évite de toucher `(marketing)/contact/page.tsx`.

### 7C.2 — `JournalHero`

Identique. `marketing.journal.hero.{title, description}` existe déjà dans les 3 locales.

### 7C.3 — `Manifeste`

**Action zéro** : Manifeste est data-driven (`data.kicker/title/paragraphs`). Le mock AR (`homepage.ar.ts:59-65`) fournit déjà le bon contenu. La page `[locale]/page.tsx` passe `content.manifeste` → tout va bien. **Documenter dans la PR : pas de changement.**

### 7C.4 — `NewsletterBlock`

Default props FR (`kicker = 'Lettre de la maison'`, etc.). Ajouter prop `locale` optionnel et fallback `getTranslations('marketing.newsletter.block')`. Clés AR/EN à ajouter dans `messages/*.json` si manquantes.

### 7C.5 — `DirectContactBlock`

Idem : passer `locale`, utiliser `marketing.contact.direct.kicker_write/kicker_atelier/response_time/appointment_only` (déjà présents AR + EN).

### 7C.6 — `FAQAccordion` (titre seulement)

Le composant reçoit `items` en prop, donc data-driven pour Q/R. SEUL le `Kicker` + `Heading` au-dessus sont hardcodés (« Foire aux questions », « Réponses rapides. »). Ajouter `locale?` et utiliser `marketing.contact.faq.kicker/title`.

### 7C.7 — Composants à inspecter

- `EngagementsGrid.tsx` « Les six engagements » → `marketing.maison.engagements.kicker`
- `EditorialLetter.tsx` « Un mot de notre fondatrice » → `marketing.rituel.letter.kicker`
- `PreparationGesture.tsx` « Préparation au geste » → `marketing.rituel.preparation.kicker`

Tous différés Phase 7E (P2) sauf si vu en preview live.

---

## Phase 7D — Seed bindings AR/EN (P0)

### 7D.1 — Fix `parseArgs` ignore `--`

Fichier : `apps/web/scripts/seed-i18n-bindings.ts:60`.

```ts
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--') continue; // séparateur pnpm/npm
  switch (a) { … }
}
```

### 7D.2 — Dry-run de validation

```bash
cd apps/web && pnpm seed:i18n-bindings:dry
```

Attendu : exit 0, rapport JSON dans `.seed-reports/`, totaux > 0 inserted simulés pour AR + EN.

### 7D.3 — Apply réel

```bash
cd apps/web && pnpm seed:i18n-bindings
```

Le seed écrit en `memoryStore` en absence de DB (déterministe via `db/client.ts`). Si DB Postgres présente, il insère en `component_field_bindings` status `draft`.

### 7D.4 — Vérification SQL (si DB)

```sql
SELECT locale, status, COUNT(*) FROM component_field_bindings
WHERE locale IN ('ar', 'en')
GROUP BY locale, status
ORDER BY locale, status;
```

### 7D.5 — Documenter dans le runbook

Mettre à jour `docs/i18n-strategy-2026-05/PHASE-6-SEED-RUNBOOK.md` avec la trace du run réel + compteurs.

---

## Phase 7E — Tests intensifs renforcés (P1, prochain tour)

### 7E.1 — Test e2e `full-translation.spec.ts`

```ts
const ROUTES = ['/', '/contact', '/maison', '/journal', '/kit', '/rituel'];
const LOCALES = ['fr', 'ar', 'en'] as const;

for (const locale of LOCALES) {
  for (const route of ROUTES) {
    test(`[${locale}] ${route} → 0 char hors-locale`, async ({ page }) => {
      await page.goto(`/${locale}${route}`);
      const body = await page.locator('main').textContent();
      if (locale === 'ar') {
        // brand allowlist : FemiGlow, Paste, Powder, Polish & Shine, Step 4
        const sanitized = body.replace(/FemiGlow|Paste|Powder|Polish & Shine|Step 4|Cairo|Cormorant|Inter/g, '');
        expect(sanitized).not.toMatch(/[a-zA-Z]{4,}/); // pas 4+ chars latins consécutifs
      } else {
        expect(body).not.toMatch(/[؀-ۿ]/); // pas d'arabe
      }
    });
  }
}
```

### 7E.2 — Tests visuels (regression baseline par locale)

`apps/web/e2e/visual/` (déjà existe). Ajouter screenshots `home-{fr,ar,en}.png`, `contact-{fr,ar,en}.png`. Comparer via Playwright `toMatchSnapshot`.

### 7E.3 — Tests unitaires

- `mergeHeroFields.test.ts` : table avec couples `(locale, sources, expected)`.
- `HeroBound.test.tsx` : mock `resolveComponentFields` pour vérifier signature locale.

---

## Phase 7F — Couverture continue (P2, hors sprint)

### 7F.1 — Script CI audit

```bash
node scripts/check-hardcoded-jsx-strings.mjs --root apps/web/src/components/sections
```

Sortie : liste des strings JSX > 15 chars dans des composants Server → suggestion clé i18n.

### 7F.2 — Linter custom

ESLint rule `no-hardcoded-strings-in-jsx` (utiliser `eslint-plugin-i18n-text` ou écrire un plugin minimal).

### 7F.3 — Documentation onboarding

`docs/i18n-strategy-2026-05/12-onboarding-devs.md` :
- Pattern « tout composant éditorial accepte `locale` ou utilise `useTranslations` »
- Cookbook : « comment ajouter une nouvelle string traduite »
- Convention de naming des clés i18n

---

## Risques & contournements

| Risque | Mitigation |
|---|---|
| `useChatStore` provoque crash SSR sur `[locale]/*` | Header est déjà client component (`'use client'`) — pas de risque. |
| Switcher dans Header n'est pas hydraté si chat ouvert (data-chat-open=true) | Acceptable : UX décide. |
| `HeroBound` signature break tests existants | `locale?: Locale` est optionnel — back-compat 100 %. |
| `mergeHeroFields` signature break call sites | Idem : `options?` optionnel. |
| Seed AR/EN insère partout sauf orphans | C'est le comportement attendu — `orphans` non bloquant. |
| Footer rendu sur `/{locale}/*` peut afficher liens cassés `/journal` au lieu de `/fr/journal` | Vérifier en preview. Si bug, propager `locale` à `Footer` (Phase 7C). |

---

## Critères d'acceptation Phase 7 (mêmes que A8 audit)

1. Preview live `/fr/`, `/ar/`, `/en/`, `/fr/contact`, `/ar/contact`, `/en/contact` : 0 char hors-locale (sauf brand allowlist).
2. Switcher visible et fonctionnel sur toutes ces routes.
3. `pnpm seed:i18n-bindings:dry` exit 0.
4. `pnpm seed:i18n-bindings` exit 0 (apply réel).
5. `pnpm build` exit 0.
6. `pnpm test` pas de régression.

---

## Plan d'exécution ce tour (commits prévus)

1. **Commit 1** — Phase 7A : `feat(i18n): Phase 7A — LocaleSwitcher visible via Header dans /[locale]/*`
2. **Commit 2** — Phase 7B : `feat(i18n): Phase 7B — HeroBound + mergeHeroFields locale-aware (préserve mocks AR/EN)`
3. **Commit 3** — Phase 7C : `feat(i18n): Phase 7C — ContactHero, JournalHero, FAQAccordion, DirectContactBlock i18n-aware`
4. **Commit 4** — Phase 7D : `fix(i18n): Phase 7D — seed-i18n-bindings ignore -- + run apply AR/EN`
5. **Commit 5** — Docs : `docs(i18n): Phase 7 — audit + plan 100% coverage`

Selon avancement, possibilité d'un commit unique « Phase 7 (A+B+C partiel+D) ».
