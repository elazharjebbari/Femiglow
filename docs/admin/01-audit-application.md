# Audit de l'application FemiGlow

> **But du document.** Photographier l'état actuel de l'application — stack,
> structure, données, sécurité, capture de leads, composants réutilisables —
> avant de concevoir l'interface d'administration. Pas d'avis, pas de plan ;
> uniquement des faits avec des chemins de fichiers.

---

## 1. Monorepo & racine

| Élément | Valeur |
|---|---|
| Chemin | `/Users/elazhar/PycharmProjects/template-femiglow` |
| Gestionnaire de paquets | `pnpm` (≥ 9), workspace `pnpm-workspace.yaml` (`apps/*`) |
| Node | ≥ 20 |
| Apps déclarées | une seule : `apps/web` |
| Scripts root | `dev`, `build`, `lint`, `typecheck`, `test`, `format` (récursifs) |
| `.github/workflows/` | absent |
| `Dockerfile` | absent |
| `vercel.json` | absent (déploiement par défaut Vercel) |

## 2. Stack `apps/web/`

| Couche | Version / valeur |
|---|---|
| Next.js | 14.2.15 (App Router) |
| React | 18.3.1 |
| TypeScript | 5.6.3 — `strict`, `noUncheckedIndexedAccess: true`, alias `@/* → src/*` |
| Tailwind | 3.4.13 — palette `creme / encre / sauge / petale / ciel / champagne` |
| Fonts | `next/font/local` — Cormorant Garamond, Inter, Pinyon Script |
| State client | `zustand` 5 + persist middleware |
| Validation | `zod` 3.23 |
| Formulaires | `react-hook-form` 7.53 + `@hookform/resolvers` |
| Animation | `framer-motion` 11 |
| Markdown | `remark-*` + `rehype-*` |
| Tests | `vitest` 2.1, `@testing-library/react`, `jest-axe` |
| E2E | `@playwright/test` 1.48 (déclaré, non configuré — pas de `playwright.config.ts`) |
| Storybook | absent |
| **Auth library** | **aucune** (ni next-auth, ni clerk, ni iron-session) |
| **DB / ORM** | **aucun** (ni Prisma, ni Drizzle, ni Kysely) |
| **Email** | **aucun** transporteur intégré (`RESEND_API_KEY` listé en env mais non câblé) |
| **Queue / cron** | **aucun** (ni Inngest, ni Trigger.dev, pas de Vercel Cron) |

## 3. Configuration Next.js

Fichier : `apps/web/next.config.mjs`.

- **Headers** globaux : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- **Images** : `dangerouslyAllowSVG` activé (Phase 1, placeholders SVG),
  `remotePatterns` pour `cdn.sanity.io` et `images.femiglow.ma`.
- **Redirects** : `/products/:slug → /kit` (308), `/blog/:slug → /journal/:slug` (308).
- **`experimental.optimizePackageImports`** : `framer-motion`, `zustand`.
- **Aucun `middleware.ts`** à la racine de `src/` (donc pas d'interception
  globale de requêtes — point clé pour ajouter une garde admin).

## 4. Routes & route handlers

### Pages (App Router)

```
apps/web/src/app/
├── (marketing)/           layout marketing avec Header + Footer
│   ├── page.tsx           home
│   ├── rituel/
│   ├── kit/
│   ├── journal/
│   ├── maison/
│   └── contact/
├── (commerce)/
│   ├── panier/
│   └── merci/
├── commander/             checkout standalone (3 étapes)
├── api/
│   ├── articles/route.ts  GET — articles depuis CMS adapter
│   ├── checkout/route.ts  POST — valide, génère orderId, RAS persistance
│   ├── contact/route.ts   POST — valide, console.warn
│   ├── newsletter/route.ts POST — valide, console.warn
│   └── health/route.ts    GET — healthcheck
├── error.tsx, not-found.tsx, robots.ts, sitemap.ts
└── layout.tsx
```

### Comportement actuel des soumissions

| Endpoint | Schéma Zod | Action effective | Persistance |
|---|---|---|---|
| `POST /api/contact` | `contactFormSchema` | `console.warn` | aucune |
| `POST /api/newsletter` | inline | `console.warn` | aucune |
| `POST /api/checkout` | `checkoutFormSchema` | génère `FG-XXXX-XXXXX`, retourne `{ orderId }` | `localStorage` côté client |

> **Conclusion section 4.** Aucun lead n'est aujourd'hui persisté côté serveur.
> Toute la donnée est volatile (logs console + `localStorage` navigateur).

## 5. Schémas Zod (`src/lib/schemas/`)

| Fichier | Contenu |
|---|---|
| `common.ts` | email, phone Maroc (`+212…`), images, SEO, CTA partagés |
| `contact.ts` | `contactFormSchema` — `type ∈ {question, order, professional}` + champs conditionnels (`orderNumber` si `order`, `companyName + role` si `professional`) |
| `order.ts` | `checkoutFormSchema` (contact + adresse Maroc + `paymentMethod`), `villeMaroc` enum, `orderIdSchema` (`/^FG-[A-Z0-9]{4}-[A-Z0-9]{5}$/`) |
| `cart.ts` | `cartItemSchema` |
| `article.ts`, `product.ts`, `page-content.ts` | schémas CMS |

**Lecture :** ces schémas constituent un socle réutilisable pour valider toute
entrée admin (filtre, édition de lead, etc.) sans le réécrire.

## 6. Stores & persistance client

| Store | Fichier | Persiste où |
|---|---|---|
| Cart | `src/lib/stores/cart-store.ts` | `localStorage['femiglow-cart']` |
| Checkout draft | `src/lib/stores/checkout-draft.ts` | `localStorage['checkout-draft']` (avec `stripSensitive()` pour exclure `cardNumber`, `cvc`, `expiry`) |
| Last order | idem | `localStorage['last-order:{orderId}']` |

Aucune donnée serveur, aucune session, aucun cookie applicatif.

## 7. Couche CMS

`src/lib/cms/` — adapter pattern, deux providers commutables par
`process.env.CMS_PROVIDER` :

- `mock` (par défaut) — données en dur dans le code
- `sanity` — appels `cdn.sanity.io`

Aucun champ CMS n'est conçu pour stocker des leads.

## 8. Variables d'environnement

Fichier : `apps/web/src/env.ts` (validation Zod runtime). `.env.example`
déclare :

```
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_ENV               # development | preview | production
CMS_PROVIDER                  # mock | sanity
SANITY_PROJECT_ID             # optionnel
SANITY_DATASET                # optionnel
SANITY_API_VERSION            # optionnel
SANITY_TOKEN                  # optionnel
STRIPE_SECRET_KEY             # déclaré, non câblé
STRIPE_WEBHOOK_SECRET         # déclaré, non câblé
RESEND_API_KEY                # déclaré, non câblé
PLAUSIBLE_DOMAIN
SENTRY_DSN
B2B_ENABLED
```

> **Aucune variable d'authentification admin** n'est prévue
> (`NEXTAUTH_SECRET`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, etc.).

## 9. Sécurité actuelle

| Sujet | État |
|---|---|
| Authentification | aucune |
| Autorisation | aucune (toutes les routes API publiques) |
| Middleware | aucun (`middleware.ts` absent) |
| Cookies signés | aucun |
| CSRF | non géré explicitement (Next 14 a une protection partielle pour Server Actions ; les route handlers POST n'ont pas de garde) |
| Rate limiting | aucun |
| Headers HTTP | basique (cf. §3) — pas de CSP custom (sauf images SVG) |
| Logs structurés | aucun (`console.warn` à divers endroits) |

## 10. Composants UI réutilisables

`src/components/ui/` — primitives utilisables pour bâtir une UI admin
cohérente avec la voix de marque :

| Composant | Usage admin probable |
|---|---|
| `Button`, `ButtonLink` | actions primaires/secondaires |
| `Heading`, `Text`, `Kicker` | titres, paragraphes, surtitres |
| `Container` | wrappers max-width (`prose / content / wide / page`) |
| `Stack` | espacements verticaux/horizontaux |
| `Toast` | notifications de succès/erreur |
| `ConfirmationModal` | dialog `<dialog>` natif déjà gabarité (focus trap, `Esc`) |
| `Image`, `Logo`, `Fleuron` | assets branding |

`src/components/forms/` — `Field.tsx` (wrapper label+input+erreur),
`ContactForm.tsx`, `NewsletterForm.tsx`, `FormTypeSelector.tsx`. Patterns
react-hook-form + Zod déjà éprouvés.

`src/components/layout/` — `Header`, `Footer`, `CommerceHeader`,
`CheckoutHeader`, `FooterMinimal`, `SkipLink`, `SommaireOverlay`. Une route
`/admin/*` peut vivre dans un **route group dédié** (`(admin)`) avec son
propre layout sobre, sans interférer avec marketing ou commerce.

## 11. Tests

- 53 fichiers `*.test.ts(x)` détectés (units sur stores, forms, utils,
  rendering markdown, accessibilité via `jest-axe`).
- `vitest.config.ts` : env `jsdom`, setup mocke `next/font/local`,
  `matchMedia`, `IntersectionObserver`.
- Pas de tests E2E exécutables (Playwright installé mais non configuré).

## 12. Ce qui est **prêt à étendre**

- ✅ Route groups (`(marketing)`, `(commerce)`) — un `(admin)` parallèle est
  naturel.
- ✅ Schémas Zod partageables côté admin pour valider édition/filtre.
- ✅ Pattern `react-hook-form + Field` réutilisable pour login admin.
- ✅ `ConfirmationModal`, `Toast` déjà accessibles (a11y, focus trap).
- ✅ Stack TS strict + tests + Tailwind palette → fondation propre.

## 13. Ce qui **manque** pour une admin opérationnelle

| Besoin | Statut |
|---|---|
| Authentification admin | absent |
| Middleware d'autorisation | absent |
| Persistance serveur (DB/KV) | absent |
| Hashage de mot de passe (bcrypt/argon2) | absent |
| Gestion de session (cookies signés / JWT) | absent |
| Email transactionnel | absent (Resend déclaré, non câblé) |
| Queue / worker pour webhooks | absent |
| Logs structurés | absent |
| Rate limiting | absent |
| Tests d'intégration API | absents |

## 14. Points d'ancrage pour la suite

Les trois services à concevoir (auth, gestion de leads, webhook) doivent
respecter ces invariants :

1. **Cohabitation avec le marketing** : aucune interférence avec les routes
   publiques. Un `route group (admin)` + un layout dédié + un middleware
   matchant `/admin/*` et `/api/admin/*`.
2. **Réutilisation de l'existant** : Zod, react-hook-form, primitives UI,
   palette Tailwind. Pas de stack parallèle.
3. **Voix de marque** : même si l'admin est privée, l'UI reste cohérente —
   typographie Cormorant pour les titres, Inter pour les tableaux, palette
   `encre / creme`.
4. **Sécurité par défaut** : tout `/admin/*` et `/api/admin/*` doit refuser
   les requêtes non authentifiées. Aucun fallback.
5. **Compatibilité Vercel** (cible probable de déploiement) : les choix
   doivent rester sereins en environnement serverless (pas de processus
   worker permanent à maintenir, pas d'état mémoire entre requêtes).
