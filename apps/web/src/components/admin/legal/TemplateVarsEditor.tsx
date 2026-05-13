'use client';

import { useEffect, useState } from 'react';

import { useToast } from './Toast';

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
  const { push: toast } = useToast();
  const [rows, setRows] = useState(vars);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [republishingKey, setRepublishingKey] = useState<string | null>(null);
  const [republishResult, setRepublishResult] = useState<
    { key: string; total: number; succeeded: number; failed: number } | null
  >(null);

  // Charge le count usage par var en arrière-plan (1 fetch par key).
  // Optimisable en endpoint bulk si on a beaucoup de vars (V1.1).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const entries = await Promise.all(
        rows.map(async (r) => {
          try {
            const res = await fetch(
              `/api/admin/legal/template-vars/${encodeURIComponent(r.key)}/usage`,
            );
            if (!res.ok) return [r.key, 0] as const;
            const data = (await res.json()) as { count: number };
            return [r.key, data.count] as const;
          } catch {
            return [r.key, 0] as const;
          }
        }),
      );
      if (cancelled) return;
      setUsage(Object.fromEntries(entries));
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      toast('success', `Variable ${key} sauvegardée`);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast('error', `Échec sauvegarde ${key} : ${msg}`);
    } finally {
      setSavingKey(null);
    }
  }

  async function republish(key: string) {
    const count = usage[key] ?? 0;
    if (count === 0) return;
    if (
      !confirm(
        `Republier ${count} page(s) qui utilisent {{${key}}} ? Cette action propage la nouvelle valeur dans toutes les pages publiées.`,
      )
    ) {
      return;
    }
    setRepublishingKey(key);
    setError(null);
    setRepublishResult(null);
    try {
      const res = await fetch('/api/admin/legal/bulk-republish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ varKey: key }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        total: number;
        succeeded: number;
        failed: number;
      };
      setRepublishResult({ key, ...data });
      if (data.failed === 0) {
        toast('success', `${data.succeeded} page(s) republiée(s) pour ${key}`);
      } else {
        toast('error', `${data.failed} page(s) ont échoué (${data.succeeded} OK)`);
      }
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast('error', `Échec republish ${key} : ${msg}`);
    } finally {
      setRepublishingKey(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {republishResult ? (
        <div
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-900"
        >
          ✓ Republish {`{{${republishResult.key}}}`} : {republishResult.succeeded}/
          {republishResult.total} page(s) republiée(s)
          {republishResult.failed > 0 ? `, ${republishResult.failed} échec(s)` : ''}.
        </div>
      ) : null}
      <table className="w-full border-collapse border border-stone-200 bg-white text-sm">
        <thead className="bg-stone-100 text-left text-xs uppercase tracking-wider text-stone-600">
          <tr>
            <th className="border-b border-stone-200 px-3 py-2">Clé</th>
            <th className="border-b border-stone-200 px-3 py-2">Description</th>
            <th className="border-b border-stone-200 px-3 py-2">Valeur</th>
            <th className="border-b border-stone-200 px-3 py-2">Usage</th>
            <th className="border-b border-stone-200 px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <RowEditor
              key={r.key}
              row={r}
              saving={savingKey === r.key}
              usageCount={usage[r.key]}
              republishing={republishingKey === r.key}
              onSave={(v) => void save(r.key, v)}
              onRepublish={() => void republish(r.key)}
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
  usageCount,
  republishing,
  onSave,
  onRepublish,
}: {
  row: VarRow;
  saving: boolean;
  usageCount: number | undefined;
  republishing: boolean;
  onSave: (value: string) => void;
  onRepublish: () => void;
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
        {usageCount === undefined ? (
          <span className="text-xs text-stone-400" aria-label="Chargement usage">
            …
          </span>
        ) : usageCount === 0 ? (
          <span className="text-xs text-stone-400">Aucune page</span>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <span className="text-xs text-stone-700">
              {usageCount} page{usageCount > 1 ? 's' : ''} publiée
              {usageCount > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={onRepublish}
              disabled={republishing}
              className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              title={`Republier les ${usageCount} pages pour propager la nouvelle valeur`}
            >
              {republishing ? '…' : '↻ Republier toutes'}
            </button>
          </div>
        )}
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
