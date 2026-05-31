# Error states catalogue

## Types d'erreurs et UI associée

### Validation user (4xx)
- **Inline** sous le champ : texte rouge + icon
- Pas de toast
- Empêche la submission

### Erreur réseau temporaire
- **Toast** rouge avec retry
- React Query retry auto (3×)
- Message : "Connexion perdue. Nouvelle tentative…"

### Erreur 5xx
- **Toast persistant** + lien support
- Log côté serveur avec trace ID
- Affiche le trace ID dans le toast (admin peut le coller)

### Erreur opération longue (snapshot, push Listmonk)
- **Toast persistant** avec status
- Si erreur partielle (X/Y réussis) : message détaillé

### Erreur boundary (crash composant)
- Fallback UI pleine page
- Stack trace caché par défaut (toggle "voir détails")
- Bouton "Réessayer" qui reset le boundary

## Pattern de message

```
Format général : "Action impossible : raison."
Pas de "Oops!". Pas d'humour forcé.

✓ "Impossible d'enregistrer l'audience : le slug existe déjà."
✓ "Connexion à Listmonk perdue. Nouvelle tentative dans 5s…"
✓ "Snapshot annulé : trop de contacts (>100k)."

✗ "Oops, something went wrong!"  ← trop vague
✗ "Erreur 503"                    ← code brut au user
✗ "❌ La saisie a échoué"         ← passif
```

## Erreurs typées

### Audience builder
| Cas | Message |
|---|---|
| Slug existe déjà | "Ce slug est déjà utilisé. Modifie le nom ou ajuste le slug." |
| Rule invalide | "Ce critère a une valeur invalide. Vérifie l'opérateur et la valeur." |
| Audience trop grosse | "Cette audience matche plus de 100 000 contacts. Réduis les critères ou utilise une campagne segmentée." |
| Preview timeout | "Le calcul de taille a dépassé 5s. Simplifie les critères ou retry." |

### Snapshot
| Cas | Message |
|---|---|
| Audience supprimée pendant snapshot | "L'audience n'existe plus. Snapshot annulé." |
| DB connexion perdue | "Erreur DB temporaire. Le snapshot peut être incomplet — vérifie son statut." |
| Listmonk down | "Listmonk n'est pas joignable. Le snapshot est créé, le push est différé." |

### Automation
| Cas | Message |
|---|---|
| Step kind inconnu | "Type de step '{kind}' non reconnu. Mets à jour ton automation." |
| Template manquant | "Le template '{slug}' n'existe plus. Choisis-en un autre." |
| Condition invalide | "La condition de branch est mal formée." |

## Codes d'erreur applicatifs

Pour le support / logs :

| Code | Cas | Action admin |
|---|---|---|
| `AUD-001` | Slug duplicate | Changer slug |
| `AUD-002` | Rules schema invalid | Vérifier types |
| `AUD-003` | Preview timeout | Simplifier |
| `SNP-001` | Audience deleted | Recréer |
| `SNP-002` | DB error | Retry |
| `LM-001`  | Listmonk auth fail | Vérifier .env |
| `LM-002`  | Listmonk 503 | Attendre, retry |
| `LM-003`  | List conflict 409 | Auto-recover (suffix) |
| `AUT-001` | Step kind unknown | Re-edit |
| `AUT-002` | Cooldown blocked | Pas une erreur, info |
| `AUT-003` | Quiet hours skip | Pas une erreur, info |

## Toasts

```typescript
type ToastConfig = {
  variant: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  duration?: number;        // 5s default, 8s with undo, 0 = persistent
  action?: { label: 'Undo' | 'Retry' | 'Voir'; onClick: () => void };
  ref?: string;             // trace ID for support
};
```

Stack : bas-droite, max 3 visibles, FIFO ; toaster persistent (duration=0)
en haut de la stack.

## Sentry / monitoring

Toute erreur 5xx ou Error Boundary :
- Log via `logger.error(...)`
- Sentry capture (si configuré)
- Inclure : userEmail, trace ID, current URL, action en cours
