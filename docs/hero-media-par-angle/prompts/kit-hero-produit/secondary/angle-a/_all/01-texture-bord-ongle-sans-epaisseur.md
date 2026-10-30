# HP-SEC-A-ALL-01 — Macro du bord de l'ongle : aucune épaisseur de vernis

| Champ | Valeur |
|---|---|
| Identifiant | `HP-SEC-A-ALL-01` |
| Composant / slot | `kit-hero-produit` / `secondary` |
| Variante / langue / position | `angle-a` / `_all` (crossLocale) / `01` |
| Priorité | P2 |
| Version du prompt | v1 |
| Composition | image unique (1 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-ABSENT` |
| Main (casting) | Peau medium-mate (Fitzpatrick IV–V), ~31 ans |
| H1 affiché au-dessus | FR « Kit de manucure japonaise, ça brille, et ce n’est pas du vernis » · AR « كيت المانيكور الياباني، لمعانٌ حقيقي، وليس طلاءً » |
| Sorties | `generated/kit-hero-produit/secondary/angle-a/_all/01-texture-bord-ongle-sans-epaisseur.png` (4:5, 1200×1500) · `generated/kit-hero-produit/secondary/angle-a/_all/01-texture-bord-ongle-sans-epaisseur.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/secondary/angle-a/_all/01-texture-bord-ongle-sans-epaisseur.alt.json` |

## Objectif et principe

Slide 2 de l'angle A : macro de texture. Vu de profil, le bord libre est fin et naturel : la brillance n'est pas une couche.

Principes (01-recherche-principes.md) : 01-A6 macro / haptique · 01-A14 texture · 01-C angle A slide 2

Zone focale : Bord de l'ongle + reflet entre 20 % et 50 % de la hauteur. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

## Références à joindre (dans cet ordre)

1. **REF-07** (`references/REF-07-resultat-ongles-peau-foncee.png`) — main / peau / ongles
2. **REF-04b** (`references/REF-04b-rituel-etapes-crop.png`) — niveau de brillance des ongles
3. **REF-09** (`references/REF-09-ambiance-lumiere-matin.png`) — lumière / ambiance

## Prompt (EN)

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-ABSENT` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT -->
```text
Photorealistic extreme macro photograph of a single fingertip, the right index finger, seen in near-profile so that the nail plate and its free edge are seen from the side. Use image 1 for the skin: medium-tan skin (Fitzpatrick IV–V), about 31 years old, real skin texture with fine lines. The nail is bare and natural: the free edge is thin and translucent white, the side profile shows no layer, no ridge of product and no thickness of polish; the nail plate has a gentle natural curve, faint natural longitudinal ridges and a long soft highlight running along it, as shiny as image 2. The cuticle is natural and neat. The fingertip enters from the lower right and points toward the upper left. Background: a smooth out-of-focus cream linen, warm and calm. Light: soft side window light from the left like image 3, one clear specular line on the nail. 100 mm macro lens, f/4, focus stacked across the nail plate. Portrait framing, to be cropped to 4:5 and 3:4: the nail edge and its highlight sit between 20% and 50% of the frame height, centred; lower 35% calm (soft out-of-focus finger and linen); 8% clear side margins. No product, no text. Mood: precise, tactile, truthful.
```

## Must include

- Profil du bord libre fin et translucide
- Reflet long sur la plaque
- Stries naturelles discrètes

## Must avoid

- Bourrelet de vernis ou de top coat
- Ongle long ou pointu
- Texte, produit
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Ancre 0.40.

```bash
python3 tools/hero_pack.py crop --id HP-SEC-A-ALL-01 --master generated/_work/HP-SEC-A-ALL-01/master.png
```

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Bord d’un ongle naturel en macro : aucune épaisseur de vernis, seulement la brillance",
  "ar": "حافة ظفر طبيعي عن قرب: لا سماكة لطلاء، لمعان فقط",
  "en": "Macro of a natural nail edge: no layer of polish, just shine"
}
```
