# 04 — Design : couleurs, polices, bouton

## 1. Couleurs

### Existant conservé

| Jeton | Valeur | Usage |
|---|---|---|
| `creme` | `#FBF8F1` | Fond |
| `creme-warm` | `#F5EFE3` | Fond des champs |
| `encre` | `#2C2A28` | Texte principal |
| `encre-soft` | `#4A4744` | Texte secondaire |
| `sauge-dark` | `#4F6D52` | Validation, progression |

### Nouveaux jetons

| Jeton | Valeur | Usage |
|---|---|---|
| `--color-action` | `#8E3F3B` | Grenat, bas du dégradé du CTA |
| `--color-action-light` | `#A34A45` | Grenat clair, haut du dégradé |
| `--color-on-action` | `#FFFDF8` | Texte sur le CTA |
| `--color-notice` | `#2F5D8A` | Texte d'erreur |
| `--color-notice-soft` | `#E6EEF5` | Fond d'un champ en erreur |

Le grenat est réservé au CTA final. S'il apparaît ailleurs, il perd sa saillance.

### Contrastes mesurés

| Paire | Ratio | Exigence WCAG AA |
|---|---:|---|
| `#FFFDF8` sur `#8E3F3B` | 7,06 | 4,5 : conforme |
| `#FFFDF8` sur `#A34A45` | 5,70 | 4,5 : conforme |
| `#4A4744` sur `#FBF8F1` | 8,70 | 4,5 : conforme |
| `#2F5D8A` sur `#FBF8F1` | 6,48 | 4,5 : conforme |
| `#2F5D8A` sur `#E6EEF5` | 5,87 | 4,5 : conforme |
| Exemple dans le champ, `#6B675F` sur `#F5EFE3` | 4,92 | 4,5 : conforme |

Le texte `encre/60` utilisé sur le site ne fait que 3,9:1 : il faut l'éviter dans ce formulaire.

### Pourquoi le grenat

| Option | Pour | Contre | Verdict |
|---|---|---|---|
| **Grenat** | Chaud, donc action (`Color.pdf` p. 4). Saturation basse (`Color.pdf` p. 10). Tranche sur crème. Parent du pétale | Proche du rouge : les erreurs doivent changer de couleur | **Recommandé** |
| Encre améliorée | 13,5:1, très premium, zéro risque | Identique à tous les boutons, y compris l'étape 1 | Témoin de l'A/B |
| Sauge foncé | Vert positif | Froid, « plus tard » (`Color.pdf` p. 4). Sert déjà à valider | Écarté |
| Pétale `#B14F4A` | Déjà dans la marque | Sert aujourd'hui aux erreurs ; 4,84:1 | Écarté |

**Conséquence :** les erreurs de cette étape passent en bleu. `petale-dark` reste utilisé ailleurs sur le site.

## 2. Polices

| Élément | Latin | Arabe | Taille | Graisse |
|---|---|---|---:|---:|
| Titre | Cormorant Garamond italique | Sans italique, police arabe du site | 25 px / 21 px | 500 / 600 |
| Label | Inter | Police arabe | 13 px / 14 px | 500 |
| Champ | Inter | Police arabe | 16 px | 400 |
| CTA | Inter | Police arabe | 16 px / 17 px | 500 / 600 |
| Total | Inter | Police arabe | 18 px | 600 |
| Aide et assurance | Inter | Police arabe | 12 à 13 px | 400 |

Règles :

- Cormorant seulement sur le titre : les prix et les champs restent en Inter.
- Jamais d'italique sur un prix (`Fonts.pdf` p. 17).
- Pas de capitales (`Fonts.pdf` p. 13).
- En arabe : aucun `letter-spacing`, aucun italique, interligne d'au moins 1,6.
- `font-variant-numeric: tabular-nums` sur le total, pour éviter qu'il bouge. C'est un choix technique, pas une recommandation Kolenda.

**À vérifier au développement :** la police arabe réellement chargée. La maquette utilise Noto Sans Arabic comme substitut.

## 3. Le bouton

| Propriété | Valeur |
|---|---|
| Largeur | 100 % de la barre |
| Hauteur | 56 px, 48 px clavier ouvert |
| Rayon | 14 px |
| Fond | `linear-gradient(180deg, #A34A45, #8E3F3B)` |
| Ombre | `0 8px 18px rgb(142 63 59 / .3)` et liseré clair intérieur |
| Texte | 16 px, Inter 500, casse mixte |
| Icône | Pastille de 32 px, blanc à 16 %, picto de 19 px |
| Contenu | Icône et texte centrés |

**Pourquoi un bouton plus doux que l'actuel :** le bouton noir, carré et terne en attente paraît inactif. Les coins arrondis et le dégradé léger le rendent plus tactile, sans effet « promotion ».

## 4. Icône

**Choix : un colis fin, dans une pastille.**

| Option | Sens | Verdict |
|---|---|---|
| **Colis** | « Je reçois mon kit ». Concret, lié au paiement à la livraison | **Retenu** |
| Flèche | Forte pour l'attention (`Attention.pdf` p. 37), mais à inverser en RTL et sans lien avec le produit | Variante possible |
| Cadenas | Évoque un paiement sécurisé, alors que rien n'est payé en ligne | Écarté |
| Chariot | Évoque l'ajout au panier | Écarté |
| Coche | Suggère que c'est déjà fait | Réservé à la validation |

Spécification : SVG inline, grille de 20 px, trait de 1,35 px, extrémités rondes, `aria-hidden`. Même style que le picto de `ShippingNotice`, plus fin que les icônes de `lucide-react` par défaut.

Le colis n'a pas de sens de lecture : il n'est pas inversé en arabe.

**Aucune étude ne prouve qu'une icône améliore un CTA.** Elle est ajoutée pour comprendre plus vite ce qui suit, et le test A/B la juge avec le reste.

## 5. Fond du bouton et de la barre

| Zone | Traitement |
|---|---|
| Bouton | Dégradé vertical discret, jamais de dégradé multicolore |
| Barre | `creme` à 96 %, flou léger, filet supérieur, ombre très douce |
| Reste de l'écran | Neutre : le grenat est seul |

Le fond de page ne change pas : si tout attire, plus rien n'attire.

## 6. Micro-animation

| Moment | Effet | Durée | Répétition |
|---|---|---:|---|
| Passage à l'état prêt | Fondu du gris vers le grenat, léger soulèvement de 1 px | 320 ms | Une fois |
| Après 1 s en état prêt | Reflet diagonal, de gauche à droite | 1 300 ms | Toutes les 5 s, **3 fois maximum** |
| Avec le reflet | Le colis monte de 2 px | 400 ms | Idem |
| Tap | `scale(0.98)` | 120 ms | À chaque tap |
| Envoi | Anneau de chargement | 900 ms | Jusqu'à la réponse |

Règles :

- En arabe, le reflet part de la droite.
- Seuls `transform` et `opacity` sont animés, pour rester fluide sur un téléphone d'entrée de gamme.
- Le prix n'est jamais animé (`Pricing.pdf` p. 33).
- Avec `prefers-reduced-motion`, aucun reflet ni mouvement, seulement le changement de couleur.
- Trois passages au maximum : une animation infinie deviendrait agaçante et contraire au ton de la marque.
- Pas de vibration (`Ecommerce.pdf` p. 13-14 la déconseille au paiement).

Les durées sont des choix de conception, pas des valeurs Kolenda. Le guide Luxury suggère seulement la lenteur.

## 7. Champs

- Fond `creme-warm`, filet inférieur, hauteur de 48 px.
- Focus : filet `encre` et halo de 2 px.
- Valide : coche sauge de 16 px en fin de champ.
- Erreur : fond et texte bleus.

## 8. RTL

| Élément | Règle |
|---|---|
| Mise en page | Propriétés logiques (`ms-`, `me-`, `start`) |
| Progression | Se remplit de droite à gauche |
| Reflet | Sens inversé |
| Colis | Non inversé |
| Montants | `dir="ltr"` sur le chiffre, unité arabe |
| Adresse saisie | `dir="auto"` |

## 9. Limite du design

La maquette doit être comparée à la marque sur un vrai téléphone. Un grenat peut paraître plus rouge sur un écran OLED saturé : à vérifier avant la mise en ligne.
