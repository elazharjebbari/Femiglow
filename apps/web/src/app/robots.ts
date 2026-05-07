import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const isProduction = env.NEXT_PUBLIC_ENV === 'production';

  if (!isProduction) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/panier', '/commander', '/merci'],
      },
      // Phase 1 : refus explicite des crawlers IA.
      // Décision réversible une fois la posture éditoriale stabilisée.
      { userAgent: 'GPTBot', disallow: '/' },
      { userAgent: 'CCBot', disallow: '/' },
      { userAgent: 'ClaudeBot', disallow: '/' },
      { userAgent: 'Google-Extended', disallow: '/' },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
