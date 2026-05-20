# 03 — Backend

Service métier `TrackingPlanService`, API REST, contrats OpenAPI, diagrammes de séquence.

## Contenu

| Fichier | Contenu |
|---|---|
| [service-api.md](./service-api.md) | Documentation des endpoints + signatures TypeScript |
| [service-contract.yaml](./service-contract.yaml) | OpenAPI 3.1 (machine-readable) |
| [backend-architecture.md](./backend-architecture.md) | Choix techniques côté Next.js |
| [sequence-diagrams.puml](./sequence-diagrams.puml) | Séquences détaillées (create, update, activate, export) |

## Principe

Un service unique `TrackingPlanService` orchestré derrière les Next.js Route Handlers. Pas de microservices. Pas de queue. Tout synchrone (les opérations sont sub-100ms).

## Stack

- Next.js 14 App Router (Route Handlers)
- Drizzle ORM (Postgres)
- Zod (validation entrée/sortie)
- pino (logs structurés)
- `nanoid` (génération `bundleId` court alternatif)
