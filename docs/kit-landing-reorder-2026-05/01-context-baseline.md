# 01 — Contexte & Baseline

## Inventaire actuel `/kit` — 14 sections

Fichier : `apps/web/src/app/(marketing)/kit/page.tsx`

```
┌──────────────────────────────────────────────────┐
│  1.  GeoPromoSlideHeaderSlot                     │  Header (sticky promo)
│  2.  HeroProduitBound                            │  ⭐ Hero produit
│  3.  KitCommanderSectionBound                    │  ⚠️ Wizard pos. 3 (cold)
│  4.  CompositionRevealBound       (§4.3)         │  Preuve 1
│  5.  VideoPlayer4GestesKitBound                  │  Preuve 2
│  6.  IngredientsDetailsBound      (§4.5)         │  Detail
│  7.  ProductFeedSectionBound      (§4.6/§4.7)    │  ⭐ Pack + Steps
│  8.  ComparatifSectionBound                      │  ❌ Redondant
│  9.  RitualsModuleBound                          │  ❌ Redondant FAQ
│  10. FAQContextuelle                             │  Objections
│  11. HandsTestimonialsBound                      │  Social proof
│  12. PivotFinal                                  │  ❌ Double CTA
│  13. JournalGridBound                            │  Bottom funnel
│  14. RitualsWallDrawer                           │  Overlay (Suspense)
└──────────────────────────────────────────────────┘
```

## Frictions Kolenda identifiées

### P1 — Wizard à froid (CRITIQUE)
**Section** : `KitCommanderSectionBound` en position 3.
**Problème** : l'utilisateur n'a pas encore reçu de proof (composition, vidéo, témoignages). Conversion à froid.
**Référence** : Kolenda §5 W1 — *« commander avant d'avoir compris »*
**Impact estimé** : -15% conv rate.

### P2 — Doublons FAQ
**Sections** : `FAQContextuelle` + `RitualsModuleBound` chevauchent.
**Problème** : objections similaires traitées 2 fois. Charge cognitive.
**Référence** : Kolenda §3.4 *« une question = un endroit »*.

### P3 — Narrative fragmentée
**Sections** : Composition → Vidéo → Ingrédients → Pack → Comparatif → Rituels.
**Problème** : pas d'arc émotionnel cohérent. Rebond mi-page.
**Référence** : Kolenda §2.1 *« hero → preuve → décision »*.

### P4 — Page trop longue (mobile)
**Constat** : 14 sections ≈ 6× viewport height en mobile. Scroll fatigue avant `PivotFinal`.
**Référence** : Kolenda §1.3 *« 5-7 sections high-impact »*.

## Métriques baseline (à mesurer J-0)

| KPI | Source | Baseline cible |
|---|---|---|
| Conv rate `/kit → lead` | Plausible event `wizard_lead_submit` | ~2.8% (estim.) |
| Scroll depth median | Plausible `scroll_depth` | ~60% |
| Time-to-wizard-view | Plausible `wizard_visible` | ~12s |
| Wizard abandon rate | event `wizard_step_abandoned` | ~38% |
| Bounce rate | Plausible | ~42% |
| Mobile LCP | web-vitals | ~2.4s |
| Mobile CLS | web-vitals | ~0.08 |

> **Action L0** : exporter 7 j de métriques Plausible (CSV) **avant** la bascule flag pour fixer la baseline.

## Forces actuelles (à préserver)

1. **HeroProduit** — refonte mai 2026 (Kolenda §4.6), bien calibré
2. **ProductFeedSectionBound (Pack/Steps)** — refonte §4.7 récente + image kit-pack-shot.png par défaut
3. **Wizard embed** — refonte W0-W4 (CTA outcome, NoCommitmentBadge, TimeEstimate, mini cart-recap, phone mask, ResumeBanner)
4. **Hands testimonials** — proof visuelle forte
