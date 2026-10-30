# HP-SEC-DEF-ALL-02 — Rituel en 3 gestes, de haut en bas : pâte → poudre → polissoir

| Champ | Valeur |
|---|---|
| Identifiant | `HP-SEC-DEF-ALL-02` |
| Composant / slot | `kit-hero-produit` / `secondary` |
| Variante / langue / position | `default` / `_all` (crossLocale) / `02` |
| Priorité | P1 |
| Version du prompt | v1 |
| Composition | assemblage vertical de 3 panneaux (3 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-FULL` |
| Main (casting) | Peau medium (Fitzpatrick IV), ~25 ans, manches longues en lin crème |
| H1 affiché au-dessus | FR « Titre habituel de /kit (aucun texte d'angle) » · AR « العنوان المعتاد لـ /kit » |
| Sorties | `generated/kit-hero-produit/secondary/default/_all/02-rituel-3-gestes-vertical.png` (4:5, 1200×1500) · `generated/kit-hero-produit/secondary/default/_all/02-rituel-3-gestes-vertical.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/secondary/default/_all/02-rituel-3-gestes-vertical.alt.json` |
| Copié aussi vers | `HP-SEC-A-ALL-02`, `HP-SEC-B-ALL-03`, `HP-SEC-C-ALL-02`, `HP-SEC-D-ALL-03`, `HP-SEC-E-ALL-03` (voir manifest) |

## Objectif et principe

Slide 3 partagée : facilité / usage. Séquence verticale (haut → bas) lisible dans les trois langues, sans chiffres incrustés : les numéros sont ceux des étiquettes (« 1 paste », « 2 powder », « Step ④ »).

Principes (01-recherche-principes.md) : 01-B slide 3 · 01-A4 main droite, polissoir poignée à droite · 01-A16 vue plongeante = facile · 01-D séquence verticale = pas de miroir AR

Zone focale : Chaque geste dans la bande centrale (25–70 %) de son panneau. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

## Ordre de génération et panneaux

Générer les panneaux **dans l'ordre indiqué** : le premier panneau validé sert de référence « même main, même lumière » aux suivants. Format de chaque panneau : paysage 3:2 (ex. 1536×1024), qualité maximale. Enregistrer chaque panneau validé dans `generated/_work/HP-SEC-DEF-ALL-02/<panneau>.png`.

### Panneau 1 — `1-pate` (position finale : haut, ancre de recadrage 0.5)

Références à joindre (dans cet ordre) :

1. **REF-04b** (`references/REF-04b-rituel-etapes-crop.png`) — main / peau / ongles
2. **REF-02** (`references/REF-02-pots-ouverts-textures.png`) — fidélité produit
3. **REF-03** (`references/REF-03-pot1-label-macro.png`) — fidélité produit
4. **REF-09** (`references/REF-09-ambiance-lumiere-matin.png`) — lumière / ambiance

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-FULL` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT panel=1-pate -->
```text
Photorealistic landscape photograph, top-down view on a pale cream marble surface with a fold of ecru linen. Step one of the ritual: the woman's right index fingertip takes a small amount of thick ivory cream from the open jar labelled “1 paste”, the gesture of image 1. The jar and its lid are reproduced exactly from images 2 and 3: squat square jar of thick clear glass with faceted corners, the clear lid leaning beside it showing the round pale sage label with “1”, “paste” and the “FemiGlow” script. Her left hand rests flat at the left of the frame, bare natural nails waiting. Hands: medium skin (Fitzpatrick IV), about 25 years old, short bare natural nails, cream linen long sleeves at the wrists. The right hand enters from the right. Soft streaked morning window light from the left like image 4. 35 mm lens from above, f/4. Composition for a wide panel that will be cropped hard top and bottom: keep the jar, the fingertip and the left-hand nails inside the central horizontal band, between 28% and 70% of the height, with 8% side margins. Only label text, no other text.
```

### Panneau 2 — `2-poudre` (position finale : milieu, ancre de recadrage 0.5)

Références à joindre (dans cet ordre) :

1. **Panneau `1-pate` validé** (`generated/_work/HP-SEC-DEF-ALL-02/1-pate.png`) — même main, même lumière (panneau déjà validé)
2. **REF-02** (`references/REF-02-pots-ouverts-textures.png`) — fidélité produit
3. **REF-04b** (`references/REF-04b-rituel-etapes-crop.png`) — main / peau / ongles

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-FULL` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT panel=2-poudre -->
```text
Use image 1 as the reference for the exact same hands, sleeves, skin, marble, linen, light and camera height. Step two of the ritual: the right index fingertip, lightly dusted with fine pearly white powder, presses gently on a nail of the left hand; next to it the open jar labelled “2 powder” reproduced exactly from image 2 (squat square clear glass jar, its clear lid leaning beside it with the round powder-pink label “2”, “powder”, “FemiGlow” script), the fine white powder visible inside, as in image 3. Jar 1 is closed and slightly out of focus at the edge of the frame. The right hand enters from the right; the left hand rests at the left with natural bare nails. Photorealistic, top-down, same soft streaked window light from the left. Composition for a wide panel that will be cropped hard top and bottom: keep the powdered fingertip, the target nail and the jar between 28% and 70% of the height, 8% side margins. Only label text, no other text.
```

### Panneau 3 — `3-polissoir` (position finale : bas, ancre de recadrage 0.45)

Références à joindre (dans cet ordre) :

1. **Panneau `1-pate` validé** (`generated/_work/HP-SEC-DEF-ALL-02/1-pate.png`) — même main, même lumière (panneau déjà validé)
2. **REF-02** (`references/REF-02-pots-ouverts-textures.png`) — fidélité produit
3. **REF-06** (`references/REF-06-ugc-composition-marbre.jpg`) — fidélité produit (coffret réel)

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-FULL` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT panel=3-polissoir -->
```text
Use image 1 as the reference for the exact same hands, sleeves, skin, marble, linen, light and camera height. Step three: the right hand holds the four-sided buffer by its right end and polishes the nails of the left hand with a quick back-and-forth stroke; a light motion blur on the buffer only. The buffer is reproduced exactly from images 2 and 3: a rectangular block with a saturated sky-blue top face, white sides with a thin grey middle layer, the printed text “Step ④ Polish & Shine” where 4 sits in a small dark filled circle. The polished nails of the left hand already show a clear natural shine with crisp highlights. No polish. The two closed jars rest out of focus in the upper left corner. Photorealistic, top-down, same soft streaked window light from the left. Composition for a wide panel that will be cropped hard top and bottom: keep the buffer and the shining nails between 25% and 65% of the height, 8% side margins. Only label text, no other text.
```

### Assemblage

Panneaux de haut en bas : `1-pate` → `2-poudre` → `3-polissoir`.

```bash
python3 tools/hero_pack.py stack --id HP-SEC-DEF-ALL-02 \
  --panels generated/_work/HP-SEC-DEF-ALL-02/1-pate.png generated/_work/HP-SEC-DEF-ALL-02/2-poudre.png generated/_work/HP-SEC-DEF-ALL-02/3-polissoir.png \
  --anchors 0.5 0.5 0.45
```

## Must include

- Trois panneaux empilés dans l'ordre 1 paste → 2 powder → polissoir
- Mêmes mains et même lumière dans les trois
- Main droite active, polissoir tenu par l'extrémité droite

## Must avoid

- Chiffres, flèches ou mots incrustés en surimpression
- Disposition horizontale (exigerait une version AR miroir)
- Pinceau, flacon de vernis, lampe UV
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Assemblage `stack` à 3 panneaux, gouttières 12 px #FBF8F1. Exception documentée : le 3e panneau descend dans les 30 % bas (slide secondaire, la barre sticky n'apparaît qu'après le hero) — à vérifier au navigateur intégré Instagram.

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Les trois gestes de haut en bas : la pâte n° 1, la poudre n° 2, puis le polissoir",
  "ar": "الخطوات الثلاث من الأعلى إلى الأسفل: المعجون رقم 1، ثم البودرة رقم 2، ثم أداة التلميع",
  "en": "The three steps, top to bottom: paste no. 1, powder no. 2, then the buffer"
}
```
