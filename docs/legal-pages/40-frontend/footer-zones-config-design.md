# 40.4 — Config zones : design de la matrice

## Page `/admin/legal/placements`

Vue tableau bidirectionnel **pages × zones**, drag-and-drop pour réordonner.

## Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Pages légales › Affichage                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                  Footer        Cookies   Checkout   Compte          │
│                  ┌──────┬──┐   ┌──┐      ┌──┐       ┌──┐            │
│                  │ Main │BB│   │  │      │  │       │  │            │
│  ┌────────────┐  ├──────┼──┤   ├──┤      ├──┤       ├──┤            │
│  │ Mentions   │  │  ✓1  │✓1│   │  │      │  │       │  │            │
│  │ légales    │  │      │  │   │  │      │  │       │  │            │
│  ├────────────┤  ├──────┼──┤   ├──┤      ├──┤       ├──┤            │
│  │ CGV        │  │  ✓2  │✓2│   │  │      │ ✓ │     │ ✓ │            │
│  ├────────────┤  ├──────┼──┤   ├──┤      ├──┤       ├──┤            │
│  │ Conf.      │  │  ✓3  │  │   │ ✓ │     │ ✓ │     │  │            │
│  ├────────────┤  ├──────┼──┤   ├──┤      ├──┤       ├──┤            │
│  │ Cookies    │  │  ✓4  │  │   │ ✓ │     │  │      │  │            │
│  ├────────────┤  ├──────┼──┤   ├──┤      ├──┤       ├──┤            │
│  │ Retours    │  │  ✓5  │  │   │  │      │ ✓ │     │ ✓ │            │
│  └────────────┘  └──────┴──┘   └──┘      └──┘       └──┘            │
│                                                                     │
│  Légende : ✓N = activé, position N · drag pour réordonner          │
└─────────────────────────────────────────────────────────────────────┘
```

## Composant : `LegalPlacementsMatrix`

```tsx
<LegalPlacementsMatrix
  pages={pages}              // Pages publiées
  zones={zones}              // Zones du site
  placements={placements}    // Mappings existants
  onTogglePlacement={(pageId, zoneId) => mutatePlacement(...)}
  onReorder={(zoneId, newOrder: string[]) => mutateOrder(...)}
/>
```

## États visuels

| État | Représentation |
|---|---|
| Placement actif | Checkbox cochée + badge position (✓3) |
| Placement inactif | Cellule vide cliquable |
| Page non-published | Checkbox grisée, tooltip "Page non publiée" |
| Zone disabled | Colonne grisée avec banner "Désactivée globalement" |
| Saving | Spinner sur la cellule |
| Error | Cellule rouge + tooltip avec raison |

## Drag-and-drop : réordonner

Library : **@dnd-kit/sortable**.

```tsx
<DndContext onDragEnd={handleDragEnd}>
  <SortableContext items={placementsByZone[zone.id].map(p => p.id)}>
    {placementsByZone[zone.id].map((p, idx) => (
      <SortableItem key={p.id} id={p.id}>
        <PlacementChip page={p} index={idx + 1} />
      </SortableItem>
    ))}
  </SortableContext>
</DndContext>
```

## Validation : règles métier

| Règle | Mécanisme |
|---|---|
| Toute page `published` avec `requires_consent_link === true` DOIT être dans `cookie-banner-links` OU `footer-main` | Warning UI : "Cette page est légalement requise dans le banner cookies" |
| Au moins 1 page `mentions-legales` doit exister dans `footer-bottom-bar` | Health check : warning si non respecté |
| Pas plus de 5 liens dans `footer-bottom-bar` (ergonomie mobile) | Limite UI : refuse l'ajout du 6e |

## Vue alternative : par zone

Onglet "Par zone" :

```
Footer Main
├─ ✓ Mentions légales        [↕]
├─ ✓ CGV                     [↕]
├─ ✓ Politique conf.         [↕]
├─ ✓ Cookies                 [↕]
└─ ✓ Retours & rembours.     [↕]

[+ Ajouter une page]
```

Plus pratique pour réordonner. Drag-and-drop linéaire.

## Mobile

Vue matrice désactivée. Affichage liste :

```
Footer Main (5 liens)         [Modifier]
├─ Mentions légales · 1
├─ CGV · 2
└─ …

Footer Bottom Bar (2 liens)   [Modifier]
├─ Mentions légales · 1
└─ CGV · 2
```

Click "Modifier" → page dédiée par zone.

## Health check intégré

En haut de la page, banner si problème :

```
⚠ Attention :
   – La page "Politique cookies" n'est pas liée au banner cookies (zone "cookie-banner-links")
   – La zone "footer-bottom-bar" a 6 liens, recommandé ≤5
   [Corriger automatiquement]
```

## API utilisée

```typescript
GET  /api/admin/legal/zones
GET  /api/admin/legal/placements
POST /api/admin/legal/placements           # créer
PATCH /api/admin/legal/placements/{id}     # toggle active
PUT  /api/admin/legal/placements/order     # réordonner batch
```

## Préview en direct

Bouton "Aperçu footer" → modale avec aperçu du footer rendu (avec les changements en cours non sauvegardés).
