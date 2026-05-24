'use client';

import { useEffect, useState } from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/admin/content-studio-v2/primitives';
import { MediaPicker } from '@/components/admin/content-studio-v2/media';
import type { StudioV2MediaItem, StudioV2Compartment } from '@/lib/content-studio-v2/media/types';
import { useGenerationEstimator } from '@/lib/content-studio-v2/state/useGenerationEstimator';

interface MediaStudioProps {
  draftId: string;
  /** Whole library available in the picker. */
  items: StudioV2MediaItem[];
  /** Currently bound media (controls the selected highlight + visible state). */
  selectedMedia: StudioV2MediaItem | null;
  onSelect: (item: StudioV2MediaItem | null) => void;
  /** Notified after an upload completes so the parent can refresh state. */
  onUploaded: (item: StudioV2MediaItem) => void;
  /** Default visual prompt — typically the brief mediaDirection. */
  defaultVisualPrompt?: string;
  loading?: boolean;
}

export function MediaStudio({
  draftId,
  items,
  selectedMedia,
  onSelect,
  onUploaded,
  defaultVisualPrompt,
  loading,
}: MediaStudioProps) {
  const [compartment, setCompartment] = useState<StudioV2Compartment | 'all'>('all');
  const [generating, setGenerating] = useState(false);
  const estimator = useGenerationEstimator({ bucket: 'visual', fallbackMs: 20_000 });
  const [budget, setBudget] = useState<{ dailyBudgetCents: number; dailySpentCents: number; remainingCents: number } | null>(null);

  useEffect(() => {
    fetch('/api/admin/content-studio/generation-runs?limit=0')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { budget?: { dailyBudgetCents: number; dailySpentCents: number; remainingCents: number } } | null) => {
        if (json?.budget) setBudget(json.budget);
      })
      .catch(() => {});
  }, []);

  async function generateVisual() {
    const prompt =
      defaultVisualPrompt ??
      'Visuel skincare slow living, ambiance Marrakech, lumière chaude tamisée';
    setGenerating(true);
    estimator.start();
    try {
      const res = await fetch(`/api/admin/content-studio/drafts/${draftId}/generate-visual`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, size: '1024x1536', quality: 'low' }),
      });
      const json = (await res.json().catch(() => null)) as {
        media?: { id: string; alt: string; previewUrl?: string | null; thumbUrl?: string | null; originalUrl?: string | null };
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.media) {
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      }
      // Adapt the v1 service response (StudioMediaItem) to the v2 picker shape.
      const adapted: StudioV2MediaItem = {
        id: json.media.id,
        kind: 'image',
        compartment: 'ai_generated',
        alt: json.media.alt,
        slug: json.media.id,
        thumbnailUrl: json.media.thumbUrl ?? null,
        previewUrl: json.media.previewUrl ?? json.media.originalUrl ?? '',
        originalUrl: json.media.originalUrl ?? json.media.previewUrl ?? '',
        createdAt: new Date().toISOString(),
      };
      onUploaded(adapted);
      onSelect(adapted);
      estimator.stop();
      toast.success('Visuel IA généré');
    } catch (err) {
      estimator.cancel();
      const message = err instanceof Error ? err.message : 'Échec de la génération';
      toast.error(`Génération visuelle : ${message}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section
      aria-label="Studio média"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 18,
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
      }}
    >
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
      >
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
          Visuel
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {budget ? (
            <p
              aria-label="Budget IA quotidien"
              style={{
                margin: 0,
                fontFamily: 'var(--cs-font-mono)',
                fontSize: 11,
                color: budget.dailyBudgetCents > 0 && budget.remainingCents / budget.dailyBudgetCents < 0.2
                  ? 'var(--cs-danger)'
                  : 'var(--cs-fg-muted)',
              }}
            >
              {budget.dailyBudgetCents === 0
                ? 'Budget illimité'
                : `${budget.remainingCents}¢ / ${budget.dailyBudgetCents}¢ restants`}
            </p>
          ) : null}
          <div style={{ display: 'inline-flex', gap: 8 }}>
            {selectedMedia ? (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<RotateCcw size={14} />}
                type="button"
                onClick={() => onSelect(null)}
              >
                Décrocher
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Sparkles size={14} />}
              type="button"
              onClick={generateVisual}
              loading={generating}
            >
              Générer un visuel IA
            </Button>
          </div>
        </div>
      </header>

      {generating ? (
        <EstimatorBar
          progressPct={estimator.progressPct}
          stage={estimator.stage}
          elapsedMs={estimator.elapsedMs}
          p50Ms={estimator.p50Ms}
        />
      ) : null}

      <MediaPicker
        items={items}
        loading={loading}
        selectedId={selectedMedia?.id ?? null}
        onSelect={onSelect}
        onUploaded={onUploaded}
        compartment={compartment}
        onCompartmentChange={setCompartment}
        defaultRatio="4:5"
      />
    </section>
  );
}

function EstimatorBar({
  progressPct,
  stage,
  elapsedMs,
  p50Ms,
}: {
  progressPct: number;
  stage: 'idle' | 'running' | 'longer' | 'stuck';
  elapsedMs: number;
  p50Ms: number;
}) {
  const message =
    stage === 'stuck'
      ? 'Probablement bloqué — vérifier les logs.'
      : stage === 'longer'
        ? "C'est plus long que d'habitude…"
        : `≈ ${Math.round(p50Ms / 1000)}s en général`;
  const color =
    stage === 'stuck'
      ? 'var(--cs-danger)'
      : stage === 'longer'
        ? 'var(--cs-warning)'
        : 'var(--cs-accent)';
  return (
    <div
      role="status"
      aria-label="Progression de la génération"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 12px',
        background: 'var(--cs-bg-sunken)',
        borderRadius: 'var(--cs-radius-sm)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: 4,
          background: 'var(--cs-bg-base)',
          borderRadius: 'var(--cs-radius-full)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progressPct}%`,
            height: '100%',
            background: color,
            transition: 'width 200ms linear',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--cs-fg-muted)',
          fontFamily: 'var(--cs-font-mono)',
        }}
      >
        <span>{Math.round(elapsedMs / 1000)}s</span>
        <span style={{ color }}>{message}</span>
      </div>
    </div>
  );
}
