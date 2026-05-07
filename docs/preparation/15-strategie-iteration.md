# 15 — Stratégie d'itération composant par composant, page par page

> Document opérationnel. Lit le code actuel, propose un ordre d'attaque,
> donne une *Definition of Done* par unité de travail, et un cycle court
> que vous pouvez répéter mécaniquement jusqu'à ce que chaque pièce soit
> au niveau « cabinet international ».

---

## 1. Analyse de ce qui a été livré

### 1.1 Dossier de préparation
Quinze documents (00–14) + trois annexes (`tokens.css`, `composants-index`,
`glossaire-editorial`) couvrent : marque, design system, architecture
informationnelle, spécifications de pages, bibliothèque de composants,
architecture technique, modèles de données et API, UX/animations,
ergonomie/accessibilité, performance, SEO, QA/observabilité, modularité,
roadmap. **Statut : couvert et stable.**

### 1.2 Échafaudage Next.js
Sous `apps/web/` :

- **Configuration** : `next.config.mjs`, `tailwind.config.ts`,
  `tsconfig.json` strict (`noUncheckedIndexedAccess`), ESLint, Prettier,
  PostCSS, `.env.example`, `pnpm-workspace.yaml`.
- **Tokens** : `src/styles/tokens.css` (couleurs signature, typographies,
  espacements, motion tokens, `prefers-reduced-motion`, `prefers-contrast`).
- **Schémas Zod** (source unique des types) : `common`, `article`, `product`,
  `page-content`, `cart`, `contact`, `order`. Pas de type métier ailleurs.
- **CMS adapter** : `mockAdapter` (Phase 1) + `sanityAdapter` (stub Phase 2).
  Les pages n'importent que `cms`, pas l'implémentation. Bascule prévue
  via `CMS_PROVIDER`.
- **Store** : `cart-store` (Zustand persist + hydration flag).
- **Composants UI** : `Button`, `Container`, `Stack`, `Heading`, `Text`,
  `Kicker`, `Logo`, `Image`.
- **Layout** : `Header`, `CommerceHeader`, `Footer`, `SkipLink`.
- **Sections** : `Hero`, `GestesGrid`, `Manifeste`, `AvisStrip`, `CrossLinks`.
- **Forms** : `Field` (TextField, TextAreaField, FieldShell), `ContactForm`.
- **Commerce** : `CartButton`, `CartContents`, `CheckoutFlow` (3 étapes).
- **Pages B2C (9)** : Home, Rituel, Kit, Journal, Article `[slug]`, Maison,
  Contact, Panier, Commander, Merci. Layouts par route group.
- **API** : `/api/health`, `/api/contact`, `/api/newsletter` (validation Zod).
- **SEO** : `sitemap.ts`, `robots.ts`, `metadata` par page, `generateMetadata`
  pour les articles, `generateStaticParams`.
- **Pages techniques** : `not-found.tsx`, `error.tsx`.
- **Placeholders SVG** : 6 visuels neutres aux couleurs de marque, à
  remplacer par les photos réelles avant la prod.

### 1.3 État réel
Ce qui existe est un **squelette qui compile, démarre et navigue**. Aucun
composant n'a encore été ciselé : pas de stories, pas de tests, pas
d'animations, pas d'audit accessibilité passé. C'est le point de départ
légitime pour itérer pièce par pièce.

### 1.4 Ce qui manque encore (et qui sera traité dans le plan d'attaque)
- Patterns réutilisables : `Accordion`, `Reveal`, `Stepper`, `Tabs`.
- Overlays : `CartDrawer`, `Modal`, `Toast`.
- AddToCartButton avec intégration Zustand depuis la page Kit.
- Storybook (config + stories).
- Vitest + Playwright (config + tests).
- ESLint `import/no-restricted-paths` pour figer les couches.
- Self-hosting des polices (actuellement via `next/font/google`).
- Web Vitals : mesures réelles, pas encore d'optimisation ciblée.
- Photographies réelles (les 6 SVG sont volontairement neutres).
- Contenus longs : `body` des articles, paragraphes complets, cas d'usage
  validés contre le glossaire éditorial.

---

## 2. Philosophie d'itération

> *« Ne fais jamais deux choses à la fois. Polis une pièce, valide-la,
> commit, passe à la suivante. »*

Trois principes :

1. **Bottom-up.** On polit les tokens, puis les primitifs, puis les patterns,
   puis les sections, puis les pages. Une page n'est jamais meilleure que
   ses composants.
2. **Une unité = un commit.** Un composant ou une page = une PR autonome.
   Si la diff dépasse 400 lignes, c'est qu'on a regroupé deux unités.
3. **Pas de polissage sans mesure.** Avant de toucher au code, on prend
   une capture, on lance axe, on note le score Lighthouse. Après, on
   compare. Sans baseline, le « polissage » devient cosmétique.

---

## 3. Cycle d'itération générique (le « pas »)

Pour **chaque** composant ou page, suivre exactement ces sept temps :

### 3.1 Lire et comprendre (5 min)
- Ouvrir le fichier.
- Relire les sections concernées de `02-design-system.md`,
  `04-specifications-pages.md`, `05-bibliotheque-composants.md`,
  `08-ux-animations-interactions.md`, `09-ergonomie-accessibilite.md`.
- Reformuler à voix haute : *« Ce composant doit faire X, et seulement X. »*

### 3.2 Baseline (5 min)
- Capture d'écran avant.
- `pnpm typecheck` + `pnpm lint`.
- Pour les pages : Lighthouse en mode mobile (DevTools → Lighthouse).
- Pour les composants : ouvrir Storybook (à ajouter), lancer axe.

### 3.3 Polir (30–90 min)
- Tokens uniquement (pas de couleurs ou tailles en dur).
- Vérifier la *Definition of Done* (§ 4 ou § 5).
- Petites animations : Framer Motion + `LazyMotion` + `domAnimation`.
- Respect `prefers-reduced-motion`.

### 3.4 Tester (15 min)
- Stories Storybook : default, hover, focus, disabled, loading, RTL (Phase 2).
- Tests unitaires Vitest (props, accessibilité, edge cases).
- Tests E2E si page critique (golden path Playwright).

### 3.5 Auditer (10 min)
- axe-core : zéro violation critique.
- Navigation clavier : tab → focus visible et logique.
- Contraste : encre/crème ≥ 4.5:1, micro-texte ≥ 7:1.
- Tap targets : ≥ 44 × 44 px.
- `prefers-reduced-motion` : animations neutralisées.

### 3.6 Mesurer (5 min)
- Capture d'écran après → comparer avec baseline.
- Lighthouse : LCP, CLS, INP, TBT vs cible.
- Bundle size : `next build` puis lire le rapport.

### 3.7 Commit (2 min)
- Message court, en français, conjugué au présent : *« Polis le composant
  Button : focus-visible, loading state, micro-rebond. »*
- Une unité = un commit.

**Total par unité : 1 h à 2 h.**

---

## 4. Definition of Done — un composant

Un composant n'est considéré comme « livré » que si **toutes** les cases
sont cochées. Imprimer cette liste, la cocher au stylo.

### 4.1 Tokens et style
- [ ] Aucune couleur, taille, durée ou easing en dur. Tout passe par
      les tokens (`var(--color-*)`, `var(--space-*)`, `var(--duration-*)`,
      `var(--ease-*)`).
- [ ] Typographies via les variables `--font-*` (pas de `font-family` direct).
- [ ] Pas de `style={{...}}` inline (sauf valeur dynamique calculée).

### 4.2 Découplage
- [ ] Aucun import depuis `@/lib/cms`, `@/lib/stores`, `@/data/*`.
      Le composant reçoit ses données en props.
- [ ] Aucune référence à un slug, un id, ou une URL en dur :
      les liens passent par `routes.*`.
- [ ] `'use client'` uniquement si state, hooks ou event handlers natifs.

### 4.3 Types
- [ ] Props typées via interface, exportée si réutilisable.
- [ ] Pas de `any` ni de cast forcé.
- [ ] Pas de prop optionnelle sans valeur par défaut documentée.

### 4.4 Accessibilité
- [ ] Sémantique correcte (`<button>`, pas `<div onClick>`).
- [ ] `aria-*` posés quand requis (busy, expanded, controls, describedby).
- [ ] Focus visible (outline encre, offset 3 px).
- [ ] Tap target ≥ 44 × 44 px.
- [ ] Contraste vérifié.
- [ ] Test axe-core : zéro violation critique.
- [ ] Lecteur d'écran : lecture testée (VoiceOver sur Mac).
- [ ] `prefers-reduced-motion` honoré.

### 4.5 Animations
- [ ] Durée ≤ 240 ms pour les micro-interactions.
- [ ] Easing depuis le set défini (`--ease-out-soft`, `--ease-in-out-slow`).
- [ ] Aucune animation auto-déclenchée sans intent utilisateur (sauf reveal
      au scroll, et seulement si motion réduit n'est pas demandé).

### 4.6 Storybook
- [ ] Story `Default`.
- [ ] Story par variant (primary/secondary/ghost/link, etc.).
- [ ] Story par état (hover, focus, disabled, loading, error).
- [ ] Story responsive (sm, md, lg).

### 4.7 Tests
- [ ] Vitest : rendu, props, branches conditionnelles.
- [ ] Vitest : interaction (Testing Library) si event handlers.
- [ ] jest-axe : pas de violation.

### 4.8 Documentation
- [ ] Une ligne JSDoc en tête (intention, pas implémentation).
- [ ] Si comportement non-trivial, exemples dans la story.
- [ ] Mention dans `docs/preparation/annexes/composants-index.md` si nouveau.

---

## 5. Definition of Done — une page

### 5.1 Données
- [ ] Données récupérées via `cms.*` (jamais d'import direct mock).
- [ ] `revalidate` configuré (3600 pour pages éditoriales, 1800 pour
      catalogue, `force-dynamic` pour panier/checkout).
- [ ] `generateStaticParams` pour les routes dynamiques.
- [ ] `notFound()` si la donnée est absente (pas de fallback silencieux).

### 5.2 SEO
- [ ] `metadata` ou `generateMetadata` complets : `title`, `description`,
      `alternates.canonical`, `openGraph` (type, title, description, images,
      éventuels `publishedTime`/`authors`).
- [ ] JSON-LD injecté pour les pages structurées (Article, Product,
      BreadcrumbList, FAQPage).
- [ ] Pas d'index pour les pages techniques (panier, commander, merci, 404).

### 5.3 Performance
- [ ] LCP < 2.0 s sur connexion 4G simulée.
- [ ] CLS < 0.05.
- [ ] INP < 150 ms.
- [ ] JS first-load conforme au budget (cf. `10-performance-web-vitals.md`).
- [ ] Image LCP : `priority`, `fetchPriority="high"`, ratio défini.
- [ ] Pas de `<img>` natif. Toujours `<Image>` (wrapper).

### 5.4 Accessibilité
- [ ] `<main id="main">` présent (skip-link cible).
- [ ] Hiérarchie de `<h1>` à `<h6>` correcte (un seul h1).
- [ ] Landmark roles implicites : header, main, footer, nav, aside.
- [ ] Navigation clavier : tab logique, focus visible partout.
- [ ] Test axe-core : zéro violation.
- [ ] Test VoiceOver : lecture cohérente.

### 5.5 Responsive
- [ ] 320 px (mobile S), 720 px (tablette), 1024 px (laptop), 1440 px (desktop).
- [ ] Aucun débordement horizontal.
- [ ] Tap targets respectés sur mobile.

### 5.6 Contenu
- [ ] Copy validée contre `annexes/glossaire-editorial.md`.
- [ ] Pas de mot interdit (acheter, produit, client, !, emoji).
- [ ] Apostrophes courbes (U+2019), em-dashes (U+2014), espaces fines
      insécables dans les guillemets français (U+202F).

### 5.7 Tests E2E
- [ ] Playwright : golden path testé.
- [ ] Pour les formulaires : succès + erreurs de validation + erreur réseau.
- [ ] Pour le checkout : 3 étapes, validation, redirection vers `/merci`.

### 5.8 Resilience
- [ ] Pas de crash si `cms` renvoie `null` ou `[]` (skeleton ou notFound).
- [ ] Erreur 500 capturée par `error.tsx`.
- [ ] Image manquante : alt visible, pas de bordure cassée.

---

## 6. Plan d'attaque (ordre exact)

Travailler dans cet ordre. Ne sauter aucune étape, même si elle paraît
évidente.

### Sprint A — Fondations et outillage (avant le premier polissage)

| #   | Unité                          | Action                                                          |
| --- | ------------------------------ | --------------------------------------------------------------- |
| A1  | `tokens.css`                   | Vérifier chaque token vs annexe, ajouter ceux qui manquent      |
| A2  | Polices                        | Auto-héberger via `next/font/local` (au lieu de `next/font/google`) |
| A3  | Storybook 8                    | Installer, configurer addon-essentials + a11y + interactions    |
| A4  | Vitest + RTL                   | Config + premier test exemple                                   |
| A5  | Playwright                     | Config + premier test exemple (Home se charge, h1 visible)      |
| A6  | ESLint `import/no-restricted-paths` | Figer les couches (ui ne peut pas importer cms ni stores)  |
| A7  | CI GitHub Actions              | typecheck, lint, test, e2e, lighthouse                          |

### Sprint B — Composants UI primitifs

Ordre exact (chaque étape suit le cycle § 3 et coche les DoD § 4) :

1. `Button`
2. `Container`
3. `Stack`
4. `Heading`
5. `Text`
6. `Kicker`
7. `Logo`
8. `Image` (déjà patché width+fill ; ajouter blur placeholder, fallback alt)

### Sprint C — Patterns réutilisables (à créer)

9. `Reveal` — animation d'apparition au scroll, respecte motion réduit
10. `Accordion` — clavier, aria-expanded, animation hauteur
11. `Stepper` — déjà inline dans `CheckoutFlow` ; à extraire
12. `Tabs` — clavier (←/→/Home/End), `role="tablist"`

### Sprint D — Forms

13. `FieldShell`
14. `TextField`
15. `TextAreaField`
16. Ajouter : `SelectField`, `CheckboxField`, `RadioGroup`
17. `ContactForm` (validation onBlur, état succès, état erreur réseau)
18. `NewsletterForm` (à créer, simple : email + consent)

### Sprint E — Sections éditoriales

19. `Hero` — 3 variants (editorial, produit, lettre), priority + sizes corrects
20. `Manifeste` — typographie, prose, image latérale optionnelle
21. `GestesGrid` — numérotation, transitions au hover, ordre logique mobile
22. `AvisStrip` — citations, attribution discrète, pas plus de 3
23. `CrossLinks` — 3 cartes liens, hover discret, pas de drop shadow
24. À ajouter : `JournalExtraits`, `FAQSection`, `NewsletterBlock`

### Sprint F — Layout

25. `Header` — sticky, blur, état scrollé, menu mobile
26. `CommerceHeader` — minimaliste pour le tunnel
27. `Footer` — colonnes, newsletter inline, légal
28. `SkipLink` — focus visible, target `#main`

### Sprint G — Commerce

29. `CartButton` — badge animé à l'ajout, hydration safe
30. `CartContents` — quantités, suppression, état vide
31. `AddToCartButton` (à créer pour la page Kit, Zustand integration)
32. `CartDrawer` (à créer, overlay, focus trap, ESC pour fermer)
33. `CheckoutFlow` — 3 étapes, validation par étape, persistance étape

### Sprint H — Pages

Ordre par priorité de trafic et de friction :

34. **Home** — LCP critique, JSON-LD Organization
35. **Kit** — JSON-LD Product, AddToCartButton, galerie
36. **Article `[slug]`** — JSON-LD Article, body MDX (Phase 2 envisagée)
37. **Journal** — pagination, filtres par catégorie (Phase 2)
38. **Rituel** — vidéo silencieuse optionnelle, CTA discret
39. **Maison** — narration, signature animée
40. **Contact** — formulaire complet, états succès/erreur
41. **Panier** — état vide soigné, persistence localStorage
42. **Commander** — 3 étapes, validation, retour étape précédente
43. **Merci** — confirmation, numéro de commande, CTA retour

### Sprint I — Pages techniques

44. `not-found.tsx`
45. `error.tsx`
46. `loading.tsx` (à créer pour les pages avec data fetching)

### Sprint J — Overlays et finitions

47. `Modal` (générique, focus trap, ESC)
48. `Toast` (notifications discrètes après ajout panier, erreur réseau)
49. `CartDrawer` (si pas déjà fait au sprint G)

### Sprint K — Audit final

50. Lighthouse complet (mobile + desktop) sur les 9 pages.
51. axe-core sur toutes les pages, en navigation clavier.
52. Capture vidéo de chaque page (golden path) pour archive.
53. Stress test : panier plein, formulaires édge cases, réseau lent (3G).
54. Revue copy complète contre le glossaire.
55. Résolution des `// TODO` et `// FIXME` restants.

---

## 7. Outillage par itération

| Étape    | Outil                    | Commande                                    |
| -------- | ------------------------ | ------------------------------------------- |
| Lire     | VS Code / Cursor         | `code <fichier>`                            |
| Baseline | Chrome DevTools          | Lighthouse + Network throttle 4G            |
| Storybook| `pnpm storybook`         | http://localhost:6006                       |
| Tests    | Vitest                   | `pnpm test`                                 |
| E2E      | Playwright               | `pnpm test:e2e`                             |
| axe      | axe DevTools (extension) | + `jest-axe` dans Storybook                 |
| Bundle   | Next.js                  | `pnpm build` puis lire l'output             |
| Diff     | Git                      | `git diff` avant chaque commit              |

---

## 8. Suivi

Tenir un fichier `docs/preparation/journal-iteration.md` (à créer au fil
de l'eau, pas avant) où vous notez **par unité** :

- Date.
- Composant ou page.
- Baseline (LCP, CLS, INP, axe violations).
- Après (LCP, CLS, INP, axe violations).
- Une phrase sur ce qui a été polis.
- Lien vers le commit.

Trois lignes par unité suffisent. Au bout de 50 unités, vous aurez
un journal qui prouve la qualité, pas seulement qui la prétend.

---

## 9. Règles d'arrêt

Vous ne passez à la pièce suivante que si :

- ✅ La DoD est cochée à 100 % (pas 90 %).
- ✅ Le commit est clean (`pnpm typecheck && pnpm lint && pnpm test` passent).
- ✅ La capture après est meilleure que la capture avant (ou identique
       si l'objectif était d'ajouter du test/doc, pas de polir le visuel).

Si une de ces conditions échoue, vous ne passez pas. Vous restez sur la
pièce. C'est la seule règle qui empêche la dérive.

---

## 10. Quand demander de l'aide à l'agent

L'IA est utile pour :

- **Multiplier** : générer 8 stories Storybook en parallèle pour 8 variants
  d'un Button.
- **Auditer** : *« Cette page respecte-t-elle la DoD § 5 ? Liste les manques. »*
- **Convertir** : un wireframe Figma en JSX, un schéma Zod en formulaire.
- **Refactor mécanique** : extraire un Stepper inline dans son fichier.

L'IA est moins utile pour :

- Trancher sur la direction artistique.
- Choisir une typographie ou une palette finale.
- Décider du contenu éditorial.

Pour ces décisions, vous (ou la fondatrice) restez en barre.

---

## 11. Cadence cible

- **1 unité par jour ouvré** = ~50 unités en 10 semaines (Sprints B → J).
- **2 par jour si bonne santé** = boucler le scope complet en 5 semaines.
- Sprints A et K se traitent en bursts (1–2 semaines chacun).

Total réaliste, en solo, du *scaffold actuel* au *prototype « digne d'un
cabinet international »* : **8 à 12 semaines de travail concentré**.
