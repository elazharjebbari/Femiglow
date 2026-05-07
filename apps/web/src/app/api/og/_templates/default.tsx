/**
 * Template default — fallback minimal typographique.
 */
import type { OgTemplateProps } from './types';

const CREAM = '#FAF6EE';
const INK = '#1F2937';
const SAGE = '#A8B5A0';

export function DefaultTemplate({ title, siteName }: OgTemplateProps) {
  return (
    <div
      style={{
        width: '1200px',
        height: '630px',
        background: CREAM,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px',
      }}
    >
      <div
        style={{
          color: INK,
          fontFamily: 'serif',
          fontSize: 96,
          lineHeight: 1.1,
          textAlign: 'center',
        }}
      >
        {title || siteName}
      </div>
      <div
        style={{
          marginTop: 48,
          height: 3,
          width: '300px',
          background: `linear-gradient(90deg, ${SAGE} 0%, ${INK} 100%)`,
        }}
      />
    </div>
  );
}
