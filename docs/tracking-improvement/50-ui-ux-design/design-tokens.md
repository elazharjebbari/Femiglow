# 50.2 — Design tokens (reuse Tailwind FemiGlow)

## Couleurs

Reuse du design system existant (`tailwind.config.ts`) + statuts tracking-spécifiques.

| Token | Hex | Usage tracking |
|---|---|---|
| `--color-creme` | #FBF8F1 | Background admin pages |
| `--color-encre` | #1a1a1a | Texte body |
| `--color-stone-50` | #fafaf9 | Background cards |
| `--color-stone-200` | #e7e5e4 | Borders cards |
| `--color-stone-700` | #44403c | Texte secondaire |
| `--color-stone-900` | #1c1917 | Bouton primaire |
| `--color-emerald-700` | #047857 | Success states (active version) |
| `--color-emerald-100` | #d1fae5 | Background success badges |
| `--color-amber-700` | #b45309 | Warning states (divergences) |
| `--color-amber-100` | #fef3c7 | Background warning badges |
| `--color-rose-700` | #be123c | Error / destructive |
| `--color-rose-100` | #ffe4e6 | Background error |
| `--color-violet-700` | #6d28d9 | Statut "modifié" / override |
| `--color-violet-100` | #ede9fe | Background override |

## Typographie

| Token | Police | Taille | Usage |
|---|---|---|---|
| `font-display` | Cormorant Garamond | 32-48px | H1 pages admin |
| `font-body` | Inter | 14-16px | Body, forms |
| `font-mono` | system mono | 11-13px | Code, IDs (pixel IDs, UUIDs) |

Tailwind classes utilisées :
- `text-display-md` (page title)
- `text-lg` (section titles, ~18px)
- `text-base` (body)
- `text-sm` (forms, labels)
- `text-xs` (hints, captions)
- `text-[10px] uppercase tracking-wide` (kickers, badges)

## Espacements

| Token | Valeur | Usage |
|---|---|---|
| `space-y-1` | 4px | Items in tight list |
| `space-y-2` | 8px | Form field groups |
| `space-y-4` | 16px | Standard sections |
| `space-y-6` | 24px | Major sections |
| `space-y-8` | 32px | Page sections |

Padding cards : `p-4` (16px) ou `p-5` (20px) pour cartes interactives.

## Border radius

- `rounded-md` (6px) — boutons, inputs, badges
- `rounded-lg` (8px) — cards
- `rounded-full` — avatars, status dots

## Shadows

- `shadow-sm` — cards reposants
- `shadow-md` — cards hover
- `shadow-lg` — modals, dropdowns

## Composants typés

### Status badge

```tsx
function StatusBadge({ status }: { status: 'active' | 'inactive' | 'error' | 'warning' }) {
  const styles = {
    active: 'bg-emerald-100 text-emerald-900',
    inactive: 'bg-stone-100 text-stone-600',
    error: 'bg-rose-100 text-rose-900',
    warning: 'bg-amber-100 text-amber-900',
  }[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles}`}>
      {status}
    </span>
  );
}
```

### Sync indicator

```tsx
function SyncIndicator({ status }: { status: 'in_sync' | 'override' | 'unset' }) {
  if (status === 'in_sync') return <CheckIcon className="text-emerald-600" title="Synchronisé avec Providers" />;
  if (status === 'override') return <PencilIcon className="text-amber-600" title="Override manuel" />;
  return <DashIcon className="text-stone-400" title="Vide" />;
}
```

### Sync field row

```tsx
function SyncFieldRow({ label, value, providerValue, onChange, onSync }) {
  const status = computeSyncStatus(value, providerValue);
  return (
    <div className="flex items-center gap-2">
      <label className="w-32 text-sm text-stone-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-mono"
      />
      <SyncIndicator status={status} />
      {status === 'override' && (
        <button onClick={onSync} className="text-xs text-stone-600 hover:underline">
          Sync
        </button>
      )}
    </div>
  );
}
```

## Animations

| Use case | Tailwind | Durée |
|---|---|---|
| Button click | `active:scale-95` | 100ms |
| Loading skeleton | `animate-pulse` | 1500ms |
| Toast enter | `animate-in fade-in slide-in-from-bottom-2` | 200ms |
| Toast exit | `animate-out fade-out slide-out-to-right` | 150ms |
| Modal | `animate-in fade-in zoom-in-95` | 200ms |
| Page transition | aucune (priorité performance) | — |

Préférer `motion-safe:` pour respecter `prefers-reduced-motion`.
