# Prototype B — La Cartographie des rituels (entrée par tags)

> Un espace dédié, accessible depuis `/rituels-partages` (route publique) ou via une bascule depuis `/kit`. Au lieu d'une liste linéaire, l'initiée entre par une **carte de tags qualitatifs** dispersés en typographie variable. Elle clique sur un tag (« Plus de casse », « Ongles plus lisses », « Plaque souple »…) et voit s'ouvrir la sous-liste des témoignages correspondants.

## 1. Posture éditoriale

C'est une **expérience de découverte par envie**. Là où le prototype A présente toutes les voix dans l'ordre chronologique, le prototype B demande à l'initiée : « *Qu'est-ce que vous cherchez ?* » L'entrée est psychologique et sensorielle.

Cette approche est inspirée des cartographies éditoriales (Aesop blog, Kinfolk index pages) où l'on découvre par mot-clé typographique plutôt que par grille de cartes.

C'est **le prototype le plus identitaire** — il joue à fond la carte « maison curée », mais il sacrifie la lisibilité immédiate au profit de l'engagement contemplatif.

## 2. Surface d'entrée

### 2.1 Route publique

Une route dédiée `/rituels-partages` est créée. Elle figure dans le **footer** sous la colonne « Le Rituel » :

```
Le Rituel
─ Le rituel
─ Le pack
─ Journal
─ Rituels partagés    ← nouvelle entrée
─ Maison
```

### 2.2 Sur `/kit`

Section dédiée sous le comparatif vernis vs rituel :

```
LES VOIX DE LA MAISON

26 initiées ont partagé.
24 reprendraient le rituel.

Découvrir par envie →
```

Le lien mène à `/rituels-partages`, scroll smooth depuis le hero si l'utilisateur est arrivé depuis `/kit`.

### 2.3 Sur `/rituel` et `/maison`

Cross-link discret en pied de page.

## 3. Anatomie de la page `/rituels-partages`

### 3.1 Zone 1 — Hero éditorial (92 vh)

```
                  RITUELS PARTAGÉS
                  ───────────────

                  Les voix de la maison.

   26 initiées ont partagé.
   24 reprendraient le rituel.

   ╌╌╌╌◆╌╌╌╌                                   ← fleuron champagne
```

- Fond sauge-pale `#E8EFE7`.
- Texte centré, typo Cormorant 64 pt pour le titre, 28 pt italic pour le sous-titre, Inter 9 pt kicker.
- Aucun CTA.

### 3.2 Zone 2 — La cartographie des envies

C'est **le cœur du prototype**. Un nuage typographique en pleine page, mais soigneusement composé (pas un « tag cloud » Web 2.0).

```
                              ongles plus
                              ─────────────
        casse                              cuticules
       réduite                              apaisées
                       PLAQUE
                       SOUPLE
   éclat                                                 rituel
   naturel                                               devenu
                                                        habitude
                              halal
                              ────
                                            mains
                                            détendues
        moins
        ridées                     fini
                                  brillant
                                  sans vernis
```

**Règles** :

- Chaque tag est rendu en Cormorant Italic, taille modulée par fréquence : `clamp(18px, 1vw + 14px, 48px)`.
- Disposition manuelle (CSS Grid + named areas + média queries), pas algorithmique — la maison choisit la composition.
- Le tag le plus mentionné est en plus grand et au centre.
- Couleur : encre `#2C2A28` par défaut, sauge-dark `#A8C4A6` en hover (300 ms, `out-soft`).
- Cliquer un tag fait défiler vers la zone 3 (témoignages correspondants).

### 3.3 Zone 3 — Liste filtrée

Quand un tag est cliqué, la zone 3 apparaît avec **transition fade-in** (400 ms) :

```
PLAQUE SOUPLE — 14 témoignages

[Carte][Carte][Carte]
[Carte][Carte][Carte]
[Carte]...

[ Afficher plus (8 / 14) ]

← Revenir à la cartographie
```

- Grid responsive : 3 colonnes desktop, 2 tablet, 1 mobile.
- Cartes identiques à celles du prototype A (citation Cormorant, signature, photo optionnelle, tags choisis).
- Lien retour en pied : « ← Revenir à la cartographie ».

### 3.4 Zone 4 — CTA pack

En pied de page :

```
   ╌╌╌╌◆╌╌╌╌

   Maintenant que vous savez.

   [ Recevoir le pack — 199 dh ]
     Livraison offerte au Maroc

   Comment ces rituels sont vérifiés →
   Partager mon rituel →
```

## 4. Comportement « pas de tag sélectionné »

À l'arrivée sur la page, la zone 3 affiche **les 6 témoignages les plus récents** (toutes envies confondues), avec un en-tête :

```
RÉCEMMENT PARTAGÉS

[6 cartes en grid]

[ Voir tous les rituels (26) ]
```

Cliquer « Voir tous les rituels » bascule en mode liste exhaustive, paginée par 12.

## 5. Filtres complémentaires

Au-dessus de la zone 3, une barre discrète avec **filtres complémentaires** :

| Chip | Comportement |
| --- | --- |
| **Avec photos** | Combine avec le tag sélectionné |
| **Plus récents** | Tri chronologique inverse |
| **Reviendraient** | Filtre `would_recommend = oui` |

Pas de chip qui désactive le tag — on revient à la cartographie en remontant.

## 6. Card de témoignage (différences avec prototype A)

- **Largeur grid** : 320 px sur desktop, vs 480 px en prototype A. Donc citations plus courtes affichées (ellipsis après 200 caractères, expand on click).
- **Padding interne** : 24 px (vs 32 px en prototype A).
- **Tags choisis** : déplacés en haut de carte plutôt qu'en pied, pour cohérence avec le filtre par tag.

## 7. Wizard de soumission

Identique au prototype A. Mais accessible sur `/rituels-partages` via lien discret en pied, et toujours via l'e-mail J+45.

## 8. Mobile

- Le hero passe à 60 vh.
- La cartographie reste cliquable mais devient plus dense (tous les tags en 18 à 28 pt, scroll vertical naturel).
- La grid devient 1 colonne.
- Tap sur un tag → fait défiler vers la liste avec scroll smooth.
- CTA pack reste en sticky bottom.

## 9. Animations

| Action | Durée | Easing |
| --- | --- | --- |
| Hover tag desktop | 300 ms (couleur + très léger scale 1.02) | `out-soft` |
| Click tag → fade liste | 400 ms (out 200 ms + in 200 ms) | `in-out-silk` |
| Apparition cartes | 400 ms, stagger 60 ms | `out-soft` |
| Retour cartographie | 300 ms fade | `in-quiet` |
| Hero parallax très léger | translateY `0 → -8 px` sur scroll, vitesse `× 0.1` | `linear` |

Toutes désactivées avec `prefers-reduced-motion: reduce`.

## 10. Tracking

| Événement | Quand | Payload |
| --- | --- | --- |
| `ritual_page_view` | Arrivée sur `/rituels-partages` | `from_page` |
| `ritual_tag_click` | Tag cartographie cliqué | `tag_key`, `tag_position` |
| `ritual_card_impression` | Card en viewport | `testimonial_id`, `via_tag` |
| `ritual_filter_change` | Filtre complémentaire | `filter_key`, `filter_value` |
| `ritual_load_more` | Bouton chargé | `current_count` |
| `ritual_back_to_map` | Retour cartographie | (aucun) |
| `ritual_cta_buy_click` | CTA pack cliqué | `via_tag` (le tag qui a précédé le clic, pertinent pour comprendre la motivation) |

Particularité importante : on capture **le tag qui précède l'achat**. Ce que la cliente cherchait quand elle a décidé d'acheter est un signal marketing fort.

## 11. Politique « Comment vérifiés »

Section dédiée en pied de page, dépliable, avec les 4 paragraphes habituels.

## 12. Forces du prototype B

1. **Différenciation marque maximale** — le wall ne ressemble à aucun autre. Il devient un objet éditorial reconnaissable, partageable sur Instagram, citable.
2. **Engagement profond** — la cartographie invite à explorer. Le temps moyen sur la page est plus élevé qu'avec un drawer.
3. **Signal marketing puissant** — savoir quel tag déclenche le plus d'achats donne une carte de positionnement (« nos initiées achètent surtout pour "plus de casse" et "ongles plus lisses" »).
4. **URL partageable** — `/rituels-partages?tag=plaque-souple` peut être tweeté, envoyé sur WhatsApp.
5. **SEO long-tail** — chaque tag est une page indexable. « Manucure japonaise ongles plus lisses » devient une requête atteignable.
6. **Scalabilité** — la cartographie reste lisible à 26 témoignages comme à 260.

## 13. Faiblesses du prototype B

1. **Friction d'entrée** — l'initiée doit interpréter la cartographie pour entrer. Certaines vont rebrousser chemin.
2. **Distance au CTA** — la cliente sort de `/kit` ; on perd la proximité du bouton « Recevoir le pack ».
3. **Risque de confusion mobile** — la cartographie typographique est plus délicate à composer en 360 px de large.
4. **Implémentation plus longue** — composition manuelle de la cartographie, animations soignées, gestion des états (tag actif, retour à la cartographie) augmentent la charge.
5. **Volume initial sensible** — avec moins de 15 témoignages, la cartographie a l'air vide. Demande un seuil de lancement.
6. **A/B test plus complexe** — pas un simple comparatif « avec wall vs sans », c'est une nouvelle page entière.

## 14. Persona cible

| Persona | Cas d'usage |
| --- | --- |
| Yasmine, 28 ans, Rabat, qui découvre via Instagram | Tombe sur `/rituels-partages` partagé, est captivée par la typographie, clique sur « éclat naturel », lit 3 témoignages, va sur `/kit`. Conversion lente. |
| Salma, déjà décidée, qui veut une réassurance rapide | Trop d'effort pour elle. Probablement frustrée. **Persona mal servie.** |
| Inès, journaliste lifestyle | Cite la page comme exemple d'éditorial e-commerce. **Effet halo marque.** |

## 15. Estimation de mise en œuvre

| Phase | Charge |
| --- | --- |
| Schéma BDD + API (identique) | 3 j |
| Page `/rituels-partages` + cartographie | 5 j |
| Animation cartographie + transitions | 2 j |
| Liste filtrée + grid | 2 j |
| Wizard de soumission | 3 j |
| Admin (queue + détail + actions) | 4 j |
| Vision ML faces detection | 2 j |
| E-mail J+45 + lien pré-rempli | 1 j |
| SEO (sitemap, JSON-LD per tag) | 1 j |
| Tracking + tests | 2 j |
| **Total** | **~25 j** |

C'est ~30 % de plus que le prototype A, justifié par la composition typographique et l'animation.
