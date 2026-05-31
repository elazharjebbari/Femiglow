# 02 — Vision & Arc Kolenda

## Principe directeur

L'utilisateur doit **VOIR** (composition, vidéo, pack, témoignages) avant de **PASSER COMMANDE** (wizard). Aujourd'hui le wizard est en position 3 — il commande à froid.

## Structure v2 (11 sections)

```
┌─────────────────────────────────────────────────┐
│  ARC KOLENDA — hero → preuve → décision → reass │
├─────────────────────────────────────────────────┤
│  1.  GeoPromoSlideHeaderSlot       [HEADER]     │  Bandeau promo géo
│  2.  HeroProduitBound              [HERO]       │  1ère zone conversion
│  ─────────── PREUVE ─────────────                │
│  3.  CompositionRevealBound §4.3   [PREUVE 1]   │  Trois piliers
│  4.  VideoPlayer4GestesKitBound    [PREUVE 2]   │  Usage in vivo
│  5.  ProductFeedSectionBound §4.6/7 [PACK]      │  Densité commerciale
│  ─────────── DÉCISION ───────────                │
│  6.  KitCommanderSectionBound ⭐   [WIZARD]     │  2ème zone conv (§4.6)
│  ─────────── RÉASSURANCE ────────                │
│  7.  HandsTestimonialsBound §4.10  [POST-COMMIT]│  Trois mains avant/après
│  8.  IngredientsDetailsBound §4.5  [DETAIL]     │  Approfondissement
│  9.  RitualsModuleBound §4.8       [SOCIAL]     │  ⭐ Voix de la maison (47 avis)
│  10. FAQContextuelle §4.9          [OBJECTIONS] │  Levée d'objections
│  11. JournalGridBound §4.12        [BOTTOM]     │  Pour aller plus loin
│  ⏷ RitualsWallDrawer (overlay)                  │  Drawer Suspense
└─────────────────────────────────────────────────┘
```

## Position optimale du wizard — Kolenda §4.6

> **Citation playbook** (`docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §4.6 « Le pack ») :
> *« c'est la **deuxième zone de conversion** de la page. Tout doit converger
> vers la décision. »*

Le wizard est donc placé **immédiatement après le ProductFeed (§4.6 + §4.7)** :

| Position | Section | Logique Kolenda |
|---|---|---|
| 5 | Pack + Steps §4.6/§4.7 | Densité commerciale (prix, économie 191 MAD, value-per-manucure, trust row) |
| **6** | **WIZARD ⭐** | **2ème zone de conversion — matérialise la décision préparée par §4.6** |
| 7 | HandsTestimonials §4.10 | Réassurance post-décision pour les hésitants |

### Pourquoi pas position 3 (v1) ?
- Commande « à froid » avant que l'utilisateur n'ait compris ce qu'il achète.
- Kolenda §5 W1 anti-pattern explicite.

### Pourquoi pas position 7 (après HandsTestimonials) ?
- 5 sections de preuve avant le wizard = scroll fatigue (Kolenda §1.3).
- §4.6 dit explicitement « 2ème zone de conversion » → le wizard DOIT être là.
- HandsTestimonials est meilleur en réassurance post-clic (deuxième chance) qu'en preuve avant clic.

### Pourquoi pas tout en haut (sous hero) ?
- L'utilisateur n'a pas encore vu la composition, l'usage, le prix complet.
- Conversion sur des utilisateurs non-qualifiés → taux d'abandon élevé en cours de wizard.

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
