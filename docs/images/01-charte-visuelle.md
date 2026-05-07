# 01 — Charte visuelle FemiGlow appliquée à l'image

> Ce document est le **filtre commun à toute image** du site. Avant de prompter,
> garder ces règles présentes ; les rappeler dans la section *constraints* du prompt.

## La promesse visuelle en une phrase

Une maison marocaine de soin pour les ongles, un rituel saisonnier en cinq
minutes : **beauté lente, geste précis, lumière douce du matin, mains visibles**.

## Palette — couleurs autorisées

À tirer de `tailwind.config.ts` et `src/styles/globals.css`. À nommer en clair
dans le prompt avec leur **valeur perceptuelle**, pas leur code hex.

| Token | Sens | Manière de le décrire à ChatGPT |
|---|---|---|
| `creme` | fond, papier épais | *warm off-white, hand-made paper feel* |
| `encre` | typo, contour | *deep ink black with a hint of warmth, never pure #000* |
| `sable` | accent calme | *pale sand, dusted, matte* |
| `ambre` | détail chaud | *amber resin, translucent honey* |
| `vert` (sauge) | nature, vie | *muted sage green, herbarium* |
| `rosee` (pétale) | tendresse | *dried rose petal, faded blush* |
| `champagne` | reflet noble | *brushed champagne, never gold or yellow* |
| `ciel` | respiration | *washed sky, dawn linen* |

**Règle dure :** jamais de saturation néon, jamais de cyan vif, jamais de magenta.
Si l'image a une dominante, elle doit pouvoir se poser sur fond `creme` sans
jurer.

## Typographies (si du texte est gravé dans l'image)

- **Cormorant Garamond** — display, élégant, italique italianisant. Pour titres.
- **Inter** — sans serif neutre. Pour corps et étiquettes.
- **Pinyon Script** — script calligraphié. Réservé au mot *FemiGlow*.

Demander **toujours** « no extra text » sauf si le texte est explicitement
demandé. ChatGPT a tendance à inventer des étiquettes parasites.

## Voix d'image — adjectifs autorisés

`slow`, `quiet`, `intimate`, `lived-in`, `unhurried`, `ritual`, `tactile`,
`paper-grain`, `morning`, `Casablanca light`, `craft`, `restraint`, `editorial`.

## Voix d'image — adjectifs interdits

`luxurious` (sonne ostentatoire), `glamorous`, `dramatic`, `bold`, `vibrant`,
`cinematic neon`, `8K hyperreal`, `glossy`, `polished studio`, `magazine cover`,
`influencer`, `commercial`, `aspirational`. Tous trahissent la voix lente.

## Sujet humain — règles d'inclusion

- **Mains visibles** : presque toutes les images doivent montrer des mains
  réelles. Pas de mains parfaites de mannequin — peau réelle, ongles courts à
  moyens, cuticules naturelles, parfois petites imperfections.
- **Diversité** : carnations variées (clair, hâlé, foncé). Représentations
  marocaines réalistes ; éviter le cliché orientaliste.
- **Pas de visage** complet par défaut, sauf portrait Q/R explicite. Les mains
  portent l'humanité.
- **Âges variés** : le rituel n'est pas réservé aux 25 ans.

## Lumière signature

Lumière **diffuse, latérale, du matin** — type rideau de lin filtré, ou
fenêtre orientée nord. Ombres douces, jamais tranchées. Pas de spot, pas de
flash. La règle : *« the kind of light that makes paper feel alive »*.

## Texture & matière

Toujours évoquer une texture tangible : **lin froissé**, **papier épais**,
**verre dépoli**, **bois clair brut**, **céramique non vernie**, **métal
brossé champagne** (jamais doré). Le toucher prime sur le brillant.

## Cadrage par défaut

- Format : privilégier 4:5 (portrait éditorial) ou 3:2 (paysage doux). Carré
  1:1 réservé aux preuves (avant/après, swatches).
- Profondeur : faible profondeur de champ, sujet net, fond légèrement flou
  (mais pas de bokeh exagéré).
- Centrage : sujet décalé tiers gauche ou tiers droit. Espace négatif assumé.
- Caméra : `35mm` ou `50mm`, jamais grand-angle déformant.

## Style photographique de référence

Pour orienter ChatGPT sans dériver vers la pub :
*« editorial still-life, in the spirit of Kinfolk magazine and Aesop catalog
photography — soft natural light, restrained palette, paper-and-linen surfaces,
honest texture, no retouching, no glow, no perfume-ad gloss. »*

## À bannir explicitement (à mettre dans `do not include`)

- text overlays, watermarks, logos, brand names
- people staring at camera, smiling models, influencer poses
- studio backdrops, white seamless paper, photo-shoot equipment
- shiny gold, chrome, glitter, pearlescent paint
- HDR, oversharpening, plastic skin, retouch flaws
- alcohol, candles burning (pour éviter dérive « lifestyle » générique)
- éléments stéréotypés orientalistes (zellige bleu vif tape-à-l'œil, motifs
  saturés). Si zellige il y a, ce sera **un fragment, en sourdine**.

## Cohérence inter-images

Toutes les images du site doivent **pouvoir cohabiter dans une même page** sans
que l'œil détecte de variations de style. Pour y parvenir :

1. Générer chaque famille (héros, packshots, témoignages, journal) dans une
   **session ChatGPT distincte** mais avec **le même préfixe de charte** copié
   au début.
2. Définir une **image-pilote** par famille (la plus réussie) et la donner en
   référence visuelle pour les suivantes (« style and palette consistent with
   image 1 »).
3. Toujours mentionner **la même lumière** (« morning side light through linen
   curtain ») et **le même grain** (« subtle film grain, Kodak Portra feel »).
