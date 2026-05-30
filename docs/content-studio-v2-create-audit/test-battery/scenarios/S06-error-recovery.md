# S06 — Error Recovery

> Valide la gestion des erreurs (réseau, serveur, provider) avec messages clairs.

## Cas testés

### A — Génération texte : provider down
- Mock POST /ideas/:id/generate → 503 { error: { code: 'provider_down' } }
- **Attendu** : toast "Provider indisponible, veuillez réessayer"
- Bouton "Réessayer" visible

### B — Génération image : timeout
- Mock POST /generate-visual → 30s sans réponse, puis abort
- **Attendu** : toast "Génération trop longue, veuillez réessayer"

### C — Approve sans média
- Mock POST /drafts/:id/approve → 409 { error: { code: 'no_media_attached' } }
- **Attendu** : toast "Attachez un visuel avant de valider"

### D — Publish sans compte connecté
- Mock POST /posts/:id/publish-now → 409 { code: 'no_account_connected' }
- **Attendu** : toast "Aucun compte social connecté"
- Lien vers /admin/settings/integrations

### E — Session expirée pendant autosave
- Mock PATCH /drafts/:id → 401
- **Attendu** : AutosaveIndicator passe à 'session_expired', banner avec bouton "Se reconnecter"

### F — Erreur réseau (offline)
- Désactiver le réseau dans Playwright
- Tenter une action
- **Attendu** : toast "Connexion perdue" avec retry button

## Spec Playwright
`e2e/content-studio-v2/create-error-recovery.spec.ts`
