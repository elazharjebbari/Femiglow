# HP-SEC-D-ALL-02 — Main séchée dans une serviette : la brillance reste

| Champ | Valeur |
|---|---|
| Identifiant | `HP-SEC-D-ALL-02` |
| Composant / slot | `kit-hero-produit` / `secondary` |
| Variante / langue / position | `angle-d` / `_all` (crossLocale) / `02` |
| Priorité | P2 |
| Version du prompt | v1 |
| Composition | image unique (1 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-ABSENT` |
| Main (casting) | Peau claire-medium (Fitzpatrick III), ~33 ans, manche longue en lin écru |
| H1 affiché au-dessus | FR « Compatible woudou — Kit de manucure japonaise, des ongles soignés, rien à retirer avant le woudou » · AR « متوافق مع الوضوء — كيت المانيكور الياباني، أظافر مُعتنى بها، ولا شيء يُزال قبل الوضوء » |
| Sorties | `generated/kit-hero-produit/secondary/angle-d/_all/02-main-sechee-serviette.png` (4:5, 1200×1500) · `generated/kit-hero-produit/secondary/angle-d/_all/02-main-sechee-serviette.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/secondary/angle-d/_all/02-main-sechee-serviette.alt.json` |

## Objectif et principe

Slide de l'angle D : après l'eau, on s'essuie et les ongles brillent toujours (rien à retirer, rien à reposer).

Principes (01-recherche-principes.md) : 01-C angle D · 01-A5 main vicariante · 01-D pudeur, poignets couverts

Zone focale : Ongles entre 20 % et 52 % de la hauteur. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

## Références à joindre (dans cet ordre)

1. **REF-08** (`references/REF-08-resultat-ongles-french-reel.jpg`) — main / peau / ongles
2. **REF-04b** (`references/REF-04b-rituel-etapes-crop.png`) — niveau de brillance des ongles
3. **REF-10** (`references/REF-10-ugc-maison.jpg`) — lumière / ambiance (vraie vie à la maison)

## Prompt (EN)

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-ABSENT` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT -->
```text
Photorealistic photograph, first-person point of view: a woman pats her right hand dry with a soft cream cotton fouta towel with fine sage stripes. Use image 1 for the hand: light-medium skin (Fitzpatrick III), about 33 years old. The towel is held underneath the fingers, the back of the hand and the nails face the camera, a few tiny water droplets still on the skin. Nails: short, bare and natural, still clearly shiny with crisp highlights like image 2, natural white free edges, no polish. An ecru linen long sleeve covers the wrist; the hand enters from the lower right. Background: a calm, real Moroccan bathroom like image 3, warm off-white tadelakt walls, out of focus. Soft daylight from a window on the left. 50 mm lens, f/2.8, focus on the nails. Portrait framing, to be cropped to 4:5 and 3:4: the nails sit between 20% and 52% of the frame height; lower 35% calm (towel folds); 8% clear side margins. No product, no text. Mood: simple, clean, nothing to remove.
```

## Must include

- Fouta / serviette en coton
- Ongles brillants après l'eau
- Manche au poignet

## Must avoid

- Symboles religieux, tapis
- Bras nus
- Vernis
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Ancre 0.40.

```bash
python3 tools/hero_pack.py crop --id HP-SEC-D-ALL-02 --master generated/_work/HP-SEC-D-ALL-02/master.png
```

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Main séchée avec une serviette : les ongles naturels restent brillants",
  "ar": "يد تُجفَّف بمنشفة، والأظافر الطبيعية تبقى لامعة",
  "en": "Hand patted dry with a towel, the natural nails still shining"
}
```
