# 40.3 — Routing

## Routes Next.js (App Router)

| Route | Type | Description | Auth |
|---|---|---|---|
| `/admin/tracking/events/mappings` | server | Liste des versions | requireAdmin |
| `/admin/tracking/events/mappings/[id]` | server | Détail (matrice read-only) | requireAdmin |
| `/admin/tracking/events/mappings/[id]/edit` | server | Édition (matrice éditable) | requireAdmin |
| `/admin/tracking/events/mappings/[id]/audit` | server | Timeline historique | requireAdmin |
| `/admin/tracking/events/mappings/compare/[a]/[b]` | server | Diff entre 2 versions | requireAdmin |

## Intégration menu admin tracking

L'entrée menu doit être ajoutée à `AdminShell` ou au sous-menu `/admin/tracking/*`. Position recommandée :

```
/admin/tracking/
├── (overview)
├── gtm                       ← configs pixels/conv labels
├── events
│   ├── (catalog des events)
│   ├── categorization        ← override catégorie Google Ads (existant)
│   └── mappings              ← NOUVEAU module
├── providers
├── inventory
├── logs
├── analytics/providers
└── settings
```

Le placement sous `events/` est logique : c'est une opération sur les events. Sibling de `categorization` qui fait un job similaire (override DB par event).

## Breadcrumbs

```
Console FemiGlow  >  Tracking  >  Events  >  Mappings  >  [v3 — édition Sara]  >  Modifier
```

Chaque segment est cliquable.

## Lien depuis d'autres pages

### Depuis `/admin/tracking/gtm`
- Lien "Mappings GTM ↗" qui mène à `/admin/tracking/events/mappings` (workflow ops : configurer mappings puis exporter pour GTM)

### Depuis `/admin/tracking/events/categorization`
- Lien "Voir les mappings vendors" sous-titre

### Depuis `/admin/tracking/analytics/providers`
- Lien "Modifier les mappings" depuis le tableau (clic sur un provider qui a 0 events → suggère de vérifier les mappings)

## Layout / Sub-layouts

```
app/admin/layout.tsx                    ← admin global
└── app/admin/tracking/layout.tsx       ← header tracking (existe peut-être déjà ?)
    └── app/admin/tracking/events/layout.tsx ← (optionnel) sous-onglets events
        └── mappings/layout.tsx         ← optionnel (vue d'ensemble, retour liste)
```

**Important** (leçon retenue) : éviter le double `<AdminShell>`. Si un layout parent rend déjà `AdminShell`, les enfants ne le re-rendent pas.

## Server components vs Client components

- Toutes les pages `page.tsx` sont **server components** : fetch initial via `mappingStore.list()` directement (pas via /api), pass props au client.
- Les composants interactifs (`MappingVersionsList`, `MappingMatrix`, etc.) sont **client components** ("use client") qui consomment ces props initiales et utilisent SWR pour les revalidations.

Avantage : SEO inutile ici (admin), mais le TTFB est meilleur et l'auth est vérifiée côté serveur en first hop.

## Query params

| Route | Param | Effet |
|---|---|---|
| `/mappings` | `?status=draft,active` | Filtre par status |
| `/mappings` | `?showDeleted=true` | Inclut deleted |
| `/mappings/[id]/edit` | `?event=purchase` | Scroll auto vers cet event dans la matrice |
| `/mappings/compare/[a]/[b]` | `?mode=inline` | Switch diff inline vs side-by-side |

## Navigation programmatique

```typescript
// Après create
router.push(`/admin/tracking/events/mappings/${newId}/edit`);

// Après activate
router.refresh(); // re-fetch server component, reste sur la page

// Après delete
router.push('/admin/tracking/events/mappings');
```
