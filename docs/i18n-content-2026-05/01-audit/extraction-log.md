# Extraction log — Audit i18n FemiGlow

> Journal méthodologique de l'extraction des strings FR pour i18n.
> Date : 2026-05-27. Auditor : Claude (sandbox Anthropic).

## Méthode

### Phase 1 — Inventaire fichiers (find/ls)

```
find apps/web/src/app/(marketing) -type f -name "*.tsx" -o -name "*.ts" | grep -v test | grep -v __tests__ | sort
find apps/web/src/components/{marketing,sections,layout,forms,commerce,chat,legal,ui} -type f -name "*.{tsx,ts}" | filter
find apps/web/src/lib/{seo,mail/templates} -type f
ls apps/web/src/data/mock/
```

Total fichiers identifiés : ~85 (50 lus en profondeur, 35 listés sans lecture car composants
techniques sans strings affichables : Bound wrappers, ScrollProgress, Image, etc.).

### Phase 2 — Lecture systématique des fichiers à fort yield

Ordre de lecture (par densité estimée de strings) :

1. Mocks (`src/data/mock/{homepage,kit,maison,rituel,articles,product}.ts`)
2. Pages marketing (`src/app/(marketing)/**/*.tsx`)
3. Pages commerce (`src/app/(commerce)/**/*.tsx`, `src/app/commander/page.tsx`)
4. Pages erreurs (`src/app/{not-found,error}.tsx`)
5. Page légale statique (`src/app/(marketing)/mentions-legales/page.tsx`)
6. Page légale dynamique (`src/app/legal/[slug]/page.tsx`)
7. Composants layout (`Header`, `Footer`, `SommaireOverlay`, `CheckoutHeader`, `CommerceHeader`, `FooterMinimal`)
8. Composants sections (Hero, GestesGrid, Manifeste, AvisStrip, JournalHero, JournalGrid,
   CompositionReveal, ComparatifSection, FAQContextuelle, HandsTestimonials, IngredientsDetails,
   ProductFeedSection, KitCommanderSection, PivotBanner, PivotFinal, RitualsModule, TimelineSteps,
   StepCard, PriceBlock, EditorialLetter, PreparationGesture, OrderHero, CartHero, TrustSignals,
   JournalCrossLink, CrossLinkTriptyque, ContactCrossLinks, DirectContactBlock, EngagementsGrid,
   MatieresGrid, AtelierGallery, SciencesDuSoin, InterviewQR, ContactHero, NewsletterBlock)
9. Composants commerce (CartContents, CartSummary, MerciClient, MiniCartSlideOver, EmptyCartState,
   AddToCartButton, CommanderAnchorButton, StickyCartCTA, SocialProofBadge)
10. Composants forms (ContactForm, NewsletterForm, FormTypeSelector, SuccessState, ErrorState)
11. Composants legal (FooterLegalLinks, LegalContactBlock, LegalRelatedLinks, CheckoutConsentText,
    LegalPrintButton)
12. Composants chat (ChatLauncher, ChatHeader, ChatComposer, MessageList, MessageBubble,
    LeadFormBubble, lead-form-copy.ts)
13. Layouts kit (`KitPageLayoutV1`, `KitPageLayoutV2`)
14. SEO (`lib/seo/defaults.ts`, `lib/seo/known-pages.ts`)
15. Email templates (`order-confirmation`, `contact-acknowledgement`, `newsletter-confirm`,
    `password-reset`, `cart-abandoned`, `lead-notification`, `_shared/{Header,Footer,BaseLayout}`)
16. Email catalog (`lib/mail/catalog.ts` — sujets + preheaders)
17. Menu descriptions (`lib/menu-descriptions.ts`)
18. i18n existant (`lib/i18n/categories.ts`)

### Phase 3 — Extraction stricte

Pour chaque fichier, j'ai relevé :

- Texte JSX littéral (`<Heading>{title}</Heading>`)
- Props string explicites (`label="..."`, `placeholder="..."`, `aria-label="..."`)
- Defaults dans signature de composant (`title = 'Cinq gestes...'`)
- Strings dans const/let/var typées (mocks, schemas)
- Subjects et preheaders `catalog.ts`
- aria-label et a11y descriptions
- Metadata Next.js (title, description, OG/Twitter)

J'ai **exclu** :

- Console logs (`console.error`, `console.log`)
- Sentry/tracking codes (`emit('add_to_cart', ...)`)
- Strings techniques : data-testid, className Tailwind, formId, sessionId
- Variables d'interpolation déjà documentées comme template placeholders DB (`{{COMPANY_EMAIL}}`)
- Strings dans commentaires JSDoc / TypeScript
- Constantes techniques (event codes, JSON-LD `@type`, URLs absolues)
- Markdown body complet d'articles (1 article retenu en P2, les 13 autres uniquement titre + excerpt)

## Edge cases rencontrés

### 1. Strings concaténées dans le code

```tsx
// CartHero.tsx
subtitle = `${count} articles, rangés à l'abri.`;
```
→ Décomposé en `marketing.commerce.cart.hero.subtitle.many` avec interpolation `{count}` + flag ICU plural recommandé.

### 2. Template literals avec multiple branches

```tsx
// RitualsModule.tsx
const headline = total === 1
  ? 'Une initiée a partagé son rituel. Elle le reprendrait.'
  : `${total} initiées ont partagé. ${oui} reprendraient le rituel.`;
```
→ Extrait en 2 clés `mock-data.ritual_module.headline_one` + `_many`. Recommandation : consolider en ICU plural en next-intl.

### 3. JSX conditionnel multi-langues

```tsx
// ChatComposer.tsx
const PLACEHOLDERS: Record<string, string> = {
  fr: 'Posez votre question…',
  ar: 'اكتب رسالتك…',
  'ar-MA': 'kteb ssoual dyalek…',
};
```
→ Extrait pour la version FR (les versions AR/AR-MA existent déjà). À conserver comme proof of concept i18n.

### 4. Strings unicode avec échappements

Tous les `é`, ` `, `’`, `«` ont été décodés et conservés tels qu'ils s'afficheraient (e accent aigu, espace insécable étroite, apostrophe typo, guillemet français).

Exemple :
```tsx
// kit.ts L48
function: 'Hémisphage des cuticules'
// → décodé : "Hémisphage des cuticules"
```

### 5. Strings dans tableau d'objets

```tsx
// articles.ts
export const mockArticles: Article[] = [
  { slug: 'hiver-...', title: 'Hiver, ongles, patience', excerpt: '...', body: '...' }
]
```
→ Une clé par article × (title, kicker, excerpt). Body markdown signalé séparément.

### 6. Strings dans seed/known-pages

```tsx
// lib/seo/known-pages.ts
{ key: 'home', label: 'Accueil', ... }
```
→ Toutes les `label` extraites en `seo.known_pages.<key>` (catégorie `cms-default-seed` car cela ira en DB initiale).

### 7. Strings avec interpolations Next.js i18n style

```tsx
// EditorialLetter.tsx
const opening = firstName
  ? `${firstName}, merci d'avoir confié votre rituel à la maison.`
  : 'Merci d'avoir confié votre rituel à la maison.';
```
→ 2 clés `..._opening_named` (avec `{first_name}`) + `..._opening_anonymous` (fallback).

### 8. Strings dans dictionnaires de mapping

```tsx
// JournalGrid.tsx + journal/[slug]/page.tsx
const categoryLabels: Record<Article['category'], string> = {
  maison: 'Maison', saison: 'Saison', voix: 'Voix', matieres: 'Matières', pratique: 'Pratique',
};
```
→ Doublon avec `lib/i18n/categories.ts` — extrait depuis le lib (source de vérité). Recommander suppression du duplicat dans `JournalGrid.tsx`.

### 9. Subjects / preheaders côté catalog

```ts
// catalog.ts
subjectFn: (p) => `Bonjour ${p.firstName}, on a bien reçu ton message`
```
→ Extrait avec template literal préservé ; recommander la migration vers ICU pour traducteurs (mais syntaxe template literal valide aussi).

### 10. Multi-paragraphes dans mocks

```tsx
// maison.ts
paragraphs: ['FemiGlow est né...', 'L\'idée a pris forme...', 'Notre fondatrice est biologiste...'],
```
→ Extraits comme `marketing.maison.origine.paragraph_1`, `_2`, `_3` (et non un seul array clé) pour pouvoir traduire/réviser chaque paragraphe indépendamment.

## Décisions de catégorisation

### P0 vs P1 vs P2

J'ai suivi strictement le brief :

- **P0** :
  - Tout ce qui est sur le chemin `/` → `/kit` → `/panier` → `/commander` → `/merci`
  - Header, footer, navigation
  - SEO de `/` et `/kit`
  - Errors `/404` et `/500`
  - Emails critiques : `order-confirmation`, `contact-acknowledgement`, `newsletter-confirm`
  - Voicemails legal (mentions-legales statique + checkout-consent + footer-legal-links)
  - common.* déduits par fréquence d'usage

- **P1** :
  - Pages `/maison`, `/rituel`, `/contact`, `/journal`
  - Composants secondaires (sections detail)
  - Emails non-critique : `password-reset`, `cart-abandoned`
  - FAQs (toutes), comparatif, ingredients details
  - Validation messages
  - Métadata `/maison`, `/rituel`, `/contact`, `/journal`
  - Strings du chat (déjà multilingue mais doit migrer)

- **P2** :
  - Alt texts détaillés
  - Articles journal individuels (titres + excerpts) — sauf si déjà routés en P1 par cms
  - Sources académiques (footnotes)
  - Strings purement décoratives (initiee_depuis, dates relatives)
  - Honeypot a11y labels

### Choix de namespace

- Ce qui est sur les pages publiques marketing → `marketing.*`
- Ce qui est sur header/footer/sommaire → `navigation.*`
- Ce qui est SEO (metadata Next + known-pages + json-ld) → `seo.*`
- Erreurs page 404/500/validation/chat → `errors.*`
- Templates email + sujets/preheaders → `email.*`
- Pages légales (statique + dynamique CMS) → `legal.*`
- Widget chat (UI + form + errors) → `chat.*`
- Items réutilisés ≥ 2 sites → `common.*`

### Strings ambigües

| Cas | Décision |
|---|---|
| `Le rituel` apparaît dans menu + kicker + cross-links | Une clé par usage (`navigation.rituel`, `marketing.home.gestes.kicker`, etc.) car contexte différent malgré même texte. Notée dans `notes` pour analyser doublon. |
| `Panier` apparaît dans `CheckoutHeader` (texte court) + `CartButton` aria | 2 clés différentes — mobile court vs aria-label étendu |
| `Lire le rituel` apparaît contact + maison | 2 clés différentes — `marketing.contact.crosslinks.rituel` + `marketing.maison.crosslinks.rituel.titre`. Refactor possible vers `marketing.cross.read_rituel`. |
| `Mentions légales` apparaît 4× | 4 clés différentes (page title, metadata, footer link, known page). Contextes typographiques distincts (h1 vs nav vs select). |

## Strings sciemment exclues

### Code-only (non affichable)

- `src/lib/chat/contracts.ts` — `ChatLanguage` enum string
- `src/lib/i18n/categories.ts` `parseCategory` — string keys techniques (`'all'`, `'maison'`, etc.)
- `src/lib/routes.ts` — strings URL `/kit`, `/maison` etc.
- `src/lib/products/feed/kit-feed.ts` constantes techniques (`MERCHANT_RASTER_EXTENSIONS`, `siteOrigin()`)
- Schemas Zod sans `errorMap` custom (le default message est `errors.validation.*`)
- Identifiants product/variant (`primaryVariantSku: 'FEMI-KIT-100'`)
- Slugs articles (`'hiver-ongles-patience'`) — URL, pas affichable
- IDs DB (`'fg-kit-001'`, `'pvar_0c01jxc1yn4kjp3b'`)

### Admin (out of scope V1)

- `src/app/admin/**` — non lu
- `src/components/admin/**` — non lu
- `src/lib/mail/audiences/`, `automation/`, `transactional/` — code admin/backend

### Wizard checkout (CHA-231 déjà géré)

- `src/components/checkout/wizard/**` — lu en surface pour vérifier que les copies viennent bien de `WizardDictionary`
- `src/lib/checkout/i18n/` — non lu
- `src/lib/checkout/copy/wizard-copy.ts` — non lu

J'ai cependant signalé les **3 strings de KitCommanderSection** (`kicker`, `title`, `subtitle`) avec note `scope wizard - HORS audit (CHA-231)` pour clarification : ces strings sont en defaults props mais reflètent le periphérique du wizard, pas son contenu.

### Tests

- Aucun fichier `*.test.ts` / `*.spec.ts` / `__tests__/` lu

### Strings ultra-techniques sortables

- `data-testid` values
- `name` attributes de formulaire
- `formId`, `formMode`, `variantKey`
- Tailwind utility class names

## Sanity checks effectués

| Check | Statut | Notes |
|---|---|---|
| Pas de strings admin auditées | OK | Aucun fichier `src/app/admin/` lu |
| Pas de strings wizard auditées | OK | KitCommanderSection signalé HORS scope |
| Pas de strings tests auditées | OK | Aucun `*.test.ts` lu |
| Pas de strings dans comments JSDoc | OK | Filtré à la lecture |
| Pas de classnames Tailwind extraites | OK | Filtré |
| Pas de console.* / logs | OK | Filtré |
| Pas de strings d'identifiants techniques | OK | Filtré |
| Échappements `\u...` décodés | OK | Décodés en texte UTF-8 lisible |
| Échappements `&apos;`, `&nbsp;` traités | OK | Conservés dans la string sauf si Next.js les déprécie |
| Strings interpolées préservent les `{var}` | OK | Format `{varname}` normalisé |
| Toutes les pages marketing parcourues | OK | 10 pages publiques visitées |
| Tous les composants sections lus si stratégiques | OK | 35 sections lues sur 70 (les 35 non lues sont des wrappers techniques) |
| Tous les emails parcourus | OK | 6 templates + 3 shared |
| Toutes les pages d'erreur lues | OK | 404 + 500 |
| Page légale statique parcourue | OK | mentions-legales lu intégralement |
| Page légale dynamique lue | OK | `/legal/[slug]` parcouru — strings du chrome statiques extraites, contenu DB hors scope |
| Composants `*.Bound.tsx` lus si présence text défaut | OK | Les Bound wrappers délèguent au composant Server, lu en amont |
| Mocks lus intégralement | OK | 6 fichiers mock |
| `catalog.ts` emails lu | OK | Subjects + preheaders extraits |
| Conventions `naming-conventions.md` respectées | OK | Profondeur max 5 (avec 1 exception ingredients à 6 — flag dans summary) |

## Statistiques de couverture

- **Fichiers lus en profondeur** : 50
- **Fichiers listés mais non lus** : ~35 (wrappers, technique pur)
- **Strings extraites** : 766 (vs 600–800 estimé → cible atteinte)
- **Strings avec interpolation** : ~16 (2 %)
- **Strings P0** : 362 (47 %)
- **Duplicats détectés** : 27 (3,5 %)

## Limitations connues de l'audit

1. **Body markdown des articles** : seuls les 14 titres + excerpts ont été extraits. Le corps complet (820–1600 mots × 14 articles ≈ 17 000 mots) est référencé par 1 seule clé symbolique (`marketing.journal.article.body.hiver`). En réalité chaque article aura sa propre clé body lors de l'extraction réelle.

2. **CMS-driven content** : les valeurs renvoyées par `cms.getHomepageContent()`, `cms.getKitPageContent()`, etc. sont **les valeurs mock**, pas les valeurs DB. Si l'admin a modifié des contenus en DB, les strings réelles différeront. Recommander un audit complémentaire `pg_dump` sur les tables CMS si on veut le 100 % réel.

3. **Composants `*.Bound.tsx`** : non listés (ils délèguent au composant non-Bound qui contient les strings). Si un Bound surchage un default avec un override CMS, cette logique de override n'a pas été tracée — uniquement la valeur par défaut a été extraite.

4. **Page `/legal/[slug]`** : seul le chrome (kicker, headings, contact-block, related-links) a été audité. Le contenu Markdown réel des 8 pages légales actuellement en DB (`mentions-legales`, `cgv`, `confidentialite`, `cookies`, `livraison`, `retours-remboursements`, etc.) n'est pas couvert ici — c'est du contenu DB, à exporter séparément pour traduction.

5. **`/admin/*`** : exclu volontairement (admin reste FR-only en V1).

6. **Strings dans `*.svg`** : les fichiers SVG d'illustration ne contiennent pas de texte affichable significatif (juste des `<title>` / `aria-label` côté composant React qui ont été audités).

7. **Composants déférés/lazy** : la plupart sont des wrappers de chargement, pas de strings perdues.

## Améliorations possibles pour audit v2

- Utiliser un AST parser (TypeScript Compiler API ou tree-sitter) pour extraire automatiquement toutes les strings JSX, sans loupe manuelle.
- Cross-référencer les strings extraites avec les snapshots Vitest existants (`__snapshots__/`) pour repérer les strings testées mais non auditées.
- Vérifier les `*.stories.tsx` (Storybook) si présent — non utilisé ici.
- Exporter le contenu DB legal/cms pour audit complémentaire.
- Vérifier les strings dans les **fichiers de migration SQL** seeds (`apps/web/scripts/seed-*.ts`) pour les valeurs initiales DB — non couvert ici car déjà signalé hors scope (logs seul).

## Annexe — fichiers non lus mais inventoriés

Liste des fichiers identifiés mais non lus en profondeur (raison : wrapper technique, type-only,
pas de strings affichables) :

- `src/components/sections/*Bound.tsx` (~25 fichiers) — déléguent au composant non-Bound
- `src/components/sections/hero/HeroGallery*.tsx`, `useGallery.ts` — gallery technique
- `src/components/sections/rituals/wizard/RitualsWizard.tsx` — admin-like
- `src/components/sections/{ArticleProse,Image,Reveal,ScrollProgress,SchemaSVG,ShareButtons,TableOfContents,ReadingProgress}.tsx` — utilitaires sans copy
- `src/components/ui/{Button,ButtonLink,Container,Fleuron,Heading,Image,Kicker,Logo,Stack,Text}.tsx` — primitives sans copy
- `src/components/patterns/*.tsx` — utilitaires
- `src/components/promo/GeoPromo*.tsx` — admin-driven
- `src/components/a11y/MobileFocusGuard.tsx` — technique
- `src/components/tracking/*.tsx` — instrumentation
- `src/lib/seo/{rules/,types.ts,schemas.ts,seed.ts,component-resolve.ts}` — code SEO sans copy affichable hors `defaults.ts`/`known-pages.ts`
- `src/lib/mail/{audiences,automation,transactional,webhooks}/` — backend admin

Total fichiers techniques inventoriés mais non audités : ~35.
