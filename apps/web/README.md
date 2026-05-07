# @femiglow/web — application Next.js

Prototype Phase 1 du site FemiGlow. Architecture pensée pour basculer
d’un CMS mock vers Sanity (Phase 2) sans toucher aux pages ni aux composants.

## Démarrer

```bash
pnpm install
pnpm --filter @femiglow/web dev
```

Application servie sur http://localhost:3000.

## Scripts

| Commande           | Effet                                      |
| ------------------ | ------------------------------------------ |
| `pnpm dev`         | Serveur de dev Next.js                     |
| `pnpm build`       | Build de production                        |
| `pnpm start`       | Serveur de production                      |
| `pnpm lint`        | ESLint                                     |
| `pnpm typecheck`   | tsc --noEmit                               |
| `pnpm test`        | Vitest (unitaires + composants)            |
| `pnpm test:e2e`    | Playwright                                 |
| `pnpm storybook`   | Storybook 8                                |

## Variables d’environnement

Voir `.env.example`. Variables minimales pour faire tourner Phase 1 :

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ENV=development
CMS_PROVIDER=mock
B2B_ENABLED=false
```

`CMS_PROVIDER=mock` (par défaut) lit les fichiers de `src/data/mock/`.
`CMS_PROVIDER=sanity` activera l’adaptateur Sanity en Phase 2.

## Architecture en deux mots

```
src/
├── app/                  # Next.js App Router
│   ├── (marketing)/      # Pages éditoriales : home, rituel, kit, journal, maison, contact
│   ├── (commerce)/       # Tunnel d’achat : panier, commander, merci
│   ├── api/              # Routes API : contact, newsletter, health
│   ├── sitemap.ts        # /sitemap.xml dynamique
│   └── robots.ts         # /robots.txt
├── components/
│   ├── ui/               # Primitifs (Button, Container, Heading, Text, Image…)
│   ├── layout/           # Header, Footer, SkipLink
│   ├── sections/         # Hero, GestesGrid, Manifeste, AvisStrip, CrossLinks
│   ├── commerce/         # CartButton, CartContents, CheckoutFlow
│   ├── forms/            # Field, ContactForm
│   ├── patterns/         # Accordion, Reveal, Stepper, Tabs (à venir)
│   └── overlays/         # CartDrawer, modales (à venir)
├── lib/
│   ├── cms/              # Adaptateur CMS (mock / sanity)
│   ├── schemas/          # Zod, source unique des types
│   ├── stores/           # Zustand (cart-store)
│   ├── utils/            # cn, format-price
│   ├── env.ts            # Variables validées par Zod
│   └── routes.ts         # Source unique des chemins
├── data/mock/            # Contenus de Phase 1
└── styles/               # tokens.css + globals.css
```

## Décisions structurantes

- **Composants découplés des données.** Aucun composant `ui/` ou `sections/`
  n’importe `cms`. Les pages serveur appellent `cms.*` et passent les données
  en props. Bascule mock → Sanity invisible côté composants.
- **Zod = source unique de vérité.** Types et validation runtime générés
  depuis le même schéma. Aucun type métier déclaré ailleurs.
- **Routes typées.** `routes.ts` est le seul endroit où vivent les chemins.
  Aucun `'/journal/' + slug` éparpillé dans le code.
- **Tokens CSS-first.** Tailwind ne fait que mapper des variables CSS.
  Le design system reste portable (Storybook, emails Resend, exports figés).
- **Couches isolées.** ESLint `import/no-restricted-paths` empêche `ui` de
  remonter vers `cms`, `stores`, ou des features applicatives.

## Performance — budgets

| Page    | JS first-load (gzip) | Images critiques |
| ------- | -------------------- | ---------------- |
| Home    | ≤ 90 kB              | LCP < 2.0 s      |
| Kit     | ≤ 110 kB             | LCP < 2.0 s      |
| Article | ≤ 95 kB              | LCP < 2.5 s      |

Voir `docs/preparation/10-performance-web-vitals.md` pour les détails.

## Accessibilité

Cible : WCAG 2.2 AA. `prefers-reduced-motion` honoré, focus-visible
généreux, tap targets ≥ 44×44 px, contraste Encre/Crème = 13.2:1 (AAA).

## Pour aller plus loin

Le dossier de préparation complet (15 documents + 3 annexes) se trouve dans
`docs/preparation/`. Commencer par `README.md` puis `00-executive-summary.md`.
