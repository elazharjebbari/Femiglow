# F20 — Dry-run adapter

## Importance : 🟠 P1

## Objectif
Adapter mock pour staging/tests : retourne des résultats synthétiques sans appel réseau, avec capabilities et failure simulation.

## Comportement
- IDs déterministes : `dry_${SHA256(idempotencyKey).slice(0, 12)}`
- Permalink synthétique : `https://dry-run.local/{platform}/{id}`
- Pas d'appel réseau, pas de latency artificielle (configurable)
- Failure simulation via `content.metadata.dryRunFailureCode='provider_rate_limited'`

## Capabilities
- Instagram : post, carousel
- Facebook : post

## Tests
Voir `test-scenarios.yaml`.
