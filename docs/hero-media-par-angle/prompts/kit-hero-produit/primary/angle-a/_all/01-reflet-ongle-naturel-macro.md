# HP-PRI-A-ALL-01 — Reflet net sur ongles naturels (macro)

| Champ | Valeur |
|---|---|
| Identifiant | `HP-PRI-A-ALL-01` |
| Composant / slot | `kit-hero-produit` / `primary` |
| Variante / langue / position | `angle-a` / `_all` (crossLocale) / `01` |
| Priorité | P1 |
| Version du prompt | v1 |
| Composition | image unique (1 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-FULL` |
| Main (casting) | Peau medium olive (Fitzpatrick III–IV), ~30 ans, manche longue en lin crème |
| H1 affiché au-dessus | FR « Kit de manucure japonaise, ça brille, et ce n’est pas du vernis » · AR « كيت المانيكور الياباني، لمعانٌ حقيقي، وليس طلاءً » |
| Sorties | `generated/kit-hero-produit/primary/angle-a/_all/01-reflet-ongle-naturel-macro.png` (4:5, 1200×1500) · `generated/kit-hero-produit/primary/angle-a/_all/01-reflet-ongle-naturel-macro.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/primary/angle-a/_all/01-reflet-ongle-naturel-macro.alt.json` |

## Objectif et principe

Slide 1 (LCP) de l'angle A « ça brille, et ce n'est pas du vernis » : prouver par la macro que la brillance vient de l'ongle nu (cuticule, texture et bord libre visibles, aucune épaisseur de vernis).

Principes (01-recherche-principes.md) : 01-A1 résultat en slide 1 · 01-A4 main droite 1re personne · 01-A6 geste d'évaluation / macro · 01-A12 un seul point focal · 01-C angle A · 01-E zones de sécurité

Zone focale : Ongles index/majeur/annulaire entre 15 % et 50 % de la hauteur, légèrement à droite du centre. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

**Message match :** si le Reel de cet angle existe, comparer son premier (ou dernier) plan avec ce prompt avant de générer. Si le plan, la main ou la lumière diffèrent, joindre ce frame en dernière image de référence (rôle « composition / lumière ») et ajuster la scène pour reprendre le même plan (01-A11).

## Références à joindre (dans cet ordre)

1. **REF-08** (`references/REF-08-resultat-ongles-french-reel.jpg`) — main / peau / ongles
2. **REF-04b** (`references/REF-04b-rituel-etapes-crop.png`) — niveau de brillance des ongles
3. **REF-02** (`references/REF-02-pots-ouverts-textures.png`) — fidélité produit
4. **REF-09** (`references/REF-09-ambiance-lumiere-matin.png`) — lumière / ambiance

## Prompt (EN)

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-FULL` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT -->
```text
Photorealistic macro photograph, first-person point of view: a woman looks down at her own right hand. Use image 1 for hand anatomy and natural nails: medium olive skin (Fitzpatrick III–IV), about 30 years old. Use image 2 for the exact level of shine: buffed bare natural nails, no polish of any kind. The right hand enters from the lower right, back of the hand toward the camera, fingers slightly fanned and tilted toward a window on the left, so one crisp curved highlight runs across the index, middle and ring nails. Cuticles, fine natural ridges, pink nail beds and thin white free edges stay visible: proof there is no polish. A cream linen long sleeve covers the wrist. Far in the background, top right, the FemiGlow kit from image 3 rests out of focus, recognisable by shape and colour. Background: blurred warm Moroccan home, white lime-plaster wall, linen curtain. Light: soft diffused morning window light from the left, as in image 4. 100 mm macro look, f/2.8, very shallow depth of field, focus on the middle fingernail. Portrait framing, to be cropped to 4:5 and 3:4: the three nails sit between 15% and 50% of the frame height, slightly right of centre; lower 35% calm (out-of-focus back of the hand and sleeve); 8% clear side margins. Mood: quiet, luminous, honest.
```

## Must include

- Reflet spéculaire net et courbe sur au moins 2 ongles
- Cuticules et stries naturelles visibles
- Bord libre blanc fin (pas d'épaisseur)
- Main droite, dos de main, 1re personne
- Kit flou en arrière-plan haut droit

## Must avoid

- Tout aspect vernis, gel, top coat épais ou ongles « miroir » parfaits
- Ongles longs en amande ou capsules
- Bijoux, bagues, henné
- Main gauche, main tendue vers l'objectif
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Ancre verticale 0.40 (par défaut). Vérifier que le reflet reste au-dessus de 55 % dans le 4:5 et le 3:4.

```bash
python3 tools/hero_pack.py crop --id HP-PRI-A-ALL-01 --master generated/_work/HP-PRI-A-ALL-01/master.png
```

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Gros plan d’ongles naturels avec un reflet net, sans vernis, après la manucure japonaise FemiGlow",
  "ar": "لقطة قريبة لأظافر طبيعية بلمعان واضح دون طلاء بعد المانيكير الياباني FemiGlow",
  "en": "Close-up of natural nails with a crisp shine, no polish, after the FemiGlow Japanese manicure"
}
```
