'use client';

import { useState } from 'react';
import type { ContentBrief } from '@/lib/content-studio/types';
import type { RunFunction } from './types';
import { SectionTitle } from './SectionTitle';
import { patchJson } from './api';

const EDITABLE_STATUSES = new Set(['generated', 'needs_review', 'rejected']);

export function BriefEditor({
  brief,
  draftStatus,
  disabled,
  run,
  onUpdate,
}: {
  brief: ContentBrief;
  draftStatus: string;
  disabled: boolean;
  run: RunFunction;
  onUpdate: (brief: ContentBrief) => void;
}) {
  const [angle, setAngle] = useState(brief.angle);
  const [proof, setProof] = useState(brief.proof ?? '');
  const [cta, setCta] = useState(brief.cta);
  const [mediaDirection, setMediaDirection] = useState(brief.mediaDirection ?? '');
  const [expanded, setExpanded] = useState(false);

  const editable = EDITABLE_STATUSES.has(draftStatus);

  if (!expanded) {
    return (
      <div className="rounded-md border border-stone-200 bg-white p-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm font-medium text-stone-700 hover:text-stone-900"
        >
          Brief éditorial <span className="text-xs text-stone-500">(v{brief.version})</span>
        </button>
        <p className="mt-1 text-xs text-stone-500">
          {brief.angle} — {brief.cta}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-stone-200 bg-white p-4 shadow-sm shadow-stone-950/5">
      <SectionTitle
        eyebrow="Brief"
        title="Direction éditoriale"
        tone="stone"
        description="Modifier l'angle et les consignes avant régénération."
      />
      <div className="mt-3 grid gap-3">
        <label className="block text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-500">Angle</span>
          <textarea
            value={angle}
            onChange={(event) => setAngle(event.target.value)}
            rows={2}
            disabled={!editable || disabled}
            className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm disabled:opacity-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-500">Preuve / Justification</span>
          <textarea
            value={proof}
            onChange={(event) => setProof(event.target.value)}
            rows={2}
            disabled={!editable || disabled}
            className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm disabled:opacity-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-500">CTA</span>
          <input
            type="text"
            value={cta}
            onChange={(event) => setCta(event.target.value)}
            disabled={!editable || disabled}
            className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm disabled:opacity-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-500">Direction média</span>
          <textarea
            value={mediaDirection}
            onChange={(event) => setMediaDirection(event.target.value)}
            rows={2}
            disabled={!editable || disabled}
            className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm disabled:opacity-50"
          />
        </label>
      </div>
      {editable && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              run(
                async () =>
                  patchJson<{ brief: ContentBrief }>(
                    `/api/admin/content-studio/briefs/${brief.id}`,
                    {
                      angle: angle || undefined,
                      proof: proof || undefined,
                      cta: cta || undefined,
                      mediaDirection: mediaDirection || undefined,
                    },
                  ),
                (value) => {
                  onUpdate(value.brief);
                },
              );
            }}
            className="rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Sauvegarder le brief
          </button>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700"
          >
            Fermer
          </button>
        </div>
      )}
      {!editable && (
        <p className="mt-2 text-xs text-amber-700">
          Le brief est en lecture seule car le brouillon est au statut « {draftStatus} ».
        </p>
      )}
    </div>
  );
}