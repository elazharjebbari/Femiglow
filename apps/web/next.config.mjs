/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    optimizePackageImports: ['framer-motion', 'zustand'],
    serverComponentsExternalPackages: ['@node-rs/argon2', 'sharp', 'fluent-ffmpeg', 'ffmpeg-static'],
    instrumentationHook: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 720, 960, 1280, 1600, 1920],
    imageSizes: [80, 160, 240, 320],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Phase 1 : on autorise les SVG locaux pour les placeholders éditoriaux.
    // Phase 2 : à désactiver dès que les images photographiques arrivent.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      { protocol: 'https', hostname: 'images.femiglow.ma' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
  async redirects() {
    return [
      { source: '/products/:slug([a-z0-9-]+)', destination: '/kit', permanent: true },
      { source: '/blog/:slug', destination: '/journal/:slug', permanent: true },
    ];
  },
  async rewrites() {
    // `_media` est un dossier "privé" pour le routeur Next.js (préfixe `_`),
    // donc même un `route.ts` placé sous `app/_media/` ne route pas. On garde
    // l'URL publique `/_media/...` (stockée en DB) en la réécrivant vers la
    // route handler réelle, qui vit sous `app/media-files/`.
    return [
      { source: '/_media/:path*', destination: '/media-files/:path*' },
    ];
  },
  async headers() {
    // Note : CSP / HSTS / X-Frame-Options sont définis dynamiquement dans
    // src/middleware.ts (CSP nonce per-request). On garde ici les
    // en-têtes statiques qui ne dépendent pas de la requête.
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
