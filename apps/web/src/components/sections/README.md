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
| `PackVisual.tsx` | Server | Packshot `<figure><img>` SVG fallback (aspect-[4/5], loading lazy). Utilisé en mode statique / tests unitaires. |
| `PackVisualBound.tsx` | Server (RSC) | Wrapper qui délègue à `<ComponentMedia componentKey="kit-pack-visual" slot="primary">` — variantes AVIF/WebP/JPEG multi-breakpoints + blurhash + sizes responsive. Fallback SVG automatique via `defaultSvgFallback` du registry si binding désactivé. |

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

### Packshot Components-CMS (depuis Pack Visual A→F)

Le slot `kit-pack-visual/primary` du Components-CMS pilote l'image
affichée :

- **Canon par défaut** : `docs/images/values/kit/kit-pack-shot.png` →
  binding `autoActivate: true` dans `src/lib/components/seed-mapping.ts`.
  Un re-seed (`pnpm tsx scripts/seed-components.ts`) restaure ce canon
  même si l'admin l'a désactivé.
- **Catalogue media** : l'image est optimisée par `seed-media` →
  variantes AVIF/WebP/JPEG par breakpoint (sm/md/lg/xl/2xl), blurhash,
  palette, phash auto-calculés.
- **Admin** : `/admin/components` → `kit-pack-visual/primary` permet de :
  - pointer le slot vers n'importe quel autre media du catalogue,
  - désactiver le binding (le SVG fallback prend le relais),
  - ajuster l'alt text, le focal point, l'object-fit.
- **Reset** : `POST /api/admin/seeders/run` (ou re-seed CLI) restaure le
  canon `kit-pack-shot.png`.

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

## Section `/kit` — « Le rituel en 4 gestes » (Kolenda §4.7)

Refonte mai 2026 — plan : [`docs/steps-grid-optim-2026-05/`](../../../../../docs/steps-grid-optim-2026-05/).

### Inventaire

| Composant | Type | Rôle |
|---|---|---|
| `StepsTimeline.tsx` | Client | Wrapper de la grille : IO tracking (`pack_steps_view`, `pack_steps_complete_view`), LazyMotion stagger, encapsule Header + 4 StepCard + Connector + PostCta |
| `StepsHeader.tsx` | Server | En-tête « EN TOUT / 5 minutes / lead » (Attention #18) |
| `StepCard.tsx` | Server | Carte d'un step — pastille, durée, isResult ring + badge + italique, StepIcon optionnel |
| `StepIcon.tsx` | Server | 4 SVG inline stroke 1.5 — `buffer / drop / sparkle / mirror` |
| `StepsConnector.tsx` | Server | Ligne pointillée desktop, timeline verticale mobile — `aria-hidden` |
| `StepsPostCtaLink.tsx` | Client | « Démarrer le rituel ↓ », émet `pack_steps_cta_click` |

### Helpers associés (lib/kit/steps/)

| Module | Rôle |
|---|---|
| `computeTotalDuration(steps)` | Additionne durées parseables (« 30 s », « 1 min »), formate FR |
| `pickResultStep(steps)` | Retourne step `isResult: true` ou dernier par défaut |

### Tracking events (Kolenda §4.7)

| Event | Trigger | Params |
|---|---|---|
| `pack_steps_view` | IO 0.4 sur wrapper section | `{layout, total_steps, total_duration_label}` |
| `pack_steps_complete_view` | IO 0.5 sur step result | `{}` |
| `pack_steps_cta_click` | Click PostCtaLink | `{cta_target}` |

### Décisions de design

- **Position** : grille conservée APRÈS PriceBlock (Option A — rassure post-pricing)
- **Durées** : 30 s · 1 min · 2 min · 1 min = 5 min total (NBSP entre nombre et unité)
- **Outcome step 4** : anneau doublé champagne + badge RÉSULTAT + description italique Cormorant
- **CTA** : lien éditorial chuchoté (style identique `PostCtaLink` composition)
- **Reveal stagger** : `delay = i * 0.08`, `duration = 0.5s`, `ease = [0.22, 1, 0.36, 1]`
- **`prefers-reduced-motion`** : désactive entièrement le wrapper `m.div`

### Roadmap

- **G5 admin override** : éditeur singleton `/admin/kit/steps` (optionnel, J+30)
- **A/B test position** : grille AVANT le PriceBlock (option B) si KPIs J+30 sous cibles

## Référence

- Plan complet pack section : [`docs/pack-section-optim-2026-05/`](../../../../../docs/pack-section-optim-2026-05/)
- Plan complet steps grid : [`docs/steps-grid-optim-2026-05/`](../../../../../docs/steps-grid-optim-2026-05/)
- Playbook Kolenda : [`docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`](../../../../../docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md) §4.6 + §4.7
- Section composition : [`components/kit/README.md`](../kit/README.md)
