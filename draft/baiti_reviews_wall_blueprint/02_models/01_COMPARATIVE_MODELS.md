# 3 modèles de Reviews Wall (comparatif)

Objectif : proposer 3 patterns robustes, adaptés à BAITI, puis choisir un modèle final.

---

## Modèle A - "Drawer mural" (dans la scène)

### Description
- Un spot dédié dans la room (ex: tableau/cadre) ouvre un **drawer** (desktop: panneau latéral, mobile: bottom sheet).
- Le mur affiche : résumé (note+count+histogramme), filtres, liste d'avis, et un CTA "Voir le produit".

### Points forts
- Respecte l'immersion BAITI (l'utilisateur reste dans la scène).
- Très bon pour la conversion : rassure sans casser le parcours.
- Performance : contenu paginé + lazy images.

### Risques / limites
- Gestion de couches (drawer + modal produit + lightbox photo) à designer proprement.

### Quand choisir
- Quand on veut maximiser l'impact conversion tout en gardant l'ADN room.

---

## Modèle B - "Mur d'avis plein écran" (route dédiée)

### Description
- Un spot ouvre une page dédiée (route) : `/rooms/<slug>/reviews/`.
- Page riche (2 colonnes desktop) : à gauche liste, à droite form de dépôt.

### Points forts
- Plus d'espace : filtres avancés, stats, form complet visible.
- Facile à partager (URL) et SEO potentiellement utile.

### Risques / limites
- Rupture immersion (sort de la scène).
- Peut réduire l'engagement sur le produit si mal relié.

### Quand choisir
- Quand on vise aussi acquisition SEO et usage "comparatif" long.

---

## Modèle C - "Hybrid" : avis dans modal produit + mur global

### Description
- Dans le modal produit : onglet "Avis" (mini mur contextualisé).
- Spot mural ouvre le mur global, mais chaque avis renvoie vers un produit.

### Points forts
- Double levier : social proof au plus près du CTA + découverte globale.
- Réduit la complexité de la navigation : l'utilisateur retrouve les avis là où il achète.

### Risques / limites
- Plus coûteux à implémenter.
- Risque de duplication de logique (tri, filtres) si pas bien mutualisé.

### Quand choisir
- Quand le catalogue et les rooms ont plusieurs produits, et que les avis sont un pilier central.

---

## Recommandation

Pour BAITI (rooms immersives + lead modal), le modèle le plus cohérent est :

- **Modèle A comme base** (drawer mural, rapide, immersion, conversion).
- Avec un détail du modèle C : un "mini avis" (preview) dans le modal produit pour continuité.

Le dossier `03_final_model/` formalise ce modèle final.
