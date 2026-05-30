# F24 — Postiz payload mapping

## Importance : 🟠 P1

## Objectif
Fonction `buildPostizDraftPayload` qui construit le body attendu par Postiz POST /posts.

## Mapping FemiGlow → Postiz

| FemiGlow | Postiz |
|----------|--------|
| post.scheduledAt OR now+1h | `date` (ISO) |
| 'now' \| 'schedule' \| 'draft' | `type` |
| accountId | `posts[0].integration.id` |
| caption | `posts[0].value[0].content` |
| uploaded media | `posts[0].value[0].image[0]` (id + path) |
| platform | `settings.__type` |
| format (carousel → post) | `settings.post_type` |
| tags (default femiglow) | `tags` |

## Tests
Voir `test-scenarios.yaml`.
