# FemiGlow — monorepo

Maison de soin pour les ongles, éditée à Casablanca.
Trois gestes, cinq minutes, un rituel saisonnier.

## Structure

```
.
├── apps/
│   └── web/        # Application Next.js (Phase 1, B2C)
└── docs/
    └── preparation/  # Dossier de préparation (15 documents + 3 annexes)
```

## Pour commencer

```bash
pnpm install
pnpm --filter @femiglow/web dev
```

## Le dossier de préparation

Avant la première ligne de code, un dossier complet a été rédigé pour
cadrer marque, design system, architecture, ergonomie, performance,
SEO, qualité, modularité et roadmap.

| #   | Document                                                                     |
| --- | ---------------------------------------------------------------------------- |
| 00  | [Résumé exécutif](docs/preparation/00-executive-summary.md)                  |
| 01  | [Marque, vision, voix](docs/preparation/01-marque-vision-voix.md)            |
| 02  | [Design system](docs/preparation/02-design-system.md)                        |
| 03  | [Architecture de l’information](docs/preparation/03-architecture-information.md) |
| 04  | [Spécifications des pages](docs/preparation/04-specifications-pages.md)      |
| 05  | [Bibliothèque de composants](docs/preparation/05-bibliotheque-composants.md) |
| 06  | [Architecture technique](docs/preparation/06-architecture-technique.md)      |
| 07  | [Modèles de données et API](docs/preparation/07-modeles-donnees-api.md)      |
| 08  | [UX, animations, micro-interactions](docs/preparation/08-ux-animations-interactions.md) |
| 09  | [Ergonomie et accessibilité](docs/preparation/09-ergonomie-accessibilite.md) |
| 10  | [Performance et Web Vitals](docs/preparation/10-performance-web-vitals.md)   |
| 11  | [SEO et métadonnées](docs/preparation/11-seo-metadata.md)                    |
| 12  | [QA, debugging, observabilité](docs/preparation/12-qa-debugging-observabilite.md) |
| 13  | [Modularité, évolutivité, maintenabilité](docs/preparation/13-modularite-evolutivite.md) |
| 14  | [Roadmap d’exécution](docs/preparation/14-roadmap-execution.md)              |
| 15  | [Stratégie d’itération composant par composant](docs/preparation/15-strategie-iteration.md) |

Annexes :

- [Tokens CSS](docs/preparation/annexes/tokens.css.md)
- [Index des composants](docs/preparation/annexes/composants-index.md)
- [Glossaire éditorial](docs/preparation/annexes/glossaire-editorial.md)

## Convention

Toute la communication, le code et les commits sont rédigés en **français**,
avec les diacritiques justes (apostrophes courbes U+2019, espaces fines
insécables U+202F dans les guillemets français, em-dashes U+2014 littéraux).

## Plans d’exécution par page

Neuf plans détaillés, un par page B2C, calqués sur le même gabarit
(objectif, KPIs, dépendances, écarts spec/scaffold, phases séquentielles,
DoD spécifique, métriques avant/après, risques, estimation).

Voir [`docs/plans/`](docs/plans/README.md) pour l’index complet et l’ordre
d’exécution recommandé.

## Phases

- **Phase 1 (en cours)** — Prototype B2C : 9 pages, mock data, design system
  complet, tunnel d’achat fonctionnel sur stub de paiement.
- **Phase 2** — Bascule CMS Sanity, intégration Stripe + CMI Maroc + COD,
  espace B2B, support de l’arabe (RTL).
