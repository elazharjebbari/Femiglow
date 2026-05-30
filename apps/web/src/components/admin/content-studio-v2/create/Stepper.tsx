'use client';

import { Check } from 'lucide-react';
import type { ContentDraft, ContentStatus } from '@/lib/content-studio/types';
import { MockModeBadge } from './MockModeBadge';

export type StepKey = 'frame' | 'generate' | 'visual' | 'validate';

interface StepperProps {
  /** Optional draft used to derive the active step. */
  draft?: ContentDraft | null;
  /** Whether a media asset is currently bound to the draft. */
  hasMedia?: boolean;
  /** Override the active step (e.g. user scrolled). */
  activeStep?: StepKey;
  onStepClick?: (step: StepKey) => void;
  /** CS v2 Phase 5 — surface the global mock-mode indicator inline. */
  mockMode?: boolean;
}

const STEPS: { key: StepKey; label: string; description: string }[] = [
  { key: 'frame', label: 'Cadrer', description: 'Pilier, objectif, intention' },
  { key: 'generate', label: 'Générer', description: '3 variantes IA' },
  { key: 'visual', label: 'Visuel', description: 'Image ou vidéo' },
  { key: 'validate', label: 'Valider', description: 'Aperçu et publication' },
];

const STATUS_TO_STEP: Record<ContentStatus, StepKey> = {
  idea: 'frame',
  brief: 'generate',
  generated: 'generate',
  needs_review: 'visual',
  approved: 'validate',
  scheduled: 'validate',
  published: 'validate',
  failed: 'validate',
  cancelled: 'validate',
  rejected: 'frame',
  archived: 'frame',
  measured: 'validate',
};

export function deriveActiveStep(
  draft: ContentDraft | null | undefined,
  hasMedia: boolean,
): StepKey {
  if (!draft) return 'frame';
  const base = STATUS_TO_STEP[draft.status] ?? 'frame';
  // If we are on `visual` but already have a non-empty caption + media,
  // we can advance the user toward `validate` visually.
  if (base === 'visual' && hasMedia && draft.caption.trim().length > 0) {
    return 'validate';
  }
  return base;
}

const STEP_ORDER: StepKey[] = STEPS.map((s) => s.key);

export function Stepper({
  draft,
  hasMedia = false,
  activeStep,
  onStepClick,
  mockMode = false,
}: StepperProps) {
  const computed = activeStep ?? deriveActiveStep(draft ?? null, hasMedia);
  const activeIdx = STEP_ORDER.indexOf(computed);

  return (
    <div
      className="cs-stepper-wrapper"
      style={{ position: 'relative' }}
    >
      {mockMode ? (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
          }}
        >
          <MockModeBadge />
        </div>
      ) : null}
      <ol
        className="cs-stepper"
        aria-label="Étapes de création"
        style={{
          display: 'flex',
          gap: 12,
          padding: 14,
          background: 'var(--cs-bg-elevated)',
          border: '1px solid var(--cs-border-hair)',
          borderRadius: 'var(--cs-radius-md)',
          listStyle: 'none',
          margin: 0,
        }}
      >
      {STEPS.map((step, idx) => {
        const isActive = idx === activeIdx;
        const isDone = idx < activeIdx;
        const isFuture = idx > activeIdx;
        const prevLabel = idx > 0 ? STEPS[idx - 1]?.label : undefined;
        const futureTitle = isFuture && prevLabel
          ? `Complétez l'étape « ${prevLabel} » pour continuer`
          : undefined;
        return (
          <li
            key={step.key}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}
          >
            <button
              type="button"
              onClick={() => onStepClick?.(step.key)}
              disabled={isFuture}
              title={futureTitle}
              aria-current={isActive ? 'step' : undefined}
              aria-disabled={isFuture ? 'true' : undefined}
              data-step={step.key}
              data-state={isActive ? 'active' : isDone ? 'done' : 'future'}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: isActive ? 'var(--cs-accent-bg)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--cs-radius-sm)',
                textAlign: 'left',
                cursor: isFuture ? 'not-allowed' : 'pointer',
                opacity: isFuture ? 0.5 : 1,
                color: 'var(--cs-fg-primary)',
                transition: 'background var(--cs-motion-fast) var(--cs-easing)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--cs-font-mono)',
                  fontSize: 12,
                  fontWeight: 600,
                  background: isDone
                    ? 'var(--cs-success)'
                    : isActive
                      ? 'var(--cs-accent)'
                      : 'var(--cs-bg-sunken)',
                  color: isDone || isActive ? 'var(--cs-fg-on-accent)' : 'var(--cs-fg-secondary)',
                  flexShrink: 0,
                }}
              >
                {isDone ? <Check size={14} /> : idx + 1}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: 'var(--cs-font-display)',
                    fontSize: 'var(--cs-text-sm)',
                    fontWeight: 500,
                    color: 'var(--cs-fg-primary)',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {step.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--cs-fg-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {step.description}
                </span>
              </span>
            </button>
            {idx < STEPS.length - 1 ? (
              <span
                aria-hidden
                style={{
                  flex: '0 0 18px',
                  height: 1,
                  background: 'var(--cs-border-hair)',
                }}
              />
            ) : null}
          </li>
        );
      })}
      </ol>
    </div>
  );
}
