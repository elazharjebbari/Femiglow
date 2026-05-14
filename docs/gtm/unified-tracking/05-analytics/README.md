# 05 — Analytics

Catalog des événements, matrices providers, consent, observability.

## Contenu

| Fichier | Contenu |
|---|---|
| [event-catalog.csv](./event-catalog.csv) | Liste exhaustive des événements canoniques FemiGlow |
| [provider-matrix.csv](./provider-matrix.csv) | Matrice événement × provider (mappings recommandés) |
| [consent-mapping.md](./consent-mapping.md) | Politique de consentement par event |
| [analytics-flows.puml](./analytics-flows.puml) | Diagrammes de flow par scénario business |
| [naming-conventions.md](./naming-conventions.md) | Règles de nommage des events / params |

## Philosophy

- **Un événement = un fait métier**, indépendant du destinataire.
- **Le mapping** traduit le fait vers le langage de chaque provider.
- **Pas de tracking spec divergente** : tous les providers tracent le même fait, juste avec leur nom à eux.
