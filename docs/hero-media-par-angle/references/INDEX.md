# Références image FemiGlow — index

Jeu de références stable pour la génération d'images (gpt-image-2, edits/références).
Détails, justification et bible de style : `../02-references-et-style.md`.

| ID | Fichier | Source (dépôt) | Dimensions | Ce qu'il verrouille | À utiliser pour |
|---|---|---|---|---|---|
| REF-01 | `REF-01-kit-canon.png` | `docs/images/values/kit/image-produit.png` (hero /kit slide 1, `me_t37h41m94iv06w5j`) | 1122×1402 | Boîte FemiGlow (vagues sauge/rose, script), pots « 1 paste »/« 2 powder », polissoir « Step 4 », style maison | Toute image avec le kit complet ; référence produit principale |
| REF-02 | `REF-02-pots-ouverts-textures.png` | `docs/images/values/maison/cross-kit.png` (= `apps/web/public/maison/cross-kit.png`) | 1122×1402 | Pots ouverts : crème ivoire (1) et poudre blanche (2) ; polissoir bleu ciel vif ; lin + marbre | Angles texture / ingrédients / « comment ça marche » |
| REF-03 | `REF-03-pot1-label-macro.png` | `docs/images/values/kit/kit-base.png` (`me_e4wje0jm8xfoi9wz`) | 1254×1254 | Pot carré facetté, pastille sauge « 1 paste » + script FemiGlow, typographie | Gros plans produit, fidélité étiquette |
| REF-04 | `REF-04-rituel-etapes.png` | `docs/images/values/reviews/rituel-etapes.png` (WebP converti en PNG) | 1024×1536 | Infographie complète : boîte « MANICURE TREATMENT KIT », 4 étapes | Contexte seulement (contient du texte FR/JP — ne pas donner tel quel si risque de fuite de texte) |
| REF-04b | `REF-04b-rituel-etapes-crop.png` | idem, recadré y=1000→1345 | 1024×345 | Bande photo des 4 étapes sans texte de mise en page : geste paste (crème), geste powder (poudre nacrée), résultat brillant | Angles « geste / tuto / 5 minutes », fidélité contenu des pots |
| REF-05 | `REF-05-ugc-main-foncee-kit.jpg` | `apps/web/public/reviews/reviews4.jpg` | 500×425 | Produit réel (boîte, pots, polissoir) + main peau foncée, marbre, lumière chaude | Angles UGC / preuve sociale ; carnation foncée |
| REF-06 | `REF-06-ugc-composition-marbre.jpg` | `apps/web/public/reviews/reviews7.jpg` | 500×428 | Couleurs exactes du packaging réel, composition propre | Contrôle couleur packaging, compositions plan de travail |
| REF-07 | `REF-07-resultat-ongles-peau-foncee.png` | `docs/images/values/kit/hands-sara-apres.png` (`me_cmdeuegun0fj4itk`) | 1254×1254 | Résultat ongles nude brillants, peau foncée, matière éditoriale (soie sauvage beige) | Angles résultat / avant-après |
| REF-08 | `REF-08-resultat-ongles-french-reel.jpg` | `apps/web/public/reviews/reviews10.jpg` | 500×438 | Brillance « French naturel » réelle, peau claire/medium | Angles résultat ; niveau de brillance réaliste (pas de vernis) |
| REF-09 | `REF-09-ambiance-lumiere-matin.png` | `docs/images/values/kit/kit-pack-shot.png` (`me_cu6e7vqirq8v4ez5`) | 1122×1402 | Lumière de fenêtre striée du matin, papier crème, gaze de lin, palette | Ambiance / lumière / palette de toute génération |
| REF-10 | `REF-10-ugc-maison.jpg` | `apps/web/public/reviews/reviews3.jpg` | 500×366 | Kit réel dans une salle de bain (pot ouvert crème), main mouillée | Angles « vraie vie à la maison », rituel salle de bain |

## Ne jamais utiliser comme référence

`kit/kit-fortifiant.png` (« 2 fortifiant », résine ambrée), `kit/kit-principale.png` et `kit/og-kit.png` (3e pot à feuille), `home/hero-home.png` (« 3 shine »), `kit/kit-detail-mains.png` (couvercle métal), `rituel/hero-lifestyle.png` (polissoir sauge), `reviews11.jpg` / `reviews12.jpg` (autre packaging), `reviews9.jpg` (IA KlingAI), `stories/*` et `reviews1.jpg` (visages), `public/products/*`, tous les `*.svg`.
