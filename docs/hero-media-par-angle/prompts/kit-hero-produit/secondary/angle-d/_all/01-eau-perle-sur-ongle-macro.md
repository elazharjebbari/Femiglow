# HP-SEC-D-ALL-01 — Macro : l'eau perle sur l'ongle naturel

| Champ | Valeur |
|---|---|
| Identifiant | `HP-SEC-D-ALL-01` |
| Composant / slot | `kit-hero-produit` / `secondary` |
| Variante / langue / position | `angle-d` / `_all` (crossLocale) / `01` |
| Priorité | P2 |
| Version du prompt | v1 |
| Composition | image unique (1 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-ABSENT` |
| Main (casting) | Peau brun foncé (Fitzpatrick V–VI), ~38 ans |
| H1 affiché au-dessus | FR « Compatible woudou — Kit de manucure japonaise, des ongles soignés, rien à retirer avant le woudou » · AR « متوافق مع الوضوء — كيت المانيكور الياباني، أظافر مُعتنى بها، ولا شيء يُزال قبل الوضوء » |
| Sorties | `generated/kit-hero-produit/secondary/angle-d/_all/01-eau-perle-sur-ongle-macro.png` (4:5, 1200×1500) · `generated/kit-hero-produit/secondary/angle-d/_all/01-eau-perle-sur-ongle-macro.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/secondary/angle-d/_all/01-eau-perle-sur-ongle-macro.alt.json` |

## Objectif et principe

Slide 2 de l'angle D : l'eau touche directement l'ongle nu et la brillance reste. Macro sobre, sans élément religieux.

Principes (01-recherche-principes.md) : 01-C angle D slide 2 · 01-A6 macro · 01-D pudeur

Zone focale : Ongle + gouttes entre 18 % et 50 % de la hauteur. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

## Références à joindre (dans cet ordre)

1. **REF-07** (`references/REF-07-resultat-ongles-peau-foncee.png`) — main / peau / ongles
2. **REF-04b** (`references/REF-04b-rituel-etapes-crop.png`) — niveau de brillance des ongles
3. **REF-09** (`references/REF-09-ambiance-lumiere-matin.png`) — lumière / ambiance

## Prompt (EN)

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-ABSENT` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT -->
```text
Photorealistic macro photograph of two fingertips of a woman's right hand, index and middle finger, nails toward the camera, seen from slightly above. Use image 1 for skin: deep brown skin (Fitzpatrick V–VI), about 38 years old, real texture. Fresh clear water droplets bead and sit on the bare natural nails and the skin, a few small droplets rolling off the free edge; the nails keep a crisp natural shine like image 2, with pink-beige nail beds and natural white free edges. No polish. The fingers enter from the lower right and point toward the upper left. Background: very soft out-of-focus warm off-white tadelakt plaster and a hint of a white basin. Light: clean soft daylight from the left like image 3, a small backlight making the droplets sparkle. 100 mm macro lens, f/5.6, focus on the droplets on the middle nail. Portrait framing, to be cropped to 4:5 and 3:4: the nails and droplets sit between 18% and 50% of the frame height; lower 35% calm (out-of-focus fingers and plaster); 8% clear side margins. No product, no text. Mood: fresh, pure, respectful.
```

## Must include

- Gouttes nettes posées sur l'ongle
- Brillance visible sous l'eau
- Fond tadelakt doux

## Must avoid

- Tout objet ou symbole religieux
- Mousse, savon
- Vernis
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Ancre 0.40.

```bash
python3 tools/hero_pack.py crop --id HP-SEC-D-ALL-01 --master generated/_work/HP-SEC-D-ALL-01/master.png
```

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Gouttes d’eau qui perlent sur un ongle naturel brillant",
  "ar": "قطرات ماء على ظفر طبيعي لامع",
  "en": "Water droplets beading on a shiny natural nail"
}
```
