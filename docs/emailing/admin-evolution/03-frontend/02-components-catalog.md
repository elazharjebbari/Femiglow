# Components catalog

> Inventaire détaillé des composants à créer. Spec props + état + tests
> RTL associés.

---

## Cockpit transactional (M5.1)

### `<CommandPalette />`

```typescript
type Props = {
  scope: 'transactional' | 'audiences' | 'automation';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters?: (filters: ParsedFilters) => void;
  onSaveView?: (name: string) => void;
  onAction?: (action: 'retry' | 'export' | 'suppress', payload?: unknown) => void;
};
```
Underlying : `cmdk` lib. Sections : Filters, Saved views, Actions.
- Test RTL : ouverture (⌘K), typing, autocomplete, Enter applies, Esc closes
- Test : URL-sync après apply
- Spec UX : [04-ui-ux/01-wizard-spec-master.md §1.3](../04-ui-ux/01-wizard-spec-master.md#13-cmd-k-palette--détail)

### `<KpiHeader />`

```typescript
type Props = {
  scope: 'transactional';
  window: '1h' | '24h' | '7d';
};
```
Self-fetching via React Query, refresh 5s.
Affiche 4 KPI + sparklines + tendance vs J-1.
- Test : initial render, refresh interval, alerte si failed > seuil
- Test : tendances correctes vs mock data J-1

### `<SavedViewsSidebar />`

```typescript
type Props = {
  scope: 'transactional' | ...;
  activeViewId: string | null;
  onSelectView: (viewId: string) => void;
  onCreateView: () => void;
};
```
- Fetch system + my views via React Query
- Action menu hover : Rename, Delete
- Test : list, select, create, delete

### `<FilteredTable />`

```typescript
type Props = {
  filters: ParsedFilters;
  sort: SortKey;
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onRowClick: (id: string) => void;
};
```
Pagination cursor-based. Sticky header. 
- Skeleton loading, empty state, error state
- Test : render rows, sort change, select all, shift-click range

### `<BulkActionsBar />`

```typescript
type Props = {
  selectedCount: number;
  actions: { id: string; label: string; danger?: boolean }[];
  onAction: (id: string) => void;
  onClear: () => void;
};
```
- Test : visible si selectedCount > 0
- Confirmation modal sur actions destructives

---

## Audiences (M5.3)

### `<AudienceRulesBuilder />`

```typescript
type Props = {
  value: RulesGroup;
  onChange: (rules: RulesGroup) => void;
  onPreview?: () => void;
};
```

Structure interne :
```
<AudienceRulesBuilder>
  <RulesGroupEditor>  (récursive)
    {conditions.map(c => 
      <AudienceRuleEditor /> ou <RulesGroupEditor /> selon kind
    )}
    <AddRuleButton />
    <AddGroupButton />
  </RulesGroupEditor>
</AudienceRulesBuilder>
```

- Test : modif d'une rule met à jour la rules tree
- Test : ajout/suppression d'une rule
- Test : nested groups (AND of ORs)
- Test : validation Zod inline (affiche les erreurs)
- Test : nouvelle rule pré-remplie avec defaults sensés

### `<AudienceRuleEditor />`

Form dynamique selon `rule.kind`. Chaque kind a son sous-component :
```
<RuleEditor.OrderCount />
<RuleEditor.EmailPattern />
<RuleEditor.EmailOpened />
...
```
- Test : un test par sous-component (verify operator + value inputs)

### `<AudiencePreview />`

```typescript
type Props = {
  rules: RulesGroup;
  exclusionFlags: ExclusionFlags;
};
```
- Auto-debounce 800ms après changement de rules
- Affiche count + sample table (10 emails)
- États : idle, loading, success, error, empty
- Test : fetches mocked via MSW, debounce respected
- Test : empty state ("0 match")

### `<AudienceSelector />`

```typescript
type Props = {
  value: { type: 'saved'; id: string } | { type: 'ad-hoc'; rules: RulesGroup };
  onChange: (value) => void;
  showAdHoc?: boolean;        // default true
};
```
Trois modes : sélectionner sauvée / créer nouvelle (modal) / ad-hoc.
- Test : switch entre modes, valid output

### `<AudienceWizard />`

3 steps. Stocké en `useReducer` state.
- Test : navigation steps, validation par step, finalize

---

## Automation (M5.5)

### `<AutomationWizard />`

5 steps. State machine `useReducer` (similar to campaign wizard).
- Test : full happy path
- Test : back/forward preserve state
- Test : validation per step

### `<StepList />`

Affiche la séquence d'étapes (récursive pour les branches).
```typescript
type Props = {
  steps: AutomationStep[];
  onStepUpdate: (idx: number, step: AutomationStep) => void;
  onStepDelete: (idx: number) => void;
  onStepAdd: (afterIdx: number, kind: StepKind) => void;
};
```
- Test : render flat steps
- Test : render with branch (nested)

### `<StepEditor />`

Factory : render le bon form selon `step.kind`.
```
<StepEditor.Wait />
<StepEditor.Send />
<StepEditor.Branch />
<StepEditor.Tag />
<StepEditor.UpdateLead />
<StepEditor.Webhook />
<StepEditor.WaitForEvent />
```
- Test par kind : inputs, validation, output shape

### `<EventCatalogPicker />`

Autocomplete avec catégories.
- Test : filtres par catégorie
- Test : search par nom event
- Test : sélection retourne event_name + params attendus

### `<ConditionBuilder />`

Réutilisable : audiences ET automation branches.
Wrapper de `AudienceRulesBuilder` avec props adaptés au contexte.

### `<FrequencySettings />`

Form : cooldown, quiet hours, daily cap, suppression check.
- Test : toggles, validation cooldown ≥ 60s

---

## Composants partagés

### `<Drawer />`
- Radix Dialog avec custom styling
- Side-from-right, 480px width
- A11y : trap focus, Esc to close
- Test : open/close, focus trap

### `<ConfirmModal />`
```typescript
type Props = {
  open: boolean;
  title: string;
  description: string;
  danger?: boolean;
  requireText?: string;       // ex 'DELETE'
  onConfirm: () => void;
  onCancel: () => void;
};
```
- Test : danger style, requireText match before enable

### `<EmptyState />`
```typescript
type Props = {
  icon: ReactNode;
  title: string;
  description: string;
  cta?: { label: string; onClick: () => void };
};
```
- Test : render, CTA click

### `<ErrorBoundary />`
Class component standard React.
- Test : fallback render on child error
- Test : retry resets state

---

## Conventions communes

### Loading states
- Skeleton si latency > 200ms (use `useDeferred` pattern)
- Spinner inline pour les sub-actions (< 1s)
- Toast persistent pour les jobs longs (snapshot, bulk retry)

### Form validation
- Zod schemas en `lib/types/`
- React Hook Form pour les forms complexes (audience wizard, automation wizard)
- Inline error display ; pas de toast pour validation forms

### Accessibility
- Tous les inputs ont `<label>`
- Boutons icon-only ont `aria-label`
- Focus visible via `:focus-visible`
- Trap focus dans modales + drawers
- Annonce changements via `aria-live` (toast = polite, error = assertive)
