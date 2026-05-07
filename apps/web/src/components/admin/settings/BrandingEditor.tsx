'use client';

import { useMemo, useState } from 'react';
import type { BrandingConfig, ConfigMeta } from '@/lib/admin-config/types';
import { brandingSchema, FONT_WHITELIST } from '@/lib/admin-config/schemas';
import { SectionEditorShell } from './SectionEditorShell';

interface BrandingEditorProps {
  initialBranding: BrandingConfig;
  meta: ConfigMeta;
}

const COLOR_FIELDS = [
  { key: 'primary' as const, label: 'Primaire' },
  { key: 'accent' as const, label: 'Accent' },
  { key: 'bg' as const, label: 'Fond' },
  { key: 'text' as const, label: 'Texte' },
];

// WCAG luminance + contrast ratio
function relLum(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const raw = m[1] ?? '000000';
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const fn = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * fn(r) + 0.7152 * fn(g) + 0.0722 * fn(b);
}

function contrast(a: string, b: string): number {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function BrandingEditor({ initialBranding, meta }: BrandingEditorProps) {
  const [branding, setBranding] = useState<BrandingConfig>(() =>
    JSON.parse(JSON.stringify(initialBranding)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [version, setVersion] = useState(meta.version);

  const dirty = useMemo(
    () => JSON.stringify(branding) !== JSON.stringify(initialBranding),
    [branding, initialBranding],
  );

  const ratio = useMemo(
    () => contrast(branding.colors.text, branding.colors.bg),
    [branding.colors.text, branding.colors.bg],
  );
  const ratioWarn = ratio < 4.5;

  async function handleSave() {
    setError(null);
    setSuccess(null);
    const parsed = brandingSchema.safeParse(branding);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Validation en échec.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/branding', {
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
      setSuccess('Branding enregistré.');
      if (typeof data?.meta?.version === 'number') setVersion(data.meta.version);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionEditorShell
      section="branding"
      title="Branding"
      description="Couleurs, polices et logo. Le contraste texte/fond doit être >= 4.5 (WCAG AA)."
      meta={{ ...meta, version }}
      dirty={dirty}
      saving={saving}
      errorMessage={error}
      successMessage={success}
      onSave={handleSave}
      onReset={() => setBranding(JSON.parse(JSON.stringify(initialBranding)))}
      currentPayload={branding}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Couleurs
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {COLOR_FIELDS.map((field) => (
              <label key={field.key} className="flex flex-col gap-1 text-sm">
                <span className="text-stone-700">{field.label}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={branding.colors[field.key]}
                    onChange={(e) =>
                      setBranding((b) => ({
                        ...b,
                        colors: { ...b.colors, [field.key]: e.target.value },
                      }))
                    }
                    className="h-9 w-12 rounded border border-stone-200"
                    aria-label={`Couleur ${field.label}`}
                  />
                  <input
                    type="text"
                    value={branding.colors[field.key]}
                    onChange={(e) =>
                      setBranding((b) => ({
                        ...b,
                        colors: { ...b.colors, [field.key]: e.target.value },
                      }))
                    }
                    className="w-28 rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-xs"
                  />
                </span>
              </label>
            ))}
          </div>
          <p
            className={`mt-3 text-xs ${ratioWarn ? 'text-red-700' : 'text-stone-500'}`}
            role="status"
          >
            Contraste texte/fond : {ratio.toFixed(2)}{' '}
            {ratioWarn ? '· < 4.5 (WCAG AA non atteint)' : '· OK'}
          </p>
        </div>

        <div className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Polices
          </h2>
          <div className="mt-3 grid gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-stone-700">Titres</span>
              <select
                value={branding.fonts.heading}
                onChange={(e) =>
                  setBranding((b) => ({
                    ...b,
                    fonts: { ...b.fonts, heading: e.target.value as (typeof FONT_WHITELIST)[number] },
                  }))
                }
                className="rounded-md border border-stone-200 bg-white px-2 py-1"
              >
                {FONT_WHITELIST.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-stone-700">Corps</span>
              <select
                value={branding.fonts.body}
                onChange={(e) =>
                  setBranding((b) => ({
                    ...b,
                    fonts: { ...b.fonts, body: e.target.value as (typeof FONT_WHITELIST)[number] },
                  }))
                }
                className="rounded-md border border-stone-200 bg-white px-2 py-1"
              >
                {FONT_WHITELIST.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-stone-700">ID média logo (optionnel)</span>
              <input
                type="text"
                value={branding.logoMediaId ?? ''}
                placeholder="med_..."
                onChange={(e) =>
                  setBranding((b) => ({
                    ...b,
                    logoMediaId: e.target.value === '' ? null : e.target.value,
                  }))
                }
                className="rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-xs"
              />
            </label>
          </div>
        </div>
      </div>

      <div
        className="mt-6 rounded-md border p-6"
        style={{
          backgroundColor: branding.colors.bg,
          color: branding.colors.text,
          borderColor: branding.colors.accent,
        }}
        aria-label="Aperçu branding"
      >
        <p
          className="text-xl font-semibold"
          style={{ fontFamily: branding.fonts.heading }}
        >
          Aperçu — Titre
        </p>
        <p className="mt-2 text-sm" style={{ fontFamily: branding.fonts.body }}>
          Le quick brown fox saute par-dessus le chien paresseux.
        </p>
        <button
          type="button"
          className="mt-4 rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ backgroundColor: branding.colors.primary, color: branding.colors.bg }}
        >
          Bouton primaire
        </button>
      </div>
    </SectionEditorShell>
  );
}
