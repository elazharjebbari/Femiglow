'use client';

/**
 * <SerpPreview> — simulation carte Google desktop / mobile.
 * cf. docs/seo-cms/frontend/03-preview-serp.md
 */

interface SerpPreviewProps {
  url: string;
  title: string;
  description: string;
  faviconUrl?: string;
  device?: 'desktop' | 'mobile';
  date?: string;
  breadcrumbs?: string[];
}

const TITLE_MAX_DESKTOP = 60;
const DESC_MAX_DESKTOP = 158;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(' ', max - 1);
  return (cut > 0 ? s.slice(0, cut) : s.slice(0, max - 1)) + '…';
}

export function SerpPreview({
  url,
  title,
  description,
  faviconUrl,
  device = 'desktop',
  date,
  breadcrumbs,
}: SerpPreviewProps) {
  const isMobile = device === 'mobile';
  const titleShown = truncate(title || '(title vide)', TITLE_MAX_DESKTOP);
  const descShown = truncate(description || '(description vide)', DESC_MAX_DESKTOP);
  let host = url;
  let path = '';
  try {
    const u = new URL(url);
    host = u.host;
    path = u.pathname.replace(/^\/+/, '').replace(/\//g, ' › ');
  } catch {
    // ignore
  }
  const crumbs = breadcrumbs ?? (path ? [host, ...path.split(' › ')] : [host]);

  return (
    <div
      role="img"
      aria-label="Prévisualisation Google"
      style={{
        fontFamily: 'Arial, system-ui, sans-serif',
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        padding: 16,
        maxWidth: isMobile ? 360 : 600,
        color: '#202124',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {faviconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={faviconUrl} alt="" width={18} height={18} style={{ borderRadius: '50%' }} />
        ) : (
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#e0e0e0',
            }}
          />
        )}
        <span style={{ fontSize: 14, color: '#202124' }}>{crumbs.join(' › ')}</span>
      </div>
      <div
        style={{
          color: '#1a0dab',
          fontSize: isMobile ? 18 : 20,
          lineHeight: '1.3',
          fontWeight: 400,
          marginBottom: 4,
          cursor: 'pointer',
        }}
      >
        {titleShown}
      </div>
      <div style={{ color: '#4d5156', fontSize: 14, lineHeight: '1.58' }}>
        {date ? <span style={{ color: '#70757a' }}>{date} — </span> : null}
        {descShown}
      </div>
    </div>
  );
}
