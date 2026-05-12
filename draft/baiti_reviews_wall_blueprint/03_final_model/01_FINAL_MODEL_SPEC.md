# Modèle final - Reviews Wall BAITI (spécification)

## Résumé
Le modèle final retient la structure **Drawer mural** (Modèle A) car il maximise :
- immersion BAITI
- réassurance proche du produit
- performance mobile

Et il ajoute une couche "hybrid" minimale : une **preview avis** (2-3 cards) dans le modal produit, avec un lien "Voir tous les avis" qui ouvre le drawer sur le produit concerné.

---

## Objectifs produit

1) Social proof immédiat, scannable
- Note moyenne + nombre d'avis
- Distribution 5★->1★ cliquable
- 3 insights d'usage (tags)

2) Exploration structurée
- Filtres chips + tri
- Avis avec photos / sans photos
- Possibilité de filtrer les avis critiques

3) Chemin vers conversion
- CTA clair "Voir le produit" sur chaque avis (si mur multi-produits)
- CTA sticky "Voir ce produit" quand un produit est sélectionné

4) Dépôt d'avis simple
- Formulaire à friction minimale (progressive disclosure)
- Upload photo optionnel, limité (max 3)
- Transparence sur modération et vérification

5) Performance et accessibilité
- Pagination + Load more
- Lazy images
- Dialog accessible (focus trap, ESC, retour focus)

---

## Placement dans la room

### Nouveau spot "Reviews"
- Le spot est placé sur un objet mural (ex: tableau/cadre).
- Visuel non pulsé : style "plaque" discrète, avec badge 4.9★.
- Au hover (desktop) : légère élévation + tooltip "Avis clients".

---

## Layout desktop

- Drawer à droite (max 520px) avec overlay translucide sur la scène.
- Structure :
  1. Header sticky: titre + close + lien "Comment nos avis sont vérifiés"
  2. Summary: note, count, histogramme
  3. Filters row (chips) + Sort dropdown
  4. Reviews list (cards, 1 colonne, ou 2 colonnes si assez large)
  5. Footer sticky: CTA "Laisser un avis" + CTA "Voir le produit" (contextuel)

---

## Layout mobile

- Bottom sheet (snap points) :
  - 40% (preview)
  - 85% (full)
- Header sticky + drag handle.
- Chips scroll horizontale.
- Liste 1 colonne.
- Footer sticky avec CTA.

---

## Interactions clés

### Ouvrir le mur
- Click spot -> ouverture drawer.
- Focus sur le titre du drawer (accessibilité).
- Track event `reviews_wall_open`.

### Filtrer
- Click chip -> refresh list via API (ou client-side si déjà chargé).
- Chips actives visibles.

### Charger plus
- Click "Afficher plus" -> fetch next cursor.
- Indicateur "20/120".

### Photo
- Click photo -> lightbox.
- Lazy load full-res au moment du click.

### Aller vers un produit
- Sur chaque card : label produit + CTA.
- Click -> ferme drawer, ouvre modal produit (en mémorisant state drawer pour retour).

### Déposer un avis
- CTA "Laisser un avis" ouvre une vue "form" dans le drawer (tab, ou sous-drawer).
- Validation inline.
- Upload photos.
- Submit -> message de confirmation, état PENDING.

---

## Risques et parades

- Risque : surcharge visuelle.
  - Parade : progressive disclosure, sections pliables, header/footers sticky.

- Risque : empilement de modals.
  - Parade : stack manager (1 overlay principal + sous-vues), focus management strict.

- Risque : perf mobile avec images.
  - Parade : thumbnails, `loading=lazy`, limiter taille, compression.

---

## Fichiers clés

- Wireframes : `diagrams/wireframe_desktop.puml`, `diagrams/wireframe_mobile.puml`
- Flux : `diagrams/user_journey.puml`, `diagrams/api_sequence.puml`
- Composants : `03_COMPONENT_SPEC.md`
- Animations : `04_ANIMATION_AND_MOTION.md`
- A11y : `05_ACCESSIBILITY.md`
