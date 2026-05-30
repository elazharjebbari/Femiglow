# F21 — State machine transitions

## Importance : 🔴 P0

## Objectif
Garantir que chaque transition de statut social_publish_job est validée par `assertTransition()`. Empêche les transitions impossibles.

## Matrix transitions valides

| From → To | Valide |
|-----------|--------|
| draft → approved | ✓ |
| draft → cancelled | ✓ |
| draft → queued | ✓ (direct enqueue) |
| approved → queued | ✓ |
| approved → cancelled | ✓ |
| queued → publishing | ✓ |
| queued → cancelled | ✓ |
| queued → failed | ✓ (pre-flight fail) |
| publishing → published | ✓ |
| publishing → failed | ✓ |
| failed → queued | ✓ (retry) |
| failed → cancelled | ✓ |
| published → * | ✗ (terminal) |
| cancelled → * | ✗ (terminal) |
| Same state → same | ✓ (idempotent) |

## Tests
Voir `test-scenarios.yaml`. Table-driven, 50+ cas (valid + invalid).
