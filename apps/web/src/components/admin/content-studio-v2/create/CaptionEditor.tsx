'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useDraftAutosave } from '@/lib/content-studio-v2/state/StudioContext';

interface CaptionEditorProps {
  draftId: string;
  initialCaption: string;
  initialHook?: string | null;
  maxLength?: number;
  /** Optional callback notified after every local change (used by preview). */
  onChange?: (next: { caption: string; hook: string | null }) => void;
}

export function CaptionEditor({
  draftId,
  initialCaption,
  initialHook,
  maxLength = 2200,
  onChange,
}: CaptionEditorProps) {
  const [caption, setCaption] = useState(initialCaption);
  const [hook, setHook] = useState<string>(initialHook ?? '');
  const autosave = useDraftAutosave(draftId);

  // Sync local state when draftId changes (switching drafts).
  useEffect(() => {
    setCaption(initialCaption);
    setHook(initialHook ?? '');
  }, [draftId, initialCaption, initialHook]);

  return (
    <section
      className="cs-caption-editor"
      aria-label="Légende et accroche"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 18,
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3
          style={{
            fontFamily: 'var(--cs-font-display)',
            fontSize: 'var(--cs-text-lg)',
            fontWeight: 500,
            color: 'var(--cs-fg-primary)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Légende
        </h3>
        <AutosaveIndicator
          status={autosave.status}
          isDirty={autosave.isDirty}
          lastSavedAt={autosave.lastSavedAt}
          error={autosave.error}
        />
      </header>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontSize: 11,
            color: 'var(--cs-fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Accroche (hook)
        </span>
        <input
          type="text"
          value={hook}
          maxLength={280}
          onChange={(event) => {
            const next = event.target.value;
            setHook(next);
            onChange?.({ caption, hook: next || null });
            autosave.patch({ hook: next || null });
          }}
          aria-label="Accroche du draft"
          style={{
            padding: '10px 12px',
            background: 'var(--cs-bg-base)',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-sm)',
            fontFamily: 'var(--cs-font-display)',
            fontSize: 'var(--cs-text-base)',
            color: 'var(--cs-fg-primary)',
          }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontSize: 11,
            color: 'var(--cs-fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Caption complète
        </span>
        <textarea
          value={caption}
          maxLength={maxLength}
          rows={10}
          onChange={(event) => {
            const next = event.target.value;
            setCaption(next);
            onChange?.({ caption: next, hook: hook || null });
            autosave.patch({ caption: next });
          }}
          aria-label="Légende complète du draft"
          style={{
            padding: '12px 14px',
            background: 'var(--cs-bg-base)',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-sm)',
            fontFamily: 'var(--cs-font-body)',
            fontSize: 'var(--cs-text-sm)',
            color: 'var(--cs-fg-primary)',
            lineHeight: 1.55,
            resize: 'vertical',
            minHeight: 200,
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: 'var(--cs-fg-muted)',
            fontFamily: 'var(--cs-font-mono)',
            alignSelf: 'flex-end',
          }}
        >
          {caption.length} / {maxLength}
        </span>
      </label>
    </section>
  );
}

interface IndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error';
  isDirty: boolean;
  lastSavedAt: number | null;
  error: string | null;
}

export function AutosaveIndicator({ status, isDirty, lastSavedAt, error }: IndicatorProps) {
  if (status === 'saving') {
    return (
      <span
        role="status"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--cs-fg-secondary)',
        }}
      >
        <Loader2 size={13} className="cs-spin" style={{ animation: 'cs-spin 1s linear infinite' }} />
        Enregistrement…
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        role="alert"
        title={error ?? undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--cs-danger)',
        }}
      >
        <AlertCircle size={13} />
        Échec — réessayer
      </span>
    );
  }
  if (status === 'saved' && lastSavedAt) {
    return (
      <span
        role="status"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--cs-success)',
        }}
      >
        <CheckCircle2 size={13} />
        Enregistré {formatRelativeTime(lastSavedAt)}
      </span>
    );
  }
  if (isDirty) {
    return (
      <span
        style={{
          fontSize: 12,
          color: 'var(--cs-warning)',
        }}
      >
        Modifications non sauvées
      </span>
    );
  }
  return null;
}

function formatRelativeTime(ms: number): string {
  const delta = Math.max(0, Date.now() - ms);
  if (delta < 5_000) return "à l'instant";
  if (delta < 60_000) return `il y a ${Math.round(delta / 1000)} s`;
  if (delta < 3_600_000) return `il y a ${Math.round(delta / 60_000)} min`;
  return new Date(ms).toLocaleTimeString();
}
