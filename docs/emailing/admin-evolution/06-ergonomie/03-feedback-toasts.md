# Feedback & toasts

## Quand utiliser un toast

| Cas | Toast ? |
|---|---|
| Action utilisateur OK (save, delete, retry) | ✓ |
| Erreur réseau | ✓ |
| Action background terminée (snapshot done) | ✓ |
| Validation form inline | ✗ (inline error) |
| Confirmation destructive | ✗ (modale dialog) |
| Info contextuelle | ✗ (tooltip) |

## Variants

```typescript
type ToastVariant = 'success' | 'error' | 'info' | 'warning';
```

| Variant | Icon | Color | Duration |
|---|---|---|---|
| success | ✓ | emerald-600 | 5s (8s if undo) |
| error | ✗ | red-600 | persistent (manual close) |
| info | ℹ | sky-600 | 5s |
| warning | ⚠ | amber-500 | 5s |

## Stack

- Position : bottom-right
- Max 3 visibles simultanément
- Older fades out
- Persistent toasts (errors, jobs) en haut de la pile
- Mobile : top center, max 1

## Anatomie

```
┌────────────────────────────────────────────┐
│ ✓  Audience créée                       ✕  │
│    "Clientes VIP" — 47 contacts            │
│    [Voir]  [Annuler · 8s]                  │
└────────────────────────────────────────────┘
```

## Undo pattern

Actions à effet réversible :
- Toggle automation active
- Save view
- Tag/untag

Toast affiche "Annuler" pendant 8s. Si cliqué → re-exécute l'action
inverse. Logger côté serveur l'undo aussi.

## Pas d'undo pour

- Send campaign (déjà parti chez Listmonk)
- Snapshot (n'a aucun effet à annuler)
- Delete avec confirmation préalable (déjà confirmé)

## Annonce a11y

`role="status"` (info/success) ou `role="alert"` (error/warning).
`aria-live="polite"` ou `"assertive"`.

## Implementation

Lib suggérée : `sonner` (toast lib lightweight, accessible).

```typescript
import { toast } from 'sonner';

toast.success('Audience créée', {
  description: 'Clientes VIP — 47 contacts',
  action: { label: 'Voir', onClick: () => navigate('...') },
});

toast.error('Listmonk indisponible', {
  description: 'Nouvelle tentative dans 5s...',
  duration: Infinity,
});

toast.promise(snapshotAudience(id), {
  loading: 'Snapshot en cours...',
  success: (data) => `Snapshot terminé (${data.size} contacts)`,
  error: 'Snapshot a échoué',
});
```
