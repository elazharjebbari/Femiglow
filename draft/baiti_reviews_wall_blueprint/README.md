# BAITI - Reviews Wall Blueprint

Ce dossier est un **blueprint complet** (niveau agence) pour concevoir un "Reviews Wall" (mur d'avis) cohérent avec l'ADN BAITI (rooms immersives + hotspots), avec :

- Un mur d'avis consultable dans la scène (via un nouveau spot/hotspot).
- Des avis filtrables (photos / sans photos, catégories d'usage, note, produit, etc.).
- Un chargement progressif ("Load more") pour ne pas surcharger la mémoire.
- Un système de dépôt d'avis (avec photos optionnelles).
- Une interface Studio (back-office) pour modération, édition, suppression, mise en avant.
- Un plan de tracking (dataLayer) pour mesurer l'impact sur l'engagement et la conversion.

## Contenu

- `01_research/` : recherche documentaire (UI/UX e-commerce, psychologie, crédibilité, performances, accessibilité).
- `02_models/` : 3 modèles comparatifs + matrice de décision.
- `03_final_model/` : spécification finale (UX/UI, composants, animations, accessibilité, performance, flux).
- `04_backend/` : data model + API contracts + règles modération + sécurité/vie privée.
- `05_frontend/` : arbre de composants, state management, UI kit Tailwind, hooks testids.
- `06_tracking/` : événements dataLayer + schémas.
- `07_studio_admin/` : spécification détaillée de l'UI Studio pour gérer/modérer.
- `08_spot_type/` : nouveau type de spot "Reviews" (visuel + config).
- `09_tests/` : stratégie de tests (unit, intégration, E2E, visuel, accessibilité).
- `10_roadmap/` : feuille de route et jalons.

## Comment utiliser ce blueprint

1. Lire `01_research/01_RESEARCH_BEST_PRACTICES.md`.
2. Comparer les 3 modèles dans `02_models/01_COMPARATIVE_MODELS.md`.
3. Implémenter **le modèle final** défini dans `03_final_model/01_FINAL_MODEL_SPEC.md`.
4. S'appuyer sur `04_backend/` et `05_frontend/` pour la conception technique.
5. Utiliser `07_studio_admin/` pour cadrer la modération et l'ergonomie back-office.
6. Brancher `06_tracking/` au dataLayer existant.
7. Valider avec `09_tests/`.
