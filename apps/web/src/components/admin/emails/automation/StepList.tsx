'use client';

/**
 * StepList — liste ordonnée + insert/delete/move + édition inline via StepEditor.
 *
 * Compact mode used for branch ifTrue/ifFalse panels.
 */
import { useState } from 'react';
import type { AutomationStep, StepKind } from '@/lib/mail/automation/step-types-v2';
import { STEP_KINDS, defaultStep, stepLabel } from './step-defaults';
import { StepEditor } from './StepEditor';

export type StepListProps = {
  steps: AutomationStep[];
  onChange: (next: AutomationStep[]) => void;
  eventsCatalog?: Array<{ name: string; category: string; description: string }>;
  depth?: number;
  allowBranch?: boolean;
  compact?: boolean;
};

export function StepList({
  steps,
  onChange,
  eventsCatalog = [],
  depth = 0,
  allowBranch = true,
  compact = false,
}: StepListProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const update = (i: number, s: AutomationStep) => {
    const next = [...steps];
    next[i] = s;
    onChange(next);
  };
  const remove = (i: number) => {
    onChange(steps.filter((_, k) => k !== i));
    if (openIdx === i) setOpenIdx(null);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const add = (kind: StepKind) => {
    onChange([...steps, defaultStep(kind)]);
    setShowAddMenu(false);
    setOpenIdx(steps.length);
  };

  return (
    <div className="space-y-2">
      {steps.length === 0 && (
        <p className="rounded border border-dashed border-stone-300 bg-stone-50 p-3 text-center text-xs text-stone-500">
          Aucune étape. Ajoutez-en une ci-dessous.
        </p>
      )}
      {steps.map((step, i) => (
        <div
          key={i}
          className="rounded border border-stone-200 bg-white"
          data-testid={`step-${i}`}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-xs text-stone-400">#{i + 1}</span>
            <button
              type="button"
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="flex-1 text-left text-sm text-stone-700 hover:text-stone-900"
            >
              {stepLabel(step)}
            </button>
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="text-xs text-stone-400 hover:text-stone-700 disabled:opacity-30"
              aria-label="Monter"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === steps.length - 1}
              className="text-xs text-stone-400 hover:text-stone-700 disabled:opacity-30"
              aria-label="Descendre"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-xs text-red-500 hover:text-red-700"
              aria-label="Supprimer"
            >
              ✕
            </button>
          </div>
          {openIdx === i && (
            <div className={`border-t border-stone-100 ${compact ? 'p-3' : 'p-4'}`}>
              <StepEditor
                value={step}
                onChange={(s) => update(i, s)}
                eventsCatalog={eventsCatalog}
                depth={depth}
              />
            </div>
          )}
        </div>
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowAddMenu((s) => !s)}
          className="w-full rounded border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
          data-testid="add-step-btn"
        >
          + Ajouter une étape
        </button>
        {showAddMenu && (
          <div className="absolute left-0 right-0 z-10 mt-1 rounded border border-stone-200 bg-white shadow-md">
            {STEP_KINDS.filter((k) => allowBranch || k.kind !== 'branch').map((k) => (
              <button
                key={k.kind}
                type="button"
                onClick={() => add(k.kind)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
              >
                <span>{k.icon}</span>
                <span>{k.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
