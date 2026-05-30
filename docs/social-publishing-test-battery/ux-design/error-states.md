# Error states — Publish UX

## Niveaux de gravité

| Niveau | UI | Exemples |
|--------|----|----------|
| 🔴 Bloquant | Banner persistant + bouton action | Session expirée, compte token_expired |
| 🟠 Action requise | Toast 6s + bouton retry | Provider down, network |
| 🟡 Info | Toast 3s | Validation, format |
| 🟢 Confirmation | Toast 2s | Publication lancée |

## Mapping par scenario

### Brand review blocked
- Pre-publish : ApproveButton disabled + tooltip "Brand review bloque"
- Si tente quand même : Toast "Le contenu est bloqué par la revue brand."
- Pas de retry — fix the content

### No media attached
- Pre-publish : ApproveButton disabled + tooltip "Attachez un visuel"
- Si tente : Toast "Aucun média attaché au draft."

### Token expired
- AccountHealthCard : badge warning + lien "Reconnecter"
- Si tente publish : Toast "Compte expiré, reconnectez-le."
- Slack alert envoyé en parallèle

### Provider rate limited
- Toast "Trop de requêtes, réessayez dans un instant."
- Job auto-retry (3 tentatives)
- Si exhausted : Toast final + JobQueue row failed avec retry button

### Provider unavailable (5xx)
- Toast "Provider indisponible."
- Job retry
- Final : Slack alert + row failed

### Network error
- Toast "Connexion perdue, réessayez."
- Pas de retry automatique
- Bouton Retry inline si possible

### Validation client (caption too long, etc.)
- Inline error sous l'input
- Submit button disabled
- Pas de toast avant submit

## Recovery flows

### Token expired
1. Notification reçue (toast + AccountHealthCard badge)
2. Opérateur ouvre Postiz UI → re-OAuth
3. Click "Synchroniser" sur AccountHealthCard
4. Account status revient active
5. Retente publish

### Network blackout temporaire
1. Toast "Connexion perdue"
2. Click Retry → second attempt
3. Si toujours fail → Slack alert ops
4. Wait + recovery

### Brand violation
1. Toast "Bloqué brand"
2. Opérateur édite caption
3. Brand review revalide (auto)
4. ApproveButton se réactive
5. Re-publish

## A11y errors
- Tous les toasts : role=status, aria-live=assertive (error) / polite (success)
- Banner critiques : role=alert
- Bouton Retry : aria-label="Réessayer la publication"
