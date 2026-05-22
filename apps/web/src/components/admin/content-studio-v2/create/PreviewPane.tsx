'use client';

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
}: PreviewPaneProps) {
  return (
    <aside
      aria-label="Aperçu"
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
      <div style={{ display: 'grid', placeItems: 'center', padding: '6px 0' }}>
        <PlatformPreview platform={platform} format={format} media={media} caption={caption} />
      </div>
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
