# HP-PRI-B-ALL-01 — Geste du quotidien : la main saisit un verre de thé

| Champ | Valeur |
|---|---|
| Identifiant | `HP-PRI-B-ALL-01` |
| Composant / slot | `kit-hero-produit` / `primary` |
| Variante / langue / position | `angle-b` / `_all` (crossLocale) / `01` |
| Priorité | P1 |
| Version du prompt | v1 |
| Composition | image unique (1 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-FULL` |
| Main (casting) | Peau brun foncé (Fitzpatrick V–VI), ~36 ans, manche mi-longue en maille crème |
| H1 affiché au-dessus | FR « Kit de manucure japonaise, zéro vernis, et vos ongles brillent » · AR « كيت المانيكور الياباني، بلا أيّ طلاء، وأظافركِ تلمع » |
| Sorties | `generated/kit-hero-produit/primary/angle-b/_all/01-main-verre-de-the-ongles-nus.png` (4:5, 1200×1500) · `generated/kit-hero-produit/primary/angle-b/_all/01-main-verre-de-the-ongles-nus.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/primary/angle-b/_all/01-main-verre-de-the-ongles-nus.alt.json` |

## Objectif et principe

Slide 1 de l'angle B « zéro vernis, et vos ongles brillent » : la liberté au quotidien. Les ongles nus brillent pendant un geste ordinaire (prendre son verre de thé), sans rien à poser.

Principes (01-recherche-principes.md) : 01-A1 résultat · 01-A4/A5 main droite qui saisit (simulation d'usage) · 01-A6 geste suggérant le mouvement · 01-C angle B · 01-D décor marocain sobre

Zone focale : Ongles + bord du verre entre 20 % et 55 % de la hauteur, au centre. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

**Message match :** si le Reel de cet angle existe, comparer son premier (ou dernier) plan avec ce prompt avant de générer. Si le plan, la main ou la lumière diffèrent, joindre ce frame en dernière image de référence (rôle « composition / lumière ») et ajuster la scène pour reprendre le même plan (01-A11).

## Références à joindre (dans cet ordre)

1. **REF-07** (`references/REF-07-resultat-ongles-peau-foncee.png`) — main / peau / ongles
2. **REF-04b** (`references/REF-04b-rituel-etapes-crop.png`) — niveau de brillance des ongles
3. **REF-06** (`references/REF-06-ugc-composition-marbre.jpg`) — fidélité produit
4. **REF-09** (`references/REF-09-ambiance-lumiere-matin.png`) — lumière / ambiance

## Prompt (EN)

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-FULL` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT -->
```text
Photorealistic lifestyle photograph, first-person point of view: a woman's right hand reaches for a small Moroccan glass of mint tea standing on a light wooden table. Use image 1 for skin and hand: deep brown skin (Fitzpatrick V–VI), about 36 years old. Use image 2 for the level of natural shine: short bare natural nails, softly rounded, pink-beige nail beds, natural white free edge, a clean highlight on each nail, absolutely no polish. The hand comes in from the lower right, back of the hand toward the camera, index and middle fingertips just touching the rim of the clear tea glass, nails facing the viewer; slight natural motion. Mint leaves in the amber tea; a cream knitted sleeve at the wrist. Upper left, out of focus: the FemiGlow kit from image 3 next to a plain white teapot. Soft morning window light from the left like image 4, warm but natural, gentle shadows on the table. 50 mm lens, f/2.2, eye-level slightly above the table, focus on the nails. Portrait framing, to be cropped to 4:5 and 3:4: the nails and the glass rim sit between 20% and 55% of the frame height, centred; lower 35% calm (blurred wooden table and the sleeve); 8% clear side margins. Mood: easy, everyday, confident.
```

## Must include

- Verre de thé à la menthe marocain (verre clair, sans dorure brillante)
- Ongles visibles côté dos de main, reflet net
- Kit reconnaissable mais flou

## Must avoid

- Théière en argent brillant ou plateau doré ostentatoire au premier plan
- Ongles cachés derrière le verre
- Vernis, gel, faux ongles
- Visage
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Ancre 0.40. Si le verre déborde en bas, préférer ancre 0.35.

```bash
python3 tools/hero_pack.py crop --id HP-PRI-B-ALL-01 --master generated/_work/HP-PRI-B-ALL-01/master.png
```

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Main aux ongles nus et brillants qui saisit un verre de thé à la menthe",
  "ar": "يد بأظافر طبيعية لامعة تمسك كأس شاي بالنعناع",
  "en": "Hand with bare, shiny nails reaching for a glass of mint tea"
}
```
