# Admin UI — Panneau Villes prioritaires

## 1. Architecture du composant

Le panneau `PriorityCitiesPanel` sera un onglet dans le `DeliveryCitiesEditor` existant. Il permettra de :

1. **Voir les villes prioritaires** dans l'ordre d'affichage
2. **Réordonner** par drag & drop
3. **Ajouter** une ville à la liste优先 (depuis le catalogue complet)
4. **Retirer** une ville de la liste优先 (retour à `position = 0`)
5. **Voir le résultat en temps réel** (combobox de prévisualisation)

## 2. Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│ Villes de livraison                                              │
│ Catalogue des villes desservies (Maroc).                         │
│                                                                   │
│ [ Catalogue ]  [ ◉ Villes优先 ]                                  │
│                                                                   │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ Villes优先 à l'affichage                                      │  │
│ │ Ces villes apparaissent en tête de l'autocomplete du         │  │
│ │ checkout quand le champ est vide ou au focus.                 │  │
│ │                                                               │  │
│ │ 1. ☰ Casablanca ─── الدار البيضاء ─── 0 MAD ─── 24h [✕]    │  │
│ │ 2. ☰ Marrakech ──── مراكش ─────── 0 MAD ─── 24h [✕]      │  │
│ │ 3. ☰ Tanger ─────── طنجة ───────── 0 MAD ─── 48h [✕]      │  │
│ │ 4. ☰ Agadir ─────── أكادير ──────── 0 MAD ─── 48h [✕]      │  │
│ │ 5. ☰ Kénitra ────── القنيطرة ───── 0 MAD ─── 48h [✕]      │  │
│ │ 6. ☰ Fès ────────── فاس ────────── 0 MAD ─── 48h [✕]      │  │
│ │ 7. ☰ Meknès ─────── مكناس ──────── 0 MAD ─── 48h [✕]      │  │
│ │ 8. ☰ Tétouan ────── تطوان ──────── 0 MAD ─── 48h [✕]      │  │
│ │ 9. ☰ Dar Bouaza ─── الدار البيضاء外围 0 MAD ─ 24h [✕]    │  │
│ │10. ☰ Mohammedia ─── المحمدية ────── 0 MAD ─── 24h [✕]      │  │
│ │11. ☰ El Jadida ──── الجديدة ─────── 0 MAD ─── 48h [✕]      │  │
│ │12. ☰ Bouskoura ──── بوسكورة ────── 0 MAD ─── 48h [✕]      │  │
│ │13. ☰ Oujda ──────── وجدة ────────── 0 MAD ─── 48h [✕]     │  │
│ │                                                               │  │
│ │ [+ Ajouter une ville]                                         │  │
│ │                                                               │  │
│ │ ┌─ Aperçu ─────────────────────────────────────────────────┐  │  │
│ │ │ 🔍 Ville de livraison…                                    │  │  │
│ │ │                                                           │  │  │
│ │ │ Villes populaires                                         │  │  │
│ │ │ ┌─ Casablanca — 0 MAD — 24h ─────────────────────── ─┐  │  │  │
│ │ │ ├─ Marrakech — 0 MAD — 24h ──────────────────────────┤  │  │  │
│ │ │ ├─ Tanger — 0 MAD — 48h ────────────────────────────┤  │  │  │
│ │ │ └─────────────────────────────────────────────────────┘  │  │  │
│ │ └─────────────────────────────────────────────────────────┘  │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ [ Enregistrer les positions ]                                     │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Comportement du drag & drop

- Utilisation de la librairie `@dnd-kit/core` + `@dnd-kit/sortable` (déjà compatible avec le design system admin)
- Chaque item est un `SortableItem` avec un `id` = slug
- Le drag met à jour l'ordre local (optimistic)
- Le bouton « Enregistrer » envoie un batch PATCH `/positions`
- Le bouton « ✕ » retire la ville (PATCH individual avec `position: 0`)

## 4. Ajout d'une ville优先

- Le bouton « + Ajouter une ville » ouvre un mini-autocomplete (réutilise `CityAutocomplete` en mode admin)
- L'admin tape le nom d'une ville, la sélectionne
- La ville reçoit `position = max(positions) + 1`
- Batch PATCH envoyé immédiatement

## 5. Indicateur dans la table catalogue

Dans la table principale du `DeliveryCitiesEditor`, ajouter un badge numéroté pour les villes优先 :

```
| Nom FR       | … | Position |
| Casablanca   | … | ★ 1      |
| Agadir       | … | —        |
| Marrakech    | … | ★ 2      |
```

- Badge `★ N` en or pour position 1-3
- Badge `N` en gris pour position 4+
- `—` pour position = 0

## 6. Prévisualisation en temps réel

Le panneau优先 inclut une prévisualisation du combobox tel que le client le verra :
- Quand la query est vide, les villes优先 apparaissent avec un en-tête « Villes populaires »
- Les villes sont dans l'ordre défini par l'admin
- La prévisualisation utilise le même composant `CityAutocomplete` en mode lecture seule

## 7. Accessibilité

- Les items draggables ont `role="listitem"` et `aria-grabbed`
- Le bouton ✕ a `aria-label="Retirer {nameFr} de la liste优先"`
- L'onglet actif a `aria-selected="true"`
- Le bouton « Enregistrer » est disabled tant que l'ordre n'a pas changé