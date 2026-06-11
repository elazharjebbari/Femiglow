# 01 — Conception UX / UI / design / graphique

## 1. Parti-pris (la résolution)

On **n'ajoute pas un nouveau bloc**. On **enrichit le récap panier existant** (`WizardCartRecap`) d'une **ligne éditoriale calme** qui met en récit la remise déjà affichée. Raisons :
- Respecte « un coupon, un endroit, une histoire de prix » (coupon-doc) et « une zone saillante par viewport » (Kolenda).
- Le récap est **déjà adossé** au prix, au barré et (mobile) sticky en haut du wizard → la mention voyage avec la décision.
- Zéro friction : pas de champ, pas d'action requise.

## 2. Anatomie de la mention (composant `WizardWelcomeCouponLine`)

Insérée dans le récap, **sous** la ligne prix/barré, **au-dessus** de la trust row :

```
Geste d'accueil appliqué · Économie 90 MAD
```

- « Geste d'accueil appliqué » : texte **encre** (`text-encre`), poids medium, `text-xs`/`sm`.
- Séparateur `·` discret (`text-encre/30`).
- « Économie 90 MAD » : **seul accent chaud** autorisé (Kolenda §4.6) — terracotta `#C28A6E`, `tabular-nums`, sans gras agressif. Économie **absolue**, jamais en %.
- Préfixe optionnel : un **filet/point sauge** (puce `•` sauge `#A8B89E`) en tête de ligne pour signaler « avantage maison » sans icône bruyante.
- Pas d'encadré lourd : la ligne s'intègre, séparée par un **filet fin** (`border-encre/10`) du reste — pas de carte colorée.

## 3. Wireframes

### 3.1 Mobile (récap sticky, 375 px) — coupon actif
```
┌───────────────────────────────────────────┐  ← sticky top, bg crème/95 blur
│ [img] 1 × Pack FemiGlow      199 MAD  2̶8̶9̶   │
│       livraison incluse                     │
│ • Geste d'accueil appliqué · Économie 90 MAD│  ← NOUVEAU (encre + terracotta sur "90 MAD")
└───────────────────────────────────────────┘
        … (header, steps, formulaire) …
        [ Commander le rituel ]   ← seule zone saillante (CTA sauge profond)
```

### 3.2 Desktop (récap statique, 2 lignes) — coupon actif
```
┌──────────────────────────────────────────────────────────────┐
│ [img]  1 × Pack FemiGlow                       199 MAD  2̶8̶9̶    │
│        Paste + Powder + Polissoir · livraison incluse          │
│        • Votre geste d'accueil est appliqué · Économie 90 MAD  │
└──────────────────────────────────────────────────────────────┘
```
Mobile : libellé court « Geste d'accueil appliqué ». Desktop : libellé long « Votre geste d'accueil est appliqué » (plus d'espace).

### 3.3 Coupon inactif (non-régression)
```
┌───────────────────────────────────────────┐
│ [img] 1 × Pack FemiGlow      199 MAD  2̶8̶9̶   │
│       livraison incluse                     │
└───────────────────────────────────────────┘   ← AUCUNE ligne ajoutée (identique à l'existant)
```

### 3.4 Cumul avec crédit fidélité (Phase 3)
Si un crédit fidélité est aussi appliqué, l'ordre vertical est :
```
199 MAD  2̶8̶9̶
• Geste d'accueil appliqué · Économie 90 MAD     (welcome)
Crédit fidélité −20 MAD                          (grant, ligne existante)
Total : 179 MAD
```
Les deux mentions restent calmes ; seule « Économie 90 MAD » porte l'accent terracotta (un seul mot chaud).

## 4. Micro-copy (voix maison, validée Kolenda §2.1)

| Contexte | FR | AR (à valider rédaction) |
|---|---|---|
| Mobile (court) | `Geste d'accueil appliqué` | `تم تطبيق هدية الترحيب` |
| Desktop (long) | `Votre geste d'accueil est appliqué` | `لقد تم تطبيق هدية الترحيب الخاصة بك` |
| Économie | `Économie 90 MAD` | `توفير 90 درهم` |

Interdits : « promo », « réduction », « −X% », « offre », « deal », « !», emoji, majuscules d'emphase.

## 5. Tokens de style / design / graphique

Réutilise les tokens existants du design system (cohérents Kolenda Annexe A) :

| Élément | Token / classe | Valeur |
|---|---|---|
| Texte libellé | `text-encre` | `#2A2E2A` |
| Accent économie | terracotta | `#C28A6E` (classe util `text-[#C28A6E]` ou token existant) |
| Puce avantage | sauge | `#A8B89E` (`text-sauge`/`bg-sauge`) |
| Séparateur `·` | `text-encre/30` | — |
| Filet | `border-encre/10` | — |
| Chiffres | `tabular-nums` | `font-variant-numeric` |
| Taille | `text-xs` (mobile) / `text-sm` (desktop) | 12–14 px |

**Interdits graphiques** : encadré coloré plein, rouge, ombre portée marquée, badge arrondi « sticker », countdown, icône cadeau criarde, animation snappy.

## 6. Accessibilité
- La ligne est du **texte** (pas une image) → lisible lecteur d'écran.
- Contraste encre/crème AA ; terracotta `#C28A6E` sur crème : usage **texte non essentiel** (l'info « économie » est aussi déductible du barré) → acceptable ; on garde un poids/taille suffisants.
- `data-testid="wizard-welcome-coupon"` pour les tests ; pas de rôle interactif (statique).
- RTL : `dir` hérité du wizard (ar) ; ordre `libellé · économie` reste lisible.

## 7. États & règles d'affichage
- Affiché **ssi** `welcomeCoupon.active === true` (résolu serveur, bucket treatment).
- Économie = `compareAtTotalCents − totalCents` (déjà dans le snapshot) ; n'affiche la ligne que si `> 0`.
- Holdout (bucket control) → `active=false` → ligne masquée (cohérent avec l'absence d'avantage pour le groupe contrôle).
- Aucune dépendance réseau côté client (résolu au rendu serveur).
