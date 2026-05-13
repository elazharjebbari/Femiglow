/**
 * Favicon dynamique généré par Next.js depuis le code.
 * Convention App Router : `app/icon.tsx` (32×32 par défaut).
 * cf. https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons
 */
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 18,
          background: '#FBF8F1',
          color: '#1a1a1a',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Georgia, serif',
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}
      >
        F
      </div>
    ),
    { ...size },
  );
}
