# Recherche documentaire - bonnes pratiques Reviews (e-commerce)

Objectif : consolider des principes **éprouvés** (UX research, études académiques, acteurs d'autorité, standards accessibilité) pour concevoir un "Reviews Wall" qui augmente confiance + conversion, sans nuire aux performances et en restant cohérent avec l'expérience immersive BAITI.

> NOTE : Ce document extrait des enseignements et les traduit en décisions de conception. Les sources (liens) sont listées à la fin.

---

## 1) Pourquoi les avis sont un levier conversion majeur

### 1.1 Impact quantifié sur la conversion
- Les recherches du Spiegel Research Center (Northwestern) concluent que l'affichage d'avis a un impact **significatif et quantifiable** sur la décision d'achat. Ils rapportent que l'affichage d'avis peut augmenter la conversion, avec un effet particulièrement fort pour les produits plus chers. (Voir sources)
- Une méta-analyse (156 études, 214 effect sizes, 69k observations) trouve que la **valence** des avis (positif/négatif) est le facteur le plus puissant sur l'intention d'achat (corrélation rapportée r=0.563). (Voir sources)

Décision produit :
- BAITI doit traiter les avis comme un **module central** de réassurance, pas un "plus" décoratif.

### 1.2 La crédibilité prime sur le "tout positif"
- Le Spiegel Research Center note qu'une note proche de 5.0 peut réduire la confiance et que des avis négatifs peuvent renforcer l'authenticité.
- Des acheteurs cherchent activement des avis négatifs (documenté dans l'eBook Spiegel via des études citées).

Décision produit :
- Ne pas cacher les avis négatifs. Prévoir :
  - distribution des notes visible
  - filtre "3★ et moins" ou "avis critiques"
  - mécanismes de réponse/modération (pas suppression)

---

## 2) UI/UX e-commerce : lecture rapide avant lecture profonde

### 2.1 Résumé quantitatif (distribution des notes) = feature la plus utilisée
Baymard (tests utilisateurs e-commerce) observe que :
- Les utilisateurs s'appuient énormément sur le **résumé de distribution** (bar chart 5★->1★) pour comprendre l'ensemble, souvent plus que sur le texte des avis.
- L'absence de ce résumé augmente le risque que l'utilisateur conclue "avis fake" si les avis affichés en premier sont très positifs.

Décisions UI :
- Toujours afficher en haut :
  - note moyenne + nombre d'avis
  - histogramme distribution 5★->1★ (cliquable pour filtrer)
  - 3 "insights" d'usage (ex: Confort, Parents & seniors, Utilisation quotidienne), issus de tags

### 2.2 Montrer le nombre d'avis augmente la confiance
Baymard souligne que le **nombre** d'avis/rating est une info de crédibilité; sans ce nombre, les users doutent et comparent moins.

Décisions UI :
- Afficher "4.9 (39 avis)" partout où on montre des étoiles.
- Si volume faible : microcopy "Nouveau produit : premiers retours".

---

## 3) Filtres, tri, segmentation : transformer un mur en outil de décision

Principes :
- Un mur d'avis sans filtres devient vite une "mare de texte".
- L'utilisateur a deux modes :
  1) "je veux me rassurer vite" (résumé + 2-3 avis)
  2) "je veux investiguer" (filtres, négatifs, photos, profils)

Décisions UI :
- Filtres en chips (scroll horizontal mobile) :
  - Tous
  - Avec photos
  - Sans photos
  - 5★, 4★, 3★, 2★, 1★ (ou "Critiques")
  - Tags d'usage (Genoux soulagés, Parents & seniors...)
  - Produit (si mur multi-produits)
- Tri (dropdown) : Recommandés (par défaut), Plus récents, Plus utiles, Note décroissante.

---

## 4) Performance et "Load more" : éviter la fatigue de scroll + protéger la mémoire

NN/g rappelle que l'infinite scroll n'est pas adapté partout et qu'un compromis "Load more" peut réduire certains problèmes (refind, contrôle, perf).

Décisions UI/Perf :
- Par défaut : charger 10 à 20 avis.
- "Afficher plus" explicite, avec indicateur "20/120".
- Images : thumbnails + lazy loading.
- DOM : limiter la hauteur, virtualiser si nécessaire.

---

## 5) Formulaire de dépôt d'avis : minimiser l'effort mental

NN/g (cognitive load) : structure, transparence, clarté, support.
Progressive disclosure : cacher l'optionnel jusqu'à ce que l'utilisateur soit engagé.
Baymard : inline validation réduit la friction.

Décisions UX pour le formulaire :
- Étape 1 ultra courte : Note + commentaire.
- Étape 2 (optionnelle) : titre, catégories, photo.
- Étape 3 (optionnelle) : nom/prénom, ville, anonymat.
- Inline validation non agressive.
- Microcopy de confiance :
  - "Votre avis aide les autres" (social proof)
  - "Publication après modération" (transparence)

---

## 6) Accessibilité : indispensable (et utile à la conversion)

W3C ARIA Authoring Practices (modal dialog) : focus trap, ESC, retour focus, inert background.

Décisions :
- Le Reviews Wall est un dialog/modal accessible (ou drawer role=dialog), avec focus géré.
- `prefers-reduced-motion` : réduire animations.
- Contrastes, tailles tactiles (44px minimum recommandé côté mobile).

---

## 7) Animations : "fast enough" + cohérence

Material Design (motion) :
- Animations courtes, ne pas créer de latence.
- Mobile : ~300ms typique, éléments entrant ~225ms, sortant ~195ms.
- Desktop : 150-200ms.

Décisions :
- Ouverture du mur : 180-220ms desktop, 240-300ms mobile.
- Utiliser easing standard (cubic-bezier type 0.4,0,0.2,1) ou équivalent.

---

## 8) Conformité et transparence sur les avis

Directive UE 2019/2161 (Omnibus) : si un marchand donne accès à des avis, il doit informer si des processus existent pour vérifier que les avis proviennent de consommateurs ayant acheté/utilisé le produit, et comment les avis sont traités (ex: si tous les avis sont publiés ou non).

Décisions :
- Ajouter dans le mur un lien "Comment nos avis sont vérifiés".
- Dans Studio : champ "verified_purchase" si applicable.

---

## Sources (principales)

- Baymard Institute
  - Ratings distribution summary
  - Importance du nombre d'avis
  - Form design / inline validation
- Nielsen Norman Group
  - Guidelines ecommerce product pages (incl. avis)
  - Infinite scrolling: when to use/avoid
  - Progressive disclosure
  - Cognitive load in forms
- Spiegel Research Center (Northwestern)
  - How online reviews influence sales (article + eBook)
- W3C WAI ARIA Authoring Practices
  - Dialog (Modal) Pattern
- Directive UE 2019/2161 (Omnibus)
- Google Developers
  - Review snippet structured data
- Material Design (Motion - duration & easing)
