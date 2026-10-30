# HP-PRI-E-ALL-01 — Fini salon, chez soi : main sur un coussin de salon marocain

| Champ | Valeur |
|---|---|
| Identifiant | `HP-PRI-E-ALL-01` |
| Composant / slot | `kit-hero-produit` / `primary` |
| Variante / langue / position | `angle-e` / `_all` (crossLocale) / `01` |
| Priorité | P1 |
| Version du prompt | v1 |
| Composition | image unique (1 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-FULL` |
| Main (casting) | Peau medium olive (Fitzpatrick III–IV), main mûre ~52 ans, manche longue sauge avec fine passementerie ton sur ton |
| H1 affiché au-dessus | FR « Sans rendez-vous · sans vernis — Kit de manucure japonaise, le soin du salon, chez vous, sans rendez-vous » · AR « دون موعد · بلا طلاء — كيت المانيكور الياباني، عناية الصالون في بيتكِ، دون موعد » |
| Sorties | `generated/kit-hero-produit/primary/angle-e/_all/01-fini-salon-a-la-maison.png` (4:5, 1200×1500) · `generated/kit-hero-produit/primary/angle-e/_all/01-fini-salon-a-la-maison.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/primary/angle-e/_all/01-fini-salon-a-la-maison.alt.json` |

## Objectif et principe

Slide 1 de l'angle E « le soin du salon, chez vous, sans rendez-vous » : rendu « fini salon » obtenu à la maison, dans un salon marocain, kit et verre de thé à côté.

Principes (01-recherche-principes.md) : 01-A1 résultat · 01-A2 contexte réel (femmes) · 01-C angle E · 01-D au moins une main mûre · 01-A4 main droite

Zone focale : Ongles entre 20 % et 55 % de la hauteur, centre-droit ; kit à gauche du même bandeau. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

**Message match :** si le Reel de cet angle existe, comparer son premier (ou dernier) plan avec ce prompt avant de générer. Si le plan, la main ou la lumière diffèrent, joindre ce frame en dernière image de référence (rôle « composition / lumière ») et ajuster la scène pour reprendre le même plan (01-A11).

## Références à joindre (dans cet ordre)

1. **REF-05** (`references/REF-05-ugc-main-foncee-kit.jpg`) — fidélité produit (coffret réel)
2. **REF-02** (`references/REF-02-pots-ouverts-textures.png`) — fidélité produit
3. **REF-08** (`references/REF-08-resultat-ongles-french-reel.jpg`) — main / peau / ongles
4. **REF-09** (`references/REF-09-ambiance-lumiere-matin.png`) — lumière / ambiance

## Prompt (EN)

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-FULL` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT -->
```text
Photorealistic interior photograph, first-person point of view, slightly high angle: a woman's right hand rests elegantly on the plain woven cushion of a traditional Moroccan sedari sofa (cream and soft sage fabric, subtle tone-on-tone pattern). Hand: medium olive skin (Fitzpatrick III–IV), a mature hand about 52 years old with natural veins and fine lines, inspired by image 3 for nail realism. Nails: neat salon-finish shape, short to medium, bare and natural with a refined buffed shine and crisp highlights, no polish. A sage long sleeve with a fine tone-on-tone trim covers the wrist. On a low wooden table at the left, the FemiGlow kit exactly as in images 1 and 2 (box with lid set aside, two square jars with round sage and pink labels, sky-blue buffer) and a small glass of mint tea. Background: blurred sober salon, warm white walls, a window; no folklore cliché. Soft afternoon window light from the left, as in image 4, warm and calm. 50 mm lens, f/2.5, focus on the nails, the kit slightly softer. Portrait framing, to be cropped to 4:5 and 3:4: the nails sit between 20% and 55% of the frame height, centre-right, with the kit at the left in the same band; lower 35% calm (cushion fabric); 8% clear side margins. Mood: pampered, at home, no appointment needed.
```

## Must include

- Sedari / coussin de salon marocain sobre
- Kit net (labels lisibles si possible) + verre de thé
- Main mûre, ongles « fini salon » naturels

## Must avoid

- Zellige saturé, lanternes en cliché, couleurs criardes
- Plateau en or brillant
- Vernis
- Visage
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Ancre 0.40. Le kit doit rester entier dans le 3:4 (marges 8 %).

```bash
python3 tools/hero_pack.py crop --id HP-PRI-E-ALL-01 --master generated/_work/HP-PRI-E-ALL-01/master.png
```

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Main aux ongles brillants posée sur un coussin de salon marocain, kit FemiGlow à côté",
  "ar": "يد بأظافر لامعة على وسادة صالون مغربي، وبجانبها كيت FemiGlow",
  "en": "Hand with shiny nails on a Moroccan sofa cushion, FemiGlow kit beside it"
}
```
