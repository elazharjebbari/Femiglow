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
  BookOpen,
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
  qualityScores?: Record<string, number>;
  costBreakdown?: { label: string; amountCents: number }[];
  totalCostCents?: number;
}

interface GenerationResultProps {
  result: GenerationResultData;
  contentStudioUrl?: string | null;
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

const QUALITY_LABELS: Record<string, string> = {
  brand_alignment: 'Alignement marque',
  engagement_potential: 'Potentiel engagement',
  clarity: 'Clarté du message',
  visual_coherence: 'Cohérence visuelle',
  cta_strength: 'Force du CTA',
  overall: 'Score global',
};

export function GenerationResult({ result, contentStudioUrl, onUse, onRegenerate, regenerating }: GenerationResultProps) {
  const { script, caption, hashtags, images, qualityScores, costBreakdown, totalCostCents } = result;

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
