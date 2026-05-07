'use client';

import { useState } from 'react';
import { GTM_TEMPLATES, type GtmTemplate } from '@/lib/tracking/gtm/templates';
import type { GtmConfigPerEnv } from '@/lib/tracking/gtm/config-schema';
import { GtmFullscreenPreview } from './GtmFullscreenPreview';

interface Props {
  onPick: (perEnv: GtmConfigPerEnv) => void;
}

export function GtmTemplatePicker({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<GtmTemplate | null>(null);

  function apply() {
    if (!selected) return;
    onPick(selected.perEnv);
    setOpen(false);
    setSelected(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-900 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
      >
        Partir d’un template
      </button>

      <GtmFullscreenPreview
        open={open}
        onClose={() => {
          setOpen(false);
          setSelected(null);
        }}
        title="Choisir un template"
      >
        <div className="mx-auto h-full max-w-4xl overflow-auto p-6">
          <h2 className="text-lg font-semibold text-stone-900">Templates de configuration</h2>
          <p className="mt-1 text-sm text-stone-600">
            Pré-remplit les 4 environnements selon un cas d’usage. Tu pourras
            ensuite éditer chaque champ.
          </p>

          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {GTM_TEMPLATES.map((t) => {
              const isActive = selected?.id === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(t)}
                    aria-pressed={isActive}
                    className={`block w-full rounded-md border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                      isActive
                        ? 'border-[#A8C4A6] bg-[#A8C4A6]/15 ring-1 ring-[#A8C4A6]'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-stone-900">{t.name}</span>
                      <span className="text-[10px] uppercase tracking-wide text-stone-500">
                        {t.audience}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-600">{t.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(t.perEnv.production.enabledProviders ?? []).map((p) => (
                        <span
                          key={p}
                          className="rounded-full border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] font-medium text-stone-700"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={apply}
              disabled={!selected}
              className="inline-flex items-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Appliquer le template
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSelected(null);
              }}
              className="text-sm text-stone-600 hover:text-stone-900"
            >
              Annuler
            </button>
            {selected ? (
              <p className="text-xs text-stone-500">
                Le formulaire sera pré-rempli avec « {selected.name} ».
              </p>
            ) : null}
          </div>
        </div>
      </GtmFullscreenPreview>
    </>
  );
}
