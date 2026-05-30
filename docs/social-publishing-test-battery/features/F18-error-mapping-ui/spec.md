# F18 — Error mapping UI

## Importance : 🟠 P1

## Objectif
Mapping centralisé des codes d'erreur server → messages français lisibles, via `formatError()`.

## Table de mapping

| code | message FR |
|------|-----------|
| budget_exceeded | Budget IA quotidien atteint. |
| brand_review_blocked | Le contenu est bloqué par la revue brand. |
| no_media_attached | Aucun média attaché au draft. |
| no_account_connected | Aucun compte social connecté. |
| session_expired | Session expirée, veuillez vous reconnecter. |
| rate_limit_exceeded | Trop de requêtes, réessayez dans un instant. |
| provider_rate_limited | Trop de requêtes, réessayez dans un instant. |
| provider_unavailable | Provider indisponible. |
| provider_timeout | Délai de réponse dépassé. |
| version_conflict | Le draft a été modifié ailleurs. Rechargez la page. |
| min_lead_time | La date doit être au moins 5 minutes dans le futur. |
| invalid_state | État de draft invalide pour cette action. |
| invalid_input | Requête invalide. |
| not_found | Ressource introuvable. |
| forbidden | Action non autorisée. |
| unauthorized | Session expirée, veuillez vous reconnecter. |
| token_expired | Compte expiré, reconnectez-le. |
| permission_denied | Permission refusée. |
| capability_not_supported | Ce compte ne supporte pas cette action. |
| caption_too_long | La caption dépasse la longueur maximale. |
| format_not_supported | Format non supporté pour ce compte. |
| invalid_media_url | URL média invalide (doit être HTTPS). |

## Fallback
- Si code inconnu mais `message` server présent → utiliser le message brut
- Si rien → "Une erreur est survenue."

## Tests
Voir `test-scenarios.yaml`. Table-driven test.
