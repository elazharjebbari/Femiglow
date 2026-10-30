# HP-SEC-DEF-ALL-03 — Le coffret tenu en main (échelle) à côté d'un verre de thé

| Champ | Valeur |
|---|---|
| Identifiant | `HP-SEC-DEF-ALL-03` |
| Composant / slot | `kit-hero-produit` / `secondary` |
| Variante / langue / position | `default` / `_all` (crossLocale) / `03` |
| Priorité | P1 |
| Version du prompt | v1 |
| Composition | image unique (1 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-FULL` |
| Main (casting) | Peau claire olive (Fitzpatrick III), main mûre ~46 ans, manche longue en coton crème |
| H1 affiché au-dessus | FR « Titre habituel de /kit (aucun texte d'angle) » · AR « العنوان المعتاد لـ /kit » |
| Sorties | `generated/kit-hero-produit/secondary/default/_all/03-kit-en-main-echelle.png` (4:5, 1200×1500) · `generated/kit-hero-produit/secondary/default/_all/03-kit-en-main-echelle.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/secondary/default/_all/03-kit-en-main-echelle.alt.json` |
| Copié aussi vers | `HP-SEC-A-ALL-04`, `HP-SEC-B-ALL-04`, `HP-SEC-C-ALL-03`, `HP-SEC-D-ALL-04`, `HP-SEC-E-ALL-02` (voir manifest) |

## Objectif et principe

Slide 4 partagée « In Scale » : faire comprendre la taille réelle du kit (évite la déception à la livraison COD et les refus de colis).

Principes (01-recherche-principes.md) : 01-A13 échelle (Baymard) · 01-A5 main qui tient le produit · 01-B slide 4

Zone focale : Main + coffret entre 12 % et 55 % de la hauteur. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

## Références à joindre (dans cet ordre)

1. **REF-05** (`references/REF-05-ugc-main-foncee-kit.jpg`) — fidélité produit (coffret réel)
2. **REF-06** (`references/REF-06-ugc-composition-marbre.jpg`) — fidélité produit (coffret réel)
3. **REF-02** (`references/REF-02-pots-ouverts-textures.png`) — fidélité produit
4. **REF-08** (`references/REF-08-resultat-ongles-french-reel.jpg`) — main / peau / ongles

## Prompt (EN)

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-FULL` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT -->
```text
Photorealistic photograph, first-person point of view: a woman holds the closed FemiGlow gift box in her right hand, about 25 cm above a light wooden table, the box lid facing the camera. Reproduce the box exactly from images 1 and 2: off-white lid, soft sage-green wave lower left, blush-pink wave on the right, “FemiGlow” in flowing warm-grey script, “MANICURE TREATMENT KIT” in small spaced capitals, a tiny leaf ornament, “Natural Nail Care System” in small serif type, pale sage box base. The box fits in her palm, fingers under it, thumb on the front edge, so its real small size is obvious. On the table below, slightly soft: the two jars and the sky-blue buffer from image 3, next to a standard Moroccan glass of mint tea for scale. Hand: light olive skin (Fitzpatrick III), mature, about 46 years old, natural bare nails with a soft shine like image 4. Cream cotton long sleeve. Soft daylight from a window on the left, warm neutral palette. 40 mm lens, f/3.5, focus on the box lid and the fingers. Portrait framing, to be cropped to 4:5 and 3:4: the hand and the box sit between 12% and 55% of the frame height, centred; lower 35% calm (table, jars and tea glass slightly soft); 8% clear side margins. Mood: reassuring, tangible.
```

## Must include

- Coffret réel (vagues sauge/rose, textes exacts)
- Verre de thé standard comme repère d'échelle
- Main droite

## Must avoid

- Coffret surdimensionné ou miniature
- Texte du coffret inventé ou en français/arabe
- Téléphone de marque visible
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Ancre 0.40.

```bash
python3 tools/hero_pack.py crop --id HP-SEC-DEF-ALL-03 --master generated/_work/HP-SEC-DEF-ALL-03/master.png
```

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Le coffret FemiGlow tenu dans la main, à côté d’un verre de thé, pour juger sa taille",
  "ar": "علبة FemiGlow في اليد بجانب كأس شاي لتقدير حجمها",
  "en": "The FemiGlow box held in one hand next to a tea glass, to show its size"
}
```
