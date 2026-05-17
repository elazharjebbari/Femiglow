# Stratégie de tests

## Niveaux

| Niveau | Cible |
| --- | --- |
| Unit | services, règles brand safety, payload Postiz |
| Integration | routes API admin avec DB test |
| Contract | client Postiz mocké MSW |
| Component | wizard, preview, score panel |
| E2E | idée → draft → approval → schedule fake Postiz |
| A11y | clavier, modales, calendrier, editor |
| Visual | preview Instagram/Facebook |

## Tests critiques

- Un draft `blocked` ne peut pas être programmé.
- Une génération conserve prompt, modèle, input, output.
- Un média non `ready` bloque schedule.
- Un payload Postiz Instagram contient `settings.__type=instagram` et `post_type`.
- Une erreur 401 Postiz ne retry pas indéfiniment.
- Un retry 5xx respecte backoff.
- Un admin viewer ne peut pas approve/schedule si RBAC appliqué.
- Les termes bloqués échouent toujours.

