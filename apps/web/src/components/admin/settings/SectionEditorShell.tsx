'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import type { ConfigMeta, Section } from '@/lib/admin-config/types';
import { SectionHistory } from './SectionHistory';

interface SectionEditorShellProps {
  section: Section;
  title: string;
  description: string;
  meta: ConfigMeta;
  dirty: boolean;
  saving?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  onSave: () => void;
  onReset?: () => void;
  currentPayload?: unknown;
  children: ReactNode;
}

export function SectionEditorShell({
  section,
  title,
  description,
  meta,
  dirty,
  saving,
  errorMessage,
  successMessage,
  onSave,
  onReset,
  currentPayload,
  children,
}: SectionEditorShellProps) {
  // Confirm before navigating away if dirty
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const [tab, setTab] = useState<'edit' | 'history'>('edit');

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-6 mb-8 border-b border-stone-200 bg-stone-50/95 px-6 pb-4 pt-6 backdrop-blur lg:-mx-10 lg:px-10">
        <nav aria-label="Fil d'ariane" className="text-xs text-stone-500">
          <Link href="/admin/settings" className="underline-offset-2 hover:underline">
            Réglages
          </Link>{' '}
          / <span className="text-stone-700">{title}</span>
        </nav>
        <header className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-stone-900">
              {title}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  meta.isDefault
                    ? 'bg-stone-100 text-stone-600'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {meta.isDefault ? 'Valeur défaut' : `v${meta.version}`}
              </span>
            </h1>
            <p className="mt-1 text-sm text-stone-600">{description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onReset ? (
              <button
                type="button"
                onClick={onReset}
                disabled={!dirty || saving}
                className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:bg-stone-50 disabled:opacity-40"
              >
                Annuler
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || saving}
              className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-40"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </header>
        <div role="tablist" aria-label={`Onglets ${title}`} className="mt-4 flex gap-1">
          {(['edit', 'history'] as const).map((key) => {
            const isActive = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(key)}
                className={`rounded-md px-3 py-1 text-sm transition ${
                  isActive
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                {key === 'edit' ? 'Édition' : 'Historique'}
              </button>
            );
          })}
        </div>
      </div>
      {errorMessage ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {successMessage}
        </div>
      ) : null}
      <div hidden={tab !== 'edit'}>{children}</div>
      <div hidden={tab !== 'history'}>
        {tab === 'history' ? (
          <SectionHistory section={section} currentPayload={currentPayload ?? null} />
        ) : null}
      </div>
    </div>
  );
}
