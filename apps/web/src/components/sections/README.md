# `components/sections/` — Sections de page

Composants de niveau « section » utilisés par les pages marketing
(`/kit`, `/blog`, etc.). Chaque section est typiquement un Server
Component (RSC) qui consomme des données déjà résolues côté serveur,
avec des sous-composants Client (`PriceBlock`, `PackSectionTracker`, …)
pour les interactions et IntersectionObserver.

## Section `/kit` — « Le Pack » (Kolenda §4.6)

Refonte mai 2026 — plan : [`docs/pack-section-optim-2026-05/`](../../../../../docs/pack-section-optim-2026-05/).

### Inventaire

| Composant | Type | Rôle |
|---|---|---|
| `ProductFeedSection.tsx` | Server | Section racine : layout 2 colonnes (texte gauche, packshot droite sur md+, 1 colonne mobile avec packshot au-dessus). Conserve grille 4 steps + 3 claims + social proof complet. |
| `ProductFeedSectionBound.tsx` | Server | Wrapper RSC qui résout le `ProductFeed` via `resolveKitPack()` (cascade override-publié → mock) puis délègue. |
| `PriceBlock.tsx` | Client | Bloc prix Kolenda §4.6 : prix XXL + prix barré + bandeau économie terracotta + ValueBreakdownList + perUsageHint + CTA primaire + social proof condensé + microcopy. IO émet `pack_section_view`, `pack_economy_view`, `pack_social_proof_view`. |
| `ValueBreakdownList.tsx` | Server | Liste verticale label · valueLabel avec items `muted` rendus en italique opacity. |
| `PackVisual.tsx` | Server | Packshot `<figure><img>` avec aspect-[4/5] et loading lazy. |

### Helpers associés (lib/kit/pack/)

| Module | Rôle |
|---|---|
| `lib/kit/pack/savings.ts` | `computePackSavings(priceFinal, priceCompareAt)` retourne `{eur, pct}` ou `null`. + `formatSavingsLabel`. |
| `lib/kit/pack/per-usage.ts` | `buildPerUsageHint(priceCents, days)` retourne `« ≈ 0,75 € par soin sur 30 jours »` ou `null`. |
| `lib/kit/pack/types.ts` | `KitPackOverride`, `KitPackOverridePatch`, `ResolvedKitPack`, `KitPackSource`. |
| `lib/kit/pack/store.ts` | memoryStore via `ext()` clé `kit:pack`. `get / upsert / publish / unpublish / reset`. |
| `lib/kit/pack/resolver.ts` | `resolveKitPack()` (publié) + `resolveKitPackDraft()` (admin preview). `KIT_PACK_TAG = 'kit-pack'`. |
| `lib/kit/pack/schemas.ts` | `kitPackOverrideUpsertSchema` Zod (8 mots min sur microcopy). |

### Admin

`/admin/kit/pack` (singleton) — `apps/web/src/app/admin/kit/pack/page.tsx`.
Composant : `KitPackEditor` (`components/admin/kit-pack/`).

Routes API : `GET / PATCH /api/admin/kit/pack`, `POST /publish`, `POST /reset`.

Magic word reset : `RESET-PACK`. Audit actions :
- `kit_pack.update`
- `kit_pack.publish`
- `kit_pack.reset`

### Tracking

4 events émis automatiquement par `PriceBlock` (IO seuil 0.3 / 0.5) +
`CommanderAnchorButton` (au click) :

| Event | Trigger | Params |
|---|---|---|
| `pack_section_view` | IO 0.3 sur PriceBlock | `{has_visual, layout}` |
| `pack_economy_view` | IO 0.5 (si savings) | `{savings_eur, savings_pct}` |
| `pack_social_proof_view` | IO 0.5 (si socialProof) | `{rating, count, label_used: 'geo' | 'count'}` |
| `pack_cta_click` | Click CTA + source=pack_section | `{source, cta_label, cta_accent}` |

### Conventions

- **Apostrophe** : `’` U+2019 dans JSX (pas l'ASCII `'`).
- **Tailwind opacity-modifier sur CSS var** : ne fonctionne PAS sur
  `bg-encre/X` (var CSS). Utiliser un color literal `bg-[#C28A6E]/X`
  (bandeau terracotta).
- **`ctaAccent` optionnel** : fallback `champagne` (= variant primary natif).
  `sauge-dark` active aussi `motion-safe:animate-soft-pulse` (3.5 s, 2 %).
- **`prefers-reduced-motion`** : Tailwind `motion-safe:` désactive auto.
- **`countLabelGeo` prioritaire** sur `${reviewsCount} avis` (fallback).
- **Le builder `kit-feed.ts` reste pur** : le feed XML Merchant Google
  Shopping ne lit JAMAIS l'override admin (décision sécurité — cf.
  `docs/pack-section-optim-2026-05/04-backend-design.md`).
- **Magic word reset** : `RESET-PACK`. Différent par section
  (`RESET-VIDEO`, `RESET-COMPOSITION-{ID}`) pour éviter les confusions.

### Tests

- Tous les composants ont leur propre `*.test.tsx` co-localisé.
- Helpers `lib/kit/pack/*` couverts : `savings` (9), `per-usage` (5),
  `store` (10), `resolver` (8) — couverture ≥ 90 % branches visée.
- `PriceBlock` 16 cas, `ValueBreakdownList` 6 cas, `PackVisual` 6 cas,
  `KitPackEditor` 11 cas, `CommanderAnchorButton` 6 cas.
- E2E Playwright : `e2e/pack-section.spec.ts` (5 cas) +
  `e2e/admin-kit-pack.spec.ts` (5 cas) — tags `@pack-*`.

### Roadmap

- **Itération suivante** : éditeur live `ValueBreakdownEditor` (add/remove
  items) + `KitPackPreviewCard` (preview live du bloc dans l'admin).
- **A/B testing** : si KPIs J+30 non atteints, dossier
  `docs/pack-section-iter-2026-06/` pour variantes (CTA accent, position
  packshot, libellé social proof).
- **Self-hosted packshot** : remplacer SVG par PNG/WebP raster pour
  Lighthouse score (le SVG actuel pèse < 30 kB, donc non bloquant).

## Référence

- Plan complet pack section : [`docs/pack-section-optim-2026-05/`](../../../../../docs/pack-section-optim-2026-05/)
- Playbook Kolenda : [`docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`](../../../../../docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md) §4.6
- Section composition : [`components/kit/README.md`](../kit/README.md)
