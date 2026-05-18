# Frontend — Autocomplete villes优先

## 1. Comportement actuel

Quand l'utilisateur focus le champ ville dans le wizard checkout (étape 2), l'autocomplete affiche les villes par ordre alphabétique (toutes avec `position = 0`). Le comportement par défaut de `searchCities("")` retourne `MOROCCAN_CITIES.slice(0, limit)`.

Côté DB, `searchDeliveryCities("")` trie par `position ASC, nameFr ASC`, mais puisque toutes les positions sont 0, le tri est purement alphabétique.

## 2. Comportement cible

### Query vide (focus initial)

```
┌─────────────────────────────────────────┐
│ 🏠 Ville de livraison…                  │
│                                         │
│ ── Villes populaires ────────────── ── │
│ ┌─ Casablanca ─── 0 MAD ─── 24h ───┐ │
│ ├─ Marrakech ──── 0 MAD ─── 24h ───┤ │
│ ├─ Tanger ─────── 0 MAD ─── 48h ───┤ │
│ ├─ Agadir ─────── 0 MAD ─── 48h ───┤ │
│ ├─ Kénitra ────── 0 MAD ─── 48h ───┤ │
│ ├─ Fès ────────── 0 MAD ─── 48h ───┤ │
│ ├─ Meknès ─────── 0 MAD ─── 48h ───┤ │
│ └─ Tétouan ────── 0 MAD ─── 48h ───┘ │
│                                         │
│ Tapez pour voir plus de villes…         │
└─────────────────────────────────────────┘
```

### Query non-vide (recherche)

Le comportement existant est conservé : prefix matching + ranking (0=exact, 1=alias, 2=contains), tri secondaire par `position ASC, nameFr ASC`.

Les villes优先 restent en tête des résultats de recherche quand le rank est égal.

## 3. Modifications au composant CityAutocomplete

### 3.1 Ajout d'un label de groupe

```tsx
// Dans CityAutocomplete, quand la query est vide :
{items.length > 0 && !query && (
  <li className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-[0.1em] text-encre/50" role="presentation">
    Villes populaires
  </li>
)}
```

### 3.2 Limite augmentée au focus

Quand la query est vide, on affiche jusqu'à 13 résultats (les villes优先). Quand l'utilisateur tape, on revient à la limite standard de 8.

```tsx
const effectiveLimit = query.trim() === '' ? 13 : 8;
```

### 3.3 Hint dynamique

Ajouter une prop `groupLabel` au composant `CityAutocomplete` :

```tsx
interface CityAutocompleteProps {
  // ... props existantes
  /** Label affiché au-dessus des suggestions quand la query est vide. */
  groupLabel?: string;
}
```

Par défaut : `groupLabel = "Villes populaires"`.

## 4. Modifications au hook `useDeliveryCities`

```typescript
// Ajout d'une prop limit dynamique
const { query, items, loading, error } = useDeliveryCities(
  debouncedQuery,
  { countryCode, limit: debouncedQuery.trim() === '' ? 13 : 8 }
);
```

## 5. Modifications à `searchCities()` (fallback statique)

Voir `02-schema-api.md` section 5. Le tri par `position` est ajouté quand `query` est vide.

## 6. Modifications à `searchDeliveryCities()` (backend DB)

Aucune modification nécessaire. Le tri existant `position ASC, nameFr ASC` produit déjà le bon résultat une fois les positions mises à jour.

## 7. Groupe visuel dans la dropdown

```css
/* Style pour le label de groupe */
.city-group-label {
  @apply px-3 pt-2 pb-1 text-[11px] uppercase tracking-[0.1em] text-encre/50;
  @apply border-b border-encre/5;
}
```

## 8. Accessibilité

- Le label « Villes populaires » a `role="presentation"` (ne compte pas dans le compteur d'options)
- Les items restent des `<li role="option">` avec `aria-selected`
- L'annonce live reste `aria-live="polite"` sur le conteneur de la liste