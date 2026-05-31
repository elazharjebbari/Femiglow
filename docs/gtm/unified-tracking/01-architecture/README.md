# 01 — Architecture

Vue système haut niveau, journaux de décision (ADRs), diagrammes de flux.

## Contenu

| Fichier | Contenu |
|---|---|
| [architecture.md](./architecture.md) | Description textuelle complète de l'architecture cible |
| [decision-record.md](./decision-record.md) | ADRs (Architecture Decision Records) numérotés |
| [high-level-architecture.puml](./high-level-architecture.puml) | Diagramme PlantUML — boîtes & flèches niveau système |
| [data-flow.puml](./data-flow.puml) | Diagramme PlantUML — flux d'une donnée tracking de bout en bout |
| [components.puml](./components.puml) | Diagramme PlantUML — composants logiciels et leurs dépendances |
| [sequence-publish.puml](./sequence-publish.puml) | Séquence : admin publie une nouvelle version de plan |
| [sequence-event.puml](./sequence-event.puml) | Séquence : un événement client → providers → GA4 |

## Principes architecturaux

1. **Single Source of Truth** — `TrackingPlan` est l'unique modèle métier persisté.
2. **Projections déterministes** — exports (GTM JSON, Pixel snippets) sont des fonctions pures `plan → output`.
3. **Validation transversale** — un seul validator Zod, utilisé en front (édition), back (save), runtime (resolver).
4. **Versionning explicite** — chaque activation crée un snapshot immuable. Pas de mutation in-place.
5. **Observability native** — drift detector et audit log lisent le même `bundleId` que celui exporté.
