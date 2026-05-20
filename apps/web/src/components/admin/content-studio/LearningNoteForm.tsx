'use client';

import { useState } from 'react';
import type { ContentLearningNote } from '@/lib/content-studio/types';
import { SectionTitle } from './SectionTitle';
import { postJson } from './api';
import type { RunFunction } from './types';

export function LearningNoteForm({
  postId,
  disabled,
  onCreated,
  run,
}: {
  postId: string | null;
  disabled: boolean;
  onCreated: (note: ContentLearningNote) => void;
  run: RunFunction;
}) {
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('');

  return (
    <form
      className="rounded-md border border-indigo-100 bg-indigo-50/40 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const tagList = tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        run(
          async () =>
            postJson<{ note: ContentLearningNote }>('/api/admin/content-studio/learning-notes', {
              postId: postId ?? null,
              note,
              tags: tagList.length > 0 ? tagList : undefined,
            }),
          (value) => {
            setNote('');
            setTags('');
            onCreated(value.note);
          },
        );
      }}
    >
      <SectionTitle
        eyebrow="Apprentissage"
        title="Note d'apprentissage"
        tone="indigo"
        description="Capitaliser sur les retours post-publication."
      />
      <label className="mt-3 block text-sm">
        <span className="text-xs uppercase tracking-wide text-stone-500">Observation</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
          placeholder="Ce qui a bien fonctionné, ou ce qu'il faut améliorer…"
        />
      </label>
      <label className="mt-2 block text-sm">
        <span className="text-xs uppercase tracking-wide text-stone-500">Tags (séparés par des virgules)</span>
        <input
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
          placeholder="hook, visuel, engagement"
        />
      </label>
      <button
        type="submit"
        disabled={disabled || note.trim().length < 1}
        className="mt-2 rounded-md bg-indigo-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Ajouter la note
      </button>
    </form>
  );
}