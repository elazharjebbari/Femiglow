import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Monorepo pnpm — Next.js scanne par défaut depuis `apps/web/` ce qui rate
  // les `node_modules` hoistés à la racine. Sans `outputFileTracingRoot`, les
  // vendor chunks (framer-motion, zod, etc.) ne sont pas inclus dans
  // `.next/server/vendor-chunks/` → erreurs `Cannot find module ./vendor-chunks/…`
  // au runtime `pnpm start`. cf. github.com/vercel/next.js/issues/52553
  outputFileTracingRoot: path.join(__dirname, '../..'),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    optimizePackageImports: ['framer-motion'],
    serverComponentsExternalPackages: ['@node-rs/argon2', 'sharp', 'fluent-ffmpeg', 'ffmpeg-static', 'isomorphic-dompurify', 'jsdom'],
    instrumentationHook: true,
    // Note : `optimizeCss` (critters) NON utilisé — Next 14.2 ne bundle plus
    // critters pour App Router (streaming RSC incompatible). Pour réduire le
    // render-blocking CSS, on s'appuie sur :
    //  - split admin-fields.css (gain ~11 KB sur pages publiques)
    //  - cache headers (HTML no-store + chunks immutable) → cf. headers()
    //  - tailwind purge (config existante)
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
      // Legacy /favicon.ico → on sert le favicon dynamique généré par
      // `app/icon.tsx`. Les browsers modernes utilisent le <link rel=icon>
      // (auto-injecté) ; ce rewrite est juste pour les outils/clients
      // historiques qui requêtent encore /favicon.ico par défaut.
      { source: '/favicon.ico', destination: '/icon' },
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
      // Chunks JS/CSS hashés : immutable 1 an. Le hash change à chaque
      // déploiement, on peut donc cacher agressivement sans risque de stale.
      // Évite que l'utilisateur charge un chunk obsolète après un déploy.
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Images optimisées Next servies dynamiquement : cache court côté CDN.
      {
        source: '/_next/image/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ];
  },
};

export default nextConfig;
