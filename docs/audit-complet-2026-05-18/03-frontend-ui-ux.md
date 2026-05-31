# 03 — Frontend, UI, UX & Design

> **Vue d'ensemble** : 627 fichiers `.tsx`, design system maison cohérent (palette marocaine : crème, encre, sauge, pétale, ciel, champagne), a11y avancée (combobox WAI-ARIA, Lighthouse exigé à 1.0), Consent Mode v2 Google. Trois faiblesses : composants "godzilla" (4 fichiers > 600 LOC), `prefers-reduced-motion` non systématique sur Framer Motion, validation client `LeadFormBubble` minimale.

---

## 1. Stack UI

| Domaine | Choix | Notes |
|---|---|---|
| CSS | Tailwind 3.4.13 + PostCSS + Autoprefixer | tokens CSS custom (`--color-*`, `--font-*`, `--space-*`) consommés via `theme.extend` |
| Animations | Framer Motion 11.11 | usage modéré, surtout sections éditoriales |
| Forms | React Hook Form 7.53 + Zod 3.23 | systématique côté public, partiel côté chat |
| State | Zustand 5.0 | scopé (chat-store, cart-store, tracking) |
| Data viz | Recharts 2.13 | uniquement admin |
| Command palette | cmdk 1.1 | admin |
| Primitives | maison `/components/ui/` (13 fichiers) | pas de shadcn/Radix |
| Fonts | next/font/local | Cormorant Garamond (display), Inter (body), Pinyon Script (decorative) |

---

## 2. Design system & tokens

### 2.1 Palette (sémantique marocaine)

Définie dans `src/styles/tokens.css` puis projetée dans `tailwind.config.ts` :

| Token | Hex | Usage |
|---|---|---|
| `creme` | #FBF8F1 | surface, fond chaleureux |
| `encre` | #2C2A28 | texte primaire |
| `sauge` (+ dark) | accent vert salvia | success |
| `petale` (+ dark) | rose poudre | erreur |
| `ciel` (+ dark) | bleu lavé | info |
| `champagne` (+ dark) | doré tamisé | warning |

✅ Choix esthétique cohérent avec la cible (cosmétique féminin haut de gamme Maroc).
✅ Sémantique success/error/info/warning mappée sur la palette → pas de rouge/vert "système".

### 2.2 Typographie fluide

```
display-2xl: clamp(64px, 9vw, 128px)
display-xl:  clamp(48px, 7vw, 96px)
lead:        clamp(18px, 1.6vw, 22px)
```
→ Responsive sans `@media`, élégant. Pas de duplication sm/md/lg dans le HTML.

### 2.3 Échelles temporelles & easing

`--duration-{instant, fast, base, slow, cinematic}` (100 ms → 800 ms), `--ease-out-soft`, `--ease-in-out-silk`, `--ease-in-quiet` (cubic-bezier maison).
→ Vocabulaire d'animation explicite, qui évite l'arbitraire des `0.3s ease-in-out` partout.

### 2.4 Z-index nommés

`--z-chat-overlay: 250`, `--z-modal: 300`, `--z-toast: 400`.
→ Hiérarchie pensée et documentée — fin du conflit `z-index: 9999` !

### 2.5 Globals — corrections fines

`src/styles/globals.css` contient des corrections subtiles que la plupart des projets oublient :

```css
input:not([type=button]):not([type=submit]):not(...) {
  font-size: max(16px, 1rem); /* iOS Safari : empêche le zoom-on-focus */
}
:focus-visible {
  outline: var(--focus-outline-width) solid var(--focus-outline-color);
  outline-offset: var(--focus-outline-offset);
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
[data-chat-scope] input { font-size: 16px !important; } /* contourne text-sm Tailwind */
```

✅ Niveau d'attention design exceptionnel.

---

## 3. Architecture des composants

### 3.1 Volumétrie

| Dossier | Fichiers `.tsx` | Rôle |
|---|---|---|
| `components/admin/` | 317 | back-office (settings, tracking, products, SEO, emails, components) |
| `components/sections/` | 123 | sections éditoriales (Hero, Manifeste, GestesGrid, AvisStrip, JournalExtraits, ...) |
| `components/commerce/` | 50 | panier, checkout |
| `components/chat/` | 17 | chat widget, LeadFormBubble, chat-store |
| `components/checkout/` | 13 | wizard form steps + CityAutocomplete |
| `components/ui/` | 13 | primitives maison (Button, Text, Heading, Field, Stack, Container, ...) |
| `components/tracking/` | 13 | GTM, Snap, Consent, PixelLoader |
| `components/forms/` | 8 | ContactForm, NewsletterForm |
| `components/layout/` | 8 | Header, Footer, Navigation, SkipLink |
| `components/legal/`, `patterns/`, `a11y/`, `icons/` | 14 | |

### 3.2 Primitives `/components/ui/`

Excellente discipline. Exemple `Button.tsx` :
```tsx
export function Button({ variant = 'primary', size = 'base', disabled, loading, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        disabled && 'opacity-50 cursor-not-allowed',
        loading && 'pointer-events-none',
      )}
      disabled={disabled || loading}
      {...props}
    />
  );
}
```
✅ Variants Tailwind + helper `cn()`, pas de styles inline. C'est *la* bonne approche.

### 3.3 Composants "godzilla"

Top 15 par taille :

| Composant | Lignes | Catégorie |
|---|---|---|
| **DeliveryCitiesEditor** | 1117 | admin |
| **RitualsWizard** | 1017 | public |
| TrackingHelpPanel | 805 | admin |
| InsightsView | 736 | admin |
| VariantsEditor | 672 | admin |
| RitualsImportClient | 647 | admin |
| LegalEditor | 645 | admin |
| SeoOverrideEditor | 641 | admin |
| SeedRunnerForm | 636 | admin |
| **CheckoutFlow** | **625** | **public — critique** |
| FormConfigEditor | 608 | admin |
| CampaignWizard | 570 | admin |
| SeedersRunner | 557 | admin |
| **CityAutocomplete** | **498** | **public (a11y excellente)** |
| **LeadFormBubble** | **451** | **public — chat** |

🔴 **CheckoutFlow (625 LOC)** : 14 `useState`, handlers métier + JSX mélangés, appels API wizardClient + tracking + validation dans le même corps de fonction.
🔴 **RitualsWizard (1017 LOC)** : navigation steps + upload photo avec détection visage + sélection tags + draft autosave + form RHF. Le plus urgent à découper.
🟠 **DeliveryCitiesEditor (1117 LOC)** : admin → moins critique côté UX prod mais lourd à maintenir.
🟢 **CityAutocomplete (498 LOC)** : grosse mais justifiée — pattern WAI-ARIA combobox complet (cf. §5.1). Ne pas la "casser" sous prétexte de taille.

---

## 4. Pages clés

### 4.1 Home (`app/(marketing)/page.tsx`)

```tsx
export default async function HomePage() {
  const [content, journalArticles] = await Promise.all([
    cms.getHomepageContent(),
    cms.getArticles({ limit: 3, featured: true }),
  ]);
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={websiteSchema()} />
      <ScrollMilestonesTracker contentId="home" contentType="page" />
      <HeroBound data={content.hero} priority componentKey="home-hero" />
      <Fleuron />
      <GestesGrid etapes={content.gestes} />
      <Fleuron />
      <Manifeste data={content.manifeste} />
      <AvisStripBound testimonials={content.avis} componentKey="home-avis-strip" />
      <JournalExtraitsBound articles={journalArticles} />
      <NewsletterBlock />
    </>
  );
}
```

✅ Composition de sections éditoriales, Promise.all sur le data fetch, JSON-LD `Organization` + `Website`, tracking scroll-milestones, ISR `revalidate = 3600`.

### 4.2 Checkout wizard (`commerce/CheckoutFlow.tsx`)

Wizard 3 steps — Infos → Adresse → Paiement.
- Steps individuels existent (`InfoStep`, `AddressStep`, `PaymentStep`).
- Mais 14 `useState` + handlers `handleNextStep` / `handlePrevStep` / `handleSubmit` (40 lignes chacun) restent dans `CheckoutFlow`.
- Tracking (`emit('begin_checkout')`) intégré aux bons endroits.
- Draft restore + autosave via `useWatch` + setTimeout.

🟠 **À refactoriser** : extraire `useCheckoutState()` + `useCheckoutHandlers()` en hooks séparés, sortir le rendu de la modale "leave guard" et de `OrderSummary`.

### 4.3 CityAutocomplete — pépite WAI-ARIA

`src/components/checkout/wizard/components/CityAutocomplete.tsx` (498 LOC).

```tsx
<input
  role="combobox"
  aria-autocomplete="list"
  aria-expanded={showListbox}
  aria-controls={listboxId}
  aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
  aria-invalid={hasError ? 'true' : undefined}
  dir="auto"
  onKeyDown={handleKeyDown}  /* ↑↓ Home End Enter Esc Tab */
/>
<ul role="listbox" id={listboxId} aria-label={label}>
  {items.map((city, index) => (
    <li role="option" aria-selected={index === activeIndex}>
      <div>{city.nameFr}</div>
      {city.nameAr && <div dir="rtl">{city.nameAr}</div>}
    </li>
  ))}
</ul>
```

✅ Pattern WAI-ARIA "Editable Combobox with List Autocomplete" complet.
✅ Bilingue FR/AR avec `dir="auto"` + `dir="rtl"` ciblé.
✅ Debounce 200 ms via hook `useDeliveryCities`.
✅ Focus reste sur l'input, sélection visuelle pilotée par `aria-activedescendant`.

**À garder en référence interne** comme exemple de "comment faire un combobox bien".

### 4.4 Chat — `ChatPanel` + `LeadFormBubble`

Architecture :
```
ChatLauncher → ChatPanel (full-screen mobile / bubble desktop)
→ useChatSession() → GET /api/chat/session
→ ChatComposer + MessageList
→ useChatSend() → POST /api/chat/message (SSE)
→ LeadFormBubble (capture phone/name) → POST /api/chat/lead/contact
→ Zustand chat-store (partial localStorage)
```

**LeadFormBubble (451 LOC)** :
- Honeypot `_phone_alt` ✅
- Préfillage localStorage (90 j) ✅
- RTL via `language === 'ar'` ✅
- Consent version sauvegardée (`CONSENT_VERSION = '2026-05-06'`) ✅
- Tracking view / focus / submit / dismiss ✅
- 🟠 Validation client minimale (longueur phone seulement) — dépend trop du serveur ; en cas de réseau lent, l'utilisateur peut soumettre un payload invalide qui rebondira en 422.

---

## 5. Tracking client

### 5.1 Consent banner (`ConsentBanner.tsx`)

- Default `denied` (RGPD-first).
- Feature flag DB (`isChatEnabled`, `getTrackingSetting`).
- Persiste localStorage + cookie + emet `fg:consent-changed`.
- `dialog role="dialog" aria-labelledby="consent-title"`.

### 5.2 PixelLoader

Charge dynamiquement les pixels tier-3 (Snap, GTM custom) si consent donné.
- `requestIdleCallback` (`whenIdle`).
- `Set<string>` pour dédupliquer les injections.
- Unsubscribe `fg:consent-changed` au cleanup.

### 5.3 GtmHeadScript

Consent Mode v2 Google :
```ts
gtag('consent', 'default', {
  'analytics_storage': defaultGranted ? 'granted' : 'denied',
  'ad_storage': defaultGranted ? 'granted' : 'denied',
  'ad_user_data': defaultGranted ? 'granted' : 'denied',
});
```
Chargé `strategy="beforeInteractive"` AVANT le container GTM → conforme spec Google 2024.

### 5.4 Snap Pixel events

`SnapPixelEvents.tsx` — événements client-side via PixelLoader + dedup CAPI server-side. Corrigé récemment (commits `163fb5e`, `497a1c7`, `b110129`, `7595103`, `2ce33f0` : alignement spec v3, race condition pixel ID, default `capi_only`).

---

## 6. Accessibilité (a11y)

### 6.1 Lighthouse CI

`.lighthouserc.json` exige `accessibility: minScore 1.0` (pas de compromis) sur 5 URLs (`/`, `/rituel`, `/journal`, `/contact`, `/admin/login`).

### 6.2 Patterns présents

| Pattern | Localisation |
|---|---|
| `SkipLink` (navigate to `#main`) | `components/layout/SkipLink.tsx` |
| `MobileFocusGuard` (iOS zoom fix) | `components/a11y/MobileFocusGuard.tsx` |
| `:focus-visible` global | `tokens.css` |
| Sémantique HTML (`<button>`, `<nav>`, `<main>`, `<footer>`) | global |
| `<label for>` systématique | `components/ui/Field.tsx` |
| ARIA combobox + listbox | `CityAutocomplete.tsx` |
| `role="dialog"` + `aria-labelledby` | ConsentBanner, modales |
| `aria-invalid`, `aria-describedby` | formulaires |
| `prefers-reduced-motion` CSS | `tokens.css` |
| Tests axe-core + Playwright | `e2e/legal-a11y.spec.ts` |
| `jest-axe` | dans dépendances |

### 6.3 Faiblesses a11y

| Sujet | Constat |
|---|---|
| `prefers-reduced-motion` Framer Motion | non systématique — CSS global OK, mais Framer Motion ignore la préférence si pas de check explicite `useReducedMotion()` |
| Dark mode | absent (zéro `prefers-color-scheme: dark`) |
| `aria-live` annonces étapes wizard | `[announcement]` state présent mais rarement peuplé |
| Contraste `--color-text-secondary` (rgba 0.70) | à valider WCAG AA selon combos |

---

## 7. Performance front

### 7.1 Images

`next.config.mjs` :
- `formats: ['image/avif', 'image/webp']`
- `deviceSizes [360, 480, 720, 960, 1280, 1600, 1920]`
- `minimumCacheTTL: 30 jours`
- `remotePatterns` whitelist stricte
- ⚠️ `dangerouslyAllowSVG: true` (mitigé par CSP sandbox)

### 7.2 Fonts

`next/font/local`, `display: 'swap'`, fichiers `.woff2` locaux → 0 requête réseau.

### 7.3 CSS

- Pas de `optimizeCss` (critters), incompatible App Router streaming.
- `admin-fields.css` chargé uniquement par `/admin/layout.tsx` (gain ~25 KB sur le bundle public).

### 7.4 Cache headers

```
/_next/static/*       → max-age=31536000, immutable
/_next/image/*        → max-age=86400, stale-while-revalidate=604800
```
✅ Optimal.

### 7.5 LCP

- `priority` prop sur `HeroBound`.
- Fonts en local + `display: swap`.
- 🟡 Pas de `<link rel="preload" as="image">` explicite pour l'image hero.
- 🟡 Checkout wizard sans skeleton de chargement.

### 7.6 Bundle splitting

- Peu de `dynamic()` côté public (2 refs trouvées). À ajouter sur les composants admin lourds (cmdk command palette, RichTextEditor, ...).
- RSC par défaut → bonnes pratiques respectées.

---

## 8. i18n & multilangue

**État réel** : monolingue français, support arabe partiel.

| Surface | FR | AR |
|---|---|---|
| HTML `lang="fr"` | ✅ | — |
| `alternates: { languages: { 'fr-MA': '/' } }` | ✅ | ❌ pas de `ar-MA` |
| Sections éditoriales | ✅ | ❌ |
| Chat IA (LLM multilangue) | ✅ | ✅ partiel (LLM-aware) |
| LeadFormBubble (`isRtl`) | ✅ | ✅ |
| CityAutocomplete (`dir="auto"`) | ✅ | ✅ |
| Formulaires (ContactForm, NewsletterForm) | ✅ | ❌ |
| SEO meta | ✅ | ❌ |

→ Le chat peut conduire une conversation en AR mais l'utilisateur retombe sur une UI FR à la fin. Pour le marché marocain c'est tenable (FR = lingua franca commerciale), mais une vraie internationalisation `next-intl` ou `next-translate` est un chantier de Phase 3.

---

## 9. SEO

### 9.1 Metadata API
`generateMetadata` + resolver SEO en cascade (`lib/seo/resolve.ts`) :
1. `seo_overrides` table (publié seulement)
2. fallback prop hardcodé page
3. `seo_settings` (defaults DB)
4. defaults TS

Cache via `unstable_cache` + tag `seo:{scope}:{targetKey}`.

### 9.2 Sitemap

`app/sitemap.ts` — statiques + articles dynamiques + legal searchable, priorités sensibles (home 1.0, journal 0.8, legal 0.4).

### 9.3 Robots

```
disallow: /api/, /panier, /admin/
GPTBot, CCBot, ClaudeBot → disallow /
```
✅ Bloque les crawlers IA — choix éditorial respecté.

### 9.4 JSON-LD

Présent : `Organization`, `Website` sur la home.
Manquant : `Product` schema sur `/kit`, `Article` schema sur `/journal/[slug]`, `LocalBusiness` (Maroc).

---

## 10. Forces front

1. **Design system mature** : tokens CSS, sémantique de couleurs, typographie fluide, z-index nommés, easings nommés.
2. **A11y avancée** : `CityAutocomplete` est un exemple à enseigner. SkipLink, focus-visible, Lighthouse à 1.0 exigé.
3. **Consent privacy-first** : Consent Mode v2, default denied, propagation événementielle.
4. **Chat IA sophistiqué** : SSE streaming, RAG pgvector, lead capture, multi-provider.
5. **Tests exhaustifs** : Vitest + Playwright + axe-core, ≈ 572 fichiers de tests recensés.
6. **Cache headers optimaux** : immutable chunks 1 an, SWR images.
7. **CSS critique split** admin/public.
8. **Local fonts** (zéro réseau).

---

## 11. Faiblesses front

| # | Constat | Fichier(s) | Sévérité |
|---|---|---|---|
| F1 | `CheckoutFlow` 625 LOC, handlers + JSX + 14 `useState` mélangés | `components/commerce/CheckoutFlow.tsx` | 🔴 P0 |
| F2 | `RitualsWizard` 1017 LOC, 4 préoccupations dans un fichier | `components/sections/rituals/wizard/RitualsWizard.tsx` | 🔴 P0 |
| F3 | `LeadFormBubble` validation client minimale (pas de RHF + Zod) | `components/chat/LeadFormBubble.tsx` | 🟠 P1 |
| F4 | `prefers-reduced-motion` non systématique sur Framer Motion | `GeoPromoSlideHeader.tsx` + autres | 🟠 P1 |
| F5 | Dark mode absent | global | 🟡 P2 |
| F6 | `aria-live` annonces wizard rarement peuplées | `CheckoutFlow`, `RitualsWizard` | 🟡 P2 |
| F7 | JSON-LD incomplet (`Product`, `Article`, `LocalBusiness`) | `app/(commerce)/kit/`, `app/journal/[slug]/` | 🟡 P2 |
| F8 | `DeliveryCitiesEditor` 1117 LOC (admin) | `components/admin/settings/DeliveryCitiesEditor.tsx` | 🟡 P2 |
| F9 | Pas d'image `<link rel="preload">` pour hero | `HeroBound` | 🟡 P2 |
| F10 | Pas de dynamic import admin lourd (cmdk, RichTextEditor) | global admin | 🟡 P2 |
| F11 | i18n limitée à FR avec AR partiel | global | 🟢 P3 |
| F12 | `dangerouslyAllowSVG: true` | `next.config.mjs` | 🟡 P2 |

---

## 12. Recommandations concrètes

### P0
1. **Refactor `CheckoutFlow`** :
   - Extraire `useCheckoutState()` et `useCheckoutHandlers()`.
   - Sortir `OrderSummary`, `ProgressBar`, `LeaveModal` en composants.
   - Cible : `CheckoutFlow.tsx` < 250 LOC, chaque step < 200 LOC.
   - **Effort** : 1–2 jours, gains majeurs en testabilité.

2. **Refactor `RitualsWizard`** :
   - Extraire photo upload (`PhotoUploadStep`), face detection en hook.
   - Form state → store Zustand `useRitualsWizardStore`.
   - **Effort** : 2–3 jours.

### P1
3. **`LeadFormBubble` validation** :
   ```ts
   import { useForm } from 'react-hook-form';
   import { zodResolver } from '@hookform/resolvers/zod';
   const leadFormSchema = z.object({
     firstName: z.string().min(2, 'Min 2 caractères').max(50),
     phone: z.string().regex(/^[+\d\s-]{7,20}$/, 'Format invalide'),
     country: z.enum(['MA', 'FR', 'BE', 'CH', 'DZ', 'TN']),
     note: z.string().max(500).optional(),
   });
   const { register, handleSubmit, formState: { errors } } = useForm({
     resolver: zodResolver(leadFormSchema), mode: 'onBlur',
   });
   ```
   **Effort** : 2 h.

4. **`useReducedMotion` Framer Motion** :
   ```ts
   // lib/accessibility/useReducedMotionVariants.ts
   export function useReducedMotionVariants(normal, reduced) {
     const reduceMotion = useReducedMotion();
     return reduceMotion ? reduced : normal;
   }
   ```
   Appliquer dans `GeoPromoSlideHeader`, `HeroBound`, sections éditoriales animées.
   **Effort** : 3–4 h.

### P2
5. **Dark mode** :
   - `darkMode: 'class'` Tailwind, classes `dark:` sur surfaces.
   - Toggle dans header + persist localStorage + `data-theme` attribute.
   - **Effort** : 2–3 jours (audit visuel + recolorisation tokens).

6. **JSON-LD `Product` + `Article` + `LocalBusiness`** : ajouter aux pages concernées (`app/(commerce)/kit/page.tsx`, `app/journal/[slug]/page.tsx`).
   **Effort** : 4 h.

7. **Image preload hero** :
   ```tsx
   <link rel="preload" as="image" href={data.image.url}
         imageSrcSet={generateSrcSet(...)} imageSizes="100vw" />
   ```
   Via metadata `other` ou Head injection.
   **Effort** : 2 h.

8. **Dynamic admin lourds** : `next/dynamic(() => import('./RichTextEditor'), { ssr: false })`.
   **Effort** : 2–3 h.

### P3
9. **`next-intl` ou `next-translate`** pour vraie i18n FR/AR.
   **Effort** : 5–8 jours.

---

## 13. Scorecard frontend

| Critère | Score |
|---|---|
| Design system & tokens | 9 / 10 |
| Composition & modularité | 7 / 10 (godzilla) |
| A11y | 8,5 / 10 |
| Performance | 7,5 / 10 |
| Tracking client | 8,5 / 10 |
| SEO | 7 / 10 |
| Animations & motion design | 7,5 / 10 |
| i18n | 4 / 10 |
| Tests UI | 7,5 / 10 |
| **Global** | **7,9 / 10** |
