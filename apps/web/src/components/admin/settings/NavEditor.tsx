'use client';

import { useMemo, useReducer, useState } from 'react';
import type { ConfigMeta, NavConfig, NavItem } from '@/lib/admin-config/types';
import { navSchema } from '@/lib/admin-config/schemas';
import { SectionEditorShell } from './SectionEditorShell';

interface NavEditorProps {
  initialItems: NavItem[];
  meta: ConfigMeta;
}

type RowError = { path: (string | number)[]; message: string };

type Action =
  | { type: 'add' }
  | { type: 'update'; index: number; patch: Partial<NavItem> }
  | { type: 'remove'; index: number }
  | { type: 'move'; index: number; direction: -1 | 1 }
  | { type: 'reset'; items: NavItem[] }
  | { type: 'set-errors'; errors: RowError[] };

interface State {
  items: NavItem[];
  errors: RowError[];
}

function normalizePositions(items: NavItem[]): NavItem[] {
  return items.map((it, i) => ({ ...it, position: i }));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const next: NavItem = {
        key: `item-${state.items.length + 1}`,
        label: 'Nouvel item',
        href: '/admin/nouveau',
        icon: 'box',
        position: state.items.length,
      };
      return { items: [...state.items, next], errors: state.errors };
    }
    case 'update': {
      const items = state.items.map((it, i) =>
        i === action.index ? { ...it, ...action.patch } : it,
      );
      return { items, errors: state.errors };
    }
    case 'remove': {
      const items = normalizePositions(state.items.filter((_, i) => i !== action.index));
      return { items, errors: state.errors };
    }
    case 'move': {
      const target = action.index + action.direction;
      if (target < 0 || target >= state.items.length) return state;
      const items = state.items.slice();
      const a = items[action.index];
      const b = items[target];
      if (!a || !b) return state;
      items[action.index] = b;
      items[target] = a;
      return { items: normalizePositions(items), errors: state.errors };
    }
    case 'reset':
      return { items: action.items, errors: [] };
    case 'set-errors':
      return { ...state, errors: action.errors };
    default:
      return state;
  }
}

const ROLE_OPTIONS = ['—', 'editor', 'admin', 'superadmin'] as const;

export function NavEditor({ initialItems, meta }: NavEditorProps) {
  const [state, dispatch] = useReducer(reducer, { items: initialItems, errors: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [version, setVersion] = useState(meta.version);

  const dirty = useMemo(
    () => JSON.stringify(state.items) !== JSON.stringify(initialItems),
    [state.items, initialItems],
  );

  const errorByRow = useMemo(() => {
    const map: Record<number, RowError[]> = {};
    for (const err of state.errors) {
      const idx = typeof err.path[1] === 'number' ? (err.path[1] as number) : -1;
      if (idx < 0) continue;
      map[idx] = map[idx] ?? [];
      map[idx].push(err);
    }
    return map;
  }, [state.errors]);

  function fieldError(rowIndex: number, field: keyof NavItem): string | null {
    const errs = errorByRow[rowIndex] ?? [];
    const e = errs.find((r) => r.path[2] === field);
    return e ? e.message : null;
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    const payload: NavConfig = { items: normalizePositions(state.items) };
    const parsed = navSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: RowError[] = parsed.error.issues.map((iss) => ({
        path: iss.path.slice(),
        message: iss.message,
      }));
      dispatch({ type: 'set-errors', errors });
      setError(`${parsed.error.issues.length} erreur(s) à corriger.`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/nav', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': String(version),
        },
        body: JSON.stringify({ payload: parsed.data }),
      });
      if (res.status === 409) {
        setError('Une autre modification a été enregistrée. Recharge la page.');
        return;
      }
      if (res.status === 422) {
        const data = await res.json();
        setError('Validation serveur en échec.');
        const issues = (data?.error?.details ?? []) as Array<{
          path: (string | number)[];
          message: string;
        }>;
        dispatch({
          type: 'set-errors',
          errors: issues.map((i) => ({ path: i.path, message: i.message })),
        });
        return;
      }
      if (!res.ok) {
        setError('Erreur serveur.');
        return;
      }
      const data = await res.json();
      setSuccess('Navigation enregistrée.');
      dispatch({ type: 'set-errors', errors: [] });
      if (typeof data?.meta?.version === 'number') setVersion(data.meta.version);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionEditorShell
      section="nav"
      title="Navigation"
      description="Items affichés dans la sidebar admin (libellés, icônes, ordre)."
      meta={{ ...meta, version }}
      dirty={dirty}
      saving={saving}
      errorMessage={error}
      successMessage={success}
      onSave={handleSave}
      onReset={() => dispatch({ type: 'reset', items: initialItems })}
      currentPayload={{ items: state.items }}
    >
      <div className="overflow-hidden rounded-md border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm" role="grid">
          <thead className="bg-stone-50">
            <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Href</th>
              <th className="px-3 py-2">Icon</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {state.items.map((item, index) => (
              <tr key={`${item.key}-${index}`} role="row">
                <td className="w-12 px-3 py-2 text-stone-500">{index + 1}</td>
                <Cell error={fieldError(index, 'key')}>
                  <input
                    type="text"
                    value={item.key}
                    onChange={(e) =>
                      dispatch({ type: 'update', index, patch: { key: e.target.value } })
                    }
                    aria-invalid={!!fieldError(index, 'key')}
                    className="w-full rounded border border-stone-200 bg-white px-2 py-1"
                  />
                </Cell>
                <Cell error={fieldError(index, 'label')}>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) =>
                      dispatch({ type: 'update', index, patch: { label: e.target.value } })
                    }
                    aria-invalid={!!fieldError(index, 'label')}
                    className="w-full rounded border border-stone-200 bg-white px-2 py-1"
                  />
                </Cell>
                <Cell error={fieldError(index, 'href')}>
                  <input
                    type="text"
                    value={item.href}
                    onChange={(e) =>
                      dispatch({ type: 'update', index, patch: { href: e.target.value } })
                    }
                    aria-invalid={!!fieldError(index, 'href')}
                    className="w-full rounded border border-stone-200 bg-white px-2 py-1"
                  />
                </Cell>
                <Cell error={fieldError(index, 'icon')}>
                  <input
                    type="text"
                    value={item.icon}
                    onChange={(e) =>
                      dispatch({ type: 'update', index, patch: { icon: e.target.value } })
                    }
                    aria-invalid={!!fieldError(index, 'icon')}
                    className="w-full rounded border border-stone-200 bg-white px-2 py-1"
                  />
                </Cell>
                <td className="px-3 py-2">
                  <select
                    value={item.requiresRole ?? '—'}
                    onChange={(e) => {
                      const v = e.target.value;
                      dispatch({
                        type: 'update',
                        index,
                        patch: {
                          requiresRole:
                            v === '—'
                              ? undefined
                              : (v as NonNullable<NavItem['requiresRole']>),
                        },
                      });
                    }}
                    className="w-full rounded border border-stone-200 bg-white px-2 py-1"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'move', index, direction: -1 })}
                      disabled={index === 0}
                      aria-label="Monter"
                      className="rounded border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'move', index, direction: 1 })}
                      disabled={index === state.items.length - 1}
                      aria-label="Descendre"
                      className="rounded border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50 disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'remove', index })}
                      aria-label={`Supprimer ${item.label}`}
                      className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                    >
                      Suppr.
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => dispatch({ type: 'add' })}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-50"
        >
          + Ajouter un item
        </button>
        <p className="text-xs text-stone-500">{state.items.length} items</p>
      </div>
      {state.errors.length > 0 ? (
        <ul className="mt-4 list-disc rounded-md border border-red-200 bg-red-50 px-6 py-3 text-sm text-red-800">
          {state.errors.slice(0, 8).map((err, i) => (
            <li key={`${err.path.join('.')}-${i}`}>
              <strong>{err.path.join('.')}</strong> : {err.message}
            </li>
          ))}
        </ul>
      ) : null}
    </SectionEditorShell>
  );
}

function Cell({
  children,
  error,
}: {
  children: React.ReactNode;
  error: string | null;
}) {
  return (
    <td className="px-3 py-2">
      <div className={error ? 'rounded ring-1 ring-red-300' : ''}>{children}</div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </td>
  );
}
