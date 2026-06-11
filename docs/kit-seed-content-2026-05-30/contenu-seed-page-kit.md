# Contenu seed de la page `/kit` — FemiGlow

> **Objet** — Ce document recense **tout le contenu seed** affiché sur la page produit `/kit`, composant par composant, dans l'ordre où il apparaît à l'écran. Il décrit pour chaque section : son rôle dans le tunnel de conversion (playbook Kolenda), la source technique du contenu, et le **texte exact** servi par défaut (locale FR).
>
> - **Date** : 2026-05-30
> - **Locale documentée** : `fr` (défaut). Des miroirs `ar` / `en` existent (`kit.ar.ts`, `kit.en.ts`, `messages/{ar,en}.json`) mais ne sont pas repris ici.
> - **Périmètre** : route `/[locale]/kit` (et legacy `/(marketing)/kit`).

---

## 1. Comment le contenu est assemblé

La page `/kit` est une page serveur (`KitPage`) qui agrège plusieurs sources, puis délègue le rendu à un **layout** (`KitPageLayoutV1` ou `KitPageLayoutV2`) selon un feature flag.

### 1.1 Sources du contenu seed

| Source | Fichier | Ce qu'elle fournit |
| --- | --- | --- |
| **CMS mock — page kit** | `apps/web/src/data/mock/kit.ts` (`mockKitPageContent`) | Composition détaillée, vidéo, comparatif, FAQ, témoignages mains, réassurances, cross-links journal |
| **CMS mock — produit** | `apps/web/src/data/mock/product.ts` (`mockKit`) | Nom, tagline, description, prix, devise, images, composition courte, SKU |
| **Feed produit (builder pur)** | `apps/web/src/lib/products/feed/kit-feed.ts` | Hero pack (prix, value breakdown, micro-copy), 4 gestes, 3 promesses, social proof |
| **Libellés de section (i18n)** | `apps/web/messages/fr.json` → `marketing.kit.*` | Kickers, titres, descriptions, colonnes, labels avant/après, CTA |
| **Avis « voix de la maison »** | `apps/web/src/lib/rituals/seed-data.ts` (`SEED_RITUALS`) | 50 avis seedés en BDD (module rituels + drawer mur d'avis) |
| **Wizard commander** | `apps/web/src/components/sections/KitCommanderSection.tsx` | Libellés du tunnel de commande embarqué |

> ⚠️ **Important** : les *headers* de section (kicker / titre / description) ne vivent **pas** dans `kit.ts` mais dans `messages/fr.json` sous `marketing.kit`. Le mock CMS porte la « matière » (composition, FAQ, témoignages…), l'i18n porte l'« habillage » éditorial des sections.

### 1.2 Les deux layouts

Le rendu est piloté par le flag `NEXT_PUBLIC_KIT_LAYOUT_V2` (`apps/web/src/lib/feature-flags/kit-layout.ts`) :

- **Défaut actuel : `v1`** (14 sections, ordre historique).
- **`v2`** (refonte Kolenda, 10 sections) — wizard remonté après le pack, sections Comparatif + PivotFinal retirées.
- Override possible par query string `?layout=v2` / `?layout=v1` (preview interne, sans impact SEO — le canonical reste `/kit`).

#### Ordre des sections

| # | Layout V1 (défaut) | Layout V2 (Kolenda) |
| --- | --- | --- |
| 1 | Hero produit | Hero produit |
| 2 | **Wizard commander** | Composition |
| 3 | Composition | Vidéo 4 gestes |
| 4 | Vidéo 4 gestes | Pack + Steps (ProductFeed) |
| 5 | Ingrédients détaillés | **Wizard commander** |
| 6 | Pack + Steps (ProductFeed) | Témoignages mains |
| 7 | **Comparatif** *(V1 only)* | Ingrédients détaillés |
| 8 | Voix de la maison (rituels) | Voix de la maison (rituels) |
| 9 | FAQ | FAQ |
| 10 | Témoignages mains | Journal (3 lectures) |
| 11 | **PivotFinal** *(V1 only)* | Mur d'avis (drawer) |
| 12 | Journal (3 lectures) | — |
| 13 | Mur d'avis (drawer) | — |

Le reste de ce document décrit **chaque composant et son contenu seed**, indépendamment du layout (l'ordre de lecture suit la V2, plus représentative de l'expérience cible).

---

## 2. Données produit globales (`mockKit`)

Réutilisées par le Hero, le ProductFeed, le JSON-LD et le wizard.

| Champ | Valeur seed |
| --- | --- |
| `id` | `fg-kit-001` |
| `slug` | `le-rituel` |
| `name` | **Pack FemiGlow** |
| `tagline` | *Manucure japonaise. Deux gestes, un polissoir, un éclat.* |
| `description` | *Le pack FemiGlow réunit deux pots — une paste lissante et une powder lustrante — et un polissoir Step 4 Polish & Shine. Une manucure japonaise, formulée à Rabat par notre équipe. Sans vernis. Sans abrasion. Cinq minutes par jour suffisent.* |
| `priceCents` | `28900` → **289 MAD** (prix de référence barré) |
| `promoPriceCents` | `19900` → **199 MAD** (prix payé) |
| `currency` | `MAD` |
| `inStock` | `true` |
| `estimatedShipping` | *Rabat : 24 h. Maroc : 48 à 72 h. Livraison offerte.* |
| `primaryVariantSku` | `FEMI-KIT-100` |
| `primaryVariantId` | `pvar_0c01jxc1yn4kjp3b` |

**Images produit :**

1. `/products/kit-principale.png` (1600×2000) — *Pack FemiGlow ouvert sur fond pastel — pot paste vert sauge, pot powder rose poudré, polissoir Step 4 bleu ciel, vague rose poudré, typographie FemiGlow*
2. `/products/kit-detail-mains.png` (1600×1067) — *Mains aux ongles nus, courts à moyens, naturellement brillants après le rituel paste-powder-polish*

**Composition courte (`product.composition`)** — utilisée en résumé :

| Pièce | Origine | Description |
| --- | --- | --- |
| 1 Paste | Atlas marocain · Souss-Massa | Pâte crème onctueuse. Cire d'abeille, huile de jojoba, tocophérol. Filme la plaque sans l'étouffer. |
| 2 Powder | Maroc · Asie biologique | Poudre fine blanche. Talc cosmétique, poudre de riz, silice. Absorbe l'excès, lustre la surface. |
| Polissoir Step 4 Polish & Shine | Atelier de Rabat · kaolin de Marrakech | Polissoir rectangulaire bleu ciel. Trois faces, trois grains. Révèle la brillance naturelle. |

---

## 3. Section 1 — Hero produit (`HeroProduitBound`)

**Rôle** : première zone de conversion. CTA principal qui scrolle vers le wizard. Affiche prix, économie, réassurances et badge avis.

**Source** : `mockKit` (produit) + `marketing.kit.hero.*` (libellés) + count avis depuis le module rituels.

**Contenu seed :**

- **Kicker** : *Le rituel*
- **Nom affiché** : *Pack FemiGlow* (depuis `content.product.name`)
- **Tagline** : *Manucure japonaise. Deux gestes, un polissoir, un éclat.*
- **Prix payé** : **199 MAD** — **Prix barré** : 289 MAD
- **Badge économie** : *Économie 90 MAD* (`savings` = 289 − 199)
- **CTA principal** : *Commander le rituel*
- **Chips (bénéfices courts)** : *Sans vernis* · *Sans UV* · *Sans acétone*
- **Trust row** : *Livraison offerte* · *Paiement à la livraison*
- **Badge avis** : nombre dynamique = total des avis du module rituels (≈ 47 en BDD seedée), libellé *« N avis »*, ancre cliquable vers `#rituals-module-title`.
  - `reviews_aria` : *Note {rating} sur 5 basée sur {count} avis*

**Réassurances (`content.reassurances`)** affichées sous le hero :

| Icône | Label | Détail |
| --- | --- | --- |
| `shipping` | Livraison offerte | Rabat 24 h — Maroc 48 à 72 h |
| `return` | Retour 30 jours | Même entamé |
| `payment` | Paiement à la livraison | Vérifiez avant de payer |

---

## 4. Section 2 — Composition (`CompositionRevealBound`)

**Rôle** : preuve 1, qualité de la formule. Trois cartes révélant les trois objets du pack.

**Source** : `content.composition` (3 items dans `kit.ts`) + header `marketing.kit.composition.section`.

**Header de section :**

- **Kicker** : *La composition*
- **Titre** : *Trois objets, trois gestes.*
- **Description** : *Le kit tient dans une main. Chaque pièce a sa place dans le geste, sa place sur la table de chevet, sa place dans la saison.*
- **CTA de carte** : *Lire le détail*

### 4.1 Carte « 1 Paste » (`id: 1-paste`)

- **Sensation** : *Tiède au contact.*
- **Couleur d'accent** : `sauge`
- **Volume** : 15 g
- **Indice d'usage** : *une noisette filme dix doigts*
- **Description courte** : *Pâte crème onctueuse. Filme la plaque sans l'étouffer. Une noisette suffit.*
- **Narratif** : *12 % de cire d'abeille fondue à basse température par la coopérative apicole du Moyen Atlas. Trois minutes de pose, le fini est mat.*
- **Image** : `/products/kit-base.svg` (1200×1500) — *Pot carré transparent à bords facettés, étiquette circulaire vert sauge "1 paste", pâte crème onctueuse*
- **Certifications** : Cosmos Organic (Ecocert) · Vegan (EVE Vegan)

**Ingrédients :**

| Ingrédient | INCI | Fonction | Origine | % | Définition INCI |
| --- | --- | --- | --- | --- | --- |
| Cire d'abeille | Cera Alba | Filmogène naturel | Coopérative apicole, Atlas marocain | 12 | Nom officiel de la cire d'abeille pure. Filme l'ongle sans le sceller, laisse respirer la plaque. |
| Huile de jojoba | Simmondsia Chinensis Seed Oil | Hémisphage des cuticules | Cultures biologiques, Souss-Massa | 8 | Cire végétale liquide, proche du sébum naturel. Assouplit les cuticules sans graisser. |
| Tocophérol | Tocopherol | Antioxydant | Origine végétale, Europe | 0,5 | Vitamine E d'origine végétale. Préserve les huiles de la formule du rancissement. |

### 4.2 Carte « 2 Powder » (`id: 2-powder`)

- **Sensation** : *Glisse, ne grise pas.*
- **Couleur d'accent** : `petale`
- **Volume** : 8 g
- **Indice d'usage** : *une pincée lustre toute la main*
- **Description courte** : *Poudre fine blanche, déposée sur la paste. Absorbe l'excès, lustre la surface.*
- **Narratif** : *Poudre minérale fine, déposée juste après la paste. Le talc absorbe le surplus, la silice lustre la surface. Pas de blanc, pas de gris.*
- **Image** : `/products/kit-fortifiant.svg` (1200×1500) — *Pot carré transparent à bords facettés, étiquette circulaire rose poudré "2 powder", poudre fine blanche*
- **Certifications** : Cosmos Organic (Ecocert)

**Ingrédients :**

| Ingrédient | INCI | Fonction | Origine | % | Définition INCI |
| --- | --- | --- | --- | --- | --- |
| Talc cosmétique | Talc | Matifiant minéral | Maroc | 60 | Silicate de magnésium pur, lavé et tamisé. Matifie sans gercer la plaque. |
| Poudre de riz | Oryza Sativa Powder | Absorbant doux | Asie biologique | 30 | Amidon de riz finement broyé. Absorbe le surplus de paste sans dessécher. |
| Silice | Silica | Texture & glissant | Origine minérale, Europe | 10 | Forme cosmétique du silicate. Donne la glisse et révèle la brillance au polissage. |

### 4.3 Carte « Polissoir Step 4 — Polish & Shine » (`id: polissoir-step-4`)

- **Sensation** : *La lumière revient à la surface.*
- **Couleur d'accent** : `ciel`
- **Volume / taille** : 90 mm
- **Indice d'usage** : *six mois de polissage doux*
- **Description courte** : *Polissoir rectangulaire bleu ciel. Trois faces, trois grains. Révèle la brillance naturelle.*
- **Narratif** : *Polissoir trois faces, du plus rugueux au plus doux. La dernière face révèle la brillance, sans solvant ni vernis. Se rince à l'eau tiède.*
- **Image** : `/products/kit-lime.svg` (1200×1500) — *Polissoir rectangulaire bleu ciel et gris clair, marqué "Step 4 Polish & Shine", trois faces de polissage*
- **Certifications** : aucune

**Ingrédients / matériaux :**

| Ingrédient | INCI | Fonction | Origine | Définition INCI |
| --- | --- | --- | --- | --- |
| Mousse polyuréthane haute densité | Polyurethane Foam | Support | Europe | Mousse synthétique haute densité, support structurel du polissoir. Lavable, durable, n'absorbe pas la poudre. |
| Poudre de kaolin polissant | Kaolin | Argile douce | Carrière, Marrakech | Argile blanche fine extraite localement. Polit sans rayer, révèle la brillance naturelle de l'ongle. |
| Encre cosmétique Step 4 Polish & Shine | Cosmetic Ink | Marquage sans solvant | Europe | Encre à base d'eau, sans solvant ni métal lourd. Marque le grain sans contaminer le polissage. |

---

## 5. Section 3 — Vidéo « 4 gestes » (`VideoPlayer4GestesKitBound`)

**Rôle** : preuve 2, usage *in vivo*. Vidéo verticale (YouTube Short) montrant le rituel.

**Source** : `content.videoSrc` (`kit.ts`) + `marketing.kit.video.*`.

**Contenu seed :**

- **Kicker** : *Les gestes*
- **Titre** : *Quatre gestes, en un seul plan.*
- **Sous-titre** : *Quatre-vingt-dix secondes, un rythme lent, le geste avant les mots.*
- **Vidéo** : YouTube Short `https://youtube.com/shorts/N2pDuciP4uQ` (embed `youtube-nocookie.com`). Sources mp4/webm conservées en fallback schéma.
- **Transcription** : boutons *Lire la transcription* / *Masquer la transcription*
- **CTA post-vidéo** : *Voir le pack ci-dessous*

**Poster (vignette de lancement) :**

- **Kicker** : *La manucure japonaise*
- **Titre ligne 1** : *Brille 3 semaines.*
- **Titre ligne 2** : *Sans vernis.*
- **Sous-titre ligne 1** : *Cire d'abeille, silicates, poudre de perle.*
- **Sous-titre ligne 2** : *4 gestes en 90 secondes — c'est tout.*
- **Aria play** : *Lancer la vidéo : …*

---

## 6. Section 4 — Pack + Steps (`ProductFeedSectionBound`)

**Rôle** : densité commerciale. Le bloc éditorial qui prépare la décision (prix, value breakdown, 4 gestes, promesses, social proof). Construit par le builder pur `kit-feed.ts`.

### 6.1 Hero du pack

- **Kicker** : *Le pack*
- **Titre** : *Le rituel s'installe en deux gestes et un polissoir.*
- **Lead** : *Trois objets dans la main, deux gestes dans la soirée. La paste filme, la powder lustre, le polissoir Step 4 révèle — manucure japonaise, pensée à Rabat.*
- **Préfixe prix** : *Tout compris :*
- **CTA** : *Commander le rituel*
- **Micro-copy CTA** : *Paste · Powder · Polissoir Step 4 inclus · Livraison offerte au Maroc · Paiement à la livraison · Retour 30 j.*
- **Prix barré (compare-at)** : 289 MAD (= `priceCents`) — aria *« Prix non packagé 289 MAD »*
- **Accent CTA** : `sauge-dark`

**Value breakdown (ventilation de la valeur perçue)** — réparti sur le prix barré (Paste 40 %, Powder 32 %, polissoir le reste) :

| Ligne | Valeur |
| --- | --- |
| 1 Paste · 30 ml | ≈ 116 MAD |
| 2 Powder · 30 g | ≈ 92 MAD |
| Polissoir 4 zones | ≈ 81 MAD |
| Notice rituel + carte | offert *(atténué)* |
| Livraison au Maroc | offert *(atténué)* |

> Les montants Paste/Powder/Polissoir sont **dérivés au runtime** du prix barré (`40 % / 32 % / reste`), pas codés en dur. Avec un compare-at de 289 MAD : ≈ 116 / 92 / 81.

- **Coût par soin** (`perUsageHint`) : calculé sur ~47 soins → *≈ 4 MAD par soin sur … jours* (libellé `per_usage.phrase`).

> ℹ️ Un autre bloc « value » statique existe dans l'i18n (`marketing.kit.value_breakdown`), avec des chiffres indicatifs distincts : Paste 120 MAD, Powder 95 MAD, Polish & Shine 105 MAD → **valeur séparée 320 MAD**, kit 199 MAD, **économie 121 MAD**. Et `value_per_use` : *≈ 1,5 MAD par geste matin et soir, sur quatre saisons* (vs ≈ 150 MAD la manucure en salon).

### 6.2 Les 4 gestes (steps)

**Header** : kicker *EN TOUT* · durée totale **5 minutes le soir** · lead *Quatre gestes lents, une fois par semaine.*

| # | Kicker | Titre | Description | Durée | Accent |
| --- | --- | --- | --- | --- | --- |
| 1 | Préparation | Préparez vos ongles | On nettoie, on sèche, on lime légèrement — la plaque s'ouvre au soin. | 30 s | sauge |
| 2 | Geste 1 | Appliquez la paste | Une noisette de paste vert sauge, le polissoir glisse, la cire entre dans la kératine. | 1 min | sauge |
| 3 | Geste 2 | Appliquez la powder | On dépose la powder rose poudré, on lustre lentement, la lumière revient à la surface. | 2 min | petale |
| 4 | Polissoir Step 4 | Polish & Shine | On finit au polissoir bleu ciel — l'ongle devient miroir, sans vernis, sans abrasion. | 1 min | champagne *(résultat)* |

- **Badge sur l'étape 4** : *Résultat*
- **CTA post-steps** : *Démarrer le rituel* → ancre `#commander-femiglow`

### 6.3 Les 3 promesses (claims)

| Icône | Label | Détail |
| --- | --- | --- |
| `leaf` | Ingrédients d'origine naturelle | Cire d'abeille, jojoba, kaolin, poudre de riz — manucure japonaise. |
| `drop` | Sans produits chimiques agressifs | Ni acétone, ni phtalates, ni toluene — la plaque respire. |
| `sparkle` | Pour des ongles forts et éclatants | Kératine renforcée, brillance lustrée au polissoir Step 4. |

### 6.4 Social proof condensé

- **Note + nombre d'avis** : depuis la BDD (`getProductReviewStats`), sinon `DEFAULT_KIT_REVIEW_STATS`.
- **Citation** : la **plus courte** des témoignages mains (sélection automatique) → par défaut *« Je ne reviendrai pas au vernis. La main suffit à elle-même. »* (Sara, Marrakech).
- **Label géo** : *« N maisons en France »* (`count_label_geo`).
- **Fallback** si aucun avis : *« Cinq minutes le soir, c'est devenu un signal de fin de journée. »* — Lina, Rabat.

---

## 7. Section 5 — Wizard commander (`KitCommanderSectionBound`)

**Rôle** : 2ᵉ zone de conversion (V2) / juste sous le hero (V1). Tunnel de commande embarqué (Mode A, `wizard_kit` / `wizard_embed`), parcours `lead → address → thank_you`. Ancre `#commander-femiglow`.

**Source** : valeurs par défaut du composant + override FR inline.

**Contenu seed (en-tête de section) :**

- **Kicker** : *Commander le rituel*
- **Titre** : *Trois gestes, livrés chez vous.*
- **Sous-titre** : *Quelques coordonnées, une adresse au Maroc, et nous nous occupons du reste. Livraison gratuite en 24-48 heures.*

**Libellés du wizard (override FR) :**

- **Titre wizard** : *Commander le rituel FemiGlow*
- **CTA étape lead** : *Continuer · paiement à la livraison*
- **CTA étape adresse** : *Confirmer la commande*
- **Titre remerciement** : *Commande reçue, on vous rappelle.*
- **Moyen de paiement** : `cod` (paiement à la livraison uniquement)

> Sur `/ar` et `/en`, l'override FR est ignoré : le dictionnaire complet de la langue pilote tous les libellés du wizard.

---

## 8. Section 6 — Témoignages mains (`HandsTestimonialsBound`)

**Rôle** : réassurance post-décision. Avant/après visuels, projection de soi.

**Source** : `content.handsTestimonials` (`kit.ts`) + header `marketing.kit.hands`.

**Header de section :**

- **Kicker** : *Trois mains*
- **Titre** : *Trois mains, trois saisons.*
- **Description** : *Photos non retouchées, prises chez nos initiées au bout de plusieurs mois de rituel. La plaque retrouve sa nervure, sans recette miracle.*
- **Labels** : *Avant* / *Après* / *Initiée depuis {date}*

**Témoignages :**

| Prénom | Ville | Citation | Initiée depuis | Image avant | Image après |
| --- | --- | --- | --- | --- | --- |
| Amal | Rabat | Trois mois, et l'ongle a retrouvé sa nervure. J'ai cessé de le forcer. | Février 2026 | `/testimonials/hands-amal-avant.svg` | `/testimonials/hands-amal-apres.svg` |
| Lina | Casablanca | Cinq minutes le soir, c'est devenu un signal de fin de journée. | Décembre 2025 | `/testimonials/hands-lina-avant.svg` | `/testimonials/hands-lina-apres.svg` |
| Sara | Marrakech | Je ne reviendrai pas au vernis. La main suffit à elle-même. | Janvier 2026 | `/testimonials/hands-sara-avant.svg` | `/testimonials/hands-sara-apres.svg` |

*(Toutes les images sont en 800×800.)*

---

## 9. Section 7 — Ingrédients détaillés (`IngredientsDetailsBound`)

**Rôle** : détail technique. Tableau exhaustif lu « ligne par ligne ».

**Source** : composition résolue (`resolveKitComposition()` en FR, sinon `content.composition`) + header `marketing.kit.ingredients`.

**Header de section :**

- **Kicker** : *Le détail*
- **Titre** : *La composition lue ligne par ligne.*
- **Description** : *Tout est dit : noms d'usage, INCI, fonction, origine, concentration. Pas d'angle mort, pas de promesse cachée derrière une formule.*
- **Colonnes** : *Ingrédient* · *INCI* · *Fonction* · *Origine*
- **CTA post-tableau** : *Voir le pack*

> Le contenu détaillé des ingrédients est identique à celui des cartes de composition (§4.1 à §4.3) — même source de données, présentation tabulaire complète ici.

---

## 10. Section 8 — Voix de la maison / Module rituels (`RitualsModuleBound`)

**Rôle** : social proof à grande échelle. C'est ce module qui alimente le **compteur du badge avis du hero** et son ancre (`#rituals-module-title`). `productKey: pack-femiglow`.

**Source** : avis seedés en BDD (`SEED_RITUALS`, 50 avis) + libellés `marketing.kit.rituals`.

**Libellés de section :**

- **Kicker** : *LES VOIX DE LA MAISON*
- **Headline (pluriel)** : *« {total} initiées ont partagé. {oui} reprendraient le rituel. »*
- **Headline (singulier)** : *« Une initiée a partagé son rituel. Elle le reprendrait. »*
- **État vide** : titre *La maison écoute.* / sous-titre *Soyez la première à partager votre rituel.*
- **Lien** : *Lire les {total} rituels partagés*
- **Carte — auteur anonyme** : *Une initiée*
- **Carte — ancienneté** : *Initiée depuis {date}*
- **Carte — badge** : *Reviendrait*

**Tags affichables (labels) :** ongles plus lisses · plaque souple · cuticules apaisees · plus de casse · eclat naturel · rituel devenu habitude · mains detendues · fini brillant · halal

### 10.1 Distribution du seed des avis (`SEED_RITUALS` — 50 avis)

| Catégorie | Nombre |
| --- | --- |
| **Signal** : oui | 41 |
| **Signal** : hésite | 6 |
| **Signal** : non | 3 |
| **Statut** : APPROVED | 40 |
| **Statut** : PENDING | 4 |
| **Statut** : REJECTED | 2 |
| **Statut** : HIDDEN | 1 |
| Featured (épinglés) | 9 (3 FR + 3 AR + 3 EN) |
| Avec photos | ~17 |
| Achats vérifiés | ~33 |

Caractéristiques (design Kolenda) : volume crédible (>20, <100), mélange oui/hésite/non (les mitigés crédibilisent), longueur naturelle 60–280 caractères, ~30 % avec photos UGC (sans visage frontal — RGPD), dates étalées sur 90 jours (plus dense récemment), prénoms et villes marocains.

### 10.2 Avis « featured » FR (les 3 épinglés)

1. **Amal — Rabat** (initiée depuis 3 mois, vérifié, photo) :
   *« Trois mois et l'ongle a retrouvé sa nervure. J'ai cessé de le forcer. Les cuticules ont apaisé doucement, sans que je m'en rende compte. Le matin je passe la lime, le soir je polis. C'est devenu un repère plus qu'un soin. »*
2. **Souad — Casablanca** (6 semaines, vérifié, photo) :
   *« Mon ongle se dédoublait au moindre geste. J'ai testé six bases dures, sept huiles, rien. Le rituel m'a appris à ne pas couvrir mais à nourrir. Six semaines et la plaque est devenue homogène. Je ne reviens pas en arrière. »*
3. **Khadija — Salé** (2 mois, vérifié, 2 photos) :
   *« J'aime que la maison soit honnête : on ne promet rien, on accompagne. La paste a une odeur de soin, pas de chimie. Le polish donne un fini brillant doux, sans cette laque dure des vernis. Mes filles m'ont demandé pourquoi mes mains brillent. »*

> Des miroirs AR et EN de ces 3 avis featured existent (mêmes auteurs, traduits). Voir l'annexe A pour la liste complète des 50 avis.

---

## 11. Section 9 — FAQ (`FAQContextuelle`)

**Rôle** : lever les objections. Génère aussi le JSON-LD `FAQPage`.

**Source** : `content.faq` (`kit.ts`, 8 questions) + header `marketing.kit.faq.section`.

**Header de section :**

- **Kicker** : *Questions*
- **Titre** : *Les questions qu'on nous pose.*
- **Description** : *Les réponses sont courtes, précises, vérifiables. Si une question manque, écrivez-nous : nous l'ajouterons.*

**Questions / réponses :**

1. **Combien de temps dure un pack ?**
   En usage quotidien, le pack tient quatre à cinq mois. La paste se vide en premier, la powder suit. Le polissoir dure environ un an. Nous proposons des recharges à partir de l'automne 2026.
2. **À quelle fréquence appliquer ?**
   Tous les soirs si vous le pouvez, en cinq minutes. Si vous sautez un jour, ce n'est pas grave : la maison accueille la pause comme elle accueille le retour.
3. **Puis-je continuer à porter du vernis ?**
   Le rituel s'accommode du vernis même s'il est pensé pour s'en passer. Appliquez la paste et la powder les soirs sans vernis. La plaque respire, le rituel installe sa lenteur.
4. **Le rituel convient-il pendant la grossesse ?**
   Toutes les formules sont sans solvants volatils, sans phtalates, sans toluene. Nous recommandons d'échanger avec votre médecin : le soin se construit en confiance.
5. **Quels sont les délais de livraison ?**
   Rabat : 24 h. Reste du Maroc : 48 à 72 h. Livraison offerte. International : nous étudions chaque destination, l'envoi se fait par DHL avec suivi.
6. **Puis-je retourner le pack ?**
   Oui, sous trente jours, même entamé. Vous nous écrivez deux lignes à info@femiglow-maroc.com, nous reprenons le pack. Remboursement sous cinq jours ouvrés.
7. **Et si je suis allergique à un ingrédient ?**
   Chaque formule liste son INCI complet sur cette page et sur l'étiquette du pot. En cas de doute, nous vous adressons un échantillon avant l'envoi du pack complet.
8. **Le rituel est-il adapté aux adolescentes ?**
   Oui, à partir de quatorze ans. Les formules sont douces, les gestes simples. C'est souvent un premier rendez-vous avec le soin lent.

---

## 12. Section 10 — Journal « Trois lectures » (`JournalGridBound`)

**Rôle** : bottom funnel, maillage interne vers le journal.

**Source** : 3 derniers articles (`cms.getArticles({ limit: 3 })`) + cross-links `content.journalCrossSlugs` + libellés `marketing.kit.journal_grid` et `marketing.journal`.

**Contenu seed :**

- **Kicker** : *Pour aller plus loin*
- **Titre** : *Trois lectures.*
- **CTA** : *Lire le journal* (`marketing.journal.grid.cta`)
- **Variante** : `symmetric`
- **Labels de catégorie** : Maison · Saison · Voix · Matières · Pratique

**Slugs de cross-link privilégiés (`journalCrossSlugs`) :**

1. `hiver-ongles-patience`
2. `matieres-d-ailleurs`
3. `paste-et-powder-deux-gestes`

---

## 13. Section 11 — Mur d'avis (drawer) (`RitualsWallDrawer`)

**Rôle** : overlay (Suspense) déclenché par le lien « Lire les N rituels partagés ». Affiche l'intégralité des avis seedés.

**Source** : `SEED_RITUALS` (BDD) + libellés `marketing.kit.rituals.wall_*`.

**Contenu seed :**

- **Kicker du mur** : *RITUELS PARTAGÉS*
- **Titre du mur** : *Les voix de la maison.*
- Filtres / tags : voir labels §10.

---

## 14. Sections présentes uniquement en Layout V1

### 14.1 Comparatif (`ComparatifSectionBound`) — *V1 only*

**Rôle** : opposer vernis classique et rituel FemiGlow, sans dénigrer.

**Source** : `content.comparatif` (`kit.ts`) + header `marketing.kit.comparatif`.

**Header :**

- **Kicker** : *Comparatif*
- **Titre** : *Vernis classique et rituel FemiGlow.*
- **Description** : *Sans dénigrer, deux approches différentes. À chacune sa place dans une vie, à chacune ses contraintes. Lisez à voix haute : chaque ligne se tient.*
- **Label de colonne d'axe** : *Axe*
- **Colonnes** : *Vernis classique* vs *Pack FemiGlow*

**Lignes du tableau :**

| Axe | Vernis classique | Pack FemiGlow |
| --- | --- | --- |
| Préparation | Dégraissage à l'acétone, surface lisse forcée. | Nettoyage doux, observation de la plaque, sans solvant agressif. |
| Tenue | 5 à 7 jours sur ongle préparé, retouches fréquentes. | Pas de tenue colorée : l'ongle reste tel qu'il est, soutenu jour après jour. |
| Récupération | Ongle déshydraté sous la couche, parfois fragilisé. | Plaque hydratée, cuticules souples, polissage au kaolin Step 4. |
| Coût annuel | Vernis + dissolvant + cures réparatrices, env. 1 500 MAD. | Un pack FemiGlow à 199 MAD tient quatre à cinq mois. Soit environ 500 MAD par an. |
| Impact matière | Solvants volatils, formules à base pétrochimique fréquente. | Cire d'abeille, jojoba, talc minéral, riz, kaolin. Certification Cosmos Organic. |
| Temps quotidien | Application 20 min, séchage long, retouches. | Cinq minutes par jour, geste lent, sans séchage forcé. |

### 14.2 PivotFinal (`PivotFinal`) — *V1 only*

**Rôle** : dernier rappel émotionnel avant le journal.

**Source** : `marketing.kit.pivot_final`.

- **Kicker** : *Le geste*
- **Titre** : *Posez le geste.*
- **Corps** : *Le rituel commence quand vous le décidez. Cinq minutes le soir, une saison, et la plaque retrouve sa cadence.*
- **CTA secondaire** : *Lire encore*

---

## 15. Éléments transverses

### 15.1 Sticky / promo header

- `GeoPromoSlideHeaderSlot` — bandeau promo géolocalisé en haut de page (porte le bouton « Commander » mobile, d'où l'absence de sticky CTA bottom en V2).
- **Région aria sticky** : *Achat rapide* (`marketing.kit.sticky.aria_region`).

### 15.2 SEO / structured data

- **Title fallback** : *Le pack FemiGlow — manucure japonaise*
- **Description fallback** : *Pack FemiGlow — coffret de manucure japonaise en deux gestes. Paste verte sauge, powder rose poudré et polissoir Step 4 Polish & Shine. Pensé à Rabat par notre équipe. Sans vernis, sans abrasion. Livraison offerte au Maroc.*
- **OG image** : `/og/kit.svg` (1200×630) — alt *Le pack FemiGlow — paste, powder, polissoir Step 4*
- **JSON-LD** : `Product` (avec `aggregateRating` + `review` system-driven) et `FAQPage` (depuis la FAQ §11).
- **Alt visuel pack** : *Kit FemiGlow — paste, powder et polissoir Step 4, posés sur fond crème*

### 15.3 Tracking

- `view_item` (CAPI server-side) déclenché au chargement, avec `value` = prix effectif (199 MAD), devise MAD, item `fg-kit-001`.

---

## Annexe A — Liste complète des 50 avis seed (`SEED_RITUALS`)

> Source : `apps/web/src/lib/rituals/seed-data.ts`. `daysAgo` = décalage en jours par rapport à aujourd'hui. Les avis AR/EN reprennent les featured FR traduits.

### Featured (9 — 3 FR / 3 AR / 3 EN)

| Auteur | Ville | Langue | Signal | Vérifié | Photos |
| --- | --- | --- | --- | --- | --- |
| Amal | Rabat | fr | oui | oui | R2 |
| Souad | Casablanca | fr | oui | oui | R10 |
| Khadija | Salé | fr | oui | oui | R7, R11 |
| أمل | الرباط | ar | oui | oui | R2 |
| سعاد | الدار البيضاء | ar | oui | oui | R10 |
| خديجة | سلا | ar | oui | oui | R7, R11 |
| Amal | Rabat | en | oui | oui | R2 |
| Souad | Casablanca | en | oui | oui | R10 |
| Khadija | Salé | en | oui | oui | R7, R11 |

### « Oui » verbeux (12 — l'épine dorsale)

Houda (Casablanca), Yasmine (Rabat), Imane (Marrakech), Sofia (Tanger), Nadia (Fès), Salma (Agadir), Hafsa (Oujda), Latifa (Meknès), Mounia (Tétouan), Wafae (Kénitra), Rajae (Rabat), Hind (Casablanca), Ikram (Marrakech).

*Exemples :*
- **Houda — Casablanca** : *« Je travaille dans la pâtisserie. Mes mains touchent l'eau, le sucre, la farine toute la journée. En quatre semaines, j'ai cessé de voir mes ongles se fendre. Le polish revient une fois par semaine. Le reste, c'est de la patience. »*
- **Latifa — Meknès** : *« Ma fille de 19 ans me l'a offert pour mon anniversaire. Elle m'a dit : "Maman, prends cinq minutes pour toi." Le rituel est devenu ce moment où je m'arrête. Mes mains m'en remercient. »*

### « Oui » courts (12 — densité de social proof)

Asmae (Rabat), Zineb (Casablanca), Fatima (Tanger), Lina (Agadir), Maryam (Salé), Kawtar (Fès), Dounia (Rabat), Sara (Oujda), Iman (Meknès), Najlaa (Marrakech), Aicha (Tétouan), Lamia (Kénitra).

*Exemples* : *« Ongles plus lisses dès la première utilisation. »* · *« Fini brillant comme une vraie manucure, mais sans le gel. »* · *« Halal et clean, c'est ce que je cherchais. »*

### « Oui » plus anciens (10 — profondeur historique)

Btissam (Rabat), Hiba (Casablanca), Karima (Salé), Naima (Fès), Loubna (Marrakech), Ghita (Agadir), Yasmin (Tanger), Soukaina (Oujda), Asma (Meknès), Chaymae (Rabat).

*Exemple* : **Karima — Salé** : *« Je suis infirmière. Mes mains supportent l'alcool plusieurs fois par jour. Ce rituel les a sauvées. »*

### « Hésite » honnêtes (6 — crédibilité)

Sanaa (Casablanca), Rim (Salé), Saadia (Fès), Houria (Tanger), Mariam (Marrakech), Amina (Agadir).

*Exemple* : **Sanaa** : *« L'effet est réel mais lent. Il faut six semaines pour le voir. Si vous cherchez un miracle en trois jours, ce n'est pas pour vous. »*

### « Non » honnêtes (3)

- **Bouchra — Rabat** : *« Ce n'est pas pour mes ongles. Ils sont trop secs à la base, le rituel n'a pas suffi. Le service a été pro, ils m'ont remboursée. »*
- **Najat — Tétouan** : *« Le rendu mat n'est pas mon goût. Je préfère un vernis classique. Pas un défaut, juste une attente. »*
- **Saida — Kénitra** : *« Je n'ai pas trouvé le temps de m'y tenir. Le rituel demande de la régularité que je n'ai pas eue. »*

### PENDING (4 — queue admin)

Salwa (Casablanca), زهرة (الرباط, ar), Karima (Agadir, flag `all_caps`), Anonyme (flags `link_external` + `emoji_detected`).

### REJECTED + HIDDEN (3 — grain de modération)

- **REJECTED** — Anonyme (`duplicate_strict`) : *« Spam évident, copié-collé d'un autre site. »*
- **HIDDEN** — Kenza, Rabat (`face_detected`) : photo non conforme (visage frontal) retirée.
- **REJECTED** — Inconnue (`all_caps`) : *« TROIS MOIS ET RIEN N'A CHANGÉ… »*

### Photos référencées

`reviews2.jpg` à `reviews12.jpg` sous `/public/reviews/` — ongles French naturels, pots paste/powder, boîte FemiGlow, setups marbre/café. Aucune photo avec visage frontal (RGPD + charte maison).

---

*Document généré le 2026-05-30 à partir du code source de `template-femiglow` (branche `feat/locale-switcher-v2`).*
