# Refonte « LE PACK · Le rituel s'installe… » — mai 2026

Plan d'action exhaustif pour la refonte de la **2ᵉ zone de conversion** de
`/kit` (section `#product-feed`, composant `ProductFeedSection`). Vise à
appliquer **les principes Pricing Kolenda manqués** (économie absolue
terracotta, reframing valeur d'usage, valeur séparée, hiérarchie prix
forte) et à renforcer l'attention visuelle (packshot + reveal + micro-pulse
CTA).

Cible Kolenda : **§4.6 Le pack** — supporté par §3.7 Pricing (38 tactiques)
+ §3.1 Attention + §3.2 Color + §3.3 Copywriting.

## Sommaire

| # | Document | Rôle |
|---|---|---|
| 01 | [Contexte & analyse](01-context-analyse.md) | Audit existant, scoring Kolenda §4.6 (5/14 OK), forces/faiblesses |
| 02 | [Vision & objectifs](02-vision-objectifs.md) | KPIs cibles, hypothèses conversion +10 à +18 % CTR CTA |
| 03 | [Data model](03-data-model.md) | Extension `ProductFeed` (valueBreakdown, savings, perUsageHint, ctaSauge…) |
| 04 | [Backend design](04-backend-design.md) | Resolver cascade override → mock (admin singleton), 4 routes API |
| 05 | [Frontend public design](05-frontend-public-design.md) | Refactor `ProductFeedSection` : bloc prix densifié, packshot, reveal |
| 06 | [Admin UI/UX design](06-admin-ui-ux-design.md) | Éditeur `/admin/kit/pack` (singleton, override copy + chiffres) |
| 07 | [Tests strategy](07-tests-strategy.md) | Vitest + MSW + Playwright + axe, couverture ≥ 90 % |
| 08 | [Plan d'action par phases](08-plan-action-phases.md) | 7 phases ordonnées avec gates |
| 09 | [Runbook d'exécution](09-runbook-execution.md) | Procédure pas-à-pas avec rollback par phase |
| 10 | [Acceptance criteria](10-acceptance-criteria.md) | Checklist exhaustive + show stoppers |

## Périmètre

**Inclus** :
- Bloc prix densifié Kolenda Pricing : valeur séparée → 390 barré → 199 (taille XXL) → « Économie 191 MAD » terracotta → reframing « ≈ 1,5 MAD/manucure · ≈ 1 200 MAD/an salon »
- CTA : label « Commander le rituel », couleur sauge profond `#4A5D4A`, micro-pulse `scale 1.02` 3-4 s (respect `prefers-reduced-motion`)
- Social proof libellé géographique : « 287 femmes · Rabat, Casablanca, Marrakech »
- Packshot 3 produits au-dessus du bloc prix (réutilise `/products/kit-principale.svg`)
- Reveal animations sur 4 step cards et 3 claims (slide-up 30 px + fade, 600 ms, slow-motion Luxury §7)
- Admin éditeur `/admin/kit/pack` singleton pour piloter ces lignes sans dev
- Tests vitest + MSW + Playwright + axe

**Exclus** (backlog) :
- A/B testing infrastructure (Ordre 3 différé)
- Sous-notes multi-dimensions reviews (Tenue · Brillance · Facilité)
- Tags chips sous citation (« rituel devenu habitude »…)
- Which-to-choose mindset (« Ce soir / Ce weekend / Avant le printemps »)
- Réponses signées « FemiGlow » sous les avis

## Cibles métier

| KPI | Baseline | Cible 30 j |
|---|---|---|
| **CTR « Commander le rituel »** depuis `#product-feed` | ~6 % | **≥ 8 %** |
| **Conversion attribuable** à la section | ~12 % | **≥ 15 %** |
| **Temps moyen** sur section | ~8 s | **≥ 14 s** |
| **Scroll-through** section → comparatif | ~62 % | **≥ 72 %** |
| **Vue social proof** (% qui voit le bandeau) | ~45 % | **≥ 70 %** (rapprochement CTA) |
| Axe a11y `#product-feed` | inconnu | **0 violation** sérieuse/critique |

## Effort total estimé

**~3,5 jours-homme** répartis sur 7 phases :

| Phase | Durée | Risque |
|---|---|---|
| 0 — Quick wins Pricing (économie + reframing + valeur séparée + hiérarchie) | 0,5 j | Très faible |
| 1 — CTA refonte (label + sauge + micro-pulse) | 0,25 j | Très faible |
| 2 — Social proof libellé + position | 0,25 j | Très faible |
| 3 — Packshot + reveal animations | 1 j | Moyen (asset DA validation) |
| 4 — Admin éditeur singleton `/admin/kit/pack` | 0,75 j | Moyen |
| 5 — E2E Playwright + axe | 0,5 j | Faible |
| 6 — Handoff README + cleanup | 0,25 j | Très faible |

## Réutilisation

Réutilise :
- `CommanderAnchorButton` existant (juste re-style)
- Pattern admin singleton (`KitVideoEditor`, `KitCompositionEditor`)
- Resolver cascade override → mock (cf. `lib/kit/video/resolver.ts`, `lib/kit/composition/resolver.ts`)
- DOMPurify isomorphique (déjà installé)
- Framer Motion `LazyMotion` + `useReducedMotion` (cf. composition `Reveal`)
- Pattern `/products/kit-principale.svg` (déjà rendu sur cover vidéo)

## Source de vérité

- Playbook : [`docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`](../kolenda/FEMIGLOW-KIT-PLAYBOOK.md) §4.6 + §3.7 Pricing + §3.1 Attention + §3.2 Color + §3.3 Copywriting
- Composant cible : [`apps/web/src/components/sections/ProductFeedSection.tsx`](../../apps/web/src/components/sections/ProductFeedSection.tsx)
- Builder copy : [`apps/web/src/lib/products/feed/kit-feed.ts`](../../apps/web/src/lib/products/feed/kit-feed.ts)
- Plans miroirs : [`docs/video-gestes-optim-2026-05/`](../video-gestes-optim-2026-05/), [`docs/ingredients-detail-optim-2026-05/`](../ingredients-detail-optim-2026-05/), [`docs/composition-reveal-optim-2026-05/`](../composition-reveal-optim-2026-05/)
