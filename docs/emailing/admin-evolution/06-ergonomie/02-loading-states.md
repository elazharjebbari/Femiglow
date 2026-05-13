# Loading states

## Latency budgets

| Latency | UI |
|---|---|
| 0-100ms | Pas d'indicateur (instant perçu) |
| 100-500ms | Spinner inline (16px) |
| 500ms-2s | Skeleton du contenu attendu |
| 2s+ | Skeleton + message "Chargement..." |
| Job long (snapshot, export) | Toast persistent avec progression |

## Skeletons

### Pattern
- Blocs gris animés (`bg-stone-200 animate-pulse`)
- Respecter la forme du contenu attendu (titres, lignes texte, table)
- Pas plus de 5-10 skeleton rows pour ne pas suggérer une charge énorme

### Composants partagés
```tsx
<Skeleton className="h-4 w-32" />   // ligne de texte
<Skeleton className="h-10 w-full" /> // input
<Skeleton.TableRow cols={5} />       // ligne de tableau
<Skeleton.Card />                    // carte KPI
```

## Spinners

- Lucide `Loader2` rotation
- Tailles : 16px (inline), 24px (button), 48px (centre page)
- Pas plus d'1 spinner visible en même temps

## Progress UI

Pour les jobs avec progression connue (snapshot 10k rows) :

```
┌────────────────────────────────────────────────────┐
│ Snapshot Clientes VIP en cours                     │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░  62%                          │
│ 6 200 / 10 000 contacts                            │
│ Temps estimé restant : 12s                         │
└────────────────────────────────────────────────────┘
```

## Indeterminate progress

Pour les jobs sans progression précise :

```
┌────────────────────────────────────────────────────┐
│ Push Listmonk en cours                             │
│ ▓▓░░░░░▓▓░░░░░ (indeterminate animation)            │
│ Cela peut prendre jusqu'à 5 minutes                │
└────────────────────────────────────────────────────┘
```

## Optimistic updates (no loading)

Pour les toggles (active/inactive), saves rapides : pas de spinner,
appliquer l'effet immédiatement, rollback si erreur.

## Debounce

Filter live : debounce 300ms.
Preview audience : debounce 800ms.
Search bar : debounce 200ms (premier char puis live).

## Background jobs

Job >5s :
1. Toast persistent avec status
2. Possibilité de "voir détails" → drawer avec progression
3. Notification au complete (toast vert + son léger optional)
4. Si admin quitte la page : continuer en arrière-plan, notif au retour
