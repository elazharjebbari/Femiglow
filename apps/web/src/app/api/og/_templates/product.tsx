/**
 * Template product — packshot droite, texte gauche.
 */
import type { OgTemplateProps } from './types';

const CREAM = '#FAF6EE';
const INK = '#1F2937';
const SAGE = '#A8B5A0';

export function ProductTemplate({
  title,
  description,
  siteName,
  imageUrl,
  price,
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
          width: '50%',
          padding: '64px 56px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            color: SAGE,
            fontSize: 20,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          {siteName}
        </div>
        <div
          style={{
            color: INK,
            fontFamily: 'serif',
            fontSize: 72,
            lineHeight: 1.05,
            marginTop: 'auto',
          }}
        >
          {title}
        </div>
        <div style={{ color: INK, opacity: 0.7, fontSize: 24, marginTop: 16 }}>
          {description}
        </div>
        {price ? (
          <div
            style={{
              color: SAGE,
              fontSize: 32,
              marginTop: 32,
              fontWeight: 600,
            }}
          >
            {price}
          </div>
        ) : null}
      </div>
      <div
        style={{
          width: '50%',
          background: imageUrl
            ? `center / contain no-repeat ${CREAM} url(${JSON.stringify(imageUrl)})`
            : SAGE,
          display: 'flex',
        }}
      />
    </div>
  );
}
