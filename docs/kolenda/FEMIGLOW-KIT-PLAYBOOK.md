# FemiGlow — Playbook de conversion `/kit`

> Synthèse opérationnelle des 8 guides Kolenda (`Attention`, `Color`, `Copywriting`, `Ecommerce`, `Fonts`, `Luxury`, `Pricing`, `UX`), filtrée et contextualisée pour la landing **Pack FemiGlow** sans jamais dénaturer la voix « maison ».

**Document préparé pour** : optimisation `/kit` section par section.
**Sources internes** : `docs/kolenda/{Attention,Color,Copywriting,Ecommerce,Fonts,Luxury,Pricing,UX}.pdf`.
**Convention** : chaque principe est suivi de `[Source.pdf — p. X]` pour vérification.

---

## Sommaire

- [0. À lire en premier — la tension centrale](#0-à-lire-en-premier--la-tension-centrale)
- [1. TL;DR — Top 12 leviers priorisés](#1-tldr--top-12-leviers-priorisés)
- [2. Les quatre invariants de la page](#2-les-quatre-invariants-de-la-page)
  - [2.1 Voix](#21-voix)
  - [2.2 Palette](#22-palette)
  - [2.3 Typographie](#23-typographie)
  - [2.4 Rythme et densité](#24-rythme-et-densité)
- [3. Les 60 principes Kolenda retenus](#3-les-60-principes-kolenda-retenus)
  - [3.1 Attention](#31-attention)
  - [3.2 Color](#32-color)
  - [3.3 Copywriting](#33-copywriting)
  - [3.4 Ecommerce](#34-ecommerce)
  - [3.5 Fonts](#35-fonts)
  - [3.6 Luxury](#36-luxury)
  - [3.7 Pricing](#37-pricing)
  - [3.8 UX](#38-ux)
- [4. Application section par section](#4-application-section-par-section)
  - [4.1 Hero](#41-hero)
  - [4.2 Bandeau « Trois gestes, livrés chez vous »](#42-bandeau--trois-gestes-livrés-chez-vous-)
  - [4.3 La composition (3 cards)](#43-la-composition-3-cards)
  - [4.4 Les gestes (vidéo)](#44-les-gestes-vidéo)
  - [4.5 Le détail (INCI)](#45-le-détail-inci)
  - [4.6 Le pack (récap + prix + CTA)](#46-le-pack-récap--prix--cta)
  - [4.7 Comparatif](#47-comparatif)
  - [4.8 Voix de la maison (témoignages)](#48-voix-de-la-maison-témoignages)
  - [4.9 FAQ](#49-faq)
  - [4.10 Trois mains (avant/après)](#410-trois-mains-avantaprès)
  - [4.11 Posez le geste (CTA final)](#411-posez-le-geste-cta-final)
  - [4.12 Trois lectures (journal)](#412-trois-lectures-journal)
  - [4.13 Footer](#413-footer)
- [5. Plan d'action priorisé (P0 → P2)](#5-plan-daction-priorisé-p0--p2)
- [6. Anti-patterns à éviter — synthèse](#6-anti-patterns-à-éviter--synthèse)
- [Annexe A — Tokens design recommandés](#annexe-a--tokens-design-recommandés)
- [Annexe B — Réécritures copy (avant / après)](#annexe-b--réécritures-copy-avant--après)
- [Annexe C — Glossaire des effets cités](#annexe-c--glossaire-des-effets-cités)

---

## 0. À lire en premier — la tension centrale

La page `/kit` doit résoudre une tension permanente entre **deux mandats opposés** :

| Mandat | Force du dossier Kolenda | Risque si on dérive |
|---|---|---|
| **Convertir** (e-commerce + attention + pricing) | Saturation locale, contraste, urgence douce, anchors, sticky CTA, preuves chiffrées. | Page « marketplace marocain agressif » qui trahit la marque. |
| **Préserver l'identité** (luxury + voix maison) | Espace, silence, lenteur, retenue, vocabulaire « rituel/initiée », pas de countdown. | Page « contemplative » qui ne déclenche aucune décision. |

**Règle d'or** : la **page de fond reste contemplative** (≈ 80 % de la surface en registre lent), et **deux zones de décision concentrent toute la pression de conversion** : le bloc prix dans le Hero et le bloc prix dans la section « Le pack ». Toute tentation d'urgence agressive est confinée à ces deux zones — et même là, sous une forme **douce mais nette** (contraste de taille, ancrage, garanties collées au CTA, pas de countdown rouge).

> **Formule synthétique** : *Hermès qui chuchote, pas Balenciaga qui se tait.* On garde l'arrogance structurelle (silence, retenue, distance par l'espace) ; on transforme la froideur en douceur initiatique.

---

## 1. TL;DR — Top 12 leviers priorisés

Liste ordonnée par **impact × facilité d'exécution**. Chaque item renvoie vers la section détaillée.

| # | Levier | Source | Effort | Détail |
|---|---|---|---|---|
| 1 | **Sticky CTA bottom-bar mobile** (prix + bouton, masqué quand `KitCommander` est dans le viewport) | UX p. 27 | M | [§4.1](#41-hero), [§5](#5-plan-daction-priorisé-p0--p2) |
| 2 | **Bloc prix refondu** : 199 MAD géant + 390 MAD barré (60% taille) + « Économie 191 MAD », *horizontal*, espace généreux | Pricing p. 10-24 / Attention p. 13 | S | [§4.6](#46-le-pack-récap--prix--cta) |
| 3 | **Ratings/témoignages au format visuel** + note 4,7-4,8/5 (pas 5,0) + 1-2 avis avec réserve honnête + réponses signées de la maison | Ecommerce p. 43-48 | M | [§4.8](#48-voix-de-la-maison-témoignages) |
| 4 | **CTA en sauge profond** sur toute la page, **terracotta sourdine réservée au CTA final pivot** (un seul moment chaud) | Color p. 5-12 / Attention p. 11 | S | [§4.11](#411-posez-le-geste-cta-final), [Annexe A](#annexe-a--tokens-design-recommandés) |
| 5 | **Galerie produit refondue** : isolated → contextual (≥ 60 % contextuel pour cible féminine), 4-6 visuels | Ecommerce p. 20-22 | M | [§4.1](#41-hero), [§4.3](#43-la-composition-3-cards) |
| 6 | **Sous-ligne reframing valeur** sous le prix : *≈ 1,5 MAD par manucure (vs ~150 MAD en salon)* | Pricing p. 21-22, 60-61 | S | [§4.6](#46-le-pack-récap--prix--cta) |
| 7 | **FAQ accordion exclusif** (un seul ouvert à la fois), 4-6 visibles + « voir plus », questions formulées en bénéfice (« Est-ce vraiment halal ? » plutôt que « Certification ») | UX p. 5, 43, 53 | S | [§4.9](#49-faq) |
| 8 | **Réécriture du sous-titre Hero** : « Manucure japonaise halal. Deux gestes, un polissoir. La main se révèle. » | Copywriting p. 5, 14-15, 39 | S | [Annexe B](#annexe-b--réécritures-copy-avant--après) |
| 9 | **Vue éclatée du kit** dans « La composition » (composants annotés, vue isométrique douce) | Ecommerce p. 40 | M | [§4.3](#43-la-composition-3-cards) |
| 10 | **Affichage de la « Valeur séparée » du kit** (paste + powder + polissoir hors pack ≈ 320 MAD) pour ancrer vers le haut sans mentir | Pricing p. 62-63 | S | [§4.6](#46-le-pack-récap--prix--cta) |
| 11 | **Stack typo officialisée** : Cormorant Garamond (display, weight 400) + Inter (body) + `tabular-nums` sur le prix | Fonts p. 8-19 | S | [§2.3](#23-typographie), [Annexe A](#annexe-a--tokens-design-recommandés) |
| 12 | **Trust row collé sous le prix** : `Livraison offerte · Paiement à la livraison · Retour 30 j même entamé`, icônes petites, texte calme | Pricing p. 17, 25-27 | S | [§4.1](#41-hero), [§4.6](#46-le-pack-récap--prix--cta) |

> **Quick-win zéro-effort** : `font-variant-numeric: tabular-nums` sur tous les chiffres de prix (alignement des digits, signal de précision). Une ligne de CSS, perception « calculé, pas inventé ».

---

## 2. Les quatre invariants de la page

Les invariants sont les règles **non négociables** qui s'appliquent à *toutes* les sections. Toute optimisation ultérieure doit les respecter.

### 2.1 Voix

| Règle | Source |
|---|---|
| Phrases courtes, ponctuées au point. Pas de virgule de remplissage. | Copywriting p. 13 |
| **Zéro** exclamation, **zéro** emoji, **zéro** majuscules d'emphase (« VITE », « ICI »). | Luxury p. 7-9 / Copywriting p. 23 |
| Pas de superlatifs marketing (« révolutionnaire », « le meilleur », « unique »). | Copywriting p. 12 |
| Pas de « 100 % naturel », « 100 % halal » — préférer la certification précise (`Halal Cosmetics Council`, `Cosmos Organic — Ecocert`). | Copywriting p. 48 |
| Vocabulaire **« rituel / initiée / saison / édition / maison »**. Bannir « promo / deal / discount / VIP / exclusif ». | Luxury p. 7-9 |
| **Chiffres en lettres** pour les *durées d'expérience* (« cinq minutes », « quatre-vingt-dix secondes ») ; **digits** pour les *métriques de preuve* (199 MAD, 15 g, 4,8/5, 287 avis). | Copywriting p. 46-47 |
| Tutoiement absent. Adresse à la lectrice par la chose qu'elle fait (« Quand vous appliquez… »). | Voix maison existante |
| **Cadence saisonnière** plutôt qu'urgence (« édition de la saison », « la suivante après l'Atlas »). | Luxury p. 14, Copywriting p. 54 |

### 2.2 Palette

Répartition cible sur l'ensemble de la page : **≈ 70 % neutres (ivoire/sable/gris-sauge), ≈ 20 % couleurs marque (sauge/rose poudré), ≈ 10 % pops fonctionnels (CTA, prix, badges)**. C'est ce ratio qui donne à la primary toute sa valeur sémantique (`Color` p. 18).

| Rôle | Couleur | Hex indicatif | Justification Kolenda |
|---|---|---|---|
| Fond global | Ivoire | `#F7F4EE` | Color p. 13, 20 — clair = sain, user-friendly, conversion. |
| Fond alterné (rythme) | Sable | `#EFE9DD` | Color p. 18 — pops aux endroits pertinents. |
| Fond alterné (sections lentes) | Sauge très pâle | `#E8EDE3` | — |
| Primary marque (badges, accents) | Sauge désaturé | `#A8B89E` (HSL ≈ 95/22/68) | Color p. 11-12 — désaturé = luxe, lointain. |
| CTA primaire en cours de page | Sauge profond | `#4A5D4A` | Color p. 13 — sombre = sérieux, durable. |
| CTA final (pivot, **un seul** sur la page) | Terracotta sourdine | `#C28A6E` | Color p. 5-6 — *un* pop chaud pour activer la décision. |
| Accent rose | Rose poudré | `#E8D5D0` | Cohérence packshot Powder. |
| Or chaud (témoignages, badges) | Or poudré | `#B8956B` | Luxury p. 12 — signal premium discret. |
| Encre (titres, body fort) | Encre désaturée | `#2A2E2A` | Color p. 18 — pas de noir pur sur les titres. |
| Body small / INCI | Noir presque pur | `#1F1F1F` | Color p. 18 — noir réservé au petit corps. |
| Séparateurs / bordures | Gris-sauge | `#C7CCC2` | Color p. 18 — jamais de gris pur. |

> **Règles annexes** :
> – Aucun rouge vif sur la page (erreurs / croix Comparatif en `#9CA396` ou encre, pas en rouge ; `Color` p. 18-19).
> – Aucun thème sombre, même sur les sections « éditoriales » : `Color` p. 20-21 est explicite, le clair est l'arme de la conversion.

### 2.3 Typographie

| Rôle | Police | Taille mobile / desktop | Weight | Letter-spacing | Justification |
|---|---|---|---|---|---|
| Eyebrow | Inter UPPERCASE | 12-13 px | 500 | `0.18em` | Fonts p. 16-19 — capitales espacées = premium discret. |
| H1 (Hero) | Cormorant Garamond | 36-44 / 56-72 px | 400 | `-0.01em` | Fonts p. 8, 14 — serif fin = luxe-doux ; jamais bold sur H1. |
| H2 (section) | Cormorant Garamond | 28-32 / 40-48 px | 400 | `-0.005em` | — |
| H3 (card, sous-section) | Inter | 18-20 px | 600 | 0 | Sans-serif pour la lisibilité écran. |
| Body | Inter | **16-17 px** (jamais < 15) | 400 | `0.005em` | UX p. 13 — accommode le skill level. |
| Prix actuel (199 MAD) | Inter `tabular-nums` | 56-64 / 72-80 px | 600 | 0 | Attention p. 13 — contraste de taille XXL ; Fonts p. 14 weight 600 max. |
| Prix barré (390 MAD) | Inter `tabular-nums` | 18-20 px | 400 | 0 | Pricing p. 10-11 — taille ≈ 60 % du prix actuel. |
| CTA label | Inter | 16-17 px | 500 | `0.02em` | Fonts p. 14 — pas de bold agressif. |
| Témoignage (citation longue) | Cormorant **italic** | 20-22 px | 400 italic | 0 | Fonts p. 20 — italique réservé aux citations humaines. |
| Micro-copy (mentions sous CTA, légales) | Inter | 13-14 px | 400 | `0.01em` | — |

> **Règle d'or** : `font-variant-numeric: tabular-nums` sur **tous** les chiffres de prix, poids et notes. Empêche les chiffres de danser, signale la précision (`Pricing` p. 51-56).

### 2.4 Rythme et densité

| Règle | Source |
|---|---|
| **Une seule zone « saillante » par viewport** (un CTA pulsant *ou* un badge *ou* un grand chiffre — jamais les trois). | Attention p. 6 |
| Chaque section déborde sur la suivante (≥ 20 px de la section suivante visible au fold) — empêche le « faux fond de page ». | UX p. 52 |
| **Layout serré pour les zones de deal** (prix + CTA), **layout aéré pour les zones de qualité** (composition, INCI, journal). | Ecommerce p. 5-6 / Pricing p. 25-27 |
| Animations à 400-600 ms (fade-in, hover, slow-loop vidéo). Pas de transition snappy < 200 ms. | Luxury p. 18-19 |
| Pulse très lente du CTA principal (`scale 1 → 1.02` toutes les 3-4 s, opacité légère). Compatible voix lente. | Attention p. 15 |
| Section avec ≥ 5 items repliée par défaut (INCI, FAQ longue, témoignages additionnels). | UX p. 53 |

---

## 3. Les 60 principes Kolenda retenus

Pour chaque discipline : les principes triés par **impact prévisible sur la conversion `/kit`**.

### 3.1 Attention

`Source : Attention.pdf — 58 p.`

1. **Salience par contraste de couleur** *[p. 11-12]* — Un pop chaud unique sur la page = aimant à œil. Réserver le terracotta strictement au CTA final pivot ; tout le reste de la page reste sauge/ivoire.
2. **Salience par contraste de taille** *[p. 13]* — Le 199 MAD doit être 3-4× la taille du body environnant ; le 390 barré 60 %. Inutile d'ajouter de la couleur.
3. **Motion onset** *[p. 15]* — Micro-pulsation très lente du CTA (`scale 1.02` toutes les 3-4 s) — capte sans agresser.
4. **Dynamic imagery** *[p. 18]* — La miniature de la vidéo « gestes » doit montrer une main *en mouvement* (pinceau qui touche l'ongle), pas une main figée.
5. **Looming motion** *[p. 16]* — La vidéo commence par un léger zoom in (2-3 s). Réflexe d'attention garanti.
6. **Faces** *[p. 23-25]* — Une photo de visage *droit* dans la section témoignages (1 sur 3 suffit). Attention au face inversion effect : pas de cadrages inclinés.
7. **Eye gaze + body orientation** *[p. 30-32]* — Si visage présent, son regard pointe vers le produit ou le CTA, pas vers la caméra.
8. **Hand pointing / body parts** *[p. 27, 33-34]* — Plans rapprochés de mains réelles (pas d'illustrations). Atout naturel d'une marque d'ongles.
9. **Novelty** *[p. 45-47]* — Le prix 199 (non rond) est déjà bon. Renforcer en juxtaposant des collocations rares : « manucure japonaise halal », « polissage Step 4 ».
10. **Self-relevance douce** *[p. 48-50]* — Prénom + ville sous chaque témoignage (« Imane, Rabat »). Évite la personnalisation invasive type cookies.
11. **Goal-directed attention** *[p. 53]* — Above-the-fold du Hero : pastilles `sans vernis · sans UV · sans acétone · halal` (les requêtes que la cliente porte en tête).
12. **Directional words** *[p. 36]* — « Voir le pack ci-dessous », « la formule en bas » — ancrent le regard sans crier.

### 3.2 Color

`Source : Color.pdf — 21 p.`

1. **Chaud vs froid** *[p. 5-6]* — Froid = liking, gist, plus tard. Chaud = action, maintenant. Toute la page en froid, *un* point chaud sur le CTA final.
2. **Saturation = taille perçue + immédiateté** *[p. 11-12]* — Désaturer le fond (luxe, distance) ; saturer localement le prix + CTA.
3. **Luminosité = poids / sérieux** *[p. 13-14]* — Clair dominant (sain, conversion) + touches sombres (titres, CTA) pour le sérieux.
4. **Thème clair = conversion** *[p. 20-21]* — `/kit` reste en thème clair sur toute la page. Pas de bloc sombre « luxueux ».
5. **Neutres dominants + pops fonctionnels** *[p. 18-19]* — Ratio 70/20/10 (neutres / marque / pops).
6. **Mélanger les neutres avec la primary** *[p. 18]* — Tous les gris doivent tirer vers le sauge (gris-sauge `#C7CCC2`). Aucun gris pur.
7. **Limiter le noir au petit corps** *[p. 18]* — Titres en encre désaturée `#2A2E2A`, pas en `#000`.
8. **Pas de rouge erreur** *[p. 18-19]* — Erreurs / croix comparatif en encre ou gris foncé. Le rouge fait basculer dans le registre « marketplace ».
9. **Saturation > Hue** *[p. 9-10]* — Choisir les bonnes valeurs HSL (S=10-15 / L=92-96 pour fonds ; S=45-55 / L=40-50 pour CTA) avant de débattre la teinte exacte.
10. **Génération par opacité** *[p. 17]* — À partir du sauge primary, générer 7 variations par superposition de blanc/noir. Unifie toute la page.

### 3.3 Copywriting

`Source : Copywriting.pdf — page count complet.`

1. **Présent vivant pour les bénéfices** *[p. 5]* — Témoignages : « L'ongle retrouve sa nervure » > « a retrouvé sa nervure ». Le présent garde l'effet en marche.
2. **Cadrage positif** *[p. 9]* — Limiter les négations. « Sans vernis » est un marqueur de catégorie : on le garde. Mais « Sans l'étouffer » → « La plaque est filmée, jamais étouffée. »
3. **Pas de descripteurs vagues** *[p. 12]* — Bannir « précieux », « somptueux », « sensoriel », « opulent ». Garder le concret (« 12 % cire d'abeille atlas »).
4. **Alignement sémantique / linguistique** *[p. 13]* — Bénéfice court = phrase courte. Bénéfice ample = phrase plus longue. La voix maison utilise déjà cette règle ; la conserver.
5. **Continuité d'image** *[p. 14-15]* — Chaque phrase commence par l'objet de la précédente. Crée une mécanique lente, hypnotique, fidèle à la voix.
6. **Mots positifs collés aux CTA** *[p. 17]* — Trust row (`Livraison offerte · Retour 30 jours`) **au-dessus** du bouton, pas en pied de page.
7. **CTA naturel à dire** *[p. 23]* — « Commander le rituel » > « Recevoir le pack ». Verbe d'agentivité, registre maison, pas d'exclamation, pas de « maintenant ».
8. **Newness préférence** *[p. 35]* — « Édition 2026, formulée à Rabat » — capitalise sur le lancement récent.
9. **Easy to imagine** *[p. 37-38]* — Préférer « dix doigts » à « 15 g » dans la description gestuelle. Le 15 g reste sur l'étiquette / dans la fiche INCI.
10. **Directional consistency** *[p. 39]* — Tous les verbes d'un même bloc dans la même direction (« lustre / révèle / soutient » ; jamais mêlé avec « réduit / apaise »).
11. **Digits vs mots — règle hybride** *[p. 46-47]* — Lettres pour l'expérience (cinq minutes), digits pour la preuve (199 MAD, 4,8/5).
12. **Pas de « 100 % »** *[p. 48]* — Spécifier la certification précise.
13. **Rôles > actions** *[p. 49-50]* — « Pour les initiées du soin lent » > « Pour celles qui prennent soin lentement ». Crée un rôle permanent.
14. **Pas de science sur produit émotionnel** *[p. 51]* — Le mot « biologiste » dans le Hero charge la science. Le déplacer dans la section Maison.
15. **Hypothétique vivant** *[p. 57-58]* — « *Quand* vous appliquez la paste… » > « Si vous appliquez ». Le quand active la simulation.
16. **Rareté temporelle, pas quantité** *[p. 54]* — « Édition d'hiver », « avant le printemps » > « plus que 12 packs ». Évite l'effet « fond de stock ».

### 3.4 Ecommerce

`Source : Ecommerce.pdf — 49 p.`

1. **Galerie : isolated → contextual** *[p. 20-21]* — Détouré fond clair en premier, contextuel ensuite. Évaluation → désir.
2. **Cible féminine = plus de contextuel** *[p. 22]* — Effet additif : plus de contexte = plus de ventes. ≥ 60 % de la galerie en contexte (table de chevet, sac, étagère salle de bain).
3. **Suggérer le toucher** *[p. 21-23]* — Plans de mains qui ouvrent un flacon, qui appliquent. Orienter les objets manipulables vers la droite (80 % droitiers).
4. **Présence humaine implicite** *[p. 18-19]* — Mains anonymes en gros plan plutôt que mannequin pleine page. La cliente s'imagine elle-même.
5. **Angle vers le bas** *[p. 34-36]* — Légère plongée sur le kit = « facile, naturel, portable ». Évite l'angle montant « luxe distant ».
6. **Vue éclatée du produit** *[p. 40]* — Composants éclatés et annotés dans « La composition ». Boost de confiance, surtout en cash-on-delivery (la cliente sait *quoi* arrive dans le colis).
7. **Zoom serré = immédiat, large = futur** *[p. 37-39]* — Hero zoomé sur la main (action ce soir), section « résultats » large (futur désiré).
8. **Note 4,7-4,8 > 5,0** *[p. 48]* — La perfection paraît fausse. Inclure 1-2 témoignages avec réserve honnête.
9. **Ratings visuels jamais en chiffre seul** *[p. 43-44]* — Étoiles ou barres. Le « 3,8/5 » écrit est ancré comme « 3,0 » (left-digit anchoring).
10. **Multi-dimensions sur les avis** *[p. 47]* — Sous-notes : tenue, texture, brillance, facilité. Plus persuasif qu'une note globale.
11. **Réponse aux avis avec réserve** *[p. 46]* — Trust signal majeur (+60 % bookings dans les études Booking.com). À signer « FemiGlow ».
12. **UGC photo récompensé** *[p. 47]* — Programme post-achat (tag + cuticle oil offert pour photo + retour). Boost les avis visuels.
13. **Which-to-choose mindset** *[p. 9]* — Micro-choix précoce (cadence — soir / matin / saison) bascule la cliente du « est-ce que j'achète » au « lequel je prends ».
14. **Densité du deal vs aération qualité** *[p. 5-6]* — Bloc prix serré ; section composition aérée. La densité signale « affaire », l'espace signale « qualité ».
15. **Round products = friendly** *[p. 28-29]* — Les flacons ronds doivent dominer la photographie chaleureuse. Les sections rationnelles (INCI, comparatif) peuvent recourir à des cadrages plus angulaires.

### 3.5 Fonts

`Source : Fonts.pdf — 17 p.`

1. **Real-world similarities** *[p. 7]* — Les adjectifs marque doivent décrire la police. Doux, lent, posé → serif fin, contre-formes ouvertes.
2. **Serif H1, sans-serif body** *[p. 8-9]* — Serif = traditionnel, sérieux du soin ; sans-serif = lisibilité écran.
3. **Roundness** *[p. 10]* — Terminaisons douces (Cormorant, Fraunces) > pointes nettes (Bodoni).
4. **Complexity** *[p. 11]* — Un soupçon de complexité sur le H1 (serif à contraste, italique sur 1 mot) = signal « occasion spéciale ».
5. **Light weight** *[p. 14-15]* — H1 en weight 300-400 (jamais bold). Body 400. CTA 500 max. Prix 600 max.
6. **Letter casing** *[p. 16-17]* — UPPERCASE espacé pour eyebrows uniquement ; casse normale pour H1/H2. Pas de capitales sur le body.
7. **Letter-spacing** *[p. 18-19]* — Eyebrows à `0.18em`. Body à `0.005em`. H1 légèrement serré.
8. **Italique = vitesse / urgence** *[p. 20]* — **Jamais** sur le prix (doit paraître stable). Réservé aux citations témoignages.
9. **Largeur normale, pas condensé** *[p. 12-13]* — Le condensé connote « pressé / agressif » — incompatible avec la voix.

### 3.6 Luxury

`Source : Luxury.pdf — 20 p.`

1. **Statut sans logo criard** *[p. 4-6]* — Le packshot capte par sa qualité ; pas de bandeau « PREMIUM ».
2. **Distance douce, pas froideur** *[p. 7-9]* — Pas de sourires factices, pas d'emojis, pas de « trop hâte que tu l'essaies ». La voix initiée joue ce rôle.
3. **Angles montants** *[p. 10-11]* — Légère contre-plongée sur le packshot. Active la perception de pouvoir / élévation.
4. **Typo fine et espacée** *[p. 12-13]* — Confirmé par §2.3. Le mix capitales-titres / lowercase-corps signale premium-accessible.
5. **Isolement, peu de visages** *[p. 14-16]* — Max 3-4 témoignages affichés. Wall infini = signal mass-market.
6. **Savoir-faire artisanal humain** *[p. 17]* — Bloc INCI raconté comme une fiche d'atelier. Mention « coopérative apicole du Moyen Atlas », « fondue à basse température ».
7. **Slow motion** *[p. 18-19]* — Animations 400-600 ms. Loop vidéo en ralenti doux.
8. **Rareté douce — saison, série** — « Édition de la saison », « première série », « la suivante après l'Atlas ». **Jamais** de countdown ni compteur.
9. **Origine et terroir** *[p. 17]* — Le terroir marocain est un atout unique. Le valoriser explicitement (« Pensée à Rabat », coopérative atlas).
10. **Justification par la valeur, pas par la promo** *[p. 4-6]* — Sous le prix, lister fabrication / certifications, jamais « -49 % ».
11. **Silence — ce qu'on ne dit pas** *[p. 7]* — Pas de FAQ défensive (« Pourquoi si cher ? »). Si la question revient, y répondre en *montrant* (terroir, INCI), pas en se défendant.
12. **Avant/Après retenu** *[p. 4-6]* — Noir & blanc, même cadrage, légères mentions « semaine 1 / semaine 6 ». Aucune flèche, aucun cercle rouge.

### 3.7 Pricing

`Source : Pricing.pdf — 85 p., 38 tactiques.`

1. **Anchoring par prix barré différencié** *[p. 10-11]* — Le 390 doit être visuellement secondaire : plus petit, gris, à gauche, barré.
2. **Espace horizontal entre les deux prix** *[p. 23-24]* — L'écart spatial Mueller-Lyer agrandit l'écart numérique perçu. Ne marche **qu'en horizontal**.
3. **Charm pricing 199** *[p. 45-46]* — Le 199 vs 200 est déjà optimal. Ne pas y toucher. Pas de « 199,00 » (décimales = + de syllabes, p. 41-42).
4. **Symbole monétaire réduit** *[p. 17-18]* — « MAD » à 70-80 % de la taille des chiffres, couleur atténuée. « DH » est plus court mais moins universel (retargeting) — garder « MAD ».
5. **Position gauche du prix** *[p. 5-6]* — Le prix à gauche du visuel ou en haut, le CTA à droite ou en bas (droitiers).
6. **Économie absolue > pourcentage** *[p. 75-76]* — Au-delà de 100 $, l'absolu (191 MAD) est plus grand que le % (49 %) — donc plus mémorable. **« Économie 191 MAD »**.
7. **Reframing en valeur d'usage** *[p. 21-22]* — « ≈ 1,5 MAD par manucure » sous le prix (pas dans le Hero principal, dans « Le pack »).
8. **Comparaison de valeur** *[p. 60-61]* — « 8 manucures salon par an ≈ 1 200 MAD. FemiGlow : 199 MAD pour 4-5 mois → économie 1 000 MAD/an. » À placer en bande dédiée.
9. **Précision (191, 390, pas 200, 400)** *[p. 51-56]* — Les nombres précis paraissent calculés. Le 390 barré est meilleur que 400.
10. **« Petits mots » à côté du prix** *[p. 7-8, 17]* — « **Juste** 199 MAD », « Livraison **offerte** ». Adoucissent la douleur de paiement.
11. **Bundles divisibles** *[p. 72-73]* — Duo à 380 MAD (190/pack), Trio à 540 MAD (180/pack). Phase 2.
12. **Shrink spatial du paiement** *[p. 25-27]* — Zone prix compacte. **Paiement à la livraison** réduit massivement la douleur d'achat — à mettre en évidence.
13. **Décrire avant de prixer** *[p. 70]* — H1 bénéfice **avant** le prix. Pas de prix au-dessus du titre.
14. **Grand nombre près du prix** *[p. 38-39]* — « 287 femmes » ou « 1 200 MAD/an d'économie » à proximité — contraste qui fait paraître le 199 plus petit.
15. **Affichage de la valeur séparée** *[p. 62-63]* — Lister les valeurs unitaires (Paste ≈ 110 MAD, Powder ≈ 90 MAD, Polissoir ≈ 120 MAD → total 320 MAD) → élargit la fenêtre haute sans mentir.
16. **Anti-pattern absolu** — Pas de « -49 % » seul, pas de countdown, pas de stickers « MEGA DEAL ». Voix maison incompatible.

### 3.8 UX

`Source : UX.pdf — page count complet.`

1. **Show ≤ 4 options** *[p. 5-6]* — Au-delà, le cerveau compte au lieu de percevoir. FAQ groupée par 4 visibles + « voir plus ».
2. **Match user expectations** *[p. 39-40]* — Above-the-fold Hero mobile (375 × 667) : photo + nom + prix + 1 CTA. Indispensable.
3. **Takeaway dans le titre** *[p. 43]* — « Trois mains, six semaines plus tard » > « Trois mains ». « Pourquoi Souheila a créé FemiGlow » > « Voix de la maison ».
4. **Visual entry point unique** *[p. 57]* — Un seul point focal par viewport. Pas de bloc concurrent.
5. **Faux fond de page** *[p. 52]* — Ne jamais terminer une section pile au fold. Toujours laisser dépasser la suivante (≥ 20 px visibles).
6. **Group similar elements** *[p. 55-56]* — Headlines collés à leur contenu, pas centrés entre deux sections (loi de proximité Gestalt).
7. **Hide unnecessary** *[p. 53-54]* — INCI en accordion replié par défaut sur mobile. Tooltip sur termes techniques.
8. **Minimize waiting** *[p. 34-36]* — Skeleton screens > spinners. Loaders bleus > rouges. Progress démarre à 1-3 %, pas 0.
9. **Frequent interactions visibles** *[p. 27-28]* — **Sticky CTA bottom-bar mobile** — manque #1 actuel.
10. **40×40 px minimum sur les targets tap** *[p. 14-15]* — Chevrons FAQ, puces réassurance, flèches comparatif.
11. **Tap feedback** *[p. 48-49]* — `:active` state visible (scale 0.97, couleur), pas seulement `:hover`.
12. **Feedback progressif** *[p. 46-47, 44]* — Funnel `KitCommander` montre la progression « coordonnées → adresse → merci ».
13. **Induce sensation** *[p. 8-9]* — Décrire la sensation physique (« la tiédeur de la paste », « le lissé du polissoir ») renforce la preuve d'efficacité.

---

## 4. Application section par section

Chaque section suit ce gabarit : **Objectif de conversion → Principes activés → Recommandations concrètes → Anti-patterns**.

### 4.1 Hero

**Objectif** : capturer l'attention de la cliente, faire comprendre *immédiatement* ce qu'est le pack et combien il coûte, faire entrer le pouce sur le CTA.

**Above-the-fold mobile (375 × 667)** doit contenir, sans scroll :
1. Eyebrow `LE RITUEL`
2. H1 bénéfice
3. Sous-titre court
4. Visuel pack (≈ 40-45 % de la hauteur)
5. Prix `199 MAD` + barré `390 MAD` + « Économie 191 MAD »
6. CTA `Commander le rituel`
7. Trust row condensée

**Principes activés** :
- Attention §1, §2 (contraste couleur, taille)
- Color §1, §4 (froid dominant, thème clair)
- Copywriting §1-7 (réécriture du sous-titre)
- Pricing §1-6 (format du prix)
- UX §2, §4, §9 (sticky CTA, point focal, expectations)

**Recommandations concrètes** :
- **H1** : `Pack FemiGlow` reste, mais lui adjoindre un sous-titre bénéfice fort. Réécriture proposée :
  - *Avant* : « Des ongles soignés. Un woudou intact. »
  - *Après* : **« Manucure japonaise halal. Deux gestes, un polissoir. La main se révèle. »**
- **Prix** :
  ```
  ~~390 MAD~~     199 MAD
                  Économie 191 MAD
  ```
  - 390 MAD à 60 % de la taille, gris-sauge, à gauche.
  - 199 MAD en sauge profond, weight 600, `tabular-nums`, 56-64 px mobile.
  - Espace horizontal `gap-6` minimum entre les deux.
- **CTA principal** : `Commander le rituel` en sauge profond `#4A5D4A`, texte ivoire, hauteur ≥ 48 px, micro-pulse `scale 1.02` toutes les 3-4 s.
- **Trust row** sous le CTA, micro-copy 13-14 px : `Livraison offerte · Paiement à la livraison · Retour 30 jours même entamé`.
- **Pastilles d'attributs** (`sans vernis · sans UV · sans acétone · halal`) en chips discrètes sous le visuel — `goal-directed attention`.
- **Visuel** : packshot en légère contre-plongée, fond ivoire, *aucun* badge promo. Image dynamique en seconde position dans la galerie (main qui applique, orientation droite).
- **Sticky CTA bottom-bar mobile** : apparition au scroll > 600 px, masquée quand `KitCommander` est dans le viewport. Hauteur 64 px, prix à gauche, bouton à droite.

**Anti-patterns** :
- Pas de « Acheter maintenant ! ».
- Pas de prix au-dessus du H1.
- Pas de mannequin pleine page (transfère l'ownership *à elle*).
- Pas d'animation snappy sur le CTA (< 200 ms = stressant).

---

### 4.2 Bandeau « Trois gestes, livrés chez vous »

**Objectif** : lever immédiatement la friction logistique (Maroc, cash-on-delivery).

**Principes activés** :
- Pricing §10, §12 (mots positifs collés au prix / paiement spatialement réduit)
- UX §1, §10 (≤ 4 options, 40 px tap)

**Recommandations** :
- Garder exactement 3 promesses (pas 4). Headlines à takeaway :
  - **Livraison offerte** — *Rabat 24 h · Maroc 48-72 h*
  - **Paiement à la livraison** — *Vous payez le colis en main propre*
  - **Retour 30 jours** — *Même entamé*
- Icônes 40 × 40 px minimum.
- Fond sable `#EFE9DD` pour distinguer du Hero (rythme).
- **Optionnel — Bénéfice cash-on-delivery** : ajouter une 4ᵉ mention si on garde 3 + 1 : `Aucun engagement financier en amont` (réduit la douleur de paiement, `Pricing` p. 25-27).

**Anti-patterns** : pas d'icônes décoratives génériques (truck, lock) — préférer pictogrammes au style maison (line art fin sauge).

---

### 4.3 La composition (3 cards)

**Objectif** : faire comprendre que le pack contient 3 objets distincts et précieux, sans submerger ; activer le `which-to-choose mindset` indirectement (la cliente choisit *son geste préféré*).

**Principes activés** :
- Ecommerce §1, §6, §15 (isolated→contextual, vue éclatée, round=friendly)
- Attention §8 (mains réelles)
- UX §1, §3 (≤ 4 items, takeaway dans le titre)
- Copywriting §5, §13 (continuité d'image, induce sensation)

**Recommandations** :
- Garder 3 cards (Paste, Powder, Polissoir) — *pas* d'ajout.
- **Ajouter en tête de section une vue éclatée annotée** du kit (composants étalés à plat, lignes fines vers chaque label). Format isométrique doux, fond sable.
- Chaque card :
  - Image **détourée** (isolated) en premier état.
  - Au hover ou en tap : image **contextuelle** (sur table de chevet, dans la main).
  - Titre : nom du produit + volume (`1 Paste · 15 g`).
  - Description : 2 phrases, voix maison, **continuité d'image** (l'objet de la phrase 1 devient sujet de la phrase 2).
  - **Ajouter une mention de sensation** : « tiède au contact », « glisse lentement », « la lumière revient à la surface » — *induce sensation* (UX p. 8-9).
- Couleurs : fond sable, cards ivoire avec bordure gris-sauge 1 px. Un chiffre / numéro en or poudré `#B8956B`.

**Anti-patterns** :
- Pas de 4ᵉ card (« polish & shine bonus ») — au-delà de 4, on compte.
- Pas de description médicale (« la kératine de l'ongle… »).
- Pas d'illustrations en place de photo.

---

### 4.4 Les gestes (vidéo)

**Objectif** : faire vivre l'application en 90 secondes, instancier le rituel.

**Principes activés** :
- Attention §4, §5 (dynamic imagery, looming motion)
- Luxury §7 (slow motion)
- UX §8, §13 (skeleton, sensation)

**Recommandations** :
- **Poster** : frame d'action (pinceau sur l'ongle ou polissage), pas une main figée.
- **Démarrage** : léger zoom in 2-3 s (looming).
- **Loop ralenti** sur la version sans son.
- **Bouton play 60 × 60 px** centré.
- **Sous-titres FR** par défaut (mobile sans son).
- **Skeleton loader** au chargement (`UX` p. 34-36). Pas de spinner.
- Transcription en accordéon replié par défaut, intitulé « Lire la transcription ».

**Anti-patterns** : autoplay avec son ; vidéo trop longue (> 120 s) ; transitions snappy entre plans.

---

### 4.5 Le détail (INCI)

**Objectif** : prouver la qualité de la formulation et le sérieux du laboratoire — **sans dénaturer la voix émotionnelle**.

**Principes activés** :
- Luxury §6 (savoir-faire artisanal raconté)
- Copywriting §14 (pas de science lourde sur produit émotionnel)
- UX §7 (accordion replié sur mobile)
- Color §6, §7 (gris-sauge, encre pour les lignes)

**Recommandations** :
- **3 tableaux INCI** repliés en accordion par défaut sur mobile (déplié sur desktop).
- Chaque tableau présenté comme une **fiche d'atelier** :
  - Petit paragraphe d'introduction *au-dessus* du tableau, raconté en voix maison : « 12 % de cire d'abeille, fondue à basse température par la coopérative apicole du Moyen Atlas. Une noisette filme dix doigts. »
  - Tableau ensuite — colonnes : Ingrédient · INCI · Fonction · Origine · %.
  - Sous le tableau, la **certification** avec son émetteur précis (`Cosmos Organic — Ecocert`, `Halal — Halal Cosmetics Council`, `Vegan — EVE Vegan`).
- Lignes alternées `#FBFAF6` / `#F7F4EE`. Bordures `#C7CCC2`.
- **Tooltip** au tap sur les termes INCI (Tocopherol, Cera Alba…) — explication courte.
- Picto certif en sauge profond, pas en vert vif.

**Anti-patterns** : pas de jargon « technologie filmogène bi-couche brevetée ». Pas de mise en avant du mot « biologiste » (à réserver à la section Maison / Voix).

---

### 4.6 Le pack (récap + prix + CTA)

**Objectif** : c'est **la deuxième zone de conversion** de la page. Tout doit converger vers la décision.

**Principes activés** :
- Pricing §1-15 (toute la partie pricing)
- Attention §2 (taille XXL du prix)
- Ecommerce §14 (densité du deal)
- Color §1, §5 (pop chaud local autorisé sur l'« Économie »)
- Copywriting §6, §13 (mots positifs collés, rôle « initiée »)

**Recommandations** :
- Bloc serré (`Ecommerce` p. 5-6). Layout dense, pas de blanc excessif autour du prix — la densité signale « affaire ».
- Construction verticale :
  1. Eyebrow `LE PACK`.
  2. H2 : « Le rituel s'installe en deux gestes et un polissoir. »
  3. **Visuel pack** packshot.
  4. **Valeur séparée** (nouveau) — micro-liste : `Paste ≈ 110 MAD · Powder ≈ 90 MAD · Polissoir Step 4 ≈ 120 MAD` → en sous-ligne *Valeur séparée 320 MAD*.
  5. **Bloc prix** : `~~390 MAD~~  199 MAD` (horizontal, espace généreux).
  6. Sous-ligne : **« Économie 191 MAD »** en terracotta `#C28A6E` (seul mot chaud de la section).
  7. **Reframing valeur d'usage** : *« ≈ 1,5 MAD par manucure · 8 manucures salon par an ≈ 1 200 MAD. »* — 13-14 px, encre 70 %.
  8. CTA principal `Commander le rituel` (sauge profond).
  9. Trust row : `Livraison offerte · Paiement à la livraison · Retour 30 j même entamé`.
  10. Bandeau avis `★ 4,8/5 · 287 femmes — Rabat, Casablanca, Marrakech` (digits sur la note, lettres sur « femmes », `Copywriting` p. 46-47).

**Sous-bloc « Étapes du rituel »** (en dessous, ou collé à droite sur desktop) :
- 4 étapes numérotées (Préparation · Paste · Powder · Polissoir).
- Numéros en or poudré `#B8956B`.
- Phrase courte par étape, verbes au présent.

**Sous-bloc « Bénéfices »** :
- 3 colonnes : ingrédients naturels / sans chimique / forts & éclatants.
- Headlines réécrits en bénéfices courts.

**Anti-patterns** :
- ❌ Pas de « -49 % » en sticker.
- ❌ Pas de countdown.
- ❌ Pas de prix au format `199,00 MAD`.
- ❌ Pas de prix barré et prix actuel à la même taille / couleur (perte d'anchoring).

---

### 4.7 Comparatif

**Objectif** : positionner FemiGlow comme **alternative posée** au vernis classique sans dénigrer.

**Principes activés** :
- Luxury §11 (silence, ne pas se justifier)
- UX §1, §3 (≤ 3 colonnes, headline takeaway)
- Color §8 (pas de rouge sur les croix)
- Copywriting §10 (directional consistency)

**Recommandations** :
- Headline : **« Vernis classique et rituel FemiGlow »** ou plus direct **« Pourquoi pas le salon ? »** (takeaway).
- Tableau 2 colonnes × 6 axes (Préparation · Tenue · Récupération · Coût annuel · Impact matière · Temps quotidien).
- **Colonne FemiGlow surlignée** : fond rose poudré 10 % opacité.
- Coches en sauge profond, croix en encre désaturée (**pas rouge** — Color p. 18-19).
- Verbes alignés (toutes les lignes FemiGlow utilisent des verbes ascendants : « préserve / révèle / soutient » ; toutes les lignes Vernis utilisent des verbes neutres : « dépose / requiert / oblige »).
- Sur mobile : tableau scrollable horizontal, **bord droit qui dépasse de 12 px** (signal qu'on peut scroller — `UX` p. 52).
- 3 packshots en haut de section restent.

**Anti-patterns** : pas de ton sarcastique. Pas de logo concurrent. Pas de croix rouges criardes.

---

### 4.8 Voix de la maison (témoignages)

**Objectif** : preuve sociale **crédible** (4,7-4,8/5, réserves honnêtes, photos), sans tomber dans le « wall of love » mass-market.

**Principes activés** :
- Ecommerce §8-12 (notes visuelles, 4,7 > 5,0, multi-dim, réponse aux avis)
- Attention §6, §7, §10 (faces, gaze, self-relevance)
- Luxury §5 (peu de témoignages, beaucoup de blanc)

**Recommandations** :
- **3 témoignages affichés** (déjà le cas). Drawer optionnel `Lire les 48 rituels partagés` reste.
- Refonte de chaque card :
  - Photo réelle de visage (1 sur 3 minimum) — visage **droit**, regard **vers la citation** (gaze cuing).
  - Prénom + ville (`Imane, Rabat`) — **self-relevance** géographique.
  - Note visuelle (étoiles en or poudré `#B8956B`).
  - **Sous-notes multi-dimensions** : `Tenue ●●●●○` `Brillance ●●●●●` `Facilité ●●●●○`.
  - Tags chips (rituel devenu habitude · plaque souple · fini brillant).
  - Citation en Cormorant *italic* 20-22 px (Fonts §8).
  - **Inclure au moins 1 témoignage avec une petite réserve honnête** (« au début je doutais » / « le polissoir prend un peu d'habitude ») → +crédibilité (`Ecommerce` p. 48).
- **Note globale en haut** : `★ 4,8/5 — Deux cent quatre-vingt-sept femmes, Rabat · Casablanca · Marrakech.` (digits sur la note, lettres sur le compte humain, géo = self-relevance).
- **Réponses signées « FemiGlow »** sous les avis avec réserve (« Merci Salma — pour le séchage, voici notre astuce : … »). +60 % bookings selon les études citées (`Ecommerce` p. 46).
- Programme post-achat à activer : tag photo + cuticle oil offert (`Ecommerce` p. 47).

**Anti-patterns** :
- ❌ Note `5,0/5` partout (paraît artificiel).
- ❌ Note écrite en chiffre seul sans étoiles ou barre.
- ❌ Wall avec 50 photos.
- ❌ Témoignages en majuscules.
- ❌ Photos en plongée ou inversées (face inversion effect).

---

### 4.9 FAQ

**Objectif** : lever les **9 objections** documentées, dans l'ordre des plus fréquentes, sans paraître défensive.

**Principes activés** :
- UX §1, §3, §7 (≤ 4 visibles, takeaway dans la question, hide unnecessary)
- Copywriting §2, §15 (cadrage positif, hypothétique vivant)
- Luxury §11 (pas de défense, montrer)

**Recommandations** :
- **Accordion exclusif** : un seul ouvert à la fois, fermeture au tap suivant.
- **Tous fermés par défaut** au chargement.
- **4-6 questions visibles**, bouton `voir plus` pour les autres (UX p. 5).
- **Intro de section** réécrite : *« Quand vous appliquez la paste pour la première fois, voici ce que les initiées demandent. »* (hypothétique vivant + rôle).
- Questions formulées en **bénéfice** ou en **doute concret**, pas en abstraction :
  - ❌ « Certification halal » → ✅ **« Est-ce vraiment halal ? »**
  - ❌ « Composition » → ✅ **« Que contient exactement chaque pot ? »**
  - ❌ « Grossesse » → ✅ **« Puis-je continuer pendant la grossesse ? »**
- Réponses :
  - Phrase courte, voix maison.
  - Lien interne (`#ingredients-details-1-paste`) quand pertinent.
  - **Ne jamais commencer une réponse par « Non, »** ni par une justification (`Luxury` p. 7-9).
  - **Mots positifs collés** : si une réponse fait mention de garantie/livraison, la coller — pas en pied de réponse.
- Targets tap (chevrons) à 40 × 40 px minimum (`UX` p. 14-15).

**Anti-patterns** :
- ❌ FAQ tous ouverts par défaut (bruit visuel).
- ❌ Question défensive « Pourquoi est-ce si cher ? » — on ne la pose pas, on répond en *montrant* (origine, fabrication).

---

### 4.10 Trois mains (avant/après)

**Objectif** : preuve visuelle non-truquée, retenue.

**Principes activés** :
- Luxury §12 (avant/après retenu)
- Ecommerce §1 (isolated → contextual)
- Color §3 (luminosité = durabilité), §8 (pas de rouge)
- UX §3 (durée explicite dans le titre)

**Recommandations** :
- Headline : **« Trois mains, six semaines plus tard. »** (takeaway dans le titre).
- Format **noir & blanc ou désaturé léger** pour avant/après (`Ecommerce` p. 24-25 : N&B = événements distants / mémoire).
- **Même cadrage, même lumière** sur les deux photos. Format `before-after-slider` ou côte à côte 1:1.
- Mention **durée explicite** sous chaque paire (« semaine 1 » / « semaine 6 »).
- Citation Cormorant *italic*, signature `Amal — Rabat · Initiée depuis Février 2026` (self-relevance + date qui prouve la durée d'engagement).
- **Aucune flèche, aucun cercle rouge**, aucun « WOW ».

**Anti-patterns** : photos retouchées (à proscrire, on signale « non retouchées » dans l'intro existante — garder cette mention).

---

### 4.11 Posez le geste (CTA final)

**Objectif** : **la dernière** zone de décision. C'est ici qu'on autorise un point chaud unique.

**Principes activés** :
- Color §1 (un seul pop chaud = ici)
- Attention §1 (salience unique)
- Copywriting §7 (CTA naturel à dire)
- Luxury §1, §10 (statut sans logo, justification par valeur)

**Recommandations** :
- **Fond sauge profond `#4A5D4A` pleine largeur**. Titre ivoire en serif.
- Bouton CTA **en terracotta sourdine `#C28A6E`**, texte ivoire — **le seul moment de la page où on autorise le chaud**.
- Headline : **« Posez le geste. »** (déjà bon).
- Corps : « Le rituel commence quand vous le décidez. Cinq minutes le soir, une saison, et la plaque retrouve sa cadence. »
- Lien secondaire `Lire encore ↗` → `/rituel`, en lien souligné rose poudré clair.
- Hauteur de section généreuse (≥ 70 vh). Espace blanc autour du bouton.
- Bouton hauteur 56 px, padding horizontal 32 px. Micro-pulse lente.

**Anti-patterns** :
- ❌ Plus d'un CTA chaud sur toute la page.
- ❌ Pas de countdown.
- ❌ Pas de seconde offre en haut de cette section (« Et aussi, recevez le mini-guide ! »).

---

### 4.12 Trois lectures (journal)

**Objectif** : éditorial doux, ralentit le sortie de page, prépare au retour.

**Principes activés** :
- Luxury (cadence saisonnière)
- UX §3, §4 (takeaway, entry point image)

**Recommandations** :
- 3 articles maximum (jamais 4).
- Chaque card : image obligatoire, tag temps de lecture, titre lien rédigé.
- Désaturation légère sur les images (signal d'événement distant — `Ecommerce` p. 24-25). Couleurs saturées sont réservées au Hero / Pack / CTA.

---

### 4.13 Footer

**Objectif** : navigation utilitaire, **silence**.

**Recommandations** :
- 5 colonnes existantes (Branding, Le rituel, Assistance, Légal, Coordonnées) — garder.
- Pas d'inscription newsletter criarde. Si newsletter : un seul champ email + label « *Pour suivre les saisons.* ».
- Pas d'icônes réseaux sociaux géantes.
- Copyright en encre 50 %.

---

## 5. Plan d'action priorisé (P0 → P2)

| Priorité | Item | Effort | Source |
|---|---|---|---|
| **P0** | Sticky CTA bottom-bar mobile | M (1 composant + 1 hook scroll) | UX p. 27 |
| **P0** | Refonte bloc prix Hero + section Pack (199 géant, 390 barré 60 %, gap horizontal, économie 191 MAD) | S | Pricing p. 10-24 |
| **P0** | Trust row collée sous CTA (`Livraison · COD · Retour 30 j`) | S | Pricing p. 17, 25-27 |
| **P0** | Réécriture H1/sous-titre Hero | S | Copywriting (Annexe B) |
| **P0** | FAQ accordion exclusif + 4 visibles + intro réécrite | S | UX p. 5, 53 |
| **P0** | `font-variant-numeric: tabular-nums` sur tous les prix | XS | Pricing |
| **P1** | Ratings visuels + 4,8/5 + 1 avis avec réserve + réponses signées | M | Ecommerce p. 43-48 |
| **P1** | Photo de visage droit avec regard orienté pour 1 témoignage / 3 | M (shoot photo) | Attention p. 23-32 |
| **P1** | Sous-ligne reframing valeur (`≈ 1,5 MAD/manucure`) | XS | Pricing p. 21 |
| **P1** | Affichage « Valeur séparée 320 MAD » dans la section Pack | S | Pricing p. 62 |
| **P1** | CTA final en sauge profond + bouton terracotta | S | Color, Luxury |
| **P1** | Vue éclatée du kit dans Composition | M (illustration) | Ecommerce p. 40 |
| **P1** | Sous-notes multi-dimensions sur témoignages (tenue / brillance / facilité) | M | Ecommerce p. 47 |
| **P2** | Programme UGC post-achat (tag photo + cuticle oil offert) | L | Ecommerce p. 47 |
| **P2** | Duo Pack (380 MAD) / Trio Pack (540 MAD) en upsell sous la section Pack | M | Pricing p. 72-73 |
| **P2** | Animations slow-motion (400-600 ms) sur transitions / hover packshot | M | Luxury p. 18-19 |
| **P2** | Stack typo finalisé (Cormorant + Inter + échelle) | M (intervention sur le design system) | Fonts entier |
| **P2** | Mini-quiz d'engagement « Trois questions pour trouver votre cadence » | L | Ecommerce p. 9 |
| **P2** | Sticky desktop : prix + CTA en haut au scroll | M | UX p. 27 |

> **Effort** : XS (< 30 min) · S (1-2 h) · M (½-1 j) · L (1-3 j).

---

## 6. Anti-patterns à éviter — synthèse

| Catégorie | À ne **jamais** faire | Pourquoi |
|---|---|---|
| Voix | Exclamation, emoji, majuscules d'emphase | Luxury p. 7-9 — détruit le registre |
| Voix | « Promo / deal / discount / VIP / exclusif » | Luxury p. 4-9 |
| Voix | Justification défensive du prix (« On sait que ça paraît cher mais… ») | Luxury p. 7 — confirme que c'est cher |
| Voix | « 100 % naturel », « 100 % halal » | Copywriting p. 48 — backfire de confiance |
| Voix | Descripteurs vagues (« précieux », « somptueux ») | Copywriting p. 12 |
| Couleur | Thème sombre sur une section | Color p. 20-21 — checkout = clair |
| Couleur | Rouge erreur / croix rouges | Color p. 18-19 — palette douce préservée |
| Couleur | Plus d'**un** point chaud sur la page | Color p. 5-6 |
| Couleur | Noir pur (`#000`) sur les titres H1/H2 | Color p. 18 |
| Couleur | Gris pur (jamais teinté) | Color p. 18 |
| Pricing | « -49 % » seul (sans « Économie 191 MAD ») | Pricing p. 75 — l'absolu > % au-delà de 100 |
| Pricing | Prix au format `199,00 MAD` | Pricing p. 41-42 — décimales = +syllabes |
| Pricing | Prix barré et prix actuel à la même taille | Pricing p. 10-11 — perte d'anchoring |
| Pricing | Prix barré au-dessus du prix actuel (vertical) | Pricing p. 23-24 — Mueller-Lyer ne marche qu'en horizontal |
| Pricing | Countdown, « plus que 3 packs ! », badge MEGA | Voix maison + Luxury §8 |
| Typo | H1 en bold | Fonts p. 14 — light = beauté, féminin, luxe |
| Typo | Italique sur le prix ou le CTA | Fonts p. 20 — italique = urgence, instable |
| Typo | Capitales sur le body | Fonts p. 16 — fatigant + vulgaire |
| Typo | Police script (handwritten) sur H1 ou CTA | Fonts p. 8 |
| Typo | Letter-spacing serré sur petit texte | Fonts p. 18 |
| Attention | Plusieurs zones « salientes » en même temps | Attention p. 6 |
| Attention | Pop-up exit-intent agressif (`Why not subscribe?!!`) | Attention p. 46 — détonne |
| Attention | Visages inversés / cadrages cassés | Attention p. 23 — face inversion effect |
| Ecommerce | Note `5,0/5` partout | Ecommerce p. 48 — paraît artificiel |
| Ecommerce | Notes en chiffres seuls (sans étoiles ou barres) | Ecommerce p. 43-44 — left-digit anchoring |
| Ecommerce | Galerie 100 % packshot détouré (sans contextuel) | Ecommerce p. 22 — cible féminine = +contextuel |
| Ecommerce | Mannequin pleine page en hero | Ecommerce p. 18 — transfère ownership ailleurs |
| UX | CTA principal noyé en fin de page sans sticky | UX p. 27 — manque #1 actuel |
| UX | Accordion FAQ tous ouverts au chargement | UX p. 53 — bruit visuel |
| UX | Titre décoratif sans takeaway | UX p. 43 |
| UX | Sections qui se terminent pile au fold | UX p. 52 — faux fond de page |
| UX | Tap targets < 40 × 40 px | UX p. 14-15 |
| UX | Pas de `:active` state sur tactile | UX p. 48 |

---

## Annexe A — Tokens design recommandés

À intégrer dans le design system / Tailwind config / `globals.css`.

```css
:root {
  /* Fonds */
  --bg-ivoire:           #F7F4EE;
  --bg-sable:            #EFE9DD;
  --bg-sauge-pale:       #E8EDE3;

  /* Marque */
  --sauge:               #A8B89E;  /* HSL 95/22/68 — désaturé */
  --sauge-profond:       #4A5D4A;  /* CTA principal */
  --rose-poudre:         #E8D5D0;  /* accent doux */
  --or-poudre:           #B8956B;  /* badges, étoiles */

  /* Pop chaud (réservé CTA final) */
  --terracotta:          #C28A6E;

  /* Encre & gris */
  --encre:               #2A2E2A;  /* titres */
  --encre-doux:          rgba(42, 46, 42, 0.7);
  --noir-body:           #1F1F1F;  /* INCI / body small uniquement */
  --gris-sauge:          #C7CCC2;  /* séparateurs */
  --gris-sauge-doux:     #D8D2CC;  /* alt séparateurs */
}

/* Typographie */
.font-display { font-family: 'Cormorant Garamond', serif; font-weight: 400; }
.font-body    { font-family: 'Inter', system-ui, sans-serif; }
.prix         { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }

/* Échelle */
h1 { font-family: 'Cormorant Garamond'; font-weight: 400; font-size: clamp(2.25rem, 5vw, 4.5rem); letter-spacing: -0.01em; line-height: 1.1; }
h2 { font-family: 'Cormorant Garamond'; font-weight: 400; font-size: clamp(1.75rem, 4vw, 3rem); letter-spacing: -0.005em; line-height: 1.2; }
h3 { font-family: 'Inter'; font-weight: 600; font-size: 1.125rem; line-height: 1.3; }
.eyebrow { font-family: 'Inter'; text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.8125rem; font-weight: 500; }
body { font-family: 'Inter'; font-size: 1rem; line-height: 1.65; letter-spacing: 0.005em; }
.body-small { font-size: 0.8125rem; line-height: 1.5; letter-spacing: 0.01em; }

/* Prix */
.prix-actuel { font-size: clamp(3.5rem, 8vw, 5rem); font-weight: 600; color: var(--sauge-profond); }
.prix-barre  { font-size: clamp(1.125rem, 2vw, 1.5rem); font-weight: 400; color: var(--gris-sauge); text-decoration: line-through; }
.economie    { font-size: 1rem; font-weight: 500; color: var(--terracotta); }

/* CTA */
.cta-primary    { background: var(--sauge-profond); color: var(--bg-ivoire); padding: 14px 28px; font-weight: 500; letter-spacing: 0.02em; transition: transform 400ms ease; }
.cta-primary:active { transform: scale(0.97); }
.cta-pivot-warm { background: var(--terracotta); color: var(--bg-ivoire); /* réservé section "Posez le geste" */ }

/* Pulse lente */
@keyframes pulse-lente {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.02); }
}
.cta-primary { animation: pulse-lente 4s ease-in-out infinite; }
```

---

## Annexe B — Réécritures copy (avant / après)

### B.1 Hero — sous-titre
| Avant | Après |
|---|---|
| Des ongles soignés. Un woudou intact. | **Manucure japonaise halal. Deux gestes, un polissoir. La main se révèle.** |

> *Principes : Copywriting p. 5 (présent vivant), p. 14-15 (continuité d'image), p. 39 (directional consistency : « se révèle »).*

### B.2 Hero — description du rituel
| Avant | Après |
|---|---|
| FemiGlow réinvente la manucure japonaise dans un rituel naturel, doux et sans vernis. Le pack associe deux soins complémentaires, une paste lissante et une powder lustrante, avec un polissoir Step 4 Polish & Shine pour révéler l'éclat naturel de l'ongle nu. Sans pose de vernis, sans lampe UV, sans acétone. | **FemiGlow reprend la manucure japonaise. Paste verte sauge qui filme la plaque. Powder rose poudré qui lustre. Polissoir Step 4 Polish & Shine qui révèle. Formulé à Rabat. Sans vernis, sans lampe UV, sans acétone. Cinq minutes le soir.** |

> *Principes : Copywriting p. 12 (« réinvente » = vague), p. 14-15 (continuité d'image), p. 5 (présent vivant). « Biologiste » est déplacé vers la section Maison (Copywriting p. 51).*

### B.3 Card Paste — description
| Avant | Après |
|---|---|
| Pâte crème onctueuse. Filme la plaque sans l'étouffer. Une noisette suffit. | **Pâte crème onctueuse. La plaque est filmée, jamais étouffée. Une noisette suffit pour les dix doigts.** |

> *Principes : Copywriting p. 9 (cadrage positif), p. 14-15 (continuité), p. 37-38 (« dix doigts » = imageable).*

### B.4 Card Powder — description
| Avant | Après |
|---|---|
| Poudre fine blanche, déposée sur la paste. Absorbe l'excès, lustre la surface. | **Poudre fine blanche. Déposée sur la paste, elle absorbe l'excès. La surface se lustre lentement.** |

> *Principes : Copywriting p. 14-15 (continuité), p. 5 (présent), p. 39 (verbes ascendants).*

### B.5 Pack — preuve sociale (à insérer près du CTA)
| Avant | Après |
|---|---|
| ★★★★★ 4.8/5 · 287 avis | **★ 4,8/5 — Deux cent quatre-vingt-sept femmes. Rabat · Casablanca · Marrakech.** |

> *Principes : Ecommerce p. 43-44 (étoile + barre, pas chiffre seul), Copywriting p. 46-47 (digits sur la note, lettres sur le compte humain), Attention p. 48 (self-relevance par villes).*

### B.6 CTA principal
| Avant | Après |
|---|---|
| Recevoir le pack | **Commander le rituel** |

> *Principes : Copywriting p. 23 (naturel à dire intérieurement, verbe d'agentivité, registre maison).*

### B.7 Intro FAQ
| Avant | Après |
|---|---|
| Les réponses sont courtes, précises, vérifiables. Si une question manque, écrivez-nous : nous l'ajouterons. | **Quand vous appliquez la paste pour la première fois, voici ce que les initiées demandent. Si une question manque, écrivez-nous.** |

> *Principes : Copywriting p. 57-58 (« Quand » > « Si » = simulation), p. 49-50 (rôle « initiée »).*

### B.8 Questions FAQ — reformulation en bénéfice
| Avant | Après |
|---|---|
| Que signifie la certification halal pour FemiGlow ? | **Est-ce vraiment halal ?** |
| Combien de temps dure un pack ? | **Combien de temps dure un pack ?** *(déjà bien)* |
| Le rituel convient-il pendant la grossesse ? | **Puis-je continuer pendant la grossesse ?** |
| Et si je suis allergique à un ingrédient ? | **Et si un ingrédient ne convient pas ?** |
| Le rituel est-il adapté aux adolescentes ? | **Convient-il aux adolescentes ?** |

> *Principes : UX p. 43 (takeaway dans le titre), Copywriting p. 9 (cadrage positif : « ne convient pas » > « allergique »).*

### B.9 Citation finale pivot (section CTA)
| Avant | Après |
|---|---|
| Le rituel commence quand vous le décidez. Cinq minutes le soir, une saison, et la plaque retrouve sa cadence. | **Le rituel commence quand vous le décidez. Cinq minutes le soir. Une saison. La plaque retrouve sa cadence.** |

> *Principes : Copywriting p. 13 (phrase courte = idée simple ; trois propositions ralentissent la lecture, servent la voix lente).*

---

## Annexe C — Glossaire des effets cités

| Effet | Définition courte | Source |
|---|---|---|
| **Anchoring** | Un prix barré sert d'ancre haute, fait paraître le prix actuel plus bas. | Pricing p. 10 |
| **Charm pricing** | Prix se terminant juste sous un seuil (199 vs 200), perçu beaucoup plus bas. | Pricing p. 45 |
| **Left-digit anchoring** | Une note « 3,8 » est perçue comme « 3,0 » — le chiffre de gauche ancre. | Ecommerce p. 43 |
| **Mueller-Lyer** | Deux objets espacés horizontalement paraissent plus distants — agrandit l'écart numérique. | Pricing p. 23 |
| **Loi de Hick** | Le temps de décision augmente avec le nombre d'options. ≤ 4 = perception sans comptage. | UX p. 5 |
| **Loi de Fitts** | Cibles plus grandes ou plus proches = clics plus rapides. | UX p. 14 |
| **Face inversion effect** | Le cerveau met 2-3× plus de temps à reconnaître un visage incliné — on perd le bénéfice attentionnel. | Attention p. 23 |
| **Gaze cuing** | On suit automatiquement la direction du regard d'un visage présenté. | Attention p. 30 |
| **Self-relevance** | Capter par ce qui nous concerne (prénom, ville, rôle). | Attention p. 48 |
| **Goal-directed attention** | On voit mieux ce qu'on cherche — exposer les attributs en mots-clés au-dessus du fold. | Attention p. 53 |
| **Looming motion** | Le zoom in active un réflexe d'attention (objet qui s'approche). | Attention p. 16 |
| **Newness preference** | Préférence inconsciente pour les produits récents — capitaliser sur le lancement 2026. | Copywriting p. 35 |
| **Which-to-choose mindset** | Un micro-choix précoce bascule du « j'achète ou pas » au « lequel je prends ». | Ecommerce p. 9 |
| **Directional consistency** | Les verbes d'un même bloc doivent aller dans la même direction (ascendante / descendante). | Copywriting p. 39 |
| **Fluency / disfluency** | Lecture facile = familier ; lecture légèrement difficile = signal de « spécial » (à doser). | Fonts p. 11 |
| **Imply human presence** | Suggérer la présence (mains, traces) plutôt que la montrer (mannequin) ; la cliente s'imagine. | Ecommerce p. 18 |
| **Pain of paying** | Douleur perçue de payer — réduite par cash-on-delivery et zone prix spatialement compacte. | Pricing p. 25 |

---

**Fin du playbook.** Ce document est conçu pour être consulté section par section au moment de chaque optimisation. À chaque modification, vérifier que l'invariant correspondant (§2) reste respecté, et que l'anti-pattern correspondant (§6) n'est pas réintroduit.
