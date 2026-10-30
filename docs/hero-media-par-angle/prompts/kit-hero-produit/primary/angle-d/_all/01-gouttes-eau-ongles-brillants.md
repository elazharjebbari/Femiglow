# HP-PRI-D-ALL-01 — Main sous un filet d'eau, gouttes sur ongles brillants

| Champ | Valeur |
|---|---|
| Identifiant | `HP-PRI-D-ALL-01` |
| Composant / slot | `kit-hero-produit` / `primary` |
| Variante / langue / position | `angle-d` / `_all` (crossLocale) / `01` |
| Priorité | P1 |
| Version du prompt | v1 |
| Composition | image unique (1 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-FULL` |
| Main (casting) | Peau medium-mate (Fitzpatrick IV–V), ~27 ans, manche longue en lin écru retenue au poignet |
| H1 affiché au-dessus | FR « Compatible woudou — Kit de manucure japonaise, des ongles soignés, rien à retirer avant le woudou » · AR « متوافق مع الوضوء — كيت المانيكور الياباني، أظافر مُعتنى بها، ولا شيء يُزال قبل الوضوء » |
| Sorties | `generated/kit-hero-produit/primary/angle-d/_all/01-gouttes-eau-ongles-brillants.png` (4:5, 1200×1500) · `generated/kit-hero-produit/primary/angle-d/_all/01-gouttes-eau-ongles-brillants.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/primary/angle-d/_all/01-gouttes-eau-ongles-brillants.alt.json` |

## Objectif et principe

Slide 1 de l'angle D « compatible woudou : rien à retirer avant le woudou » : l'eau passe sur l'ongle nu qui brille. Sobre, pudique, aucune mise en scène religieuse.

Principes (01-recherche-principes.md) : 01-A1 résultat · 01-C angle D (eau, gouttes, cadrage sobre, poignets couverts) · 01-D pudeur, pas de prière · 01-A6 mouvement suggéré (filet d'eau)

Zone focale : Filet d'eau + ongles entre 15 % et 55 % de la hauteur, centre. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

**Message match :** si le Reel de cet angle existe, comparer son premier (ou dernier) plan avec ce prompt avant de générer. Si le plan, la main ou la lumière diffèrent, joindre ce frame en dernière image de référence (rôle « composition / lumière ») et ajuster la scène pour reprendre le même plan (01-A11).

## Références à joindre (dans cet ordre)

1. **REF-07** (`references/REF-07-resultat-ongles-peau-foncee.png`) — main / peau / ongles
2. **REF-04b** (`references/REF-04b-rituel-etapes-crop.png`) — niveau de brillance des ongles
3. **REF-10** (`references/REF-10-ugc-maison.jpg`) — lumière / ambiance (vraie vie à la maison)
4. **REF-06** (`references/REF-06-ugc-composition-marbre.jpg`) — fidélité produit

## Prompt (EN)

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-FULL` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT -->
```text
Photorealistic photograph, first-person point of view: a woman holds her right hand, palm down, under a thin clear stream of water from a simple matte brushed-steel tap over a white basin. Use image 1 for skin and hand: medium-tan skin (Fitzpatrick IV–V), about 27 years old. Short bare natural nails with a natural shine like image 2; droplets bead on the nails, each still showing a crisp highlight. No polish. The hand enters from the lower right; the stream touches the back of the fingers just behind the nails. An ecru linen long sleeve is held at the wrist bone and stays dry; the forearm is covered. Setting: a calm Moroccan bathroom with warm off-white tadelakt plaster walls, as real and lived-in as image 3. On a shelf, upper left and out of focus, the FemiGlow kit from image 4. Soft daylight from a small window on the left, fresh and clean, droplets sparkling. 50 mm lens, f/2.8, fast shutter freezing the droplets, focus on the middle nail. Portrait framing, to be cropped to 4:5 and 3:4: the tap mouth, the stream and the nails sit between 15% and 55% of the frame height, centred; lower 35% calm (out-of-focus basin and sleeve); 8% clear side margins. Mood: pure, simple, respectful.
```

## Must include

- Filet d'eau fin et gouttes nettes sur les ongles
- Manche couvrant le poignet
- Main droite seule, paume vers le bas
- Kit flou à l'arrière-plan

## Must avoid

- Tapis de prière, chapelet, aiguière décorative, mosquée, calligraphie ou tout texte religieux
- Visage, pieds, bras nus
- Robinet doré brillant
- Mousse de savon
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Ancre 0.35 (garder le bec du robinet dans le cadre).

```bash
python3 tools/hero_pack.py crop --id HP-PRI-D-ALL-01 --master generated/_work/HP-PRI-D-ALL-01/master.png
```

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Gouttes d’eau sur des ongles naturels brillants sous le robinet, rien à retirer",
  "ar": "قطرات ماء على أظافر طبيعية لامعة تحت الصنبور، دون أي طبقة تُزال",
  "en": "Water drops on shiny natural nails under the tap, nothing to remove"
}
```
