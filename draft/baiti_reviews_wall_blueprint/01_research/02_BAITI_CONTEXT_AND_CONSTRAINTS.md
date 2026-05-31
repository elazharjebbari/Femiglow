# Contexte BAITI et contraintes produit

## ADN BAITI (rappel)
- Expérience immersive "room" : l'utilisateur explore une scène, clique des hotspots (spots) et ouvre des modules (infos / produits).
- Le produit se commande via un **modal multi-étapes** (lead capture).

## Implication pour un Reviews Wall
Un mur d'avis "classique" (bas de page produit) n'est pas suffisant.
Dans BAITI, les avis doivent :

1) Respecter l'immersion
- Ne pas "téléporter" l'utilisateur vers une page lourde.
- Garder un lien clair vers la scène (fermeture intuitive).

2) Garder un chemin rapide vers le produit
- Chaque avis doit permettre de revenir vers le produit associé.
- L'utilisateur doit pouvoir quitter le mur pour :
  - ouvrir le modal produit
  - continuer son exploration

3) Fonctionner très bien sur mobile
- Le room browsing est mobile-first.
- Les overlays doivent être compacts (drawer/bottom sheet).

4) Être compatible avec l'architecture existante
- RoomHotspot a `module_key`, `payload`, `style`.
- `compute_hotspot_kind` classe comme "product" uniquement si module_key commence par `product:`.

Conclusion :
- Le Reviews Wall est implémenté comme un module `module_key = "reviews_wall"` (ou `"reviews:"`), avec un nouveau preset de style dans `hotspot.style`.
- On évite de toucher à la DB pour ajouter un nouveau `Kind` si inutile.
