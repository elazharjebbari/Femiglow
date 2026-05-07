# Page — `/admin/leads`

| Aspect | Valeur |
|---|---|
| Type | Server Component (page) + Client Components (filters, pagination) |
| Auth | requise |
| Layout | admin |
| Breadcrumb | "Leads" |

## Wireframe

Voir [`../../03-ux-navigation/wireframes-textuels.md`](../../03-ux-navigation/wireframes-textuels.md#adminleads).

## Comportement

1. Lit les filtres depuis `searchParams`.
2. Appelle `listLeads(filters)` côté Server Component.
3. Rend `LeadFilters` (Client) avec valeurs initiales.
4. Rend `LeadTable` (mixed) avec les lignes.
5. Rend `Pagination` avec `nextCursor`.
6. Filtres modifiés → URL mise à jour → page re-rend.

## Filtres pris en charge

| Filtre | Param URL | Valeurs |
|---|---|---|
| Type | `type` | `contact`, `order`, `newsletter`, `b2b` |
| Statut | `status` | array CSV (`new,in_progress,...`) |
| Période from | `from` | ISO date |
| Période to | `to` | ISO date |
| Ville | `city` | enum villes Maroc |
| Recherche | `q` | texte (debounce 300 ms) |
| Tri | `sort` | `created_at`, `total` |
| Ordre | `order` | `asc`, `desc` |
| Cursor | `cursor` | base64 |

## Tableau

Colonnes :

1. Date (relative, hover = absolu)
2. Nom complet
3. Type (badge)
4. Email (tronqué si long)
5. Statut (badge)
6. Action (chevron →)

Tri par défaut : `created_at DESC`.

Toute la ligne est cliquable → `/admin/leads/[id]`.

## Pagination

```tsx
<Pagination
  hasPrev={!!searchParams.cursor}
  hasNext={!!nextCursor}
  prevHref={getPrevHref(searchParams)}
  nextHref={getNextHref(searchParams, nextCursor)}
  rangeStart={offset + 1}
  rangeEnd={offset + items.length}
  total={total}
/>
```

`total` est calculé via une requête `count(*)` séparée (acceptable au
volume FemiGlow).

## Export CSV

Bouton "Exporter en CSV" en haut à droite :

```tsx
<a
  href={`/api/admin/leads?${currentFilters}&format=csv`}
  download={`leads-${formatDate(now)}.csv`}
>
  <Button variant="secondary">Exporter en CSV</Button>
</a>
```

L'API admin `/api/admin/leads?format=csv` stream la réponse.

## Empty states

| Condition | Message | CTA |
|---|---|---|
| Aucun lead du tout | "Aucun lead pour le moment. Les soumissions du site apparaîtront ici." | aucun |
| Aucun résultat de filtre | "Aucun résultat ne correspond à ces filtres." | "Réinitialiser les filtres" |

## Tests

| Type | Fichier |
|---|---|
| Unit | `LeadFilters.test.tsx`, `LeadTable.test.tsx`, `Pagination.test.tsx` |
| MSW | `scenario-leads-list.md`, `scenario-leads-filters.md`, `scenario-leads-pagination.md` |
| a11y | `jest-axe` sur la page complète |
| E2E | `e2e/leads.spec.ts` — filtrer, paginer, exporter |
