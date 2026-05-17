'use client';

import { useState } from 'react';
import type {
  ContentDraft,
  ContentFormat,
  ContentIdea,
  ContentObjective,
  ContentPillar,
  ContentPlatform,
} from '@/lib/content-studio/types';
import {
  CONTENT_FORMATS,
  CONTENT_OBJECTIVES,
  CONTENT_PILLARS,
  CONTENT_PLATFORMS,
} from '@/lib/content-studio/types';
import type { RunFunction } from './types';
import { SectionTitle } from './SectionTitle';
import { Select } from './Select';
import { postJson } from './api';

export function IdeaForm({
  disabled,
  onCreate,
  run,
}: {
  disabled: boolean;
  onCreate: (idea: ContentIdea) => void;
  run: RunFunction;
}) {
  const [pillar, setPillar] = useState<ContentPillar>('rituel');
  const [objective, setObjective] = useState<ContentObjective>('consideration');
  const [platform, setPlatform] = useState<ContentPlatform>('instagram');
  const [format, setFormat] = useState<ContentFormat>('post');
  const [prompt, setPrompt] = useState('Présenter le rituel FemiGlow comme un geste lent du soir');

  return (
    <form
      className="rounded-md border border-rose-100 bg-white p-4 shadow-sm shadow-rose-950/5"
      onSubmit={(event) => {
        event.preventDefault();
        run(
          async () =>
            postJson<{ idea: ContentIdea }>('/api/admin/content-studio/ideas', {
              pillar,
              objective,
              platform,
              format,
              prompt,
            }),
          (value) => onCreate(value.idea),
        );
      }}
    >
      <SectionTitle
        eyebrow="Cadrage"
        title="Créer une idée"
        tone="rose"
        description="Définir l'intention avant toute génération."
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Select label="Pilier" value={pillar} values={CONTENT_PILLARS} onChange={setPillar} />
        <Select
          label="Objectif"
          value={objective}
          values={CONTENT_OBJECTIVES}
          onChange={setObjective}
        />
        <Select
          label="Plateforme"
          value={platform}
          values={CONTENT_PLATFORMS}
          onChange={setPlatform}
        />
        <Select label="Format" value={format} values={CONTENT_FORMATS} onChange={setFormat} />
      </div>
      <label className="mt-3 block text-sm">
        <span className="text-xs uppercase tracking-wide text-stone-500">Intention</span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={disabled}
        className="mt-3 rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Enregistrer l&apos;idée
      </button>
    </form>
  );
}