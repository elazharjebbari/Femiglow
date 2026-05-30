# F18 — Récupération d'erreurs

## Objectif
Gérer gracieusement les erreurs (réseau, serveur, provider) avec messages clairs et actions de retry.

## Comportement attendu
- Toast d'erreur clair par code (mapping)
- Bouton "Réessayer" pour les opérations idempotentes
- Banner pour les erreurs persistantes (session expirée)
- Logs centralisés (Sentry, etc.) — hors scope UI

## Comportement actuel
Toast génériques "HTTP 500". Pas de retry inline.

## Gaps
- G13 : erreurs opaques
- F18-LOCAL-1 : pas de retry buttons
- F18-LOCAL-2 : pas de detection offline

## Propositions
### A — Mapping erreurs côté UI
Map { code → message } dans un fichier dédié.

### B — Backend retourne directement message i18n
Mais couplage.

### C — Both: codes connus → message UI, codes inconnus → message brut

## Recommandation
**C**.

## Implementation
- `lib/content-studio-v2/errors/messages.ts` :
  ```ts
  export const ERROR_MESSAGES: Record<string, string> = {
    budget_exceeded: 'Budget IA quotidien atteint.',
    brand_review_blocked: 'Le contenu est bloqué par la revue brand.',
    no_media_attached: 'Aucun média attaché au draft.',
    no_account_connected: 'Aucun compte social connecté.',
    session_expired: 'Session expirée, veuillez vous reconnecter.',
    rate_limit_exceeded: 'Trop de requêtes, réessayez dans un instant.',
  };
  ```
- Helper `formatError(err)` utilisé dans tous les catch blocks

## Tests
Voir `test-scenarios.yaml`.
