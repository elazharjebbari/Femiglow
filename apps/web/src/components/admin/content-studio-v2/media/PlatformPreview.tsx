'use client';

import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import type { StudioV2MediaItem } from '@/lib/content-studio-v2/media/types';
import { VideoPlayer } from './VideoPlayer';

export type PreviewPlatform = 'instagram' | 'facebook';
export type PreviewFormat = 'post' | 'story' | 'reel' | 'carousel';

interface Props {
  platform: PreviewPlatform;
  format: PreviewFormat;
  media: StudioV2MediaItem | null;
  caption: string;
  /** Account handle shown in the preview header. */
  handle?: string;
  /** Optional carousel siblings (additional images for IG carousel preview). */
  carouselSiblings?: StudioV2MediaItem[];
}

const ASPECT: Record<PreviewFormat, string> = {
  post: '4 / 5',
  story: '9 / 16',
  reel: '9 / 16',
  carousel: '4 / 5',
};

export function PlatformPreview({ platform, format, media, caption, handle = 'femiglow.maroc', carouselSiblings }: Props) {
  if (platform === 'facebook') return <FacebookPreview media={media} caption={caption} handle={handle} format={format} />;
  if (format === 'story') return <InstagramStory media={media} caption={caption} handle={handle} />;
  if (format === 'reel') return <InstagramReel media={media} caption={caption} handle={handle} />;
  return (
    <InstagramFeed
      media={media}
      caption={caption}
      handle={handle}
      aspectRatio={ASPECT[format]}
      isCarousel={format === 'carousel'}
      carouselCount={(carouselSiblings?.length ?? 0) + (media ? 1 : 0)}
    />
  );
}

/* ============================ Instagram Feed ============================ */

function InstagramFeed({
  media,
  caption,
  handle,
  aspectRatio,
  isCarousel,
  carouselCount,
}: {
  media: StudioV2MediaItem | null;
  caption: string;
  handle: string;
  aspectRatio: string;
  isCarousel: boolean;
  carouselCount: number;
}) {
  return (
    <div className="cs-ig-feed" style={feedFrame}>
      <Header handle={handle} subline="Marrakech, Maroc" />
      <div style={{ aspectRatio, background: 'var(--cs-bg-sunken)', position: 'relative' }}>
        {renderMedia(media, 'cover')}
        {isCarousel && carouselCount > 1 ? (
          <span
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              padding: '4px 10px',
              borderRadius: 'var(--cs-radius-full)',
              background: 'rgba(0,0,0,0.55)',
              color: 'white',
              fontFamily: 'var(--cs-font-mono)',
              fontSize: 11,
              backdropFilter: 'blur(6px)',
            }}
          >
            1 / {carouselCount}
          </span>
        ) : null}
      </div>
      {isCarousel ? (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '8px 0' }}>
          {Array.from({ length: Math.max(carouselCount, 3) }).map((_, i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'var(--cs-accent)' : 'var(--cs-border)' }} />
          ))}
        </div>
      ) : null}
      <ActionsBar />
      <p style={{ padding: '0 14px', fontSize: 13, fontWeight: 600, color: 'var(--cs-fg-primary)' }}>1 247 j'aime</p>
      <p style={{ padding: '6px 14px 14px', fontSize: 13, lineHeight: 1.5, color: 'var(--cs-fg-primary)' }}>
        <b>{handle}</b>{' '}
        <span dangerouslySetInnerHTML={{ __html: formatHashtags(caption) }} />
      </p>
      <p style={{ padding: '0 14px 14px', fontSize: 10, color: 'var(--cs-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>il y a 2 heures</p>
    </div>
  );
}

/* ============================ Instagram Story ============================ */

function InstagramStory({ media, caption, handle }: { media: StudioV2MediaItem | null; caption: string; handle: string }) {
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '9 / 16',
        maxWidth: 320,
        position: 'relative',
        borderRadius: 'var(--cs-radius-md)',
        overflow: 'hidden',
        background: '#000',
        boxShadow: 'var(--cs-shadow-lg)',
      }}
    >
      {renderMedia(media, 'cover')}
      {/* Top gradient + progress bar */}
      <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 80, background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, height: 3, background: 'rgba(255,255,255,0.3)', borderRadius: 2 }}>
        <div style={{ width: '40%', height: '100%', background: 'white', borderRadius: 2 }} />
      </div>
      <div style={{ position: 'absolute', top: 22, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--cs-accent), var(--cs-saffron))', display: 'grid', placeItems: 'center', color: 'white', fontFamily: 'var(--cs-font-display)', fontWeight: 600, fontSize: 12 }}>F</div>
        <span style={{ color: 'white', fontSize: 12, fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>{handle}</span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>2 h</span>
      </div>
      {/* Bottom caption */}
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 24, color: 'white', fontSize: 14, lineHeight: 1.4, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
        {caption ? <>{caption.split(' ').slice(0, 14).join(' ')}{caption.split(' ').length > 14 ? '…' : ''}</> : null}
      </div>
    </div>
  );
}

/* ============================ Instagram Reel ============================ */

function InstagramReel({ media, caption, handle }: { media: StudioV2MediaItem | null; caption: string; handle: string }) {
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '9 / 16',
        maxWidth: 320,
        position: 'relative',
        borderRadius: 'var(--cs-radius-md)',
        overflow: 'hidden',
        background: '#000',
        boxShadow: 'var(--cs-shadow-lg)',
      }}
    >
      {renderMedia(media, 'cover')}
      {/* Bottom info */}
      <div style={{ position: 'absolute', left: 14, right: 60, bottom: 12, color: 'white', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ fontSize: 13, fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{handle}</p>
        <p style={{ fontSize: 12, lineHeight: 1.4, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
          {caption ? <>{caption.split(' ').slice(0, 18).join(' ')}{caption.split(' ').length > 18 ? '…' : ''}</> : null}
        </p>
      </div>
      {/* Right vertical actions */}
      <div style={{ position: 'absolute', right: 10, bottom: 12, display: 'flex', flexDirection: 'column', gap: 14, color: 'white' }}>
        <ReelIcon icon={<Heart size={22} />} label="1,2k" />
        <ReelIcon icon={<MessageCircle size={22} />} label="48" />
        <ReelIcon icon={<Send size={22} />} label="Partager" />
      </div>
    </div>
  );
}

function ReelIcon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {icon}
      <span style={{ fontSize: 11, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{label}</span>
    </div>
  );
}

/* ============================ Facebook ============================ */

function FacebookPreview({ media, caption, handle, format }: { media: StudioV2MediaItem | null; caption: string; handle: string; format: PreviewFormat }) {
  const isVertical = format === 'story' || format === 'reel';
  const aspect = isVertical ? '9 / 16' : format === 'carousel' ? '1 / 1' : '1.91 / 1';

  if (isVertical) {
    return (
      <div style={{ width: '100%', aspectRatio: '9 / 16', maxWidth: 320, position: 'relative', borderRadius: 'var(--cs-radius-md)', overflow: 'hidden', background: '#000', boxShadow: 'var(--cs-shadow-lg)' }}>
        {renderMedia(media, 'cover')}
        <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 60, background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #1877F2, #4267B2)', display: 'grid', placeItems: 'center', color: 'white', fontFamily: 'var(--cs-font-display)', fontWeight: 600, fontSize: 12 }}>F</div>
          <span style={{ color: 'white', fontSize: 12, fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>{handle}</span>
        </div>
        {caption ? (
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 24, color: 'white', fontSize: 14, lineHeight: 1.4, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
            {caption.split(' ').slice(0, 14).join(' ')}{caption.split(' ').length > 14 ? '…' : ''}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ ...feedFrame, maxWidth: 360 }}>
      <Header handle={handle} subline="Page · Boutique · 2 h" platform="facebook" />
      <p style={{ padding: '10px 14px 12px', fontSize: 14, lineHeight: 1.5, color: 'var(--cs-fg-primary)' }}>
        {caption.length > 300 ? <>{caption.slice(0, 300)}<span style={{ color: 'var(--cs-accent)', cursor: 'pointer' }}>… Voir plus</span></> : caption}
      </p>
      {media ? (
        <div style={{ aspectRatio: aspect, background: 'var(--cs-bg-sunken)', position: 'relative' }}>
          {renderMedia(media, 'cover')}
          {format === 'carousel' ? (
            <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
              {[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'white' : 'rgba(255,255,255,0.5)' }} />)}
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{ padding: '10px 14px', display: 'flex', gap: 18, fontSize: 13, color: 'var(--cs-fg-secondary)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Heart size={16} /> 312</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><MessageCircle size={16} /> 24</span>
      </div>
    </div>
  );
}

/* ============================ Shared bits ============================ */

const feedFrame: React.CSSProperties = {
  background: 'var(--cs-bg-elevated)',
  border: '1px solid var(--cs-border)',
  borderRadius: 'var(--cs-radius-md)',
  overflow: 'hidden',
  boxShadow: 'var(--cs-shadow-md)',
  maxWidth: 320,
};

function Header({ handle, subline, platform = 'instagram' }: { handle: string; subline: string; platform?: 'instagram' | 'facebook' }) {
  return (
    <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--cs-border-hair)' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: platform === 'instagram'
            ? 'linear-gradient(135deg, var(--cs-accent), var(--cs-saffron))'
            : 'linear-gradient(135deg, #1877F2, #4267B2)',
          display: 'grid',
          placeItems: 'center',
          color: 'white',
          fontFamily: 'var(--cs-font-display)',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        F
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cs-fg-primary)' }}>{handle}</div>
        <div style={{ fontSize: 11, color: 'var(--cs-fg-muted)' }}>{subline}</div>
      </div>
      <span style={{ color: 'var(--cs-fg-muted)', fontSize: 18 }}>⋯</span>
    </div>
  );
}

function ActionsBar() {
  return (
    <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 13 }}>
      <Heart size={22} style={{ color: 'var(--cs-fg-primary)', cursor: 'pointer' }} />
      <MessageCircle size={22} style={{ color: 'var(--cs-fg-primary)', cursor: 'pointer' }} />
      <Send size={22} style={{ color: 'var(--cs-fg-primary)', cursor: 'pointer' }} />
      <Bookmark size={22} style={{ marginLeft: 'auto', color: 'var(--cs-fg-primary)', cursor: 'pointer' }} />
    </div>
  );
}

function renderMedia(media: StudioV2MediaItem | null, fit: 'cover' | 'contain') {
  if (!media) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(circle at 30% 30%, rgba(255,180,150,0.45), transparent 55%), radial-gradient(circle at 70% 70%, rgba(156,42,71,0.35), transparent 60%), linear-gradient(135deg, var(--cs-saffron), var(--cs-accent))',
        }}
      />
    );
  }
  if (media.kind === 'video') {
    return <VideoPlayer media={media} fit={fit} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={media.previewUrl}
      alt={media.alt}
      style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }}
    />
  );
}

function formatHashtags(caption: string): string {
  return caption
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/#(\w+)/g, '<span style="color: var(--cs-accent); font-weight: 500;">#$1</span>');
}
