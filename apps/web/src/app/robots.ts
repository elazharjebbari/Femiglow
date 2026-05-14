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
        // /admin/legal et /legal/<noindex> sont déjà protégés par
        // X-Robots-Tag (admin) / meta robots (legal noindex), mais on
        // bloque aussi côté robots.txt pour économiser le budget crawl.
        // Les pages /legal/livraison et /legal/faq (include_in_search=true)
        // restent allow par défaut.
        disallow: [
          '/api/',
          '/panier',
          '/commander',
          '/merci',
          '/admin/',
        ],
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
