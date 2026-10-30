# Images hero qui convertissent — principes sourcés (FemiGlow)

Date : 30/10/2026

## Résumé des règles clés
1. Slide 1 (LCP) = le résultat : main droite vue à la 1re personne, ongles naturels qui brillent avec un reflet net, kit en second plan, décor marocain réel et flou, aucun texte incrusté.
2. Message match : la slide 1 de chaque utm_content reprend le plan, la lumière et la main du Reel ; le prix « 99 DH avec code » est en HTML près du H1.
3. Pas de visage dans la slide 1 ; si un visage apparaît, il regarde les ongles, pas l'objectif.
4. Galerie de 5 à 6 slides : résultat → avant/après vertical → étapes 1-2-3 → kit + échelle → UGC de clientes marocaines → argument propre à l'angle.
5. Avant/après honnête (même main, même lumière) et vertical : avant en haut, après en bas, neutre FR/AR. Ne jamais miroiter les photos ; miroiter seulement les séquences en AR.
6. Point focal dans les 60 % supérieurs de l'image : la barre sticky masque environ le tiers inférieur. Vignettes swipables, pas d'autoplay, peek de la slide suivante.
7. Technique : AVIF/WebP + srcset, `fetchpriority="high"`, jamais de lazy-load sur la slide 1, width/height renseignés, LCP ≤ 2,5 s, choix de la variante côté serveur.
8. Pas de vernis, gel, henné, mains de stock ni texte incrusté dans les visuels ; alt rédigé dans la langue de la page.

---

## Périmètre et limites
- **Kolenda, lu en entier :** guides Ecommerce (maj. 15/02/2025), Visual Attention (maj. 15/02/2025), Advertising (maj. 30/04/2025) et User Experience (maj. 25/04/2025).
  - Il n'existe **pas de guide « landing pages »** dans l'index https://www.kolenda.io/guides.
  - Plusieurs tactiques sont **payantes** et n'ont pas pu être lues : environ 13 dans Ecommerce, 7 dans Advertising.
- **Non consultés directement :** les livres (Kolenda « Methods of Persuasion », Cialdini, Krug).
- **Page vide :** la page web.dev « responsive images » n'a renvoyé aucun contenu au scraping.
- **Pas de source académique trouvée** sur les codes culturels marocains (pudeur, henné). La partie D les présente comme **hypothèses à tester**.
- Toutes les citations ci-dessous sont **verbatim** (15 mots max). Les éléments marqués « heuristique » sont des estimations, pas des données sourcées.

---

## A. Principes

**1. La slide 1 montre le résultat (l'ongle qui brille), pas l'effort.**
- **Pourquoi :** le client se projette dans un état désiré. Montrer l'effort (le polissage) rend le coût saillant.
- **Preuve :**
  - Kolenda : « Help people envision this desired outcome, rather than the costs to achieve this outcome. » (https://www.kolenda.io/guides/ecommerce)
  - CXL : un hero doit montrer « the product, outcome, use case, context ». Mis à jour en 08/2026 : https://cxl.com/blog/hero-image/
- **FemiGlow :** gros plan d'une main dont les ongles naturels brillent, avec un reflet lumineux visible. Le kit est présent mais secondaire.

**2. Contexte réel plutôt que fond blanc pour un public féminin, et humain présent parce que c'est un produit d'apparence.**
- **Pourquoi :**
  - Les femmes traitent davantage le détail contextuel.
  - Les humains distraient, sauf quand ils servent à juger la qualité.
- **Preuve (Kolenda Ecommerce) :**
  - « Men prefer isolated backgrounds, whereas women prefer realistic backgrounds. »
  - Montrer des humains : oui, « if they convey quality (e.g., apparel, beauty, jewelry ».
  - Mais : « Humans can reduce conversions because they distract from the product. »
- **FemiGlow :**
  - Montrer une main, pas un visage.
  - Mettre un décor domestique réel mais flou (salon marocain, lumière de fenêtre).
  - Kolenda : un arrière-plan flou fait paraître le produit plus grand (Meng et al. 2022).

**3. Séquence de galerie : isolé et contextuel se complètent, mais en landing page on est au stade « acheter ».**
- **Preuve :** Kolenda, « Isolated photos help customers choose. Contextual photos help them buy. » (Lee et al. 2024 ; Bagatini et al. 2023)
- **FemiGlow :**
  - Le visiteur d'une pub n'a qu'un seul produit à évaluer. Il est donc déjà en phase d'achat : slide 1 contextuelle (main + résultat + kit).
  - Le packshot isolé du kit vient en slide 3 ou 4.
  - Il y a une tension avec l'ordre isolé→contextuel de Lee et al. : c'est **à A/B tester** (slide 1 « main + kit » contre « kit seul »).

**4. Simulation mentale et main dominante : orienter vers la droite ce qui se saisit.**
- **Pourquoi :** voir un objet orienté vers sa main dominante déclenche une simulation motrice d'usage.
- **Preuve :**
  - Elder & Krishna 2012 (JCR) : « For negatively valenced products, facilitation of embodied mental simulation decreases purchase intentions. » (https://websites.umich.edu/~aradhna/Elder_Krishna_JCR_Proof.pdf). Conséquence : la simulation n'aide que si l'image est attrayante.
  - Kolenda : « any graspable elements of a product (e.g., handle) should be positioned toward the right ».
  - Kolenda Advertising : « Since most people are right-handed, this orientation feels more familiar and immersive. »
- **FemiGlow :**
  - Le polissoir (buffer) a sa poignée vers la droite.
  - Dans les plans d'usage, c'est une main droite qui tient le buffer, vue à la 1re personne (point de vue de l'utilisatrice).
  - Le pot de pâte est ouvert, la spatule et le doigt côté droit.

**5. Mains « vicariantes » : montrer une main qui touche le produit.**
- **Pourquoi :** la cliente s'approprie la main vue à l'écran, ce qui crée un sentiment de propriété psychologique.
- **Preuve :**
  - Kolenda, citant Luangrath et al. 2022 : « Customers simulate the ownership of hands ».
  - Baymard : « communicate size (and portability) is by having a hand hold the product » (https://baymard.com/research-articles/ux-product-image-categories).
- **FemiGlow :**
  - Cadrage à la 1re personne (main vue depuis les yeux de l'utilisatrice) plutôt que main tendue vers la caméra.
  - La main tenant le kit sert aussi de repère d'échelle.

**6. Montrer le geste d'évaluation réel : la cliente juge la brillance en inclinant la main sous la lumière.**
- **Preuve :**
  - Kolenda : « Product images should simulate real-world assessments. »
  - Kolenda : « Close-up images can reveal haptic features (e.g., textures, softness). »
  - Visual Attention : les images statiques qui suggèrent le mouvement captent l'attention (Cian, Krishna & Elder 2015).
- **FemiGlow :**
  - Gros plan macro du reflet sur l'ongle.
  - Buffer saisi en plein mouvement (léger flou de bouge).
  - Option : boucle vidéo muette de 2 à 3 s, main qui pivote sous la lumière. Jamais en slide 1, LCP oblige (voir E).

**7. Regard et visages : un visage capte l'attention et la retient sur lui-même.**
- **Preuve :**
  - Kolenda : « Eye gaze captures attention automatically. »
  - Sajjacholapunt & Ball 2014 (eye-tracking) : le regard détourné vers le produit et le texte augmente l'attention portée au texte et au produit (« near 5-fold increase in product dwell time » pour les bannières verticales). https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00166/full
  - Breeze, cité par Neuromarketing (source secondaire) : « If they are looking out at us we will simply look back at them ».
- **FemiGlow :**
  - Si une slide contient un visage (témoignage), la femme **regarde ses ongles**, pas l'objectif.
  - Dans la slide 1, pas de visage, ou alors coupé, sinon il vole l'attention aux ongles.
  - Kolenda : expression marquée plutôt que neutre, « All of these emotions converted better than a neutral face ».

**8. Images informatives plutôt que décoratives ; vraies personnes plutôt que photos de banque d'images.**
- **Preuve :**
  - NN/g : « users pay attention to information-carrying images ».
  - NN/g : « users ignore stock photos of generic people » (2010, revu depuis : https://www.nngroup.com/articles/photos-as-web-content/).
- **FemiGlow :**
  - Chaque slide doit répondre à une question d'achat : ça brille vraiment ? c'est facile ? qu'y a-t-il dans la boîte ? d'autres femmes comme moi l'utilisent ?
  - Proscrire les mains de stock caucasiennes manucurées.

**9. Contraste avant/après : il est puissant mais doit rester honnête.**
- **Preuve :**
  - Kolenda Advertising : « Viewers confuse visual contrast for semantic contrast ».
  - Kolenda conseille aussi : « degrade the color or visual quality of the "problem" framing. »
- **FemiGlow :**
  - Avant = ongle terne ou abîmé par le semi-permanent. Après = brillant.
  - Garder la même main, la même lumière et le même cadrage, sinon ça paraît truqué. On peut éventuellement désaturer légèrement l'arrière-plan du « avant », jamais l'ongle lui-même.

**10. Le sens de lecture gouverne le « avant → après ».**
- **Preuve :**
  - Chae & Hoegg 2013 (JCR) : les lecteurs de gauche à droite (LTR) visualisent le passé à gauche et le futur à droite. « The effect of horizontal position reverses among consumers who read from right to left. » https://ideas.repec.org/a/oup/jconrs/doi10.1086-669476.html
  - Material Design : « Anything depicting the passage of time should be mirrored. »
- **FemiGlow :**
  - FR/EN : avant à gauche, après à droite.
  - AR : avant à droite, après à gauche.
  - Sur un format portrait 3:4, solution neutre : **avant en haut, après en bas** (valable pour les deux langues).

**11. Message match pub → page : la slide 1 reprend là où la pub s'arrête.**
- **Preuve :**
  - Meta : « your landing page should pick up where your ad left off » (créa, prix et promo cohérents). https://www.facebook.com/business/news/learn-how-to-optimize-your-mobile-landing-page-to-drive-sales
  - Google Ads : « Choose a landing page that closely matches your ad and keywords. »
  - Kolenda (attention top-down) : « Insert cues that viewers are actively monitoring. »
- **FemiGlow :**
  - La slide 1 de chaque utm_content reprend **le même plan, la même lumière, la même main et la même palette** que le 1er ou le dernier frame du Reel.
  - Le prix « 99 DH avec code » est affiché en texte HTML près du H1, pas incrusté dans l'image.

**12. Point d'entrée visuel unique et hiérarchie.**
- **Preuve :**
  - Kolenda UX : « Users should know where to look first. »
  - NN/g : « Assign visual weight based on goal importance. » (https://www.nngroup.com/articles/image-focused-design/)
- **FemiGlow :**
  - Un seul point focal par slide : l'ongle brillant.
  - Pas de collage de quatre éléments en slide 1.
  - Kolenda : collages ordonnés pour les nouveaux clients.

**13. Échelle (« In Scale ») : au moins une image doit faire comprendre la taille réelle.**
- **Preuve :** Baymard, « 42% of users will attempt to gauge the overall scale and size ». Recommandation : « should always offer at least one "In Scale" image ». Article de 2017 : https://baymard.com/research-articles/in-scale-product-images
- **FemiGlow :** kit tenu dans une main, ou posé à côté d'un objet connu (téléphone, tasse de thé). Cela désamorce la déception « c'est tout petit ? » à la livraison en paiement à la livraison (COD), donc les refus de colis.

**14. Texture et preuve sociale dans la galerie.**
- **Preuve (Baymard, 7 types d'images) :**
  - Texture : « an extreme close-up image will give the customer a sense of the texture ».
  - Photos clients : « user submitted images can be a cost-effective way of providing social proof ».
- **FemiGlow :**
  - Macro de la pâte et de la poudre.
  - Photos UGC de vraies clientes marocaines, ongles naturels, avec leur prénom et leur ville en légende HTML.

**15. Navigation de galerie mobile : vignettes oui, défilement automatique non.**
- **Preuve :**
  - Baymard : « On mobile, gallery indicator dots are so small that hit area issues nearly always arise. » Les vignettes sont « the universal solution across platforms ». https://baymard.com/research-articles/always-use-thumbnails-additional-images
  - NN/g, défilement automatique : « users automatically assume that it might be an advertisement » (2013).
  - Kolenda : « Extend elements beyond the screen to communicate that more information exists. »
- **FemiGlow :**
  - Swipe manuel avec vignettes cliquables.
  - Pas d'autoplay.
  - Laisser dépasser 8 à 12 % de la slide suivante (« peek ») pour signaler la suite.

**16. Angle de prise de vue.**
- **Preuve :** Kolenda, « Downward angles look easy, portable, and sustainable. » Les angles légèrement en contre-plongée connotent l'efficacité.
- **FemiGlow :** vue plongeante ou à plat pour les étapes et le contenu du kit (message « facile, naturel »). Angle neutre ou légère contre-plongée pour la macro du résultat (« efficace »).

---

## B. Structure recommandée de la galerie (5 à 6 slides ; 7 au maximum)

| # | Rôle | Contenu | Pourquoi |
|---|---|---|---|
| **1 (LCP)** | Résultat + message match | Main (1re personne, droite) aux ongles naturels **brillants avec un reflet net** ; kit FemiGlow flou ou en coin haut ; décor intérieur chaud et flou. Même plan que la pub de l'angle. **Aucun texte incrusté.** | Principes 1, 2, 4, 11, 12 |
| **2** | Preuve du contraste | Avant/après **vertical** (avant en haut, après en bas), même main et même lumière. Variante selon l'angle (voir C). | Principes 9, 10 |
| **3** | Facilité / usage | 3 étapes en vue plongeante : pâte → poudre → polissoir. Main droite, buffer en mouvement. Numéros 1-2-3 en surimpression minimale (chiffres seulement) ; légende en HTML. | Principes 4, 5, 6, 16 |
| **4** | Contenu + échelle | Kit ouvert tenu dans une main, ou à côté d'un téléphone ; packshot propre sur fond neutre chaud. | Principes 3, 13 |
| **5** | Preuve sociale | 1 à 3 photos UGC de clientes marocaines (mains variées), légendes HTML (prénom, ville, note). | Principe 14 |
| **6 (option)** | Argument d'angle | Salon vs maison, compatibilité woudou, ou macro de texture, selon l'angle. | Section C |
| 7 (option) | Bénéfices « sans » | Pictos sans vernis / sans lampe UV / sans acétone, idéalement en HTML sous la galerie plutôt qu'en slide. | CXL : texte en HTML |

Règle de tri : l'ordre des slides 2 à 6 change selon l'angle de la pub, mais **la slide 1 garde toujours le même rôle** (résultat brillant).

---

## C. Recommandations par angle (utm_content)

| Angle | Slide 1 (LCP) doit montrer | Slides à prioriser ensuite |
|---|---|---|
| **A « ça brille, et ce n'est pas du vernis »** | Macro d'ongle naturel avec reflet spéculaire ; la cuticule et la texture naturelle de l'ongle restent visibles, preuve que ce n'est pas du vernis. | 2 = macro de texture (l'ongle naturel n'a pas d'épaisseur de vernis) ; 3 = étapes ; 5 = UGC |
| **B « zéro vernis et ça brille »** | Même logique, version plus « liberté » : main dans un geste du quotidien (tasse, téléphone), ongles brillants nus. | 2 = avant/après terne → brillant ; 3 = pictos « 0 vernis / 0 UV / 0 acétone » ; 4 = kit |
| **C « fini le semi-permanent »** | Ongle naturel brillant **et sain**. Éviter le rouge ou le glossy qui ressemble à du gel. | 2 = avant/après « ongle abîmé après semi-permanent → ongle naturel brillant » (vertical) ; 3 = étapes ; 5 = UGC d'ex-utilisatrices de gel |
| **D « rien à retirer avant le woudou »** | Mains sous un filet d'eau (robinet ou aiguière), gouttes sur des ongles brillants : le brillant tient à l'eau. Cadrage sobre, poignets couverts, aucun visage. **Ne pas mettre en scène la prière.** | 2 = l'eau perle sur l'ongle naturel ; 3 = étapes ; 6 = rappel en HTML « rien à retirer, rien à poser » |
| **E « le soin du salon chez vous »** | Résultat « fini salon » chez soi : main sur un coussin ou une table de salon marocain, kit à côté, lumière douce. | 2 = comparaison salon vs maison (deux vignettes ; les prix en HTML, ou en surimpression courte en chiffres si l'image est déclinée par langue) ; 4 = kit + échelle ; 5 = UGC |
| **Témoin « la manucure japonaise à la maison »** | Slide générique : main + kit ouvert, résultat brillant. Sert de contrôle pour l'A/B test. | Ordre standard du B |

**Point clé :** il faut une slide 1 dédiée par angle (6 variantes). Les slides 3 à 5 sont partagées. Il faut mesurer le CTR vers « Commander » et le taux de swipe par variante.

---

## D. Langue et culture (FR / AR / EN)

**Texte dans les images**
- **À éviter :** H1, promesse, prix et code promo incrustés.
  - CXL : « Important headlines, value propositions, and calls to action are generally better placed as page text ».
  - Material Design : « Graphics that include text usually require localization ».
- **Toléré :** chiffres 1-2-3, flèches neutres, éventuellement « 99 DH ». Les chiffres latins sont lisibles en FR et en AR marocain.
  - Une flèche « avant → après » doit être miroitée en AR.
  - Si un mot est indispensable, produire **une image par langue**.

**Miroir RTL**
- **Ne pas miroiter les photos.** Material Design : « The majority of users in RTL-writing countries are also right-handed ». La main droite et le buffer poignée à droite restent valables en AR.
- **Miroiter seulement ce qui exprime une séquence temporelle :** avant/après côte à côte, frise des étapes. En AR, 1-2-3 se lit de droite à gauche. Une version **verticale** évite d'avoir deux fichiers.
- Si un visage regarde un élément de la page (H1, prix), sa direction de regard doit pointer vers cet élément dans chaque version linguistique.
  - Le H1 étant au-dessus, un regard vers le haut ou vers les ongles reste neutre en FR comme en AR.
  - Kolenda : l'œil LTR part de la gauche et va vers la droite ; un « blocage » (sujet tourné vers l'intérieur) le retient. En AR, la logique s'inverse ; c'est une extrapolation à tester.

**Codes culturels pour le public marocain (hypothèses, aucune source académique trouvée)**
- Mains et poignets avec manches longues ou mi-longues, tissus simples ; pas de décolleté, de bras nus ou de bijoux ostentatoires dans la slide 1.
- Décor reconnaissable mais sobre : coussin de salon, verre de thé, zellige flou. Éviter le cliché folklorique.
- **Henné : pas dans la slide 1.**
  - Le henné colore les ongles et brouille la preuve « ongle naturel ».
  - Il est possible en slide UGC ou saisonnière (Aïd, mariages), à tester.
- Angle D : pudeur et respect (eau, mains, pas de prière ni de tapis en gros plan, pas de texte religieux incrusté).
- **Carnations :** réalistes du public marocain (olive à brun), mains de 20 à 55 ans, au moins une main mûre. Les mains « parfaites » de stock sont ignorées (NN/g).
- Baymard : les photos clientes montrent le produit « when not perfectly lit in a studio setup ». Préférer la lumière naturelle.

**Texte alternatif (alt) par langue**
- W3C : pour une photo simple, « Use a brief description of the image in a way that conveys that meaning ». Pour une image contenant du texte, mettre ce texte dans l'alt.
- Rédiger l'alt dans la langue de la page (attribut `lang`/`dir` cohérent), sans bourrage de mots-clés.
- Exemples :
  - FR : « Ongles naturels brillants sans vernis après la manucure japonaise FemiGlow »
  - AR : « أظافر طبيعية لامعة بدون طلاء بعد المانيكير الياباني FemiGlow »
  - EN : « Natural nails shining without polish after FemiGlow Japanese manicure »
- Les vignettes ou slides redondantes avec une légende HTML peuvent avoir `alt=""`.

---

## E. Spécifications techniques

**Ratios à produire**
- **3:4 portrait** pour la galerie mobile (slide 1 et les autres). Exemple : 1125×1500 px de master (375 CSS px × DPR 3).
- **1:1** pour les vignettes, ou un recadrage central du 3:4 : prévoir une **zone de recadrage carrée centrée** dans chaque photo.
- **4:5** (1080×1350) et **9:16** (1080×1920) pour les déclinaisons pub Meta, afin d'assurer la continuité visuelle. Shooter large pour pouvoir recadrer.

**Zones de sécurité (heuristique, à vérifier dans le navigateur intégré d'Instagram)**
- Hauteur utile du viewport : environ 650 à 700 px sur un écran de 812.
- Header + H1 au-dessus : environ 120 à 160 px. Barre sticky du bas : environ 150 px.
- Sur une image de 375×500 CSS px, **le tiers inférieur (environ 30 %) risque d'être masqué** au premier écran.
- Conséquence : placer **l'ongle brillant (point focal) dans les 60 % supérieurs** du cadre. Ne rien mettre d'essentiel dans les 30 % du bas ni dans les 8 % latéraux (zone du peek et des flèches).

**Résolution et formats**
- Servir **AVIF + WebP** avec JPEG en repli via `<picture>`. web.dev : l'AVIF offre une « improved perceptual quality at file sizes smaller than JPEG or WebP ».
- `srcset` en largeurs : 480w, 750w, 1080w, 1440w, avec `sizes="100vw"`.

**Poids cible (heuristique, non sourcé)**
- Slide 1 à 750-1080w : **≤ 80-120 Ko en AVIF / ≤ 150 Ko en WebP**.
- Vignettes : ≤ 15 Ko.
- Vidéo éventuelle : jamais en slide 1, poster léger, chargée paresseusement.

**LCP (web.dev)**
- Objectif : « an LCP of 2.5 seconds or less for at least 75% of page visits ».
- Slide 1 en `<img>` présente dans le HTML initial, avec `fetchpriority="high"`.
- **Jamais de `loading="lazy"` sur la slide 1.**
- Slides 2 et suivantes : `fetchpriority="low"` ou lazy. web.dev : « setting a high priority on more than one or two images makes priority setting unhelpful ».
- Pas d'image en `background-image` CSS ni en `data-src` JS pour le LCP. Si c'est inévitable, ajouter `<link rel="preload" as="image" fetchpriority="high">`.
- Source : https://web.dev/articles/optimize-lcp

**CLS (stabilité de mise en page)**
- web.dev : « Always include width and height size attributes on your images », ou utiliser `aspect-ratio: 3/4`.
- Source : https://web.dev/articles/optimize-cls

**Variantes par angle**
- La slide 1 change selon utm_content. Le choix doit se faire **côté serveur ou dans le HTML initial** : un swap en JS retarde le LCP et provoque un flash.

---

## F. Anti-patterns à éviter
1. Slide 1 = packshot du kit sur fond blanc, sans résultat visible (pas de projection, pas de message match).
2. Slide 1 avec un visage qui regarde l'objectif : il capte l'attention au détriment des ongles et du H1.
3. Texte, prix ou code promo incrustés dans l'image : illisibles en 375 px, non traduisibles, inaccessibles, et ils alourdissent le LCP.
4. Main gauche ou buffer poignée à gauche dans les plans d'usage ; main tendue vers la caméra (pas en 1re personne).
5. Ongles vernis, gel ou faux ongles dans le visuel : contredit la promesse « sans vernis », surtout pour les angles A, B et C.
6. Avant/après truqué (lumière ou main différentes, retouche) : perte de confiance et risque réglementaire.
7. Avant/après horizontal identique en FR et en AR : le sens temporel est inversé pour les lecteurs RTL.
8. Miroiter les photos pour la version AR (mains qui deviennent gauches, logo inversé).
9. Défilement automatique, points comme seul indicateur, slide « autonome » sans peek.
10. Point focal dans le tiers inférieur, caché par la barre sticky.
11. Photos de banque d'images (mains caucasiennes, manucure de magazine), et henné ou bijoux dans la slide 1.
12. Slide 1 en lazy-load, en CSS background ou injectée en JS ; plusieurs images en `fetchpriority="high"` ; images sans width/height.
13. Collage chargé en slide 1 (plusieurs points focaux).
14. Vidéo au ralenti de mains : Kolenda (Yin et al. 2021) note que le ralenti de mouvements humains réduit l'efficacité.

---

## G. Sources
**Kolenda (consultées 30/10/2026)**
- https://www.kolenda.io/guides (index)
- https://www.kolenda.io/guides/ecommerce (maj. 15/02/2025 ; certaines tactiques payantes)
- https://www.kolenda.io/guides/visual-attention (maj. 15/02/2025)
- https://www.kolenda.io/guides/advertising (maj. 30/04/2025 ; 7 tactiques payantes)
- https://www.kolenda.io/guides/user-experience (maj. 25/04/2025)

**Académiques**
- Elder & Krishna 2012, JCR, « The Visual Depiction Effect » : https://websites.umich.edu/~aradhna/Elder_Krishna_JCR_Proof.pdf
- Chae & Hoegg 2013, JCR, « The Future Looks Right » : https://ideas.repec.org/a/oup/jconrs/doi10.1086-669476.html
- Sajjacholapunt & Ball 2014, Frontiers in Psychology : https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00166/full
- Études citées via Kolenda, non lues directement : Luangrath et al. 2022 (JMR) ; Lee et al. 2024 ; Bagatini et al. 2023 ; González et al. 2021 ; Lu et al. 2023 ; Meng et al. 2022 ; Cian, Krishna & Elder 2015 ; Park et al. 2018 ; Yin et al. 2021 ; Zhang et al. 2024.

**Baymard**
- https://baymard.com/research-articles/in-scale-product-images (2017)
- https://baymard.com/research-articles/ux-product-image-categories (date non affichée)
- https://baymard.com/research-articles/always-use-thumbnails-additional-images

**Nielsen Norman Group**
- https://www.nngroup.com/articles/photos-as-web-content/ (2010, revu depuis)
- https://www.nngroup.com/articles/image-focused-design/
- https://www.nngroup.com/articles/auto-forwarding/ (2013)

**CXL et Unbounce**
- https://cxl.com/blog/hero-image/ (A. Birkett, 2021, maj. 08/2026)
- https://cxl.com/blog/how-images-can-boost-your-conversion-rate/ (P. Laja, 2019, maj. 2022 ; chiffres d'A/B tests anciens, via des liens d'archives)
- https://unbounce.com/landing-page-articles/the-anatomy-of-a-landing-page/ (« Ideally, a hero image should show the context of use. »)

**Meta et Google Ads**
- https://www.facebook.com/business/news/learn-how-to-optimize-your-mobile-landing-page-to-drive-sales (date non affichée)
- https://support.google.com/google-ads/answer/6238826

**web.dev**
- https://web.dev/articles/optimize-lcp
- https://web.dev/articles/optimize-cls
- https://web.dev/learn/images/avif
- La page responsive-images n'a renvoyé aucun contenu.

**RTL et accessibilité**
- https://m2.material.io/design/usability/bidirectionality.html
- https://www.w3.org/WAI/tutorials/images/decision-tree/

**Secondaire**
- https://www.neurosciencemarketing.com/blog/articles/baby-heat-maps.htm (étude de James Breeze, non revue par des pairs)
