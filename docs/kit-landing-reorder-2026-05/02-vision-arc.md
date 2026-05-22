# 02 — Vision & Arc Kolenda

## Principe directeur

L'utilisateur doit **VOIR** (composition, vidéo, pack, témoignages) avant de **PASSER COMMANDE** (wizard). Aujourd'hui le wizard est en position 3 — il commande à froid.

## Structure v2 (11 sections)

```
┌─────────────────────────────────────────────────┐
│  ARC ÉMOTIONNEL — hero → preuve → décision     │
├─────────────────────────────────────────────────┤
│  1.  GeoPromoSlideHeaderSlot       [HEADER]     │  Bandeau promo géo
│  2.  HeroProduitBound              [HERO]       │  Premier contact
│  ─────────── PREUVE ─────────────                │
│  3.  CompositionRevealBound §4.3   [PREUVE 1]   │  Trois piliers
│  4.  VideoPlayer4GestesKitBound    [PREUVE 2]   │  Usage in vivo
│  5.  ProductFeedSectionBound §4.6/7 [PREUVE 3]  │  Pack + Steps refonte
│  6.  HandsTestimonialsBound        [PREUVE 4]   │  Social proof mains
│  ─────────── DÉCISION ───────────                │
│  7.  KitCommanderSectionBound ⭐   [WIZARD]     │  Commande WARM
│  ─────────── DÉTAIL & SOCIAL ────                │
│  8.  IngredientsDetailsBound §4.5  [DETAIL]     │  Approfondissement
│  9.  RitualsModuleBound            [SOCIAL]     │  ⭐ Voix de la maison (47 avis)
│  10. FAQContextuelle               [OBJECTIONS] │  Levée d'objections
│  11. JournalGridBound              [BOTTOM]     │  Pour aller plus loin
│  ⏷ RitualsWallDrawer (overlay)                  │  Drawer Suspense
└─────────────────────────────────────────────────┘
```

## Sections retirées (2)

| Section | Raison du retrait | Migration |
|---|---|---|
| `ComparatifSectionBound` | Le tableau §4.7 Steps couvre déjà la comparaison avec/sans vernis. | Vérifier qu'aucun argument unique du Comparatif manque dans Steps. Sinon enrichir Steps (1 ligne CMS). |
| `PivotFinal` | Le wizard EST le CTA final — double CTA inutile. | Le sticky top GeoPromoSlideHeaderSlot prend le relais. |

## Section conservée vs hypothèse initiale

| Section | Raison | Position v2 |
|---|---|---|
| `RitualsModuleBound` | C'est le bloc social proof à grande échelle (47 rituels partagés en DB) — **c'est lui qui alimente le compteur du badge avis hero** + son ancre. Le retirer casserait le tunnel social proof. | Position 9 (post-wizard, pré-FAQ) |

## Pourquoi cette réorganisation ?

### Le wizard remonte à position 6 (pas 3)

- **À 3** : utilisateur cold, n'a vu QUE le hero. Commande sans preuves.
- **À 6** : utilisateur warm, a parcouru :
  - Composition (qualité formule)
  - Vidéo 4 gestes (usage simple)
  - Pack + Steps (transparence prix)
  - Témoignages mains (proof visuelle)
  
Conversion d'un public **informé**, pas impulsif. Ticket moyen plus stable.

### IngredientsDetails passe en 8 (pas 6)

- À 6 (actuel) : interrompt l'arc avant le wizard
- À 8 (v2) : approfondissement **après** commande (sert ceux qui hésitent encore)

### FAQ remonte à 9

Levée d'objection juste avant Journal (bottom funnel). L'utilisateur qui scrolle jusqu'ici est en hésitation — FAQ doit être présent.

## Sticky CTA mobile (non ajouté en v2)

> **Révision 2026-05-22** : pas de sticky CTA bottom ajouté. Raison : le
> `GeoPromoSlideHeaderSlot` (top sticky existant) porte déjà un bouton
> « Commander » mobile. Un sticky bottom en plus créerait un doublon
> visuel + double event `cta_click`.
>
> Si on souhaite tester un sticky bottom en complément du top (a/b split
> sur clic-through rate), prévoir un flag distinct (`NEXT_PUBLIC_KIT_STICKY_BOTTOM`)
> et un composant dédié.

## Garde-fous

- ❌ Aucune réécriture de composant — uniquement réorganisation + retraits
- ✅ Feature flag `NEXT_PUBLIC_KIT_LAYOUT_V2` — par défaut `false` (v1 préservé)
- ✅ Tracking préservé (event IDs stables)
- ✅ Composants retirés en v2 **conservés** dans le repo (rollback trivial)
