# 02 — Références image et bible de style FemiGlow

> Inventaire lecture seule réalisé le 30/10/2026 sur `feat/kit-cro-v2` (= prod https://femiglow-maroc.com).
> Objectif : fournir à l'agent de génération d'images (gpt-image-2, qui accepte des images de référence)
> un jeu stable de références pour garder produit, packaging, palette, mains et direction artistique
> cohérents lors de la génération de nouvelles images hero par angle publicitaire.
>
> Le jeu de références retenu est copié dans `references/` (identifiants REF-01…REF-10) ;
> index détaillé : `references/INDEX.md`.

## 0. Synthèse

- **Le vrai produit est connu avec certitude.** Il se compose de :
  - une boîte rigide blanche avec des vagues sauge et rose, le logo « FemiGlow » en script et les mentions « MANICURE TREATMENT KIT » et « Natural Nail Care System » ;
  - deux pots carrés en verre transparent épais à bords facettés :
    - le n°1 a un couvercle à pastille ronde **vert sauge** marquée « 1 paste » ; il contient une **crème ivoire** ;
    - le n°2 a une pastille **rose poudré** marquée « 2 powder » ; il contient une **poudre blanche fine et légèrement nacrée** ;
  - un polissoir rectangulaire **bleu ciel** à tranches blanches et grises, marqué « Step ④ Polish & Shine ».
- **Les meilleures références de fidélité produit sont les photos clientes** (`reviews3/4/5/7`), plus l'infographie `rituel-etapes.png`. Les images générées par IA du site s'écartent souvent du produit réel.
- **Il y a une incohérence en prod.** Le slot « 2 powder » de la section composition sert une image où l'on lit « **2 fortifiant** », avec une **résine ambrée**, alors que le texte alt dit « poudre fine blanche ». Ce sont `docs/images/values/kit/kit-fortifiant.png` et le média `me_0md55ut0fq1ejexy`. **Ne jamais l'utiliser comme référence.**

## 1. D'où viennent les images

| Source | Emplacement | Rôle |
|---|---|---|
| Galerie hero | `apps/web/src/lib/products/kit-hero-gallery.ts` (`getKitHeroGalleryImages`) | Ordre : slot `kit-hero-produit/primary`, puis `context_1` et `context_2`, puis `product_review_photos` publiées (triées par `display_order`, 6 au maximum). Plafond de 7 images au total. |
| Média des composants (seed) | `apps/web/src/lib/components/seed-pipeline.ts` et `seed-mapping.ts` | Lit `docs/images/values/<groupe>/*.png` et crée les entrées `media`, leurs variantes `/_media/media/me_<id>/{webp,avif,jpeg}/{xs..2xl}` et les bindings `site_component_media`. `kit/image-produit.png` alimente `kit-hero-produit/primary` en autoActivate (CHA-243). `kit/kit-pack-shot.png` alimente `kit-pack-visual` en autoActivate. `kit/kit-base`, `kit-fortifiant` et `kit-lime` alimentent `kit-comparatif`. `kit/hands-*` alimentent `kit-hands-testimonials`. |
| Photos clientes | `apps/web/public/reviews/reviews{2..8,10..12}.jpg` (500 px) et `docs/images/values/reviews/` (contient en plus `reviews1`, `reviews9` et `rituel-etapes.png`) | Table `product_review_photos` en prod. |
| Stories | `apps/web/public/stories/1-6.{jpg,mp4,webm}` (360×640) | Vidéos UGC « face caméra ». |
| Mocks du kit | `apps/web/src/data/mock/kit{,.ar,.en}.ts` | Pointent vers `/products/*.png|svg` et `/testimonials/*.svg`. **Ce sont des illustrations plates (placeholders), inutilisables comme référence.** Même chose pour `public/avis`, `public/testimonials`, `public/journal/*.svg` et `public/rituel/*.svg`. |

## 2. Galerie hero de /kit en prod (vérifiée dans le HTML live le 30/10/2026)

**L'ordre est identique en FR (`/kit`) et en AR (`/ar/kit`), avec 7 slides et aucun slot de contexte actif :**

| # | URL | Ce qu'on voit |
|---|---|---|
| 1 | `https://femiglow-maroc.com/_media/media/me_t37h41m94iv06w5j/webp/xl.webp` (1122×1402). Source : `docs/images/values/kit/image-produit.png` (= **REF-01**) | Packshot IA. La boîte FemiGlow est ouverte, couvercle posé derrière, avec les vagues sauge et rose et le script « Femi Glow ». Devant : pot « 1 paste » (pastille sauge, couvercle ouvert sur le côté), pot « 2 powder » (pastille rose) et polissoir bleu clair « Step 4 — Polish & Shine ». Le tout sur un papier crème fait main à bord déchiré, en lumière douce de fenêtre à gauche. Alt : « Visuel FemiGlow. » |
| 2 | `/reviews/reviews2.jpg` | Cliente, mains jointes devant une robe sauge, ongles « French naturel » brillants, bijoux fins dorés. |
| 3 | `/reviews/reviews3.jpg` (= **REF-10**) | Main mouillée dans une salle de bain. Sur l'étagère en pierre grise : boîte, pots 1 et 2, un pot ouvert avec crème blanche, polissoir bleu, bougie. |
| 4 | `/reviews/reviews4.jpg` (= **REF-05**) | Main à peau foncée devant la boîte, avec les pots 1 (ouvert, poudre blanche visible) et 2 et le polissoir, sur marbre en lumière chaude. |
| 5 | `/reviews/reviews5.jpg` | Main sur un plaid en maille crème, avec la boîte, les pots 2 et 1 (ouverts, crème blanche) et le polissoir en gros plan. |
| 6 | `/reviews/reviews6.jpg` | Main levée dans un café (table en marbre, chaise en bois), avec la boîte, les pots et le polissoir. |
| 7 | `/reviews/reviews7.jpg` (= **REF-06**) | Composition propre sur plan de travail en marbre blanc : boîte, pots 1 et 2, polissoir, main posée à droite. |

Les autres images de /kit en AR sont les mêmes médias que la version FR, avec des alt traduits. Image OG des deux langues : `me_s3rs2rrx4snd16v4` (1731×909, issue de `kit/og-kit.png`).

## 3. Catalogue des images candidates

### A. Produit et packaging

| Chemin dans le dépôt | URL prod | Dimensions | Description | Usage comme référence |
|---|---|---|---|---|
| `docs/images/values/kit/image-produit.png` → **REF-01** `references/REF-01-kit-canon.png` | `/_media/media/me_t37h41m94iv06w5j/jpeg/2xl.jpeg` | 1122×1402 (4:5) | Décrit en section 2 (hero n°1). | ★★★ Boîte, pots et polissoir en style maison. Petits écarts : le pot 1 paraît contenir de la poudre, et le polissoir est bleu très pâle. |
| `docs/images/values/kit/kit-pack-shot.png` → **REF-09** `references/REF-09-ambiance-lumiere-matin.png` | `/_media/media/me_cu6e7vqirq8v4ez5/jpeg/2xl.jpeg` | 1122×1402 | Pots 1 et 2 alignés verticalement, polissoir dessous, gaze de lin à gauche, ombres de fenêtre striées sur papier crème. Le script « FemiGlow » apparaît sous les numéros. Pas de boîte. | ★★★ Ambiance et lumière signature. ★★ pour la fidélité des pots. |
| `docs/images/values/kit/kit-base.png` → **REF-03** `references/REF-03-pot1-label-macro.png` | `/_media/media/me_e4wje0jm8xfoi9wz/jpeg/2xl.jpeg` | 1254×1254 | Gros plan d'un pot carré facetté, pastille sauge pâle « 1 paste » avec « FemiGlow » en script, sur marbre crème avec un rayon de lumière. | ★★★ Label et pot n°1 de près. |
| `docs/images/values/kit/kit-lime.png` | `/_media/media/me_ycbnlore2dlbia80/jpeg/2xl.jpeg` | 1254×1254 | Polissoir : dessus bleu ciel pâle, corps blanc, « Step ④ Polish & Shine », sur marbre. | ★★ La forme est bonne, mais le bleu est plus pâle que le vrai, qui est plus saturé. Non retenu. |
| `docs/images/values/kit/kit-fortifiant.png` | `/_media/media/me_0md55ut0fq1ejexy/...` | 1254×1254 | Pot n°2 avec la mention **« 2 fortifiant »** et une **résine ambrée**. | ✗ **À exclure : produit faux.** |
| `docs/images/values/maison/cross-kit.png` (= `apps/web/public/maison/cross-kit.png`, même md5) → **REF-02** `references/REF-02-pots-ouverts-textures.png` | `/maison/cross-kit.png` | 1122×1402 | Pots 1 et 2 ouverts, couvercles appuyés contre les pots : on voit la crème ivoire et la poudre. Polissoir **bleu ciel vif** à droite. Lin écru et marbre beige, lumière de fenêtre. | ★★★ Montre les deux textures et le bon bleu. |
| `docs/images/values/reviews/rituel-etapes.png` (**en réalité un fichier WebP**, malgré l'extension .png) → **REF-04** `references/REF-04-rituel-etapes.png` (vrai PNG) et **REF-04b** `references/REF-04b-rituel-etapes-crop.png` (bande photo seule, 1024×345) | Non servi | 1024×1536 | Infographie fournisseur ou marque. En haut : la boîte « MANICURE TREATMENT KIT » avec son insert et les pots. En dessous : 4 étapes FR et japonais avec photos de mains : préparer, paste (crème ivoire au doigt), powder (poudre blanche nacrée), résultat brillant. Fond de marbre clair. | ★★★ **Référence la plus fidèle pour les contenus des pots et le geste.** Préférer REF-04b, recadrée, pour que le texte japonais et français ne fuite pas dans les générations. |
| `docs/images/values/kit/kit-principale.png` (non mappé), `kit/og-kit.png` (OG en prod, `me_s3rs2rrx4snd16v4`) | — | 1122×1402 / 1731×909 | **3 pots** : 1 paste, 2 powder, plus un troisième pot blanc avec une **feuille**. Marbre et rayon de lumière. | ✗ Produit faux (pot n°3 inexistant). L'OG en prod est donc incohérent. |
| `apps/web/public/products/*.png` | — | 1600×2000 | Illustrations plates (flacons, bâtonnet). | ✗ |

### B. Produit en main

| Chemin | Dimensions | Description | Usage |
|---|---|---|---|
| `docs/images/values/kit/kit-detail-mains.png` (`me_eubjbzl3ffib298v`) | 1448×1086 | Index qui plonge dans la crème d'un pot carré, avec un **couvercle métal champagne sans pastille**, sur lin crème. | ★ Le geste est bon, mais **le couvercle est faux** : pas de pastille sauge. |
| `docs/images/values/rituel/hero-lifestyle.png` | 1448×1086 | Mains qui manipulent une lime, avec un pot de crème et un **polissoir vert sauge**, sur table en bois et lin, branche d'olivier. | Ambiance seulement. ✗ pour le produit (le polissoir n'est pas bleu). |
| `docs/images/values/home/hero-home.png` | 1448×1086 | Femme en lin, mains jointes, avec **3 pots « 1 paste / 2 powder / 3 shine »** et une lime blanche, olivier, lumière douce. | Ambiance « maison » ★★. ✗ pour le produit (« 3 shine »). |
| `apps/web/public/reviews/reviews4.jpg` → **REF-05**, `reviews7.jpg` → **REF-06**, `reviews5.jpg` | 500×425 / 500×428 / 500×278 | Voir la section 2. | ★★★ Fidélité réelle de la boîte, des pots, du polissoir et de la main. La basse résolution (500 px) suffit pour verrouiller l'identité, pas le détail. |

### C. Gros plans d'ongles (résultat, avant/après)

| Chemin et média | Dimensions | Description | Usage |
|---|---|---|---|
| `kit/hands-sara-apres.png` (`me_cmdeuegun0fj4itk`) → **REF-07** `references/REF-07-resultat-ongles-peau-foncee.png` | 1254×1254 | Dos de main à peau foncée, ongles courts rose-nude brillants, posée sur de la soie sauvage beige, rayon de lumière. | ★★★ Peau foncée et rendu « glow ». |
| `kit/hands-lina-avant.png` et `hands-lina-apres.png` (`me_bfvchfzcllxa6ad3`, `me_b3qabead2bzd3eia`) | 1254×1254 | Main à peau medium sur lin écru froissé. L'« après » est légèrement plus net et brillant. | ★★ Peau medium. Différence avant/après faible. |
| `kit/hands-amal-avant.png` et `hands-amal-apres.png` (`me_7gb7l59jh52q1ql6`, `me_fd6tm1gcyverz5gh`) | 1254×1254 | Main à peau claire sur papier fait main posé sur bois foncé, ombres de fenêtre. **L'avant et l'après sont quasi identiques.** | ★★ Peau claire. Pas utile pour un angle « transformation ». |
| `apps/web/public/reviews/reviews10.jpg` → **REF-08** `references/REF-08-resultat-ongles-french-reel.jpg` | 500×438 | Main avec ongles « French naturel » brillants, fond neutre. | ★★★ Résultat réel. |
| `apps/web/public/reviews/reviews2.jpg` | 500×452 | Deux mains, robe sauge, ongles brillants. | ★★★ Résultat réel. Le haut du buste et le collier sont visibles, pas le visage. |
| `docs/images/values/reviews/reviews9.jpg` | 377×500 | Hijab beige, mains French. **Watermark « KlingAI 3.0 »**, donc image générée. | ✗ Ne pas utiliser : image IA, et le bas du visage est visible. |

### D. Ambiance et maison (style, sans produit)

| Chemin | Dimensions | Description |
|---|---|---|
| `docs/images/values/home/mains-yasmine.png` | 1254×1254 | Main à peau foncée sur lin écru, bracelet argent fin, herbe sèche, ombres de feuillage. ★★★ ambiance (alternative à REF-09). |
| `docs/images/values/home/mains-ines.png` | 1536×1024 | Still-life « Cinq gestes » : bol en céramique, brosse, compte-gouttes d'huile ambrée, pot de crème, olivier, lin. Contient du texte incrusté. ★ palette seulement. |
| `docs/images/values/maison/*`, `docs/images/values/journal/*`, `docs/images/values/rituel/*` | 1086 à 1731 px | Famille éditoriale cohérente : lin, bois brut, céramique non émaillée, huile d'argan, lumière rasante chaude. Exemples : `journal/huile-d-argan-vraie.png` (`me_l0ty15jncazsafdw`) et `journal/ranger-son-rituel.png` (`me_js9l96ehtpoecegy`, mains foncées qui plient un tissu vieux rose). ★★ ambiance. |

### E. UGC à écarter ou réserver

| Chemin | Raison |
|---|---|
| `apps/web/public/reviews/reviews3.jpg` → **REF-10** `references/REF-10-ugc-maison.jpg` | Retenue : kit réel en salle de bain, main mouillée. Angle « vraie vie à la maison ». |
| `reviews11.jpg`, `reviews12.jpg` | **Packaging différent** : boîtiers ronds verts et roses, polissoirs vert et rose, boîte blanche à rabat. ✗ Risque de dériver vers un faux produit. |
| `reviews6.jpg` et `reviews8.jpg` | Quasi doublons (scène du café). |
| `reviews1.jpg` | Le bas du visage d'une cliente est visible. Le cadrage « deux pots tenus face caméra » est bon, mais **ne pas s'en servir comme référence d'identité**. |
| `public/stories/1-6.jpg` | Visages de vraies personnes (Marocaines, intérieur avec zellige, hijab). À n'utiliser que comme inspiration de cadrage UGC vertical 9:16, **jamais comme référence de personne**. `stories/6.jpg` est un gros plan d'ongles avec le texte « Manucure sans vernis ». |

## 4. Bible de style

### Palette (`apps/web/src/styles/tokens.css` et `apps/web/tailwind.config.ts`)

| Token | Hex | Rôle dans l'image |
|---|---|---|
| creme / creme-warm | `#FBF8F1` / `#F5EFE3` | Fonds : papier fait main, lin écru. `theme-color` du site. |
| encre / encre-soft | `#2C2A28` / `#4A4744` | Typo et contours, noir chaud, jamais `#000`. |
| sauge / sauge-soft / sauge-dark | `#C5DBC4` / `#E0EDE0` / `#4F6D52` | Pastille du pot 1, vague de la boîte. |
| petale / petale-soft / petale-dark | `#F2CECC` / `#FAE6E5` / `#B14F4A` | Pastille du pot 2, vague de la boîte, nude des ongles. |
| ciel / ciel-soft / ciel-dark | `#C5DBE5` / `#E0EBF1` / `#4F7A92` | Polissoir. Le vrai polissoir des photos UGC est plus saturé, proche d'un bleu ciel moyen. |
| champagne / champagne-soft / champagne-dark | `#C8A876` / `#E8D9BC` / `#7A5F38` | Reflets « métal brossé », jamais doré. |

Il n'y a **pas de token terracotta** dans les tokens du site. Le terme n'apparaît que dans `apps/web/src/styles/content-studio-v2/tokens.css` (outil admin).

### Typographies

- Cormorant Garamond pour les titres ;
- Inter pour le corps de texte et les labels des pots (« 1 paste ») ;
- Pinyon Script réservé au mot « FemiGlow » ;
- Cairo pour l'arabe.

### Charte photo (`docs/images/01-charte-visuelle.md`)

- **Lumière** : diffuse, latérale, du matin, à travers un rideau de lin ou une fenêtre nord. Ombres douces et rayons striés sur la surface. Pas de flash ni de spot.
- **Matières** : lin froissé, papier épais à bord déchiré, marbre crème veiné, bois clair brut, céramique non émaillée.
- **Cadrage** : 4:5 éditorial ou 3:2 ; 1:1 réservé aux preuves. Optique 35 à 50 mm, faible profondeur de champ, sujet au tiers, espace négatif.
- **Grain** : « Kodak Portra 400 », esprit Kinfolk ou Aesop, sans retouche ni gloss.
- **Mains** : réelles, ongles courts à moyens, carnations variées (claire, medium, foncée), pas de visage par défaut. Bijoux fins discrets.
- **Interdits** : néon, cyan vif, magenta, or brillant, chrome, glitter, HDR, peau plastique, poses d'influenceuse, zellige saturé.

### Conflit de la charte avec la pub

Les anciens prompts (`docs/images/prompts/kit/*.txt`, `docs/images/prompts/_a-generer/cross-kit.txt`) décrivent un produit obsolète (pot « base », pot « fortifiant » ambré, lime en céramique, étiquettes illisibles, « no text »). Pour les ads, il faut **garder les pastilles lisibles « 1 paste » et « 2 powder »** ainsi que le polissoir « Step ④ Polish & Shine ». Il ne faut **pas** reprendre ces descriptions.

### Description produit à verrouiller dans chaque prompt

- deux pots carrés en verre épais transparent à bords facettés ;
- sur chaque couvercle, une pastille ronde mate : sauge `#C5DBC4` « 1 / paste » et rose `#F2CECC` « 2 / powder », avec « FemiGlow » en script dessous ;
- le pot 1 contient une crème ivoire épaisse, le pot 2 une poudre blanche fine légèrement nacrée ;
- un polissoir rectangulaire 4 faces, dessus bleu ciel et tranches blanches et grises, texte « Step ④ Polish & Shine » ;
- une boîte rigide blanche avec vagues sauge et rose et « FemiGlow / MANICURE TREATMENT KIT / Natural Nail Care System » ;
- jamais de troisième pot, jamais de « fortifiant », jamais de couvercle métallique.

## 5. Jeu de références recommandé (REF-01 à REF-10)

Tous les fichiers sont dans `docs/hero-media-par-angle/references/`, copiés depuis le dépôt sans modification (sauf REF-04 et REF-04b, convertis et recadrés).

| ID | Groupe | Fichier `references/` | Source dans le dépôt | URL de secours | Dimensions | Pourquoi |
|---|---|---|---|---|---|---|
| REF-01 | Produit et packaging (canon) | `REF-01-kit-canon.png` | `docs/images/values/kit/image-produit.png` | `https://femiglow-maroc.com/_media/media/me_t37h41m94iv06w5j/jpeg/2xl.jpeg` | 1122×1402 | Boîte, pots et polissoir dans le style maison. C'est le hero actuel. |
| REF-02 | Produit (textures) | `REF-02-pots-ouverts-textures.png` | `docs/images/values/maison/cross-kit.png` | `https://femiglow-maroc.com/maison/cross-kit.png` | 1122×1402 | Pots ouverts (crème et poudre) et bon bleu du polissoir. |
| REF-03 | Produit (label en macro) | `REF-03-pot1-label-macro.png` | `docs/images/values/kit/kit-base.png` | `https://femiglow-maroc.com/_media/media/me_e4wje0jm8xfoi9wz/jpeg/2xl.jpeg` | 1254×1254 | Typographie et pastille du pot 1. |
| REF-04 | Produit réel et geste (infographie complète) | `REF-04-rituel-etapes.png` | `docs/images/values/reviews/rituel-etapes.png` (WebP converti en PNG) | — | 1024×1536 | Vérité terrain sur la boîte, le contenu des pots et l'application. Contient du texte. |
| REF-04b | Produit réel et geste (bande photo) | `REF-04b-rituel-etapes-crop.png` | idem, recadrée y=1000→1345 | — | 1024×345 | Les 4 photos d'étapes sans texte de mise en page. **À préférer à REF-04.** |
| REF-05 | Produit en main (réel) | `REF-05-ugc-main-foncee-kit.jpg` | `apps/web/public/reviews/reviews4.jpg` | `https://femiglow-maroc.com/reviews/reviews4.jpg` | 500×425 | Peau foncée, boîte, pots et polissoir réels, marbre. |
| REF-06 | Produit en main (réel) | `REF-06-ugc-composition-marbre.jpg` | `apps/web/public/reviews/reviews7.jpg` | `https://femiglow-maroc.com/reviews/reviews7.jpg` | 500×428 | Composition propre, couleurs exactes du packaging. |
| REF-07 | Résultat sur les ongles | `REF-07-resultat-ongles-peau-foncee.png` | `docs/images/values/kit/hands-sara-apres.png` | `https://femiglow-maroc.com/_media/media/me_cmdeuegun0fj4itk/jpeg/2xl.jpeg` | 1254×1254 | Glow nude, peau foncée, matière éditoriale. |
| REF-08 | Résultat sur les ongles (réel) | `REF-08-resultat-ongles-french-reel.jpg` | `apps/web/public/reviews/reviews10.jpg` | `https://femiglow-maroc.com/reviews/reviews10.jpg` | 500×438 | Brillance « French naturel » réelle, peau claire et medium. |
| REF-09 | Ambiance et lumière | `REF-09-ambiance-lumiere-matin.png` | `docs/images/values/kit/kit-pack-shot.png` | `https://femiglow-maroc.com/_media/media/me_cu6e7vqirq8v4ez5/jpeg/2xl.jpeg` | 1122×1402 | Lumière striée du matin, lin, papier crème. Alternative possible : `home/mains-yasmine.png`. |
| REF-10 | UGC maison | `REF-10-ugc-maison.jpg` | `apps/web/public/reviews/reviews3.jpg` | `https://femiglow-maroc.com/reviews/reviews3.jpg` | 500×366 | Kit réel en salle de bain, angle « vraie vie à la maison ». Alternative possible : `reviews5.jpg` (plaid en maille). |

**À ne jamais fournir comme référence :**
- `kit/kit-fortifiant.png` / `me_0md55ut0fq1ejexy`
- `kit/kit-principale.png`
- `kit/og-kit.png` / `me_s3rs2rrx4snd16v4`
- `home/hero-home.png` (« 3 shine »)
- `kit/kit-detail-mains.png` (couvercle métal)
- `rituel/hero-lifestyle.png` (polissoir sauge)
- `reviews11.jpg` et `reviews12.jpg`
- `reviews9.jpg` (KlingAI)
- `stories/*` et `reviews1.jpg` (visages)
- tout `public/products/*` et tous les `*.svg`

## 6. Incohérences à signaler, à corriger hors de cette tâche

1. En prod, la carte « 2 powder » (`kit-comparatif/kit-fortifiant`) affiche « 2 fortifiant » avec une résine ambrée.
2. L'OG de /kit (FR et AR) montre 3 pots, dont un pot à feuille qui n'existe pas.
3. Les images avant/après d'Amal sont quasi identiques.
4. `docs/images/values/reviews/rituel-etapes.png` est en réalité un fichier WebP.
5. La teinte du polissoir varie : bleu très pâle sur les rendus IA, bleu ciel vif sur les photos réelles.
6. Le texte alt du hero n°1 est générique (« Visuel FemiGlow. »).
