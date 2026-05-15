/**
 * Hôtes CSP statiques par kind de provider.
 *
 * Ce module est conçu pour être importé depuis le middleware Edge :
 * il NE doit PAS importer d'adaptateur (qui dépendent de `node:crypto`)
 * ni de code Node-only. Si un nouvel adaptateur est ajouté, mettre à
 * jour cette table en parallèle de son `cspHosts()`.
 */
import type { TrackingProviderKind } from '@/lib/db/types';

export interface CspHostMap {
  scriptSrc: readonly string[];
  connectSrc: readonly string[];
}

export const TRACKING_CSP_HOSTS: Readonly<Record<TrackingProviderKind, CspHostMap>> = {
  meta: {
    scriptSrc: ['https://connect.facebook.net'],
    connectSrc: ['https://www.facebook.com', 'https://graph.facebook.com'],
  },
  google_ga4: {
    scriptSrc: ['https://www.googletagmanager.com'],
    connectSrc: [
      'https://www.google-analytics.com',
      'https://*.google-analytics.com', // region1.google-analytics.com etc.
      'https://analytics.google.com',
      'https://*.analytics.google.com',
      'https://stats.g.doubleclick.net',
      'https://*.g.doubleclick.net',
    ],
  },
  google_ads: {
    scriptSrc: [
      'https://www.googletagmanager.com',
      'https://www.googleadservices.com',
      'https://pagead2.googlesyndication.com',
    ],
    connectSrc: [
      'https://www.google.com',
      'https://www.google.fr',
      'https://www.google.ma', // marché FemiGlow (Maroc)
      'https://googleads.g.doubleclick.net',
      'https://www.googletagmanager.com',
      // Endpoint critique pour les pings de conversion Google Ads.
      // Sans ça, le browser bloque la requête avec une erreur CSP
      // "connect-src blocked request to pagead2.googlesyndication.com"
      // et la conversion N'EST PAS COMPTÉE par Google Ads.
      'https://pagead2.googlesyndication.com',
      'https://www.googleadservices.com',
    ],
  },
  tiktok: {
    scriptSrc: ['https://analytics.tiktok.com'],
    connectSrc: ['https://analytics.tiktok.com', 'https://business-api.tiktok.com'],
  },
  snap: {
    scriptSrc: ['https://sc-static.net'],
    connectSrc: ['https://tr.snapchat.com'],
  },
  pinterest: {
    scriptSrc: ['https://s.pinimg.com'],
    connectSrc: ['https://ct.pinterest.com', 'https://api.pinterest.com'],
  },
  gtm: {
    scriptSrc: ['https://www.googletagmanager.com', 'https://tagassistant.google.com'],
    connectSrc: [
      'https://www.googletagmanager.com',
      'https://*.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://*.google-analytics.com',
      'https://analytics.google.com',
      'https://*.analytics.google.com',
    ],
  },
  custom: {
    scriptSrc: [],
    connectSrc: [],
  },
};
