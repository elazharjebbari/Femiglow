'use client';

import { useEffect, useState } from 'react';
import { Sparkles, RotateCcw, Image as ImageIcon, Film, LibraryBig, Wand2, RefreshCw } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { toast } from 'sonner';
import { Button } from '@/components/admin/content-studio-v2/primitives';
import { MediaPicker } from '@/components/admin/content-studio-v2/media';
import { formatDuration } from '@/components/admin/content-studio-v2/media/VideoPlayer';
import { MediaStudioTracks } from './MediaStudioTracks';
import type { StudioV2MediaItem, StudioV2Compartment } from '@/lib/content-studio-v2/media/types';
import { useGenerationEstimator } from '@/lib/content-studio-v2/state/useGenerationEstimator';
import type { ContentFormat } from '@/lib/content-studio/types';
import { ModelPicker } from './ModelPicker';
import { GenerationModeToggle } from './GenerationModeToggle';

function computeRatio(width: number | null | undefined, height: number | null | undefined): string | null {
  if (!width || !height) return null;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(width, height);
  return `${width / g}:${height / g}`;
}

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
  /** CS v2 Phase 3 — draft format drives the default kind (image vs video). */
  format?: ContentFormat;
  /** MP-AR-006 (BUG-004) — gates the voice-over/subtitles/montage tracks panel. */
  mediaStudioEnabled?: boolean;
}

type GenKind = 'image' | 'video';

const VIDEO_FORMATS: ReadonlyArray<ContentFormat> = ['reel', 'story'];

export function MediaStudio({
  draftId,
  items,
  selectedMedia,
  onSelect,
  onUploaded,
  defaultVisualPrompt,
  loading,
  format,
  mediaStudioEnabled = false,
}: MediaStudioProps) {
  const [compartment, setCompartment] = useState<StudioV2Compartment | 'all'>('all');
  const [generating, setGenerating] = useState(false);
  const estimator = useGenerationEstimator({ bucket: 'visual', fallbackMs: 20_000 });
  const [budget, setBudget] = useState<{ dailyBudgetCents: number; dailySpentCents: number; remainingCents: number } | null>(null);
  // CS v2 Phase 3 — default kind to video for reel/story, image otherwise.
  const videoCapable = format ? VIDEO_FORMATS.includes(format) : false;
  const [kind, setKind] = useState<GenKind>(videoCapable ? 'video' : 'image');
  const [model, setModel] = useState<string | null>(null);

  // If the parent changes the format, keep the kind in sync (only if user
  // hasn't already switched it manually — we reset model to use the suggestion).
  useEffect(() => {
    if (!format) return;
    const nextDefault: GenKind = VIDEO_FORMATS.includes(format) ? 'video' : 'image';
    setKind(nextDefault);
    setModel(null);
  }, [format]);

  useEffect(() => {
    fetch('/api/admin/content-studio/generation-runs?limit=0')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { budget?: { dailyBudgetCents: number; dailySpentCents: number; remainingCents: number } } | null) => {
        if (json?.budget) setBudget(json.budget);
      })
      .catch(() => {});
  }, []);

  async function generateVisual() {
    // Guard: without a selected draft, the URL becomes /drafts//generate-visual
    // → 308 redirect then 405. Surface a clear toast instead.
    if (!draftId) {
      toast.error('Sélectionnez d’abord une variante avant de générer un visuel.');
      return;
    }
    const prompt =
      defaultVisualPrompt ??
      'Visuel skincare slow living, ambiance Marrakech, lumière chaude tamisée';
    setGenerating(true);
    estimator.start();
    try {
      // CS v2 Phase 3 — pass kind + model. Backend handles image and video.
      const body: Record<string, unknown> = { prompt, size: '1024x1536', quality: 'low', kind };
      if (model) body.model = model;
      const res = await fetch(`/api/admin/content-studio/drafts/${draftId}/generate-visual`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as {
        media?: {
          id: string;
          alt: string;
          kind?: string;
          previewUrl?: string | null;
          thumbUrl?: string | null;
          originalUrl?: string | null;
          width?: number | null;
          height?: number | null;
          durationMs?: number | null;
        };
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.media) {
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      }
      // Adapt the v1 service response (StudioMediaItem) to the v2 picker shape.
      const mediaKind: 'image' | 'video' = json.media.kind === 'video' ? 'video' : 'image';
      const adapted: StudioV2MediaItem = {
        id: json.media.id,
        kind: mediaKind,
        compartment: 'ai_generated',
        alt: json.media.alt,
        slug: json.media.id,
        thumbnailUrl: json.media.thumbUrl ?? null,
        previewUrl: json.media.previewUrl ?? json.media.originalUrl ?? '',
        originalUrl: json.media.originalUrl ?? json.media.previewUrl ?? '',
        width: json.media.width ?? null,
        height: json.media.height ?? null,
        durationSec:
          mediaKind === 'video' && typeof json.media.durationMs === 'number'
            ? json.media.durationMs / 1000
            : null,
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <GenerationModeToggle />
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
            {selectedMedia && selectedMedia.compartment === 'ai_generated' ? (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<RefreshCw size={14} />}
                type="button"
                onClick={generateVisual}
                loading={generating}
                disabled={!draftId || generating}
                title="Régénérer avec les mêmes paramètres"
                data-cs-regenerate-button
              >
                Régénérer
              </Button>
            ) : null}
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
              leftIcon={kind === 'video' ? <Film size={14} /> : <Sparkles size={14} />}
              type="button"
              onClick={generateVisual}
              loading={generating}
              disabled={!draftId || generating}
              title={
                !draftId
                  ? 'Sélectionnez d’abord une variante.'
                  : undefined
              }
              aria-disabled={!draftId || generating ? 'true' : undefined}
              data-cs-generate-button
            >
              {kind === 'video' ? 'Générer une vidéo IA' : 'Générer un visuel IA'}
            </Button>
          </div>
        </div>
      </header>

      {selectedMedia ? (
        <div
          data-cs-section="media-metadata"
          aria-label="Métadonnées du média attaché"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            background: 'var(--cs-bg-sunken)',
            border: '1px solid var(--cs-border-hair)',
            borderRadius: 'var(--cs-radius-full)',
            fontSize: 11,
            color: 'var(--cs-fg-secondary)',
            width: 'fit-content',
            fontFamily: 'var(--cs-font-mono, ui-monospace)',
          }}
        >
          {selectedMedia.kind === 'video' ? (
            <Film size={12} aria-hidden style={{ color: 'var(--cs-accent)' }} />
          ) : (
            <ImageIcon size={12} aria-hidden style={{ color: 'var(--cs-accent)' }} />
          )}
          <span data-cs-meta-kind style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {selectedMedia.kind === 'video' ? 'Vidéo' : 'Image'}
          </span>
          {selectedMedia.kind === 'video' && selectedMedia.durationSec ? (
            <>
              <span aria-hidden style={{ opacity: 0.5 }}>·</span>
              <span data-cs-meta-duration>{formatDuration(selectedMedia.durationSec)}</span>
            </>
          ) : null}
          {selectedMedia.width && selectedMedia.height ? (
            <>
              <span aria-hidden style={{ opacity: 0.5 }}>·</span>
              <span data-cs-meta-dimensions>
                {selectedMedia.width}×{selectedMedia.height}
              </span>
            </>
          ) : null}
          {computeRatio(selectedMedia.width, selectedMedia.height) ? (
            <>
              <span aria-hidden style={{ opacity: 0.5 }}>·</span>
              <span data-cs-meta-ratio>{computeRatio(selectedMedia.width, selectedMedia.height)}</span>
            </>
          ) : null}
        </div>
      ) : null}

      {mediaStudioEnabled && draftId && videoCapable && selectedMedia?.kind === 'video' ? (
        <MediaStudioTracks draftId={draftId} />
      ) : null}

      {!draftId ? (
        <div
          role="note"
          aria-label="Indication MediaStudio"
          data-cs-media-empty-state
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            background: 'var(--cs-accent-bg)',
            color: 'var(--cs-accent)',
            borderRadius: 'var(--cs-radius-sm)',
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          <Sparkles size={14} aria-hidden />
          <span>
            Décrivez votre intention puis sélectionnez une variante pour activer la génération de visuel.
          </span>
        </div>
      ) : null}

      {/* CS v2 Phase 7 — Tabs Bibliothèque / Générer IA. Default to "generate"
        * since the typical operator flow is AI-first; the library tab is
        * mostly used for re-using a previously-imported asset. */}
      <Tabs.Root defaultValue="generate" data-cs-section="media-tabs">
        <Tabs.List
          aria-label="Source du visuel"
          style={{
            display: 'inline-flex',
            gap: 2,
            background: 'var(--cs-bg-sunken)',
            padding: 3,
            borderRadius: 'var(--cs-radius-sm)',
            marginBottom: 12,
          }}
        >
          <Tabs.Trigger value="library" data-testid="media-tab-library" asChild>
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 500,
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: 'var(--cs-fg-secondary)',
                cursor: 'pointer',
              }}
              className="cs-tab-trigger"
            >
              <LibraryBig size={14} />
              Bibliothèque
            </button>
          </Tabs.Trigger>
          <Tabs.Trigger value="generate" data-testid="media-tab-generate" asChild>
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 500,
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: 'var(--cs-fg-secondary)',
                cursor: 'pointer',
              }}
              className="cs-tab-trigger"
            >
              <Wand2 size={14} />
              Générer IA
            </button>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="generate">
          <div
            data-cs-section="media-generate-controls"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: 12,
              background: 'var(--cs-bg-sunken)',
              borderRadius: 'var(--cs-radius-sm)',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--cs-fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Type de média
              </span>
              <div
                role="radiogroup"
                aria-label="Type de média à générer"
                data-cs-section="media-kind-toggle"
                style={{
                  display: 'inline-flex',
                  gap: 2,
                  padding: 3,
                  background: 'var(--cs-bg-base)',
                  border: '1px solid var(--cs-border-hair)',
                  borderRadius: 'var(--cs-radius-full)',
                  width: 'fit-content',
                }}
              >
                {(['image', 'video'] as const).map((k) => {
                  const disabled = k === 'video' && !videoCapable;
                  const active = kind === k;
                  const reason = disabled
                    ? `Vidéo disponible uniquement pour les formats Reel et Story${format ? ` (format actuel : ${format})` : ''}.`
                    : undefined;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-disabled={disabled ? 'true' : undefined}
                      disabled={disabled}
                      data-cs-kind={k}
                      data-testid={`media-kind-${k}`}
                      title={reason}
                      onClick={() => {
                        if (disabled) return;
                        setKind(k);
                        setModel(null);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 14px',
                        fontSize: 12,
                        fontWeight: 500,
                        borderRadius: 'var(--cs-radius-full)',
                        border: 'none',
                        background: active ? 'var(--cs-accent)' : 'transparent',
                        color: active
                          ? 'var(--cs-on-accent, white)'
                          : disabled
                            ? 'var(--cs-fg-muted)'
                            : 'var(--cs-fg-secondary)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.55 : 1,
                        transition: 'background 120ms ease, color 120ms ease',
                      }}
                    >
                      {k === 'image' ? <ImageIcon size={13} /> : <Film size={13} />}
                      {k === 'image' ? 'Image' : 'Vidéo'}
                    </button>
                  );
                })}
              </div>
              {!videoCapable && format ? (
                <p
                  data-cs-kind-hint
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: 'var(--cs-fg-muted)',
                    lineHeight: 1.4,
                  }}
                >
                  Vidéo disponible pour les formats <strong>Reel</strong> et <strong>Story</strong>.
                </p>
              ) : null}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--cs-fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Modèle {kind === 'video' ? 'vidéo' : 'image'}
              </span>
              <ModelPicker
                role={kind}
                format={format}
                value={model}
                onChange={setModel}
                disabled={generating}
                testId={`media-studio-model-picker-${kind}`}
              />
            </label>
          </div>

          {generating ? (
            <EstimatorBar
              progressPct={estimator.progressPct}
              stage={estimator.stage}
              elapsedMs={estimator.elapsedMs}
              p50Ms={estimator.p50Ms}
            />
          ) : null}
        </Tabs.Content>

        <Tabs.Content value="library">
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
        </Tabs.Content>
      </Tabs.Root>
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
