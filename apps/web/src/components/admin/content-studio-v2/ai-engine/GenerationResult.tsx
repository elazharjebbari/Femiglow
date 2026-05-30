'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Image as ImageIcon,
  Film,
  BookOpen,
  Send,
  Calendar,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/admin/content-studio-v2/primitives';
import { Badge } from '@/components/admin/content-studio-v2/primitives';

export interface ScriptScene {
  type: string;
  text: string;
  duration?: string;
}

export interface GenerationResultData {
  script?: {
    hook?: string;
    scenes?: ScriptScene[];
    cta?: string;
  };
  caption?: string;
  hashtags?: string[];
  images?: string[];
  videos?: string[];
  qualityScores?: Record<string, number>;
  costBreakdown?: { label: string; amountCents: number }[];
  totalCostCents?: number;
}

export interface BridgeResultData {
  ideaId: string;
  briefId: string;
  draftId: string;
}

interface GenerationResultProps {
  result: GenerationResultData;
  contentStudioUrl?: string | null;
  bridgeResult?: BridgeResultData | null;
  onUse?: () => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copier"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 'var(--cs-radius-sm)',
        border: '1px solid var(--cs-border)',
        background: 'var(--cs-bg-elevated)',
        color: copied ? 'var(--cs-success)' : 'var(--cs-fg-secondary)',
        fontSize: 'var(--cs-text-xs)',
        cursor: 'pointer',
        transition: 'all var(--cs-motion-fast) var(--cs-easing)',
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copié' : 'Copier'}
    </button>
  );
}

function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '14px 18px',
          background: 'var(--cs-bg-base)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 'var(--cs-text-sm)',
          fontWeight: 600,
          fontFamily: 'var(--cs-font-display)',
          color: 'var(--cs-fg-primary)',
          textAlign: 'left',
        }}
      >
        <span style={{ color: 'var(--cs-accent)', display: 'flex' }}>{icon}</span>
        <span style={{ flex: 1 }}>{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div style={{ padding: '16px 18px', background: 'var(--cs-bg-elevated)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function QualityBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80
      ? 'var(--cs-success)'
      : pct >= 60
        ? 'var(--cs-warning)'
        : 'var(--cs-danger)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span
        style={{
          fontSize: 'var(--cs-text-sm)',
          color: 'var(--cs-fg-secondary)',
          minWidth: 140,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 'var(--cs-radius-full)',
          background: 'var(--cs-bg-sunken)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 'var(--cs-radius-full)',
            background: color,
            transition: 'width var(--cs-motion-base) var(--cs-easing)',
          }}
        />
      </div>
      <span
        className="cs-mono"
        style={{
          fontSize: 'var(--cs-text-xs)',
          color: 'var(--cs-fg-muted)',
          minWidth: 36,
          textAlign: 'right',
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

type PublishMode = 'now' | 'schedule';
type PublishState = 'idle' | 'publishing' | 'success' | 'error';

function PublishSection({ draftId }: { draftId: string }) {
  const [mode, setMode] = useState<PublishMode>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [publishState, setPublishState] = useState<PublishState>('idle');
  const [publishMessage, setPublishMessage] = useState('');

  const isMock = draftId.startsWith('mock-') || draftId.includes('test');

  const canPublish =
    publishState !== 'publishing' &&
    (mode === 'now' || (mode === 'schedule' && scheduledAt.trim().length > 0));

  const handlePublish = useCallback(async () => {
    setPublishState('publishing');
    setPublishMessage('');

    try {
      const body: Record<string, unknown> = { draftId, mode };
      if (mode === 'schedule' && scheduledAt) {
        body.scheduledAt = new Date(scheduledAt).toISOString();
      }

      const res = await fetch('/api/admin/ai-engine/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data.message ?? data.error ?? `Erreur HTTP ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      setPublishState('success');
      setPublishMessage(
        mode === 'now'
          ? 'Contenu publié avec succès.'
          : `Contenu planifié pour le ${new Date(scheduledAt).toLocaleString('fr-FR')}.`,
      );
    } catch (e: unknown) {
      setPublishState('error');
      setPublishMessage(
        e instanceof Error ? e.message : 'Erreur lors de la publication.',
      );
    }
  }, [draftId, mode, scheduledAt]);

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        padding: '24px 28px',
        boxShadow: 'var(--cs-shadow-sm)',
      }}
    >
      {isMock && (
        <span
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            padding: '2px 8px',
            borderRadius: 'var(--cs-radius-sm)',
            background: 'rgba(245, 158, 11, 0.12)',
            color: '#f59e0b',
            fontSize: 'var(--cs-text-xs)',
            fontWeight: 500,
          }}
        >
          Mode Mock
        </span>
      )}
      <h4
        className="cs-display"
        style={{
          fontSize: 'var(--cs-text-base)',
          fontWeight: 500,
          margin: '0 0 16px 0',
        }}
      >
        Publier
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Mode selector */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setMode('now')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 'var(--cs-radius-sm)',
              border: `1px solid ${mode === 'now' ? 'var(--cs-accent)' : 'var(--cs-border)'}`,
              background: mode === 'now' ? 'var(--cs-accent-bg)' : 'var(--cs-bg-base)',
              color: mode === 'now' ? 'var(--cs-accent)' : 'var(--cs-fg-secondary)',
              fontSize: 'var(--cs-text-sm)',
              fontFamily: 'inherit',
              fontWeight: mode === 'now' ? 600 : 400,
              cursor: 'pointer',
              transition: 'all var(--cs-motion-fast) var(--cs-easing)',
            }}
          >
            <Send size={13} />
            Publier maintenant
          </button>
          <button
            type="button"
            onClick={() => setMode('schedule')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 'var(--cs-radius-sm)',
              border: `1px solid ${mode === 'schedule' ? 'var(--cs-accent)' : 'var(--cs-border)'}`,
              background: mode === 'schedule' ? 'var(--cs-accent-bg)' : 'var(--cs-bg-base)',
              color: mode === 'schedule' ? 'var(--cs-accent)' : 'var(--cs-fg-secondary)',
              fontSize: 'var(--cs-text-sm)',
              fontFamily: 'inherit',
              fontWeight: mode === 'schedule' ? 600 : 400,
              cursor: 'pointer',
              transition: 'all var(--cs-motion-fast) var(--cs-easing)',
            }}
          >
            <Calendar size={13} />
            Planifier
          </button>
        </div>

        {/* Date picker for schedule mode */}
        {mode === 'schedule' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              className="cs-eyebrow"
              style={{ fontSize: 'var(--cs-text-xs)' }}
            >
              Date et heure de publication
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              style={{
                width: '100%',
                maxWidth: 280,
                padding: '9px 12px',
                borderRadius: 'var(--cs-radius-sm)',
                border: '1px solid var(--cs-border)',
                background: 'var(--cs-bg-base)',
                color: 'var(--cs-fg-primary)',
                fontSize: 'var(--cs-text-sm)',
                fontFamily: 'inherit',
                outline: 'none',
                transition:
                  'border-color var(--cs-motion-fast) var(--cs-easing)',
              }}
            />
          </div>
        )}

        {/* Publish button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
          <Button
            variant="primary"
            leftIcon={<Send size={14} />}
            onClick={handlePublish}
            disabled={!canPublish}
            loading={publishState === 'publishing'}
          >
            {mode === 'now' ? 'Publier' : 'Planifier la publication'}
          </Button>
        </div>

        {/* Status message */}
        {publishState === 'success' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 'var(--cs-radius-sm)',
              background: 'var(--cs-success-bg, rgba(34,197,94,0.08))',
              border: '1px solid var(--cs-success, #22c55e)',
              color: 'var(--cs-success, #22c55e)',
              fontSize: 'var(--cs-text-sm)',
            }}
          >
            <CheckCircle size={14} />
            {publishMessage}
          </div>
        )}

        {publishState === 'error' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 'var(--cs-radius-sm)',
              background: 'var(--cs-danger-bg, rgba(239,68,68,0.08))',
              border: '1px solid var(--cs-danger, #ef4444)',
              color: 'var(--cs-danger, #ef4444)',
              fontSize: 'var(--cs-text-sm)',
            }}
          >
            <AlertTriangle size={14} />
            {publishMessage}
          </div>
        )}
      </div>
    </div>
  );
}

const QUALITY_LABELS: Record<string, string> = {
  brand_alignment: 'Alignement marque',
  engagement_potential: 'Potentiel engagement',
  clarity: 'Clarté du message',
  visual_coherence: 'Cohérence visuelle',
  cta_strength: 'Force du CTA',
  overall: 'Score global',
};

export function GenerationResult({ result, contentStudioUrl, bridgeResult, onUse, onRegenerate, regenerating }: GenerationResultProps) {
  const { script, caption, hashtags, images, videos, qualityScores, costBreakdown, totalCostCents } = result;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          background: 'var(--cs-bg-elevated)',
          border: '1px solid var(--cs-border-hair)',
          borderRadius: 'var(--cs-radius-md)',
          padding: '24px 28px',
          boxShadow: 'var(--cs-shadow-sm)',
        }}
      >
        <h3
          className="cs-display"
          style={{
            fontSize: 'var(--cs-text-xl)',
            fontWeight: 500,
            margin: '0 0 20px 0',
          }}
        >
          Contenu généré
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {script && (
            <CollapsibleSection title="Script" icon={<Sparkles size={14} />} defaultOpen>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {script.hook && (
                  <div>
                    <span className="cs-eyebrow" style={{ display: 'block', marginBottom: 6, fontSize: 'var(--cs-text-xs)' }}>
                      Hook
                    </span>
                    <p style={{ margin: 0, fontSize: 'var(--cs-text-sm)', lineHeight: 1.6 }}>
                      {script.hook}
                    </p>
                  </div>
                )}
                {script.scenes && script.scenes.length > 0 && (
                  <div>
                    <span className="cs-eyebrow" style={{ display: 'block', marginBottom: 8, fontSize: 'var(--cs-text-xs)' }}>
                      Scènes
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {script.scenes.map((scene, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '10px 14px',
                            background: 'var(--cs-bg-sunken)',
                            borderRadius: 'var(--cs-radius-sm)',
                          }}
                        >
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                            <Badge tone="clay" size="sm">{scene.type}</Badge>
                            {scene.duration && (
                              <span className="cs-mono" style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
                                {scene.duration}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: 'var(--cs-text-sm)', lineHeight: 1.55 }}>
                            {scene.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {script.cta && (
                  <div>
                    <span className="cs-eyebrow" style={{ display: 'block', marginBottom: 6, fontSize: 'var(--cs-text-xs)' }}>
                      Call to Action
                    </span>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 'var(--cs-text-sm)',
                        fontWeight: 600,
                        color: 'var(--cs-accent)',
                      }}
                    >
                      {script.cta}
                    </p>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {caption && (
            <div
              style={{
                border: '1px solid var(--cs-border-hair)',
                borderRadius: 'var(--cs-radius)',
                padding: '16px 18px',
                background: 'var(--cs-bg-base)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--cs-font-display)', fontWeight: 600, fontSize: 'var(--cs-text-sm)' }}>
                  Caption
                </span>
                <CopyButton text={caption} />
              </div>
              <p style={{ margin: 0, fontSize: 'var(--cs-text-sm)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {caption}
              </p>
            </div>
          )}

          {hashtags && hashtags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 0' }}>
              {hashtags.map((tag) => (
                <Badge key={tag} tone="accent" size="sm">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          {images && images.length > 0 && (
            <CollapsibleSection title={`Visuels (${images.length})`} icon={<ImageIcon size={14} />} defaultOpen>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 10,
                }}
              >
                {images.map((src, i) => (
                  <div
                    key={i}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 'var(--cs-radius)',
                      overflow: 'hidden',
                      border: '1px solid var(--cs-border-hair)',
                      background: 'var(--cs-bg-sunken)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Visuel ${i + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {videos && videos.length > 0 && (
            <CollapsibleSection title={`Vidéos (${videos.length})`} icon={<Film size={14} />} defaultOpen>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {videos.map((src, i) => (
                  <div
                    key={i}
                    style={{
                      borderRadius: 'var(--cs-radius)',
                      overflow: 'hidden',
                      border: '1px solid var(--cs-border-hair)',
                      background: 'var(--cs-bg-sunken)',
                    }}
                  >
                    <video
                      src={src}
                      controls
                      style={{
                        width: '100%',
                        maxHeight: 400,
                        display: 'block',
                        background: '#000',
                      }}
                    />
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      </div>

      {qualityScores && Object.keys(qualityScores).length > 0 && (
        <div
          style={{
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border-hair)',
            borderRadius: 'var(--cs-radius-md)',
            padding: '24px 28px',
            boxShadow: 'var(--cs-shadow-sm)',
          }}
        >
          <h4
            className="cs-display"
            style={{ fontSize: 'var(--cs-text-base)', fontWeight: 500, margin: '0 0 16px 0' }}
          >
            Scores qualité
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(qualityScores).map(([key, val]) => (
              <QualityBar key={key} label={QUALITY_LABELS[key] ?? key} value={val} />
            ))}
          </div>
        </div>
      )}

      {costBreakdown && costBreakdown.length > 0 && (
        <div
          style={{
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border-hair)',
            borderRadius: 'var(--cs-radius-md)',
            padding: '24px 28px',
            boxShadow: 'var(--cs-shadow-sm)',
          }}
        >
          <h4
            className="cs-display"
            style={{ fontSize: 'var(--cs-text-base)', fontWeight: 500, margin: '0 0 16px 0' }}
          >
            Détail des coûts
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--cs-text-sm)' }}>
            <tbody>
              {costBreakdown.map((item, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: i < costBreakdown.length - 1 ? '1px solid var(--cs-border-hair)' : 'none',
                  }}
                >
                  <td style={{ padding: '8px 0', color: 'var(--cs-fg-secondary)' }}>{item.label}</td>
                  <td
                    className="cs-mono"
                    style={{ padding: '8px 0', textAlign: 'right', color: 'var(--cs-fg-primary)' }}
                  >
                    {(item.amountCents / 100).toFixed(2)} MAD
                  </td>
                </tr>
              ))}
              {totalCostCents != null && (
                <tr style={{ borderTop: '2px solid var(--cs-border)' }}>
                  <td style={{ padding: '10px 0', fontWeight: 600 }}>Total</td>
                  <td
                    className="cs-mono"
                    style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700 }}
                  >
                    {(totalCostCents / 100).toFixed(2)} MAD
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {bridgeResult && (
        <PublishSection draftId={bridgeResult.draftId} />
      )}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 8 }}>
        <Button
          variant="ghost"
          leftIcon={<RefreshCw size={14} />}
          onClick={onRegenerate}
          loading={regenerating}
        >
          Régénérer
        </Button>
        {contentStudioUrl && (
          <Link href={contentStudioUrl} style={{ textDecoration: 'none' }}>
            <Button
              variant="ghost"
              leftIcon={<BookOpen size={14} />}
            >
              Voir dans la Bibliothèque
            </Button>
          </Link>
        )}
        <Button
          variant="primary"
          rightIcon={<ArrowRight size={14} />}
          onClick={onUse}
        >
          Utiliser ce contenu
        </Button>
      </div>
    </div>
  );
}
