# Frontend overview

## Stack
- Next.js 14 (App Router, RSC)
- React 18
- Tailwind CSS
- Zod (validation client/serveur partagée)
- React Query (côté client pour cache / mutations / polling)
- Radix UI (primitives a11y : dialog, dropdown, switch, etc.)
- cmdk (palette command)
- Lucide icons

## Structure

```
apps/web/src/
├── app/admin/emails/
│   ├── page.tsx                                (dashboard, existant)
│   ├── transactional/
│   │   ├── page.tsx                            ⭐ M5.1 refonte
│   │   └── [id]/page.tsx                       (existant, polish M5.6)
│   ├── audiences/                              ⭐ M5.3
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx
│   │   ├── new/page.tsx
│   │   └── snapshots/[id]/page.tsx
│   ├── campaigns/
│   │   ├── page.tsx                            (existant)
│   │   ├── new/page.tsx                        (existant, M5.4 wizard étape 2 refait)
│   │   └── [id]/...                            (existant + audience link)
│   └── automation/                             ⭐ M5.5
│       ├── page.tsx                            (existant, polish)
│       ├── new/page.tsx
│       ├── [id]/edit/page.tsx
│       └── runs/[id]/page.tsx
├── components/admin/emails/
│   ├── cockpit/                                ⭐ M5.1
│   │   ├── KpiHeader.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── SavedViewsSidebar.tsx
│   │   ├── FilteredTable.tsx
│   │   └── BulkActionsBar.tsx
│   ├── audiences/                              ⭐ M5.3
│   │   ├── AudienceRulesBuilder.tsx
│   │   ├── AudienceRuleEditor.tsx
│   │   ├── AudiencePreview.tsx
│   │   ├── AudienceSelector.tsx
│   │   └── AudienceWizard.tsx
│   ├── automation/                             ⭐ M5.5
│   │   ├── AutomationWizard.tsx
│   │   ├── StepEditor.tsx
│   │   ├── StepList.tsx
│   │   ├── EventCatalogPicker.tsx
│   │   ├── ConditionBuilder.tsx
│   │   └── FrequencySettings.tsx
│   └── shared/
│       ├── Drawer.tsx
│       ├── ConfirmModal.tsx
│       ├── EmptyState.tsx
│       └── ErrorBoundary.tsx
└── hooks/
    ├── useOutboxSearch.ts                      ⭐ M5.1
    ├── useAudiencePreview.ts                   ⭐ M5.3
    ├── useAutomationDraft.ts                   ⭐ M5.5
    └── useCmdK.ts                              ⭐ M5.1
```

## Patterns

### Server Components par défaut
Toute page est RSC, fetch SSR. Les composants interactifs (`use client`)
sont des feuilles.

### React Query pour les mutations
```typescript
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: previewAudience,
  onSuccess: () => queryClient.invalidateQueries(['audience-preview']),
});
```

### Optimistic updates
Sur les actions UI rapides (toggle automation, save view), update
optimiste + rollback si erreur :
```typescript
useMutation({
  mutationFn: toggleAutomation,
  onMutate: async ({ id, active }) => {
    await queryClient.cancelQueries(['automations']);
    const prev = queryClient.getQueryData(['automations']);
    queryClient.setQueryData(['automations'], (old) => updateOptimistic(old, id, active));
    return { prev };
  },
  onError: (err, _, ctx) => {
    queryClient.setQueryData(['automations'], ctx?.prev);
    toast.error('Failed');
  },
});
```

### URL-state
Les filtres / sort / view active sont synchronisés dans l'URL (search
params). Permet de partager un lien direct ("voir failed today") et de
restaurer le state au reload.

### Sticky/persistent state
Les saved views custom : DB.
La view active courante : URL (param `?view=failed-today`).
Le filtre courant en cours d'édition : `sessionStorage`.

### Error boundaries
Chaque section (`transactional`, `audiences`, `automation`) wrap dans un
`ErrorBoundary` qui affiche : message + retry + lien support.

## Tests

Voir [11-tests/01-jest-unit/](../11-tests/01-jest-unit/) pour RTL specs
par composant.
