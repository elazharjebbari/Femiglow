# HP-SEC-C-ALL-01 — Avant/après vertical : ongle abîmé par le semi-permanent → ongle naturel sain et brillant

| Champ | Valeur |
|---|---|
| Identifiant | `HP-SEC-C-ALL-01` |
| Composant / slot | `kit-hero-produit` / `secondary` |
| Variante / langue / position | `angle-c` / `_all` (crossLocale) / `01` |
| Priorité | P2 |
| Version du prompt | v1 |
| Composition | assemblage vertical de 2 panneaux (2 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-ABSENT` |
| Main (casting) | Peau medium (Fitzpatrick IV), main mûre ~44 ans, manche longue en lin crème |
| H1 affiché au-dessus | FR « Une pause avec le semi-permanent — Kit de manucure japonaise, des ongles nus qui brillent » · AR « استراحة من الطلاء شبه الدائم — كيت المانيكور الياباني، أظافر طبيعية تلمع » |
| Sorties | `generated/kit-hero-produit/secondary/angle-c/_all/01-avant-apres-semi-permanent.png` (4:5, 1200×1500) · `generated/kit-hero-produit/secondary/angle-c/_all/01-avant-apres-semi-permanent.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/secondary/angle-c/_all/01-avant-apres-semi-permanent.alt.json` |

## Objectif et principe

Slide 2 de l'angle C : l'ongle fragilisé après le semi-permanent (sans couleur résiduelle) puis le même ongle lisse et brillant. Vertical, neutre FR/AR/EN.

Principes (01-recherche-principes.md) : 01-A9 avant/après honnête (dégrader modérément) · 01-A10 vertical · 01-C angle C slide 2

Zone focale : Haut : ongles 30–70 % du panneau. Bas : ongles 10–40 % du panneau. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

## Ordre de génération et panneaux

Générer les panneaux **dans l'ordre indiqué** : le premier panneau validé sert de référence « même main, même lumière » aux suivants. Format de chaque panneau : paysage 3:2 (ex. 1536×1024), qualité maximale. Enregistrer chaque panneau validé dans `generated/_work/HP-SEC-C-ALL-01/<panneau>.png`.

### Panneau 1 — `bas-apres` (position finale : bas, ancre de recadrage 0.3)

Références à joindre (dans cet ordre) :

1. **REF-08** (`references/REF-08-resultat-ongles-french-reel.jpg`) — main / peau / ongles
2. **REF-04b** (`references/REF-04b-rituel-etapes-crop.png`) — niveau de brillance des ongles
3. **REF-09** (`references/REF-09-ambiance-lumiere-matin.png`) — lumière / ambiance

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-ABSENT` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT panel=bas-apres -->
```text
Photorealistic landscape close-up, first-person view from above: a woman's right hand resting on a cream linen cushion. Use image 1 for the hand: medium skin (Fitzpatrick IV), a mature hand about 44 years old with natural fine lines. Back of the hand toward the camera, fingers relaxed, the hand entering from the lower right. Nails: short, healthy and bare, smooth even surface, intact white free edges, even pink nail beds, a soft natural shine with crisp highlights like image 2. Healthy, not glossy like gel, no colour. A cream linen long sleeve covers the wrist. Soft morning window light from the left like image 3. 85 mm lens, f/4, nails sharp. Composition for a 3:2 landscape panel that will be cropped slightly top and bottom: place the nails between 10% and 40% of the panel height; lower half shows the back of the hand and linen; 8% clear side margins. No product, no text.
```

### Panneau 2 — `haut-avant` (position finale : haut, ancre de recadrage 0.5)

Références à joindre (dans cet ordre) :

1. **Panneau `bas-apres` validé** (`generated/_work/HP-SEC-C-ALL-01/bas-apres.png`) — même main, même lumière (panneau déjà validé)
2. **REF-08** (`references/REF-08-resultat-ongles-french-reel.jpg`) — main / peau / ongles

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-ABSENT` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT panel=haut-avant -->
```text
Edit image 1. Keep exactly the same hand, pose, sleeve, cushion, framing and light. Change only the nails to how they look right after removing semi-permanent gel polish: no colour left, but thin and weakened nails with white chalky patches, a rough uneven surface where the top layers were filed off, a few small peeling layers at the free edges, dry cuticles, completely dull with no highlight. Keep it realistic and moderate, no injury, no redness, no blood, no fungus. Do not change the skin, the hand or the background; you may lower the background saturation by about 10%, never the nails or the skin. Reframe so the nails sit between 30% and 70% of the panel height, 8% side margins. Photorealistic, same 3:2 landscape format, no text.
```

### Assemblage

Panneaux de haut en bas : `haut-avant` → `bas-apres`.

```bash
python3 tools/hero_pack.py stack --id HP-SEC-C-ALL-01 \
  --panels generated/_work/HP-SEC-C-ALL-01/haut-avant.png generated/_work/HP-SEC-C-ALL-01/bas-apres.png \
  --anchors 0.5 0.3
```

## Must include

- Avant : plaques blanches crayeuses, surface rugueuse, bords qui pèlent — sans couleur
- Après : lisse, sain, brillance douce
- Même main/lumière

## Must avoid

- Restes de gel coloré, rouge, sang, mycose, blessure
- Brillance « gel » dans l'après
- Texte
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Assemblage `stack` : haut = haut-avant (ancre 0.50), bas = bas-apres (ancre 0.30).

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Avant, en haut : ongles abîmés après le semi-permanent. Après, en bas : ongles naturels lisses et brillants",
  "ar": "قبل، في الأعلى: أظافر متضررة بعد الطلاء شبه الدائم. بعد، في الأسفل: أظافر طبيعية ناعمة ولامعة",
  "en": "Before, top: nails damaged by gel polish. After, bottom: smooth, shiny natural nails"
}
```
