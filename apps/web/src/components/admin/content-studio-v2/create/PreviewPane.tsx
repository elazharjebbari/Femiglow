'use client';

import { Info } from 'lucide-react';
import { PlatformPreview } from '@/components/admin/content-studio-v2/media';
import type {
  PreviewFormat,
  PreviewPlatform,
} from '@/components/admin/content-studio-v2/media';
import type { StudioV2MediaItem } from '@/lib/content-studio-v2/media/types';

interface PreviewPaneProps {
  platform: PreviewPlatform;
  format: PreviewFormat;
  media: StudioV2MediaItem | null;
  caption: string;
  /** Optional list of platforms — for multi-tab future. */
  onPlatformChange?: (platform: PreviewPlatform) => void;
  /** Optional list of formats — synchronised with IntentionForm. */
  onFormatChange?: (format: PreviewFormat) => void;
  /**
   * CS v2 create-audit Phase 5 — slot for the "Valider et préparer la
   * publication" action. Rendered under the preview when supplied.
   */
  footerActions?: React.ReactNode;
  /**
   * CS v2 Phase 7 polish — true when a draft is selected. Lets us swap the
   * "Décrivez votre intention" message for "Attachez un visuel" / "Ajoutez
   * une caption" depending on which piece is still missing.
   */
  hasDraft?: boolean;
}

function computeGuidance(hasDraft: boolean, media: StudioV2MediaItem | null, caption: string): string | null {
  if (!hasDraft) return 'Décrivez votre intention pour démarrer.';
  if (!media) return 'Attachez un visuel pour activer la validation.';
  if (!caption.trim()) return 'Ajoutez une caption avant de valider.';
  return null;
}

const FORMATS: { value: PreviewFormat; label: string }[] = [
  { value: 'post', label: 'Post' },
  { value: 'story', label: 'Story' },
  { value: 'reel', label: 'Reel' },
  { value: 'carousel', label: 'Carousel' },
];

const PLATFORMS: { value: PreviewPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
];

export function PreviewPane({
  platform,
  format,
  media,
  caption,
  onPlatformChange,
  onFormatChange,
  footerActions,
  hasDraft = false,
}: PreviewPaneProps) {
  const guidance = computeGuidance(hasDraft, media, caption);
  return (
    <aside
      aria-label="Aperçu"
      data-section="validate"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 18,
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        position: 'sticky',
        top: 24,
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          Aperçu
        </h3>
        <TabRow
          options={PLATFORMS}
          value={platform}
          onChange={(value) => onPlatformChange?.(value as PreviewPlatform)}
        />
        <TabRow
          options={FORMATS}
          value={format}
          onChange={(value) => onFormatChange?.(value as PreviewFormat)}
        />
      </header>
      {guidance ? (
        <div
          role="note"
          aria-label="Indication d'aperçu"
          data-cs-preview-guidance
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: 'var(--cs-accent-bg)',
            color: 'var(--cs-accent)',
            borderRadius: 'var(--cs-radius-sm)',
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          <Info size={12} aria-hidden />
          <span>{guidance}</span>
        </div>
      ) : null}
      <div style={{ display: 'grid', placeItems: 'center', padding: '6px 0' }}>
        <PlatformPreview platform={platform} format={format} media={media} caption={caption} />
      </div>
      {footerActions ? (
        <div
          data-cs-section="preview-footer"
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 8,
            borderTop: '1px solid var(--cs-border-hair)',
          }}
        >
          {footerActions}
        </div>
      ) : null}
    </aside>
  );
}

function TabRow<V extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: V; label: string }>;
  value: V;
  onChange: (next: V) => void;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        gap: 2,
        background: 'var(--cs-bg-sunken)',
        padding: 3,
        borderRadius: 'var(--cs-radius)',
        alignSelf: 'flex-start',
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: 'none',
              background: active ? 'var(--cs-bg-elevated)' : 'transparent',
              color: active ? 'var(--cs-fg-primary)' : 'var(--cs-fg-secondary)',
              fontSize: 11,
              fontFamily: 'var(--cs-font-body)',
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              boxShadow: active ? 'var(--cs-shadow-sm)' : 'none',
              transition: 'all var(--cs-motion-fast) var(--cs-easing)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
