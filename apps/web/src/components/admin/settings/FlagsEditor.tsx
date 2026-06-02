'use client';

import { useMemo, useState } from 'react';
import type { ConfigMeta, FlagsConfig } from '@/lib/admin-config/types';
import { flagsSchema } from '@/lib/admin-config/schemas';
import { SectionEditorShell } from './SectionEditorShell';

interface FlagsEditorProps {
  initialFlags: Record<string, boolean>;
  meta: ConfigMeta;
}

const FLAG_DESCRIPTIONS: Record<string, string> = {
  newComposer: 'Nouvel éditeur de composants (alpha).',
  betaSeo: 'Linter SEO en bêta avec scoring.',
  productsCmsEnabled: "Active la gestion du catalogue produits dans l'admin.",
  appConfigUiEnabled: 'Affiche /admin/settings (cette page).',
  freeShipping:
    'Livraison offerte sur toutes les villes (les prix catalogue sont barrés à l’affichage). Désactiver pour facturer la livraison.',
  menuHintEnabled:
    'Affiche l’indice animé « ↑ Voir le pack ci-dessous » près du menu (header), après 8 s. Désactivé par défaut : il chevauchait la barre promo sticky sur mobile.',
};

export function FlagsEditor({ initialFlags, meta }: FlagsEditorProps) {
  const [flags, setFlags] = useState<Record<string, boolean>>({ ...initialFlags });
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [version, setVersion] = useState(meta.version);

  const dirty = useMemo(
    () => JSON.stringify(flags) !== JSON.stringify(initialFlags),
    [flags, initialFlags],
  );

  const visible = useMemo(
    () =>
      Object.entries(flags)
        .filter(([k]) => k.toLowerCase().includes(filter.toLowerCase()))
        .sort(([a], [b]) => a.localeCompare(b)),
    [flags, filter],
  );

  async function handleSave() {
    setError(null);
    setSuccess(null);
    const payload: FlagsConfig = { flags };
    const parsed = flagsSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Validation en échec.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/flags', {
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
      if (!res.ok) {
        setError('Erreur serveur.');
        return;
      }
      const data = await res.json();
      setSuccess('Flags enregistrés.');
      if (typeof data?.meta?.version === 'number') setVersion(data.meta.version);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionEditorShell
      section="flags"
      title="Feature Flags"
      description="Active ou désactive des fonctionnalités. Les changements sont effectifs après refresh."
      meta={{ ...meta, version }}
      dirty={dirty}
      saving={saving}
      errorMessage={error}
      successMessage={success}
      onSave={handleSave}
      onReset={() => setFlags({ ...initialFlags })}
      currentPayload={{ flags }}
    >
      <div className="mb-3 flex items-center justify-between">
        <input
          type="search"
          placeholder="Filtrer un flag…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-64 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm"
          aria-label="Filtrer les flags"
        />
        <p className="text-xs text-stone-500">
          {visible.length} sur {Object.keys(flags).length} flags
        </p>
      </div>
      <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
        {visible.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-stone-500">
            Aucun flag ne correspond.
          </li>
        ) : (
          visible.map(([key, value]) => (
            <li key={key} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium text-stone-900">{key}</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {FLAG_DESCRIPTIONS[key] ?? 'Flag personnalisé.'}
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) =>
                    setFlags((f) => ({ ...f, [key]: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-stone-300"
                />
                <span className="font-medium text-stone-700">
                  {value ? 'Activé' : 'Désactivé'}
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
    </SectionEditorShell>
  );
}
