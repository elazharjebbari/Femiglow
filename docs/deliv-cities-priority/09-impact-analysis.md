# Analyse d'impact — Villes prioritaires

## Fichiers modifiés

### Phase 1 — Données

| Fichier | Changement | Impact |
|---------|-----------|--------|
| `src/lib/checkout/data/moroccan-cities.ts` | Ajout champ `position`, 2 nouvelles villes, tri par position | **Moyen** — Ajout d'un champ à l'interface, modification de `searchCities()`, ajout de 2 entrées. Les tests existants vérifient `searchCities('')` qui change d'ordre → mettre à jour les snapshots. |
| `drizzle/migrations/0054_priority_cities.sql` | Nouvelle migration SQL | **Faible** — 13 UPDATEs atomiques, pas de DDL |
| `src/lib/checkout/data/moroccan-cities.test.ts` | Nouveaux tests | **Faible** — Ajout uniquement |

### Phase 2 — Backend

| Fichier | Changement | Impact |
|---------|-----------|--------|
| `src/lib/db/queries/delivery-cities.ts` | Ajout `updateDeliveryCityPositions()` | **Faible** — Nouvelle fonction, pas de modification des fonctions existantes |
| `src/lib/checkout/delivery/schemas.ts` | Ajout `deliveryCityPositionsSchema` | **Faible** — Nouveau schema, pas de modification des existants |
| `src/app/api/admin/delivery-cities/positions/route.ts` | Nouveau endpoint | **Faible** — Nouveau fichier, pas de modification des existants |

### Phase 3 — Admin UI

| Fichier | Changement | Impact |
|---------|-----------|--------|
| `src/components/admin/settings/DeliveryCitiesEditor.tsx` | Ajout onglet + badge position | **Moyen** — Modification d'un composant existant. Risque : casser la table existante. Mitigation : l'onglet est conditionnel, la table catalogue ne change pas. |
| `src/components/admin/settings/PriorityCitiesPanel.tsx` | Nouveau composant | **Faible** — Nouveau fichier |
| `package.json` | Ajout `@dnd-kit/core` + `@dnd-kit/sortable` | **Faible** — Nouvelles dépendances |

### Phase 4 — Frontend

| Fichier | Changement | Impact |
|---------|-----------|--------|
| `src/components/checkout/wizard/components/CityAutocomplete.tsx` | Label de groupe + limite dynamique | **Moyen** — Modification d'un composant critique du checkout. Risque : casser l'autocomplete existant. Mitigation : le label est conditionnel (query vide uniquement), la limite change de 8→13 uniquement au focus. |
| `src/lib/checkout/delivery/use-delivery-cities.ts` | Limite dynamique | **Faible** — Un paramètre change |

## Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| L'autocomplete casse sur mobile iOS | Moyen | Élevé | Tester sur iOS Safari, `MobileFocusGuard` déjà en place |
| Les positions优先 ne sont pas rafraîchies dans le cache | Faible | Moyen | `Cache-Control: s-maxage=300` sur l'API search ; le cache se rafraîchit en 5 min |
| Le drag & drop est cassé sur tactile | Moyen | Moyen | `@dnd-kit` supporte le tactile nativement, tester sur mobile |
| Les 2 nouvelles villes ne sont pas en DB | Faible | Faible | Créer via l'admin UI ou via le seed mis à jour |
| Les tests existants cassent (ordre changé) | Moyen | Faible | Mettre à jour les assertions qui dépendent de l'ordre |

## Non-régression

- **Comportement par défaut** : Si `position = 0` pour toutes les villes (état actuel), le tri est alphabétique → identique au comportement actuel
- **Kill-switch** : `NEXT_PUBLIC_USE_DB_CITIES=false` désactive la DB et utilise les données statiques → les données statiques auront aussi les positions
- **API existante** : `GET /api/delivery-cities/search` ne change pas de signature, le tri est interne
- **Admin existante** : Le tri par position existait déjà dans le dropdown de tri → aucune modification nécessaire

## Dépendances inverses

Aucun autre composant ne dépend de l'ordre des villes dans l'autocomplete en dehors de :
- `CityAutocomplete.tsx` (modifié en Phase 4)
- `AddressStep.tsx` (utilise `CityAutocomplete`, pas de modification nécessaire)
- `useDeliveryCities` (modifié en Phase 4)
- Le webhook `from-wizard-step2` utilise `citySlug` qui est indépendant de l'ordre