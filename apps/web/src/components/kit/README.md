# `components/kit/` — Composants dédiés à la page `/kit`

Composants extraits ou créés pour la refonte de la section « La composition »
selon le playbook Kolenda (`docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §4.3) et
le plan d'action `docs/composition-reveal-optim-2026-05/`.

## Inventaire

| Composant | Rôle | Source |
|---|---|---|
| `CompositionCard.tsx` | Card individuelle d'un sous-produit (pastille numérotée, image, titre+volume inline, description, sensation italique, lien profondeur INCI). Remplace `commerce/ProductCard` (supprimé phase 8). | Kolenda §4.3 |
| `NumberBadge.tsx` | Pastille typographique 36×36 avec couleur d'accent (sauge/petale/ciel/champagne), `aria-hidden`. | Kolenda §4.3 + Annexe A |
| `SensationLine.tsx` | `<p>` italique Cormorant Garamond text-encre/70 pour la phrase de sensation. | Kolenda §4.3 + UX §13 |
| `MediaCrossfade.tsx` | Crossfade isolated ↔ contextual au hover desktop / tap mobile / clavier (Enter/Space). Respecte `prefers-reduced-motion`. | Kolenda §4.3 + Ecommerce §6 |

## Helpers associés

| Module | Rôle |
|---|---|
| `@/lib/composition/copy.ts` | Fonctions pures : `buildCardHeader`, `formatSensation`, `formatIndex`, `resolveAccentHex`. |

## Conventions

- **Pas d'apostrophe ASCII (`'`) dans les chaînes JSX**. Utiliser `’` (U+2019) ou échapper `\'` si nécessaire (`prettier` peut le faire pour vous).
- **Toujours passer `index` à `CompositionCard`** pour que la pastille numérotée soit cohérente avec l'ordre de la liste.
- **`accentColor` est optionnel**. Le fallback automatique est `champagne` (`#B8956B`).
- **`sensation` est optionnel**. Si absent du SubProduct, la `SensationLine` n'est pas rendue.
- **`contextualImage` est optionnel**. Si absent, `MediaCrossfade` désactive son interaction.

## Tests

- Tous les composants ont leur propre `*.test.tsx` co-localisé.
- Helpers `lib/composition/copy.ts` couverts par `copy.test.ts` (15 cas).
- Couverture cible : ≥ 85 % branches (cf. `docs/composition-reveal-optim-2026-05/07-tests-strategy.md`).

## Roadmap

- **Phase 6 (à venir)** : éditeur admin `/admin/kit/composition/[id]` qui pilote nom, volume, description, sensation, ingrédients, certifications, image isolated et contextuelle.
- **Phase 7 (à venir)** : E2E Playwright + a11y axe pour figer le rendu et les interactions.

## Référence

- Plan d'action complet : [`docs/composition-reveal-optim-2026-05/`](../../../../../docs/composition-reveal-optim-2026-05/).
- Playbook Kolenda : [`docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`](../../../../../docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md) §4.3.
