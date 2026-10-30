# HP-PRI-C-ALL-01 — Ongles nus, sains et brillants (après le semi-permanent)

| Champ | Valeur |
|---|---|
| Identifiant | `HP-PRI-C-ALL-01` |
| Composant / slot | `kit-hero-produit` / `primary` |
| Variante / langue / position | `angle-c` / `_all` (crossLocale) / `01` |
| Priorité | P1 |
| Version du prompt | v1 |
| Composition | image unique (1 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-FULL` |
| Main (casting) | Peau claire olive (Fitzpatrick III), ~41 ans, manche longue en coton vieux rose |
| H1 affiché au-dessus | FR « Une pause avec le semi-permanent — Kit de manucure japonaise, des ongles nus qui brillent » · AR « استراحة من الطلاء شبه الدائم — كيت المانيكور الياباني، أظافر طبيعية تلمع » |
| Sorties | `generated/kit-hero-produit/primary/angle-c/_all/01-ongles-nus-sains-brillants.png` (4:5, 1200×1500) · `generated/kit-hero-produit/primary/angle-c/_all/01-ongles-nus-sains-brillants.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/primary/angle-c/_all/01-ongles-nus-sains-brillants.alt.json` |

## Objectif et principe

Slide 1 de l'angle C « une pause avec le semi-permanent : des ongles nus qui brillent » : l'ongle naturel sain et brillant, sans le rendu « glossy » d'un gel.

Principes (01-recherche-principes.md) : 01-A1 résultat · 01-A4 main droite 1re personne · 01-C angle C (sain, pas glossy gel) · 01-A2 contexte réel flou

Zone focale : Ongles entre 18 % et 50 % de la hauteur, centre-droit. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

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
Photorealistic close-up photograph, first-person point of view: a woman's right hand resting on her lap, on a soft cream linen cushion. Use image 1 for the hand and nails: light olive skin (Fitzpatrick III), about 41 years old, natural fine lines on the knuckles. The nails are bare, healthy and natural: short (recovering length), smooth surface, even pink nail beds, intact white free edges, neat but natural cuticles, a soft satin-to-glossy natural shine like image 2. Not wet-look, not gel-like, no colour at all. The back of the hand faces the camera, fingers relaxed and slightly apart, the hand entering from the lower right. A dusty-rose cotton long sleeve covers the wrist. Behind the hand, upper left and slightly out of focus, the FemiGlow kit from image 3 stands on a low table: the two square jars with their round sage and pink labels, the sky-blue buffer. Background: blurred calm Moroccan living room, warm white walls. Diffused morning window light from the left, as in image 4, delicate shadows. 85 mm lens, f/2.5, shallow depth of field, focus on the nails. Portrait framing, to be cropped to 4:5 and 3:4: the nails sit between 18% and 50% of the frame height, centre-right; lower 35% calm (soft linen cushion and sleeve); 8% clear side margins. Mood: relief, healthy, gentle.
```

## Must include

- Ongles courts, sains, surface lisse, brillance douce
- Kit flou haut gauche
- Lumière douce

## Must avoid

- Rouge, nude laqué, effet gel bombé ou « wet look »
- Ongles abîmés (c'est la slide 1 : seulement le résultat)
- Bijoux, henné
- Visage
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Ancre 0.40.

```bash
python3 tools/hero_pack.py crop --id HP-PRI-C-ALL-01 --master generated/_work/HP-PRI-C-ALL-01/master.png
```

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Ongles naturels sains et brillants, sans semi-permanent, à côté du kit FemiGlow",
  "ar": "أظافر طبيعية صحية ولامعة دون طلاء شبه دائم، بجانب كيت FemiGlow",
  "en": "Healthy, shiny natural nails with no gel polish, next to the FemiGlow kit"
}
```
