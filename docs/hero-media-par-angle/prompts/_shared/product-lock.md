# Verrou produit — kit FemiGlow

Description du produit à coller **verbatim** dans chaque prompt, juste après la bible de style.
Deux blocs selon le champ `productLock` du manifest :

- `full` → **`PROMPT-BLOCK-FULL`** : le kit (ou une partie) apparaît dans l'image ;
- `absent` → **`PROMPT-BLOCK-ABSENT`** : aucune partie du kit ne doit apparaître (macros d'ongles, avant/après sans produit). Sans ce bloc, le modèle a tendance à inventer un flacon ou un pot.

Sources : observation directe des références (REF-02, REF-03, REF-05, REF-06, REF-10 = produit réel ; REF-04b = contenus et gestes) et `../../02-references-et-style.md` §0, §4.

## Ce que montrent les références (constats)

| Élément | Produit réel (à reproduire) | Écarts vus dans certaines références (à ne pas copier) |
|---|---|---|
| Pots | **Deux** pots carrés bas (≈ 4,5 cm de côté, ≈ 3 cm de haut), verre transparent épais, angles arrondis facettés qui accrochent la lumière ; couvercle transparent | REF-01 montre le pot 1 rempli de poudre ; REF-01 et REF-09 rendent les labels en sérif |
| Label pot 1 | Pastille ronde mate **sauge pâle**, texte gris chaud fin **sans empattement** : « 1 » / « paste », puis « FemiGlow » en script | Couvercle métal sans pastille (`kit-detail-mains.png`) |
| Label pot 2 | Pastille ronde mate **rose poudré** : « 2 » / « powder » / « FemiGlow » script | « 2 fortifiant » + résine ambrée (`kit-fortifiant.png`) |
| Contenus | Pot 1 : **crème ivoire épaisse et lisse** ; pot 2 : **poudre blanche fine légèrement nacrée** (REF-02, REF-04b) | — |
| Polissoir | Bloc rectangulaire 4 faces (≈ 9,5 × 2,5 × 2,5 cm), **face supérieure bleu ciel saturé**, flancs blancs avec une fine strate grise ; texte « Step ④ Polish & Shine », le 4 blanc dans une pastille sombre | REF-01/REF-09 : bleu très pâle et « Step 4 — Polish & Shine » ; polissoir sauge (`hero-lifestyle.png`) |
| Coffret | Couvercle blanc cassé, vague **sauge** en bas à gauche, vague **rose** à droite, « FemiGlow » en script gris chaud, « MANICURE TREATMENT KIT » en petites capitales espacées, petit ornement feuille, « Natural Nail Care System » en petit sérif ; **base sauge pâle** avec cale crème (REF-04, REF-05, REF-06) | Coffret REF-01 sans mentions « MANICURE TREATMENT KIT » |
| Interdits | — | 3e pot (pot à feuille, « 3 shine »), « fortifiant », couvercle métal, lime céramique |

Décision : **REF-01 n'est pas joint par défaut** (labels sérif, « Step 4 — », pot 1 en poudre). Le produit est verrouillé par REF-02 (labels nets, bon bleu, textures), REF-03 (label en macro), REF-05/REF-06 (couleurs et coffret réels).

## PROMPT-BLOCK-FULL

<!-- PROMPT-BLOCK-FULL -->
```text
PRODUCT LOCK — the FemiGlow Japanese manicure kit. Whenever any part of it appears, reproduce it exactly as in the attached product reference images; never redesign it. (1) Exactly TWO small jars, never three: squat square jars of thick crystal-clear glass, about 4.5 cm wide and 3 cm high, with softly rounded faceted corners that catch the light, and a clear lid. (2) Each lid carries one round matte paper label covering most of the lid. Jar 1: pale sage-green label printed in thin warm-grey sans-serif with "1" on the first line, "paste" on the second line and "FemiGlow" in a small elegant script below. Jar 2: pale powder-pink label with "2", "powder" and "FemiGlow" in the same typography. (3) Jar 1 holds a thick smooth ivory cream; jar 2 holds a fine loose white powder with a faint pearly sheen. (4) One rectangular four-sided nail buffer block, about 9.5 x 2.5 x 2.5 cm: saturated sky-blue top face, white sides with a thin grey middle layer, printed in dark grey sans-serif "Step 4 Polish & Shine" where the 4 is a white numeral inside a small dark filled circle. (5) The gift box, when shown: off-white lid with a soft sage-green wave at the lower left and a blush-pink wave on the right, "FemiGlow" in a flowing warm-grey script, "MANICURE TREATMENT KIT" in small spaced capitals, a tiny leaf ornament, "Natural Nail Care System" in small serif type; pale sage box base with a cream insert. (6) These printed labels are the only text allowed; spell them exactly as written or leave them softly out of focus, never misspelled, never translated. Never: a third jar, the word "fortifiant", amber or yellow resin, metal or gold lids, droppers, bottles, nail-polish bottles, a sage or pink buffer, a ceramic file, any other logo.
```

## PROMPT-BLOCK-ABSENT

<!-- PROMPT-BLOCK-ABSENT -->
```text
PRODUCT: no FemiGlow product and no cosmetic product of any kind appears in this image — no jar, bottle, tube, buffer, file, nail-polish bottle or packaging. The image shows only the hand, the nails and the described setting.
```

## Contrôles produit (QA)

1. Exactement **2 pots** carrés à angles facettés, en verre transparent ; aucun 3e pot.
2. Pastilles rondes : **sauge = « 1 paste »**, **rose = « 2 powder »**, « FemiGlow » en script ; jamais inversées.
3. Pot 1 = crème ivoire ; pot 2 = poudre blanche nacrée (quand ils sont ouverts).
4. Polissoir **bleu ciel saturé**, flancs blancs/gris, « Step ④ Polish & Shine » (ou flou, jamais faux).
5. Coffret : vagues sauge/rose, « FemiGlow » script, « MANICURE TREATMENT KIT », « Natural Nail Care System ».
6. Aucun couvercle métallique ou doré, aucun « fortifiant », aucun texte inventé.

Note : dans le bloc, le cercle « ④ » est décrit en mots (« the 4 is a white numeral inside a small dark filled circle ») car certains modèles rendent mal le caractère Unicode ④. Le texte attendu sur l'objet reste **« Step ④ Polish & Shine »**.
