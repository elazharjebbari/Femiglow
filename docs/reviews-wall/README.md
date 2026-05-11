# Reviews Wall FemiGlow — dossier complet

Ce dossier est le **blueprint exhaustif** d'un mur de témoignages (« Rituels partagés ») conçu pour FemiGlow. Il prend appui sur le travail antérieur réalisé pour Baiti (`draft/baiti_reviews_wall_blueprint/`) et le **réinscrit dans la charte FemiGlow** : voix « maison / rituel / initiée », palette sauge / crème / encre, refus des étoiles 1-5, refus des emoji, refus des visages, anchoring prix 199 / 390 dh.

L'objectif est double :

1. Construire un **outil de conversion** mesurable (target : ×1,3 sur l'add-to-cart de `/kit`, +12 pts sur la confiance perçue).
2. Préserver l'**identité éditoriale de la maison** : un témoignage n'est pas un avis-étoile, c'est un fragment de rituel partagé par une initiée.

## Plan du dossier

| # | Fichier | Sujet |
| --- | --- | --- |
| — | `README.md` | Index, méthode |
| 01 | [`01-recherche-bonnes-pratiques.md`](01-recherche-bonnes-pratiques.md) | 25 heuristiques de walls de conversion (synthèse Baiti + littérature) |
| 02 | [`02-contraintes-femiglow.md`](02-contraintes-femiglow.md) | Contraintes marque + Kolenda + ce qui n'est PAS transposable |
| 03 | [`prototypes/prototype-A-paroi-narrative.md`](prototypes/prototype-A-paroi-narrative.md) | Prototype A — drawer narratif éditorial |
| 04 | [`prototypes/prototype-B-cartographie-rituels.md`](prototypes/prototype-B-cartographie-rituels.md) | Prototype B — cartographie par tags rituels |
| 05 | [`prototypes/prototype-C-mur-editorial-filtre.md`](prototypes/prototype-C-mur-editorial-filtre.md) | Prototype C — page complète éditoriale type journal |
| 06 | [`prototypes/matrice-comparative.md`](prototypes/matrice-comparative.md) | Matrice critères × prototypes, forces / faiblesses, recommandation |
| 07 | [`07-proposition-finale.md`](07-proposition-finale.md) | Description complète de la proposition retenue |
| 08 | [`08-architecture-data.md`](08-architecture-data.md) | Modèle de données Drizzle + Zod, contrats API |
| 09 | [`09-interface-publique.md`](09-interface-publique.md) | UI front : layout, composants, états, comportements |
| 10 | [`10-interface-admin.md`](10-interface-admin.md) | Back-office : queue, détail, actions, audit |
| 11 | [`11-wizard-soumission.md`](11-wizard-soumission.md) | Wizard de dépôt en 3 étapes (initiée → wizard → confirmation) |
| 12 | [`12-microcopy-voix.md`](12-microcopy-voix.md) | Microcopy complet (40+ chaînes), do/don't, voix maison |
| 13 | [`13-animations-motion.md`](13-animations-motion.md) | Easings, durées, slow motion, `prefers-reduced-motion` |
| 14 | [`14-accessibilite-ergonomie.md`](14-accessibilite-ergonomie.md) | WCAG 2.2 AA, focus, clavier, lecteurs d'écran, mobile |
| 15 | [`15-performance-loading.md`](15-performance-loading.md) | Pagination, lazy load, ETag, budget Web Vitals |
| 16 | [`16-tracking-analytics.md`](16-tracking-analytics.md) | Catalogue d'événements, dataLayer, agrégation insights |
| 17 | [`17-moderation-workflow.md`](17-moderation-workflow.md) | SLA, auto-flags, vision ML pour visages, audit log |
| 18 | [`18-roadmap-execution.md`](18-roadmap-execution.md) | 3 jalons, charge, DoD, métriques avant / après |
| — | `annexes/glossaire.md` | Termes du dossier |
| — | `annexes/decisions-design-tokens.md` | Tokens CSS spécifiques (couleurs des chips, etc.) |
| — | [`execution/`](execution/README.md) | **Sous-dossier opérationnel** : runbook, architecture détaillée, plans backend/frontend/admin, spec UI wizard, catalogues de tests Jest/MSW/Playwright, debug, évolutivité, **système d'import + bulk management** |

## Comment lire ce dossier

**Pour décider** : lire 01 → 02 → matrice comparative → proposition finale (07).

**Pour implémenter** : lire 07 → 08 (data) → 09 (front) → 11 (wizard) → 10 (admin) → 12 (microcopy) → 18 (roadmap).

**Pour passer en revue** : 13 (motion), 14 (a11y), 15 (perf), 16 (tracking), 17 (modération) sont des chapitres de qualité transverses.

## Nom du composant — décision

Le composant ne s'appelle **pas** « Reviews Wall » côté utilisateur. C'est un nom de travail interne. Côté UI : **« Rituels partagés »**. Côté code : `RitualsWall` / `ritual-wall-*`. Cette translation linguistique est l'un des piliers de l'alignement charte / produit (cf. `02-contraintes-femiglow.md` § 2.3).

## Pré-requis lecture

- `docs/audit/04-charte-architecture.md` — palette, typo, motifs
- `docs/audit/05-pages-b2c.md` — gabarit des sections existantes
- `docs/audit/09-guide-modifications-detaille.md` — guide voix « initiée »
- `docs/preparation/01-marque-vision-voix.md` — voix maison
- `docs/kolenda/*.pdf` — heuristiques de conversion
- `draft/baiti_reviews_wall_blueprint/` — référence research (à ne pas implémenter telle quelle)

## Convention rédaction

- Français, accents soignés, apostrophes courbes, em-dashes littéraux.
- Aucun emoji.
- Citations file:line quand un appui de code est utile.
- Tableaux préférés aux listes longues pour les inventaires.
- Toute heuristique Kolenda mobilisée est citée par son code (K-LUX-03, K-PRI-01, etc., référencés dans `docs/audit/09-guide-modifications-detaille.md`).
