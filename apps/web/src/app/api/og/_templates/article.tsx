/**
 * Template article — image hero gauche, texte droite.
 */
import type { OgTemplateProps } from './types';

const CREAM = '#FAF6EE';
const INK = '#1F2937';
const SAGE = '#A8B5A0';

export function ArticleTemplate({
  title,
  description,
  siteName,
  imageUrl,
  kicker,
}: OgTemplateProps) {
  return (
    <div
      style={{
        width: '1200px',
        height: '630px',
        background: CREAM,
        display: 'flex',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          width: '60%',
          background: imageUrl
            ? `center / cover no-repeat url(${JSON.stringify(imageUrl)})`
            : SAGE,
        }}
      />
      <div
        style={{
          width: '40%',
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {kicker ? (
          <div
            style={{
              color: SAGE,
              fontSize: 18,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
            }}
          >
            {kicker}
          </div>
        ) : null}
        <div
          style={{
            color: INK,
            fontFamily: 'serif',
            fontSize: 64,
            lineHeight: 1.05,
            marginTop: 'auto',
          }}
        >
          {title}
        </div>
        <div style={{ color: INK, opacity: 0.7, fontSize: 24, marginTop: 16 }}>
          {description}
        </div>
        <div
          style={{
            color: SAGE,
            fontSize: 16,
            marginTop: 32,
            letterSpacing: '0.1em',
          }}
        >
          {siteName}
        </div>
      </div>
    </div>
  );
}
