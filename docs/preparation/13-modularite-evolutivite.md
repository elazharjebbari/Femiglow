# 13 — Modularité, évolutivité & maintenabilité

> *Le code que nous écrivons en Phase 1 doit accueillir Phase 2, Phase 3, sans réécriture.*

---

## 1. Trois axes de pérennité

| Axe | Définition | Mesure |
|---|---|---|
| **Modularité** | Chaque unité a une responsabilité unique et substituable | nombre de dépendances entrantes/sortantes par module |
| **Évolutivité** | Le système accueille du nouveau sans réécriture | coût d'ajout d'une feature comparable |
| **Maintenabilité** | Un développeur tiers comprend et modifie sans peur | onboarding < 1 jour, time-to-fix < 2 h |

## 2. Principes architecturaux directeurs

### 2.1 Single Source of Truth

Une information existe **à un seul endroit** dans le code.

| Domaine | Source unique |
|---|---|
| Tokens visuels | `src/styles/tokens.css` |
| Types et runtime validation | `src/lib/schemas/*.ts` (Zod) |
| Mock data | `src/data/mock/*.ts` |
| Microcopy | `src/lib/i18n/fr.ts` (Phase 2 : `+ ar.ts`) |
| Routes | `src/lib/routes.ts` (constantes typées) |
| Config produit | `src/data/mock/products.ts` |

```ts
// src/lib/routes.ts
export const routes = {
  home: '/',
  rituel: '/rituel',
  kit: '/kit',
  journal: '/journal',
  article: (slug: string) => `/journal/${slug}`,
  maison: '/maison',
  panier: '/panier',
  commander: '/commander',
  merci: (orderId: string) => `/merci?order=${orderId}`,
  contact: '/contact',
} as const;
```

Toute navigation référence `routes.kit` et **jamais** la chaîne brute `'/kit'`.

### 2.2 Inversion des dépendances

Les composants UI **ne connaissent** pas la source de leurs données. Ils reçoivent un contrat. Le contrat est honoré par un *adapter* (cf. doc 06).

```
[Composant Button]   →   reçoit ButtonProps
[Composant Hero]     →   reçoit HeroProps (typé Zod)
                              ↑
                         [Page RSC]
                              ↑
                         [cms.getHomepageContent()]
                              ↑
                         [adapter: mock | sanity]
                              ↑
                         [source : JSON | API]
```

**Règle** : un composant `components/sections/Hero.tsx` ne doit **jamais** importer `cms` ni `mockAdapter`. La page (`app/page.tsx`) est la seule à le faire.

### 2.3 Composition over inheritance

Pas de classe abstraite, pas de HOC complexe. Composition explicite par props et children.

```tsx
// Bon : composition
<Card>
  <Card.Image src={...} ratio="4:5" />
  <Card.Body>
    <Card.Title>{title}</Card.Title>
    <Card.Excerpt>{excerpt}</Card.Excerpt>
  </Card.Body>
</Card>

// Mauvais : prop drilling rigide
<Card image={...} title={...} excerpt={...} cta={...} variant="..." showImage={...} />
```

## 3. Organisation modulaire (rappel et règles)

```
src/
├── app/                    Routes (App Router) — coquille fine
├── components/             Composants — découpés par couche
│   ├── ui/                 primitives sans logique métier
│   ├── layout/             header, footer, container
│   ├── patterns/           accordion, tabs, reveal
│   ├── forms/              fields wrapping React Hook Form
│   ├── commerce/           cart drawer, product card
│   ├── sections/           sections de page (composées)
│   └── overlays/           dialogs, drawers, lightbox
├── lib/
│   ├── schemas/            Zod (source de vérité types + runtime)
│   ├── cms/                adapters (mock, sanity, contentful)
│   ├── stores/             Zustand
│   ├── hooks/              hooks réutilisables
│   ├── utils/              helpers purs
│   ├── i18n/               microcopy
│   ├── routes.ts
│   ├── env.ts              validation env Zod
│   └── logger.ts
├── data/
│   └── mock/               mock data Phase 1
├── styles/
│   ├── tokens.css
│   ├── globals.css
│   └── motion.css
└── types/
    └── *.d.ts              types globaux (rare)
```

### 3.1 Règles d'import par couche

| Couche | Peut importer | Ne doit pas importer |
|---|---|---|
| `ui/` | autre `ui/`, `lib/utils/`, types Zod | `cms/`, `stores/`, `app/` |
| `patterns/` | `ui/`, `lib/utils/`, `lib/hooks/` | `cms/`, `app/` |
| `forms/` | `ui/`, `patterns/`, `lib/schemas/`, RHF | `cms/`, `app/` |
| `sections/` | tout sauf `app/` | `app/` |
| `overlays/` | tout sauf `app/` | `app/` |
| `app/` | tout | n/a |
| `lib/cms/` | `lib/schemas/`, `data/mock/`, fetch externes | `app/`, `components/` |
| `lib/stores/` | `lib/schemas/`, autres lib | `components/`, `app/` |

**Enforcement** : ESLint `eslint-plugin-boundaries` ou `eslint-plugin-import` avec rules custom.

```js
// .eslintrc.cjs
'import/no-restricted-paths': ['error', {
  zones: [
    { target: './src/components/ui', from: './src/lib/cms' },
    { target: './src/components/ui', from: './src/lib/stores' },
    { target: './src/components/ui', from: './src/data' },
  ],
}],
```

## 4. CMS Adapter pattern (rappel doc 06, focus évolutivité)

L'adapter est le **point d'évolution majeur** entre Phase 1 et Phase 2.

### 4.1 Interface (source de vérité)

```ts
// src/lib/cms/types.ts
import type { Article, Product, FAQItem, Testimonial } from '@/lib/schemas';

export interface CMSAdapter {
  // Articles
  getArticles(opts?: GetArticlesOpts): Promise<Article[]>;
  getArticleBySlug(slug: string): Promise<Article | null>;
  getRelatedArticles(slug: string, limit?: number): Promise<Article[]>;

  // Produit (Phase 1 : un seul kit)
  getKit(): Promise<Product>;

  // Pages éditoriales
  getHomepageContent(): Promise<HomepageContent>;
  getRituelPageContent(): Promise<RituelPageContent>;
  getMaisonPageContent(): Promise<MaisonPageContent>;

  // FAQs et témoignages
  getFAQs(): Promise<FAQItem[]>;
  getTestimonials(opts?: GetTestimonialsOpts): Promise<Testimonial[]>;
}
```

### 4.2 Implémentations

| Adapter | Statut | Localisation |
|---|---|---|
| `mockAdapter` | Phase 1 actif | `src/lib/cms/mock/index.ts` |
| `sanityAdapter` | Phase 2 stub | `src/lib/cms/sanity/index.ts` |
| `contentfulAdapter` | optionnel | `src/lib/cms/contentful/index.ts` |

### 4.3 Sélection runtime

```ts
// src/lib/cms/index.ts
import { mockAdapter } from './mock';
import { sanityAdapter } from './sanity';
import type { CMSAdapter } from './types';

const provider = process.env.CMS_PROVIDER ?? 'mock';

const adapters: Record<string, CMSAdapter> = {
  mock: mockAdapter,
  sanity: sanityAdapter,
};

export const cms: CMSAdapter = adapters[provider] ?? mockAdapter;
```

### 4.4 Tests d'interchangeabilité

Une suite Vitest applique **les mêmes tests** aux deux adapters via une fonction `runAdapterContractTests(adapter)` :

```ts
// src/lib/cms/__tests__/contract.ts
export function runAdapterContractTests(adapter: CMSAdapter, name: string) {
  describe(`CMSAdapter contract: ${name}`, () => {
    it('getArticles returns valid array', async () => {
      const articles = await adapter.getArticles({ limit: 5 });
      expect(articles).toBeInstanceOf(Array);
      articles.forEach(a => articleSchema.parse(a)); // validation Zod
    });
    // ... 20+ tests
  });
}

// dans mock.test.ts
runAdapterContractTests(mockAdapter, 'mock');

// dans sanity.test.ts (Phase 2)
runAdapterContractTests(sanityAdapter, 'sanity');
```

**Garantit** que tout adapter respecte le contrat. Le jour où on remplace `mock` par `sanity`, l'app ne casse pas.

## 5. Évolution Phase 2 : checklist d'anticipation

Tout point ci-dessous est **déjà préparé** en Phase 1 :

| Évolution Phase 2 | Préparation Phase 1 |
|---|---|
| Connexion CMS Sanity | adapter pattern, schemas Zod stables |
| Section B2B (`/partenaires`, `/programme`, `/echantillon`, `/espace-pro`) | route group `(b2b)` réservé, Header avec slot 5e entrée |
| Locale arabe RTL | i18n routing pré-câblé, tokens RTL prévus, props `dir` partout |
| Multiple produits | `Product[]` au lieu de `Product`, `getKit()` → `getProducts()` |
| Pagination journal | API `getArticles` accepte `cursor` |
| Recherche journal | API `searchArticles(q)` à ajouter |
| Newsletter double opt-in | webhook handler ajouté |
| Comptes utilisateurs | rebranchement Stripe customer + auth provider |
| A/B tests | feature flags Vercel Edge Config |
| Reviews produit | `Review` schema déjà présent dans Zod, juste pas exposé |

## 6. Stabilité des contrats publics

Un *contrat public* est tout ce qui peut être consommé par autre chose : interface adapter, type exporté, props composant exporté.

### 6.1 SemVer interne

Même sans publier de package, on suit SemVer pour les composants UI :

| Type de changement | Action |
|---|---|
| Ajout prop optionnelle | minor — pas breaking |
| Renommage prop | major — déprécation 1 sprint avant retrait |
| Suppression composant | major — déprécation + JSDoc `@deprecated` |
| Modification schéma Zod (ajout champ optionnel) | minor |
| Modification schéma Zod (champ required) | major — migration data + version schéma |

### 6.2 Déprécation

```tsx
/**
 * @deprecated Utiliser `<Card.Image />` à la place. Sera retiré le 2026-09-01.
 */
export function CardImage(props: CardImageProps) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[FemiGlow] CardImage est déprécié, utilisez Card.Image');
  }
  return <NewCardImage {...props} />;
}
```

## 7. Documentation comme infrastructure

| Document | Audience | Localisation |
|---|---|---|
| README.md | onboarding général | racine repo |
| `docs/preparation/*` | tout public | présent dossier |
| Storybook | designers, devs | dev server + déploiement Vercel |
| JSDoc / TSDoc | devs IDE | inline code |
| ADR (Architecture Decision Records) | équipe technique | `docs/adr/0001-titre.md` |
| Postmortems | équipe technique | `docs/postmortems/` |

### 7.1 ADR template

```md
# ADR 0007 — Choix de Zustand pour le panier

Date : 2026-04-12
Statut : accepté
Décideurs : @ej

## Contexte
Le panier doit persister entre les rechargements et être lisible RSC + Client.

## Options considérées
1. Context React + localStorage manuel
2. Zustand avec persist middleware
3. Redux Toolkit

## Décision
Zustand avec persist middleware vers localStorage.

## Conséquences
+ API minimaliste, ~1 kB
+ Pas de boilerplate
- Pas de devtools historiques aussi riches que Redux
```

Tout choix architectural significatif → ADR.

## 8. Scalabilité du code

### 8.1 Limites par fichier

| Type | Limite raisonnable |
|---|---|
| Composant | < 200 lignes |
| Hook | < 100 lignes |
| Helper | < 80 lignes |
| Schema Zod | < 150 lignes |
| Test file | < 300 lignes |
| Page (`page.tsx`) | < 80 lignes (orchestration uniquement) |

Au-delà : refactor en sous-modules.

### 8.2 Convention nommage

| Élément | Convention |
|---|---|
| Composant | PascalCase, fichier homonyme `Button.tsx` |
| Hook | camelCase préfixé `use` |
| Helper | camelCase, descriptif |
| Type / Interface | PascalCase, jamais préfixé `I` |
| Constante | UPPER_SNAKE_CASE pour config, camelCase pour valeurs typées |
| Fichier test | `*.test.ts` ou `*.spec.ts` |
| Story | `*.stories.tsx` |

### 8.3 Index barrels (avec mesure)

Barrel `index.ts` autorisé seulement à la racine d'une *catégorie* (ex. `components/ui/index.ts`) — pas en sous-dossier. Évite les bundlers qui chargent tout. Avec Next.js 14+, `optimizePackageImports` mitige le coût.

```ts
// components/ui/index.ts
export { Button } from './Button';
export { Card } from './Card';
export { Input } from './Input';
// ...
```

## 9. Découplage Phase 1 / Phase 2

### 9.1 Variables d'environnement progressives

```ts
// src/lib/env.ts (validation Zod)
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  CMS_PROVIDER: z.enum(['mock', 'sanity']).default('mock'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SANITY_PROJECT_ID: z.string().optional(),
  SANITY_DATASET: z.string().optional(),
  SANITY_API_TOKEN: z.string().optional(),
  PLAUSIBLE_DOMAIN: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  B2B_ENABLED: z.enum(['true', 'false']).default('false'),
});

export const env = envSchema.parse(process.env);
```

Activation Phase 2 = ajouter les variables d'env, pas refactor de code.

### 9.2 Route groups préfixés

```
app/
├── (marketing)/        // Phase 1 : public
│   ├── page.tsx
│   ├── rituel/page.tsx
│   ├── kit/page.tsx
│   ├── journal/...
│   ├── maison/page.tsx
│   └── contact/page.tsx
├── (commerce)/         // Phase 1 : transactionnel
│   ├── panier/page.tsx
│   ├── commander/page.tsx
│   └── merci/page.tsx
├── (b2b)/              // Phase 2 : préparé
│   ├── partenaires/page.tsx
│   ├── programme/page.tsx
│   ├── echantillon/page.tsx
│   └── espace-pro/page.tsx
└── api/...
```

`(b2b)` créé en Phase 1 vide ou stub `notFound()`. Le jour où on l'active, il suffit d'écrire les pages.

## 10. Maintenabilité par lecture

Un nouveau dev rejoint le projet. Mesure cible : **lecture du repo en 1 jour, première PR en 2 jours**.

### 10.1 Onboarding path

1. Lire `README.md` (vue 5 minutes du projet)
2. Lire `docs/preparation/00-executive-summary.md`
3. Selon profil, lire les 2-3 documents pertinents (cf. README index)
4. Cloner, `pnpm install`, `pnpm dev` — site tourne
5. Storybook : `pnpm storybook`
6. Première tâche : ajouter une variante mineure (mood story)

### 10.2 Lisibilité du code

| Règle | Détail |
|---|---|
| Naming explicite | `getRelatedArticles(slug, limit)` pas `getRA(s, l)` |
| Pas de magie | éviter abstractions trop fines (1 fonction utilisée 1 fois) |
| Code = doc | TSDoc sur fonctions exportées non triviales |
| Comments = pourquoi | jamais le quoi |
| Logique testable | extract pure functions |

### 10.3 Anti-cognitive load

- Pas de globalThis hacks
- Pas de monkey-patching
- Pas de proxies pour state
- Pas de `eval` ni `new Function`
- Pas de side effects au top level (sauf init très ciblées)

## 11. Refactor budget

Chaque sprint réserve **10-15 % du temps** pour :

- Nettoyage de dette technique identifiée
- Mise à jour des dépendances mineures
- Amélioration de la couverture de tests
- Refactor de modules > 200 lignes
- Documentation des nouveautés

Tracking via labels GitHub `tech-debt`, `refactor`, `chore`.

## 12. Versioning & releases

| Phase | Stratégie |
|---|---|
| Phase 1 | Continuous deployment vers main |
| Phase 2 | Release branches (`release/v1.x`), tags semver, CHANGELOG.md généré via `changesets` ou `release-please` |

CHANGELOG conventionnel :

```md
## [1.2.0] — 2026-08-15
### Ajouté
- Section B2B `/partenaires`
- Recherche journal

### Modifié
- Cart store : nouveau champ `discountCode`

### Corrigé
- Tunnel checkout : focus management Étape 3
```

## 13. Métriques d'évolutivité

| Métrique | Cible |
|---|---|
| Time-to-add-page | < 1 jour pour page typique |
| Time-to-swap-CMS | < 3 jours pour intégrer Sanity |
| Time-to-fix critical bug | < 4 h |
| Onboarding new dev | < 1 jour pour première PR |
| Coverage % | ≥ 70 % |
| Build time | < 90 s |
| Test suite (unit) | < 60 s |
| Lighthouse score moyen | ≥ 95 |

## 14. Refactor moments clefs

Quand refactorer ?

| Signal | Action |
|---|---|
| Composant > 200 lignes | extraction sous-composants |
| Plus de 3 props booléennes | considérer variants |
| Logique dupliquée 3 fois | extraction helper |
| Test difficile à écrire | code probablement mal structuré |
| Bug récurrent au même endroit | revoir l'architecture locale |
| Cycle de dépendance détecté | inversion |

## 15. Anti-patterns évolutivité

- ❌ Hardcoder une URL CMS dans un composant
- ❌ `import * as cms from '@/lib/cms'` sans contrat
- ❌ Couplage direct Stripe → composant UI
- ❌ Logique métier dans `app/`
- ❌ Côté client ce qui peut être côté serveur
- ❌ Mock data dispersée (consolider dans `data/mock/`)
- ❌ String literals routes (utiliser `routes.kit`)
- ❌ Couplage tight Phase 1 / mock (le code doit ignorer la source)
- ❌ Re-export massif depuis barrels profonds
- ❌ Duplication de logique mock / réelle

## 16. Maintenance des dépendances

| Outil | Rôle |
|---|---|
| Dependabot | PRs auto pour mises à jour mineures |
| Renovate (alt.) | plus de granularité |
| `pnpm outdated` | revue mensuelle manuelle |
| Major upgrades | RFC + ADR + tests |

**Règle d'or** : pas de mise à jour critique sans tests E2E qui passent.

## 17. Plan de continuité

| Risque | Mitigation |
|---|---|
| Vercel down | Documentation pour redéploiement Cloudflare Pages |
| Sanity down (Phase 2) | Cache ISR fournit un fallback de 24 h, mockAdapter récupérable |
| Stripe down | UI affiche message clair, COD reste disponible |
| Resend down | Queue de retry + fallback Postmark |
| Domain compromis | Gestion DNS chez registrar avec 2FA hardware |

## 18. Checklist modularité par PR

- [ ] Aucun composant `ui/` n'importe `lib/cms/` ou `lib/stores/`
- [ ] Aucun usage de string literal pour les routes
- [ ] Tout schéma de données passe par Zod
- [ ] Pas de couplage à Sanity dans le code Phase 1
- [ ] Mock data isolée dans `data/mock/`
- [ ] Toute prop publique typée explicitement
- [ ] Tout composant exporté a une story Storybook
- [ ] Test unitaire associé pour toute logique non triviale
- [ ] Documentation TSDoc sur exports principaux
- [ ] ESLint boundaries / import rules : 0 violation

> *Document suivant : [14 — Roadmap d'exécution](./14-roadmap-execution.md)*
