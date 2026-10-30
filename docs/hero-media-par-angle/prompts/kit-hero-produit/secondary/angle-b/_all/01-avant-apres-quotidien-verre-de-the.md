# HP-SEC-B-ALL-01 — Avant/après vertical au quotidien (près d'un verre de thé)

| Champ | Valeur |
|---|---|
| Identifiant | `HP-SEC-B-ALL-01` |
| Composant / slot | `kit-hero-produit` / `secondary` |
| Variante / langue / position | `angle-b` / `_all` (crossLocale) / `01` |
| Priorité | P2 |
| Version du prompt | v1 |
| Composition | assemblage vertical de 2 panneaux (2 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-ABSENT` |
| Main (casting) | Peau claire olive (Fitzpatrick III), ~24 ans, manche longue en coton bleu encre doux |
| H1 affiché au-dessus | FR « Kit de manucure japonaise, zéro vernis, et vos ongles brillent » · AR « كيت المانيكور الياباني، بلا أيّ طلاء، وأظافركِ تلمع » |
| Sorties | `generated/kit-hero-produit/secondary/angle-b/_all/01-avant-apres-quotidien-verre-de-the.png` (4:5, 1200×1500) · `generated/kit-hero-produit/secondary/angle-b/_all/01-avant-apres-quotidien-verre-de-the.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/secondary/angle-b/_all/01-avant-apres-quotidien-verre-de-the.alt.json` |

## Objectif et principe

Slide 2 de l'angle B : avant/après terne → brillant dans une scène du quotidien. Vertical, neutre FR/AR/EN.

Principes (01-recherche-principes.md) : 01-A9 avant/après honnête · 01-A10 vertical · 01-C angle B slide 2

Zone focale : Haut : ongles 30–70 % du panneau. Bas : ongles 10–40 % du panneau. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

## Ordre de génération et panneaux

Générer les panneaux **dans l'ordre indiqué** : le premier panneau validé sert de référence « même main, même lumière » aux suivants. Format de chaque panneau : paysage 3:2 (ex. 1536×1024), qualité maximale. Enregistrer chaque panneau validé dans `generated/_work/HP-SEC-B-ALL-01/<panneau>.png`.

### Panneau 1 — `bas-apres` (position finale : bas, ancre de recadrage 0.3)

Références à joindre (dans cet ordre) :

1. **REF-08** (`references/REF-08-resultat-ongles-french-reel.jpg`) — main / peau / ongles
2. **REF-04b** (`references/REF-04b-rituel-etapes-crop.png`) — niveau de brillance des ongles
3. **REF-09** (`references/REF-09-ambiance-lumiere-matin.png`) — lumière / ambiance

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-ABSENT` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT panel=bas-apres -->
```text
Photorealistic landscape photograph, first-person view from slightly above: a woman's right hand rests on a light wooden kitchen table next to a small glass of mint tea and a set of keys. Use image 1 for the hand: light olive skin (Fitzpatrick III), about 24 years old, natural texture. The back of the hand faces the camera, fingers relaxed, the hand entering from the lower right, the tea glass at the upper left. Nails: short, bare and natural, with a clear natural shine and a crisp highlight on each nail like image 2, natural white free edges, no polish. A soft ink-blue cotton long sleeve covers the wrist. Morning window light from the left like image 3, warm and natural. 50 mm lens, f/3.2, focus on the nails. Composition for a 3:2 landscape panel that will be cropped slightly top and bottom: place the nails between 10% and 40% of the panel height; the lower half shows the back of the hand and the table; 8% clear side margins. No product, no text.
```

### Panneau 2 — `haut-avant` (position finale : haut, ancre de recadrage 0.5)

Références à joindre (dans cet ordre) :

1. **Panneau `bas-apres` validé** (`generated/_work/HP-SEC-B-ALL-01/bas-apres.png`) — même main, même lumière (panneau déjà validé)
2. **REF-08** (`references/REF-08-resultat-ongles-french-reel.jpg`) — main / peau / ongles

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-ABSENT` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT panel=haut-avant -->
```text
Edit image 1. Keep exactly the same hand, pose, sleeve, table, tea glass, keys, framing and light. Change only the nails to their everyday state before the treatment: the same bare natural nails but dull and matte, no highlight, faint ridges, slightly dry cuticles, slightly uneven free edges. Natural colour, clean, no polish, no damage beyond ordinary dullness. Do not change the skin, the hand shape or the background; you may lower the background saturation by about 10%, never the nails or the skin. Reframe so that the nails sit between 30% and 70% of the panel height, with 8% clear side margins. Photorealistic, same 3:2 landscape format, no text.
```

### Assemblage

Panneaux de haut en bas : `haut-avant` → `bas-apres`.

```bash
python3 tools/hero_pack.py stack --id HP-SEC-B-ALL-01 \
  --panels generated/_work/HP-SEC-B-ALL-01/haut-avant.png generated/_work/HP-SEC-B-ALL-01/bas-apres.png \
  --anchors 0.5 0.3
```

## Must include

- Même main/lumière/décor dans les deux panneaux
- Verre de thé et clés (quotidien)
- Avant en haut, après en bas

## Must avoid

- Mots, flèches, chiffres incrustés
- Vernis
- Changement de main entre panneaux
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Assemblage `stack` : haut = haut-avant (ancre 0.50), bas = bas-apres (ancre 0.30).

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Avant, en haut : ongles ternes près d’un verre de thé. Après, en bas : les mêmes ongles brillants",
  "ar": "قبل، في الأعلى: أظافر باهتة بجانب كأس شاي. بعد، في الأسفل: الأظافر نفسها لامعة",
  "en": "Before, top: dull nails by a tea glass. After, bottom: the same nails shining"
}
```
