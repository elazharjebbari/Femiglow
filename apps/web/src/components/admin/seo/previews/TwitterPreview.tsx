'use client';

/**
 * <TwitterPreview> — simulation carte Twitter/X (summary / summary_large_image).
 * cf. docs/seo-cms/frontend/03-preview-serp.md
 */

interface TwitterPreviewProps {
  card: 'summary' | 'summary_large_image';
  title: string;
  description: string;
  imageUrl?: string;
  handle?: string;
  domain: string;
}

export function TwitterPreview({
  card,
  title,
  description,
  imageUrl,
  handle,
  domain,
}: TwitterPreviewProps) {
  const isLarge = card === 'summary_large_image';
  if (isLarge) {
    return (
      <div
        role="img"
        aria-label="Prévisualisation Twitter (summary_large_image)"
        style={{
          fontFamily: "'Chirp', system-ui, sans-serif",
          border: '1px solid #cfd9de',
          borderRadius: 16,
          overflow: 'hidden',
          maxWidth: 506,
          background: '#fff',
        }}
      >
        <div
          style={{
            width: '100%',
            aspectRatio: '1.91 / 1',
            background: imageUrl
              ? `center / cover no-repeat url(${JSON.stringify(imageUrl)})`
              : '#e7e7e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#536471',
            fontSize: 14,
          }}
        >
          {!imageUrl ? 'Aucune image' : null}
        </div>
        <div style={{ padding: '8px 12px' }}>
          <div style={{ color: '#536471', fontSize: 13 }}>{domain}</div>
          <div style={{ color: '#0f1419', fontSize: 15, lineHeight: '1.3' }}>
            {title || '(title vide)'}
          </div>
          <div
            style={{
              color: '#536471',
              fontSize: 13,
              marginTop: 2,
              lineHeight: '1.4',
            }}
          >
            {description || '(description vide)'}
          </div>
          {handle ? (
            <div style={{ color: '#536471', fontSize: 12, marginTop: 4 }}>{handle}</div>
          ) : null}
        </div>
      </div>
    );
  }

  // summary (square small image left)
  return (
    <div
      role="img"
      aria-label="Prévisualisation Twitter (summary)"
      style={{
        fontFamily: "'Chirp', system-ui, sans-serif",
        border: '1px solid #cfd9de',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        maxWidth: 506,
        background: '#fff',
      }}
    >
      <div
        style={{
          width: 144,
          minHeight: 144,
          flexShrink: 0,
          background: imageUrl
            ? `center / cover no-repeat url(${JSON.stringify(imageUrl)})`
            : '#e7e7e8',
        }}
      />
      <div style={{ padding: '12px', flex: 1 }}>
        <div style={{ color: '#536471', fontSize: 13 }}>{domain}</div>
        <div
          style={{
            color: '#0f1419',
            fontSize: 15,
            fontWeight: 600,
            lineHeight: '1.3',
          }}
        >
          {title || '(title vide)'}
        </div>
        <div
          style={{
            color: '#536471',
            fontSize: 13,
            marginTop: 2,
            lineHeight: '1.4',
          }}
        >
          {description || '(description vide)'}
        </div>
        {handle ? (
          <div style={{ color: '#536471', fontSize: 12, marginTop: 4 }}>{handle}</div>
        ) : null}
      </div>
    </div>
  );
}
