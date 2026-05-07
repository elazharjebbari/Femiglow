# 03 — Inventaire des images du site

> Liste exhaustive, organisée par page. Chaque entrée donne **le path attendu**,
> le **ratio**, et un **plan court (1-3 lignes)** disant ce que l'image doit
> incarner. **Pas de prompt détaillé** — celui-ci se construit en combinant
> [01-charte-visuelle.md](01-charte-visuelle.md) + [02-guide-prompting.md](02-guide-prompting.md)
> avec l'intention notée ici.

## Légende

- **Path** : emplacement final dans `apps/web/public/` ou cible OG.
- **Ratio** : format demandé au modèle.
- **Famille** : groupe de cohérence (à générer dans la même session).
- **Doit incarner** : l'idée centrale, en français, en une phrase.

---

## Page d'accueil — `/` (TOFU)

### H-01 · Hero home
- **Path** : `/images/hero-home.{avif,webp}` · **Ratio** : 3:2 (1200×800)
- **Famille** : héros
- **Doit incarner** : le geste suspendu — une main au calme posée sur du lin
  beige, l'autre approche un pot ambré ; matin marocain qui s'éveille, pas
  encore le rituel, mais la promesse du rituel.

### H-02 à H-04 · Trois mains de témoignage
- **Path** : `/avis/mains-{ines,salma,yasmine}.{avif,webp}` · **Ratio** : 1:1 (360×360)
- **Famille** : témoignages
- **Doivent incarner** : trois mains réelles, trois carnations, trois âges
  différents, ongles entretenus mais non vernis, posés sur trois surfaces du
  quotidien (papier, lin, bois). Pas de pose — l'instant après le rituel.

### S-01 · Open Graph home
- **Path** : `/og/home.png` · **Ratio** : 1.91:1 (1200×630)
- **Famille** : social
- **Doit incarner** : la même hero, recadrée pour laisser de l'air au texte
  superposé (titre + signature Pinyon Script). Lecture rapide en miniature.

---

## Page Rituel — `/rituel` (MOFU narratif)

### R-01 · Hero lifestyle rituel
- **Path** : `/rituel/hero-lifestyle.{avif,webp}` · **Ratio** : 4:3 (1920×1440)
- **Famille** : héros
- **Doit incarner** : un coin de table à Casablanca au matin, lin écru,
  céramique non vernie, deux mains qui exécutent le **deuxième geste du
  rituel** (le polissage). Lenteur, pas de précipitation.

### R-02 · Origine sépia
- **Path** : `/rituel/origine-sepia.{avif,webp}` · **Ratio** : 16:9 (640×480)
- **Famille** : éditorial
- **Doit incarner** : photographie d'archive virée sépia, ambiance années 1920,
  une main féminine japonaise qui polit ses ongles avec une poudre fine. Le
  geste fondateur, intemporel.

### R-03 · Portrait Salma (interview)
- **Path** : `/rituel/portrait-salma.{avif,webp}` · **Ratio** : 3:4 (360×480)
- **Famille** : portraits
- **Doit incarner** : femme marocaine vue de **trois quarts dos**, lumière de
  fenêtre sur l'épaule, on devine sa main qui repose sur une tasse. L'écoute
  plus que l'image — c'est elle qui parle dans la Q/R.

### R-04 · Poster vidéo « 4 gestes »
- **Path** : `/videos/rituel-poster.{avif,webp}` · **Ratio** : 16:9 (1280×720)
- **Famille** : héros
- **Doit incarner** : image fixe avant lecture vidéo — deux mains au-dessus
  d'un plateau de céramique, lime fine en suspension, instant juste avant le
  premier geste. Invitation, pas démonstration.

### S-02 · Open Graph rituel
- **Path** : `/og/rituel.png` · **Ratio** : 1.91:1
- **Famille** : social
- **Doit incarner** : variation calme de R-01, plus aérée, palette sourde, prête
  à recevoir le titre *« Le rituel, en cinq minutes »*.

---

## Page Kit — `/kit` (BOFU conversion)

### K-01 · Hero produit (packshot 3 pots)
- **Path** : `/products/kit-principale.{avif,webp}` · **Ratio** : 4:5 (800×1000)
- **Famille** : packshots
- **Doit incarner** : les trois pots du kit alignés sur fond crème, légèrement
  décalés en profondeur, lumière latérale qui révèle la matière du verre dépoli
  et l'étiquette typographique. Étrangement vivant pour un packshot.

### K-02 · Pot « Base »
- **Path** : `/products/kit-base.{avif,webp}` · **Ratio** : 1:1 (360×360)
- **Famille** : packshots
- **Doit incarner** : le pot seul, pris d'un léger trois quarts, on devine la
  texture poudreuse à l'intérieur. Élément d'une trinité, autonome mais discret.

### K-03 · Pot « Fortifiant »
- **Path** : `/products/kit-fortifiant.{avif,webp}` · **Ratio** : 1:1
- **Famille** : packshots
- **Doit incarner** : même grammaire que K-02 mais teinte ambrée plus marquée
  (huile). La continuité de la trinité.

### K-04 · Lime de céramique
- **Path** : `/products/kit-lime.{avif,webp}` · **Ratio** : 1:1
- **Famille** : packshots
- **Doit incarner** : la lime posée sur lin, surface mate gris-sable, geste
  d'objet artisanal. Pas un outil, un instrument.

### K-05 · Détail mains en usage
- **Path** : `/products/kit-detail-mains.{avif,webp}` · **Ratio** : 4:3 (640×480)
- **Famille** : héros
- **Doit incarner** : gros plan d'un index qui prélève un peu de poudre dans le
  pot ouvert. La preuve de l'usage réel, sans modèle, sans visage.

### K-06 à K-11 · Avant/après mains × 3 témoins
- **Path** : `/testimonials/hands-{amal,lina,sara}-{avant,apres}.{avif,webp}`
- **Ratio** : 1:1 (360×360) — six images
- **Famille** : témoignages
- **Doivent incarner** : trois femmes différentes, prise au jour 0 puis au jour
  21. Variation **discrète mais lisible** (forme, nuance, hydratation). Surtout
  pas de transformation publicitaire — la beauté lente assume sa mesure.

### S-03 · Open Graph kit
- **Path** : `/og/kit.png` · **Ratio** : 1.91:1
- **Famille** : social
- **Doit incarner** : variation paysage de K-01, espace texte à droite pour le
  titre *« Le kit, trois objets »*.

---

## Page Journal — `/journal` (Editorial hub)

15+ illustrations de têtes d'articles. **Toutes** dans la même famille, même
grain, même palette, mais chacune doit dire son sujet.

### J-01 · `avril-soleil-bas.{avif,webp}` · 4:5
Le soleil d'avril qui rase les murs blancs, ombre allongée d'une plante
sur du lin clair. Saisonnier, entre hiver et printemps.

### J-02 · `cinq-minutes-le-soir.{avif,webp}` · 4:5
Un coin de table après le dîner, lampe basse, tasse refroidie ; on devine
qu'on s'apprête au rituel. Calme du soir, intimité.

### J-03 · `hiver-ongles-patience.{avif,webp}` · 4:5
Mains protégées par un gant de laine fine, posées sur un livre. Patience,
sobriété, l'hiver demande moins mais demande mieux.

### J-04 · `huile-d-argan-vraie.{avif,webp}` · 4:5
Une fiole en verre brut posée près d'un fruit d'argan ouvert, lumière
chaude du Maroc rural. Vérité de la matière, traçabilité.

### J-05 · `la-cuisine-comme-laboratoire.{avif,webp}` · 4:3
Plan de travail en bois, pots d'épices entrouverts, balance laiton.
Cuisine = laboratoire de la beauté domestique.

### J-06 · `la-maison-au-printemps.{avif,webp}` · 4:5
Rideau qui bouge, fleurs séchées sur table basse, lumière vert tendre
filtrée. Renouveau intérieur.

### J-07 · `la-poudre-de-kaolin.{avif,webp}` · 4:5
Bol de céramique blanche, poudre de kaolin tombée à côté, traçant un
petit cercle. Matière première brute, geste d'exploration.

### J-08 · `la-table-comme-atelier.{avif,webp}` · 4:3
Table en bois clair, outils du rituel disposés en demi-cercle, mains au
travail en bord de cadre. Atelier domestique.

### J-09 · `matieres-d-ailleurs.{avif,webp}` · 4:5
Petit étalage : une feuille séchée, un éclat de céramique, un fil de lin
brut, un coquillage. Origines diverses, mêmes valeurs.

### J-10 · `pluie-de-mars.{avif,webp}` · 4:5
Vue depuis l'intérieur, gouttes de pluie sur vitre, plante en silhouette.
Saison qui ralentit, qui invite au rituel.

### J-11 · `ranger-son-rituel.{avif,webp}` · 4:5
Un petit tiroir de bois entrouvert, les trois pots du kit alignés à
l'intérieur sur du papier de soie. Rituel = lieu autant que geste.

### J-12 · `voix-d-amal.{avif,webp}` · 1:1 (480×480)
Portrait de mains tenant une tasse, près d'un carnet ouvert, encre noire.
Voix d'auteure, signature manuscrite implicite.

### J-13 · `voix-de-lina.{avif,webp}` · 1:1
Variation : mains qui referment un livre. Même grammaire que J-12, autre
geste.

### J-14 · `voix-de-sara.{avif,webp}` · 1:1
Variation : mains qui rangent un foulard. Trois auteures, trois objets
familiers.

### J-15 · `visiter-l-atelier.{avif,webp}` · 4:3
Vue large d'une pièce d'atelier à Casablanca, plâtre clair, bois, pots
sur étagère. Promesse d'un lieu réel.

### S-04 · Open Graph journal
- **Path** : `/og/journal.png` · **Ratio** : 1.91:1
- **Famille** : social
- **Doit incarner** : montage sobre de 3 vignettes du journal en grille très
  espacée, sur fond crème. *« Le journal — saisons et matières. »*

---

## Page Maison — `/maison` (Marque storytelling)

### M-01 · Hero maison
- **Path** : `/images/maison-hero.{avif,webp}` · **Ratio** : 4:3 (1920×1440)
- **Famille** : héros
- **Doit incarner** : large vue d'un atelier authentique à Casablanca — plâtre,
  bois clair, fenêtre voilée, étagère de pots ; aucune personne, mais le
  sentiment qu'on vient de sortir. Le lieu existe.

### M-02 · Fondatrice — mains en geste
- **Path** : `/maison/fondatrice-mains.{avif,webp}` · **Ratio** : 4:5 (640×800)
- **Famille** : portraits
- **Doit incarner** : mains de la fondatrice (femme adulte, peau hâlée
  réelle, ongles courts) en train de **tamiser une poudre fine** au-dessus
  d'un bol. Pas le visage. Le faire (pas la figure).

### M-03 à M-05 · Trois plans d'atelier
- **Path** : `/maison/atelier-{1,2,3}.{avif,webp}` · **Ratio** : 4:3 (800×600)
- **Famille** : éditorial
- **Doivent incarner** :
  - **M-03** : table de mélange — balance laiton, poudres en pots ouverts.
  - **M-04** : étagère de stockage — pots étiquetés à la main, ordre tranquille.
  - **M-05** : coin lecture / formulation — carnet ouvert, plume, fioles à
    l'arrière-plan. Le travail intellectuel autant que manuel.

### S-05 · Open Graph maison
- **Path** : `/og/maison.png` · **Ratio** : 1.91:1
- **Famille** : social
- **Doit incarner** : recadrage paysage de M-01, place pour le titre
  *« Maison FemiGlow — Casablanca »*.

---

## Page Article — `/journal/[slug]`

Pas d'image dédiée nouvelle : on **réutilise** la featured image J-01..J-15.

### Optionnel — avatar auteur
- **Path** : `/journal/auteurs/{slug}.{avif,webp}` · **Ratio** : 1:1 (160×160)
- **Famille** : portraits
- **Doit incarner** : extrait recadré (160×160) d'un détail de mains de
  J-12/J-13/J-14, jamais un visage frontal. Cohérent avec la voix d'image.

---

## Pages sans image dédiée

- **Panier** `/panier` : réutilise `K-02..K-04` en 96×96 ou 120×120.
- **Commander** `/commander` : aucune image (formulaire + icones SVG).
- **Merci** `/merci` : aucune image (texte + icone réussite SVG).
- **Contact** `/contact` : aucune image obligatoire.

---

## Récapitulatif quantitatif

| Famille | Compte | À générer dans une session ChatGPT dédiée |
|---|---|---|
| Héros | 4 | H-01, R-01, K-05, M-01 |
| Packshots | 4 | K-01, K-02, K-03, K-04 |
| Témoignages mains | 9 | H-02..H-04, K-06..K-11 |
| Portraits | 2-5 | R-03, M-02 (+avatars optionnels) |
| Éditorial / Journal | 18 | R-02, R-04, J-01..J-15, M-03..M-05 |
| Social Open Graph | 5 | S-01..S-05 |
| **Total uniques** | **~42** | + variantes responsives (srcset, AVIF/WebP) |

**Conseil de production :** générer dans cet ordre — héros → packshots →
témoignages → éditoriaux journal → portraits → social. Chaque famille close
avant d'ouvrir la suivante.
