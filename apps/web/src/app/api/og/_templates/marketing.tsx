/**
 * Template marketing — fond crème, titre Cormorant 80px.
 */
import type { OgTemplateProps } from './types';

const CREAM = '#FAF6EE';
const SAGE = '#A8B5A0';
const INK = '#1F2937';

export function MarketingTemplate({ title, description, siteName }: OgTemplateProps) {
  return (
    <div
      style={{
        width: '1200px',
        height: '630px',
        background: CREAM,
        display: 'flex',
        flexDirection: 'column',
        padding: '64px',
        fontFamily: 'serif',
      }}
    >
      <div
        style={{
          color: SAGE,
          fontSize: 24,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}
      >
        {siteName}
      </div>
      <div
        style={{
          color: INK,
          fontSize: 80,
          fontWeight: 500,
          lineHeight: 1.1,
          marginTop: 'auto',
          maxWidth: '960px',
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: INK,
          opacity: 0.7,
          fontSize: 32,
          marginTop: 24,
          maxWidth: '960px',
          fontFamily: 'sans-serif',
        }}
      >
        {description}
      </div>
      <div
        style={{
          marginTop: 48,
          height: 3,
          width: '100%',
          background: `linear-gradient(90deg, ${SAGE} 0%, ${INK} 100%)`,
        }}
      />
    </div>
  );
}
