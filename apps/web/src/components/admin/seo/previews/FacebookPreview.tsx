'use client';

/**
 * <FacebookPreview> — simulation carte OG (link unfurl).
 * cf. docs/seo-cms/frontend/03-preview-serp.md
 */

interface FacebookPreviewProps {
  ogTitle: string;
  ogDescription: string;
  ogImageUrl?: string;
  urlHost: string;
  variant?: 'large' | 'small';
}

export function FacebookPreview({
  ogTitle,
  ogDescription,
  ogImageUrl,
  urlHost,
  variant = 'large',
}: FacebookPreviewProps) {
  const isLarge = variant === 'large';
  return (
    <div
      role="img"
      aria-label="Prévisualisation Facebook (Open Graph)"
      style={{
        fontFamily: 'SegoeUI, system-ui, sans-serif',
        border: '1px solid #ced0d4',
        borderRadius: 8,
        overflow: 'hidden',
        maxWidth: 524,
        background: '#f0f2f5',
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: isLarge ? '1.91 / 1' : '1 / 1',
          background: ogImageUrl
            ? `center / cover no-repeat url(${JSON.stringify(ogImageUrl)})`
            : 'repeating-linear-gradient(45deg,#dcdde0,#dcdde0 8px,#e4e6eb 8px,#e4e6eb 16px)',
          color: '#65676b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
        }}
      >
        {!ogImageUrl ? 'Aucune image OG' : null}
      </div>
      <div
        style={{
          padding: '10px 12px',
          background: '#f0f2f5',
          borderTop: '1px solid #ced0d4',
        }}
      >
        <div
          style={{
            color: '#65676b',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          {urlHost}
        </div>
        <div
          style={{
            color: '#050505',
            fontSize: 16,
            fontWeight: 600,
            margin: '2px 0',
            lineHeight: '1.3',
          }}
        >
          {ogTitle || '(OG title vide)'}
        </div>
        <div style={{ color: '#65676b', fontSize: 14, lineHeight: '1.4' }}>
          {ogDescription || '(OG description vide)'}
        </div>
      </div>
    </div>
  );
}
