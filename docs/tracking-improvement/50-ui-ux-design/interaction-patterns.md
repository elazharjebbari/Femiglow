# 50.8 — Patterns d'interaction

## Loading states

### Initial page load

```
┌──────────────────────────────────────┐
│  Skeleton loaders (animate-pulse)    │
│                                       │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                     │
│  ▓▓▓▓▓▓▓▓▓                            │
│                                       │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             │
│  ▓▓▓▓▓▓▓▓▓▓                           │
└──────────────────────────────────────┘
```

Pas de spinner fullscreen. Skeleton ≤ 300ms apparaît immédiatement.

### Form submit

Bouton primaire :
- Disabled
- Texte change : "Sauvegarder" → "Sauvegarde en cours…"
- Spinner inline (8px, animate-spin)

```
[ ◌ Sauvegarde en cours…  ]
```

### Polling refresh

Discret en bas à droite :
```
"Actualisation dans 22s"  [⟳]
```

## Success feedback

### Toast (5s auto-dismiss)

```
┌────────────────────────────────────────┐
│ ✅ Version v2.1 sauvegardée            │
│                            [Annuler] ✕ │
└────────────────────────────────────────┘
```

Position : top-right.
Bouton "Annuler" si l'action est réversible (5s window).

### Inline banner

Pour les confirmations qui restent visibles :

```
┌────────────────────────────────────────┐
│ ✅ Configuration sauvegardée. Vos      │
│   modifications sont actives.          │
└────────────────────────────────────────┘
```

## Error feedback

### Inline form errors

Sous le champ concerné :

```
┌──────────────────────────────────────┐
│ Meta Pixel ID                        │
│ [ 123                             ] ⚠ │
│ ⓘ Format invalide : 15-16 chiffres   │
└──────────────────────────────────────┘
```

### Banner d'erreur en haut

Pour les erreurs globales :

```
┌────────────────────────────────────────┐
│ ❌ Une erreur est survenue lors de la  │
│   sauvegarde. [Réessayer]              │
│   Référence : err_abc123               │
└────────────────────────────────────────┘
```

### Page d'erreur (404/500)

```
┌────────────────────────────────────────┐
│                                        │
│             ¯\_(ツ)_/¯                 │
│                                        │
│  Cette version n'existe pas ou plus.   │
│                                        │
│  [Retour à la liste]                   │
│                                        │
└────────────────────────────────────────┘
```

## Confirmation patterns

### Soft confirm (warning toast)

Pour actions réversibles :
```
┌────────────────────────────────────────┐
│ ✅ Version désactivée                  │
│              [Annuler]    [OK, garder] │
└────────────────────────────────────────┘
```

### Hard confirm (modal typed)

Pour actions irréversibles :
```
┌────────────────────────────────────────┐
│ ⚠ Suppression définitive               │
│                                        │
│ Cette version sera supprimée            │
│ définitivement. Cette action est       │
│ irréversible.                          │
│                                        │
│ Tape "SUPPRIMER" pour confirmer :      │
│ [_______________________]              │
│                                        │
│ [Annuler]  [Supprimer définitivement] │
└────────────────────────────────────────┘
```

Le bouton "Supprimer" reste disabled jusqu'à ce que le texte match.

## Optimistic updates

Pour les actions ultra-fréquentes (toggle, dropdown change) :

1. Update local state immédiatement
2. POST en arrière-plan
3. Si erreur : rollback + toast rouge
4. Si succès : silencieux (pas de toast)

Exemple : EventCategorizationTable change category :

```typescript
mutate(
  (current) => current?.map((row) =>
    row.name === eventName
      ? { ...row, googleAdsCategoryOverride: newCategory }
      : row,
  ),
  { revalidate: false },
);

try {
  await api.put('/events/categorization', { eventName, category: newCategory });
  await mutate(); // confirm
} catch {
  await mutate(); // rollback
  toast.error('Échec de la mise à jour');
}
```

## Empty states

### Liste vide

```
┌────────────────────────────────────────┐
│                                        │
│              📁                        │
│                                        │
│    Aucune version GTM créée.           │
│                                        │
│    Commence par [+ Nouvelle version]   │
│    pour configurer tes pixels.         │
│                                        │
│    Tu peux aussi importer depuis un    │
│    compte GTM existant.                │
│                                        │
└────────────────────────────────────────┘
```

### Filtre vide

```
┌────────────────────────────────────────┐
│ Aucun résultat pour "<query>".         │
│ [Effacer le filtre]                    │
└────────────────────────────────────────┘
```

## Search & filter

- Input avec icône loupe à gauche, X à droite (clear)
- Debounce 250ms
- Highlight des matches dans les résultats
- Compteur `12 résultats sur 45`

## Drag & drop

Hors-scope pour ces chantiers. Si besoin futur :
- Cursor : `cursor-grab` → `cursor-grabbing`
- Drop zones avec border dashed
- Aria-live announcements

## Navigation au clavier

| Touche | Action |
|---|---|
| Tab / Shift+Tab | Navigation focus |
| Enter | Activate focused element |
| Esc | Close modal / cancel |
| / | Focus search input |
| n | Nouvelle version (sur page list) |
| e | Edit (sur ligne sélectionnée) |
| Cmd+S | Save (dans form) |
| Cmd+K | Command palette (out of scope) |
