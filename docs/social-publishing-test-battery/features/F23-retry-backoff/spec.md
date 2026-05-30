# F23 — Retry with exponential backoff

## Importance : 🟠 P1

## Objectif
Strategy retry pour les erreurs transient (5xx, 429, 408, network timeout).

## Comportement
- Max 3 attempts (configurable)
- Délais [100, 300, 900, 1500]ms entre tentatives
- Transient codes : 408, 425, 429, 5xx, network errors
- Non-transient (no retry) : 400, 401, 403, 404, 409, 422
- Respect optionnel de `Retry-After` header (futur)

## Tests
Voir `test-scenarios.yaml`.
