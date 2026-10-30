# Liste d'exclusion (« avoid ») — collée en fin de chaque prompt

Les modèles type gpt-image n'ont pas de champ « negative prompt » : la liste est ajoutée **en fin de prompt**, sous forme de consignes « Avoid: … ». Chaque élément renvoie à une règle de `01-recherche-principes.md` (F = anti-patterns) ou de `02-references-et-style.md`.

| Catégorie | À éviter | Pourquoi |
|---|---|---|
| Ongles | vernis, gel, semi-permanent, top coat bombé, capsules, faux ongles, nail art, French peinte, couleur, ongles longs en amande ou stiletto, effet miroir plastique | Contredit la promesse « sans vernis » (F5) |
| Main | main gauche active, main tendue vers l'objectif, doigts en trop/en moins, mains de stock caucasiennes manucurées, peau plastique | F4, F11, 01-A8 |
| Personne | visage, regard caméra, bouche, cheveux au premier plan, bras nus, décolleté | F2, 01-D pudeur |
| Accessoires | bagues, bracelets, montres voyantes, henné, tatouages, bijoux dorés | 01-D (henné, bijoux en slide 1) |
| Produit | 3e pot, « fortifiant », résine ambrée, couvercle métal/doré, flacons, compte-gouttes, pinceau, lampe UV, lime céramique, polissoir sauge/rose, autre logo | 02 §3, §5 (« ne jamais utiliser ») |
| Texte | tout texte incrusté : titres, prix, « 99 DH », codes promo, flèches, « avant/après », chiffres en surimpression, filigranes, légendes | F3, 01-D |
| Esthétique | néon, cyan vif, magenta, or brillant, chrome, glitter, HDR, sur-saturation, zellige saturé, clichés folkloriques | 02 §4 charte |
| Religieux (angle D surtout) | tapis de prière, chapelet, mosquée, calligraphie, texte religieux, aiguière décorative, pose de prière | 01-C angle D, 01-D |
| Composition | point focal dans le tiers inférieur, éléments clés collés aux bords, collage, plusieurs points focaux, séquence horizontale gauche-droite | F10, F13, F7 |

## PROMPT-BLOCK

<!-- PROMPT-BLOCK -->
```text
Avoid: nail polish, gel, semi-permanent or acrylic nails, press-on tips, nail art, painted French tips, coloured or glossy-plastic nails, long almond or stiletto nails; a left hand as the active hand, a hand reaching toward the camera, extra or missing fingers, distorted knuckles, plastic skin; any face, eyes or mouth, bare arms, cleavage; rings, bracelets, gold jewellery, henna, tattoos; a third jar, the word "fortifiant", amber resin, metal or gold lids, droppers, brushes, UV lamps, ceramic files, a sage or pink buffer, other brands or logos; any added text, prices, numbers, arrows, captions or watermarks; neon, vivid cyan, magenta, glitter, chrome, HDR, oversaturated colours, saturated zellige or folklore clichés; prayer rugs, prayer beads, mosques, calligraphy or any religious staging; key elements placed in the bottom third or touching the frame edges.
```
