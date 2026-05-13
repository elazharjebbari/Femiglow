'use client';

import { useState } from 'react';

interface VarRow {
  key: string;
  label: string;
  description: string | null;
  value: string | null;
  isRequired: boolean;
  sensitive: boolean;
}

interface Props {
  vars: VarRow[];
}

export function TemplateVarsEditor({ vars }: Props) {
  const [rows, setRows] = useState(vars);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(key: string, value: string) {
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch('/api/admin/legal/template-vars', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <table className="w-full border-collapse border border-stone-200 bg-white text-sm">
        <thead className="bg-stone-100 text-left text-xs uppercase tracking-wider text-stone-600">
          <tr>
            <th className="border-b border-stone-200 px-3 py-2">Clé</th>
            <th className="border-b border-stone-200 px-3 py-2">Description</th>
            <th className="border-b border-stone-200 px-3 py-2">Valeur</th>
            <th className="border-b border-stone-200 px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <RowEditor
              key={r.key}
              row={r}
              saving={savingKey === r.key}
              onSave={(v) => void save(r.key, v)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowEditor({
  row,
  saving,
  onSave,
}: {
  row: VarRow;
  saving: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(row.value ?? '');
  const dirty = value !== (row.value ?? '');
  const empty = value.trim() === '';
  return (
    <tr className="border-b border-stone-100 align-top">
      <td className="px-3 py-2">
        <code className="font-mono text-xs text-stone-800">{row.key}</code>
        <div className="text-xs text-stone-500">{row.label}</div>
        {row.isRequired ? (
          <span className="mt-0.5 inline-block text-[10px] uppercase tracking-wider text-red-600">
            requis
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-xs text-stone-500">{row.description ?? '—'}</td>
      <td className="px-3 py-2">
        <input
          type={row.sensitive ? 'password' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={row.isRequired ? 'à remplir' : 'optionnel'}
          className={`w-full rounded-md border px-2 py-1 text-sm ${
            row.isRequired && empty ? 'border-red-300 bg-red-50' : 'border-stone-300'
          }`}
        />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => onSave(value)}
          className="rounded-md bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-700 disabled:opacity-40"
        >
          {saving ? '…' : 'Save'}
        </button>
      </td>
    </tr>
  );
}
