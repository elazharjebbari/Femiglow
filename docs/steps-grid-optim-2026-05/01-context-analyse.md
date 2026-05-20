# 01 — Contexte & analyse Kolenda

## 1. Contexte du composant

`FeedStepCard` × 4 — grille « Le rituel en 4 gestes » dans la section
`#product-feed` de `/kit`, **sous** le bloc prix XXL et **au-dessus** du
bandeau 3 promesses + social proof.

```
ProductFeedSection.tsx
├── Hero copy + PriceBlock + PackVisual    (Kolenda §4.6)
├── <ol grid-cols-1 sm:grid-cols-2 lg:grid-cols-4>   ← ICI (§4.7)
│   ├── FeedStepCard 1 — Préparation
│   ├── FeedStepCard 2 — Geste 1 (Paste)
│   ├── FeedStepCard 3 — Geste 2 (Powder)
│   └── FeedStepCard 4 — Polissoir Step 4
├── 3 Claims (leaf · drop · sparkle)
└── Social proof condensé
```

## 2. Rôle dans le funnel conversion

La grille répond à **2 objections post-pricing** :

1. *« Combien de gestes ? Est-ce que je vais savoir le faire ? »*
   → **Trust #4** (réduire l'anxiété d'usage avant l'achat)
2. *« Combien de temps ça va me prendre ? »*
   → **Attention #18** (le temps perçu pèse autant que le prix)

Fonction actuelle : **rassurer** (« ok, c'est 4 gestes, je peux le faire »).
Fonction manquante : **pousser activement** vers le CTA.

## 3. Audit Kolenda — état actuel

### 3.1 Forces (à conserver)

| Principe Kolenda | Présence | Citation du code |
|---|---|---|
| Copy #1 — Present tense | ✅ Fort | « On nettoie, on sèche, on lime légèrement » |
| Copy #2 — Diversify flow | ✅ Bon | Alternance phrases brèves / longues |
| Copy #21 — First step as completed | ✅ Step 4 | « l'ongle devient miroir » |
| Copy #29 — Sensoriel | 🟡 Partiel | « la plaque s'ouvre », « la cire entre », « la lumière revient » |
| Luxury #6 — Craftsmanship | ✅ Discret | Implicite via vocabulaire (« kératine », « lustre lentement ») |
| Visual brand | ✅ | 4 pastilles couleurs reprennent le visuel produit imprimé |

### 3.2 Faiblesses identifiées (W1-W10)

| # | Faiblesse | Principe Kolenda | Impact |
|---|---|---|---|
| **W1** | Aucune **durée** affichée par geste | Attention #18 | 🔴 Élevé |
| **W2** | Aucune **durée totale** au-dessus de la grille | Attention #18 + Pricing #14 | 🔴 Élevé |
| **W3** | Aucun **connecteur visuel** entre les cartes | Attention #12 (directional cues) | 🟡 Moyen |
| **W4** | Aucun **visuel** par carte (texte pur) | Ecom #6 (show don't tell) | 🔴 Élevé |
| **W5** | Aucun **CTA post-grille** | Attention #12 + Pricing #11 | 🟡 Moyen |
| **W6** | Step 4 (résultat final) **noyé** dans la même typo que les 3 autres | Copy #21 + Ecom #14 | 🟡 Moyen |
| **W7** | **Aucun tracking** (view, complete, click) | Mesurabilité | 🔴 Élevé |
| **W8** | Aucune **animation reveal** | Attention #2 (movement attracts) | 🟢 Faible |
| **W9** | Mobile : 4 cartes empilées sans rythme → **scroll long** | UX mobile | 🟡 Moyen |
| **W10** | Aucun **éditable admin** (durée, copy, résultat) — toute modif passe par git | Agilité éditoriale | 🟡 Moyen |

## 4. Hypothèses conversion

| Hypothèse | Référence | Lift estimé |
|---|---|---|
| Afficher « EN TOUT 5 minutes » réduit l'anxiété temps → +scroll-through | Attention #18 | +10 à +15 % scroll-through |
| Connecteur timeline → guide l'œil → +temps section | Attention #12 | +30 à +50 % temps section |
| Outcome step 4 mis en évidence (italique + anneau) → memorisation résultat | Copy #21 | +5 à +10 % mémorisation résultat |
| PostCtaLink post-grille → relance funnel | Attention #12 | +3 à +6 % CTR commande |
| 4 micro-icônes SVG par step → ancrage visuel | Ecom #6 | +5 % temps section |
| Tracking IO → mesure du taux complétion → optim itérative | KPI | mesure |

**Hypothèse combinée** : +8 à +14 % de CTR « Commander le rituel » via
l'effet halo « rituel concret · 5 minutes · facile · résultat clair ».

## 5. Score Kolenda actuel vs cible

| Catégorie | Actuel | Cible J+30 |
|---|---|---|
| Voix / copy | 4/5 | 5/5 (italique outcome, sinon inchangé) |
| Structure visuelle | 2/5 | 5/5 (timeline, durées, icônes) |
| Pousseurs conversion | 0/5 | 4/5 (CTA + tracking) |
| Adaptabilité éditoriale | 0/5 | 4/5 (override admin G5) |
| **TOTAL** | **6/20** | **18/20** |

## 6. Risques

| Risque | Probabilité | Mitigation |
|---|---|---|
| Refonte trop chargée → casse la voix « lente » FemiGlow | Faible | Icônes stroke fin, durées en `tabular-nums` discrètes, animations soft-pulse `motion-safe` uniquement |
| Connecteur visuel cassé en RTL ou viewport extrême | Moyen | Tests responsive 320 / 375 / 768 / 1280 + axe a11y |
| Surcoût Lighthouse (animation Framer Motion) | Faible | `LazyMotion` déjà adopté, `useReducedMotion` désactive auto |
| Override admin complique le builder | Faible | Pattern singleton miroir `kit-pack` (déjà éprouvé) |
| Hydration mismatch RSC/Client sur Reveal | Moyen | Pattern Reveal éprouvé sur composition / pack, tests E2E |

## 7. Alignement avec les refontes précédentes

- Section composition (§4.3 + §4.5) : déjà refondue avec `Reveal`,
  `MediaCrossfade`, `NumberBadge`. La grille pack reprend la `pastille
  numérotée colorée` du même vocabulaire.
- Section vidéo (§4.4) : utilise `VideoChapters` (mini-timeline cliquable
  sous le player). Notre `StepsTimeline` reprend cette grammaire timeline.
- Section pack (§4.6) : `PriceBlock` émet déjà 4 events tracking ; on aligne
  notre nouveau composant sur le même registre `pack_*`.
