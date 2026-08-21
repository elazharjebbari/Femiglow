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
  /** Hosts à whitelist dans `frame-src` (iframes injectées par les balises :
   * conversion/remarketing Google Ads via doubleclick, GTM, Meta). Sans ça,
   * `frame-src` retombe sur sa liste explicite et bloque ces iframes →
   * GTM « Qualité du conteneur » signale un CSP incomplet. */
  frameSrc?: readonly string[];
}

/**
 * Hôtes communs à plusieurs providers — utilisés par les Built-in
 * variables GTM, Tag Assistant, Looker Studio etc. Whitelisted une
 * seule fois pour éviter les blocages CSP sur les sous-domaines
 * gérés par Google côté éditeur.
 */
const GOOGLE_COMMON_SCRIPT = [
  'https://www.googletagmanager.com',
  'https://*.googletagmanager.com',
  'https://tagassistant.google.com',
  'https://www.google.com',
] as const;

const GOOGLE_COMMON_CONNECT = [
  'https://www.google.com',
  'https://www.google.fr',
  'https://www.google.ma', // marché FemiGlow (Maroc)
  'https://www.google.be',
  'https://www.google.ca',
  'https://*.google-analytics.com',
  'https://www.google-analytics.com',
  'https://analytics.google.com',
  'https://*.analytics.google.com',
  'https://stats.g.doubleclick.net',
  'https://*.g.doubleclick.net',
  // `ad.doubleclick.net` (et autres sous-domaines hors `.g.`) — signalé bloqué
  // par GTM « Qualité du conteneur ». Le wildcard couvre ad./td./googleads.g./
  // bid.g. et tout futur sous-domaine doubleclick sur connect-src.
  'https://*.doubleclick.net',
  'https://googleads.g.doubleclick.net',
  'https://www.googletagmanager.com',
  'https://*.googletagmanager.com',
  'https://tagassistant.google.com',
] as const;

/**
 * Hôtes `frame-src` communs Google — iframes injectées par le gtag / GTM :
 *  - `td.doubleclick.net` + `*.doubleclick.net` : iframe conversion & remarketing
 *    Google Ads (bid.g.doubleclick.net inclus).
 *  - `www.googletagmanager.com` : iframe GTM (noscript + certaines balises).
 *  - `www.google.com` : iframe de certaines conversions.
 */
const GOOGLE_COMMON_FRAME = [
  'https://td.doubleclick.net',
  'https://*.doubleclick.net',
  'https://www.googletagmanager.com',
  'https://www.google.com',
] as const;

export const TRACKING_CSP_HOSTS: Readonly<Record<TrackingProviderKind, CspHostMap>> = {
  meta: {
    scriptSrc: [
      'https://connect.facebook.net',
      'https://*.facebook.com',
      'https://*.facebook.net',
    ],
    connectSrc: [
      'https://www.facebook.com',
      'https://graph.facebook.com',
      'https://*.facebook.com',
      'https://*.facebook.net',
      // Endpoint pixel Meta (events tracking pixel-side)
      'https://www.facebook.com/tr',
      // Endpoints Meta business
      'https://business.facebook.com',
    ],
    frameSrc: ['https://www.facebook.com', 'https://*.facebook.com'],
  },
  google_ga4: {
    scriptSrc: [...GOOGLE_COMMON_SCRIPT],
    connectSrc: [...GOOGLE_COMMON_CONNECT],
    frameSrc: [...GOOGLE_COMMON_FRAME],
  },
  google_ads: {
    scriptSrc: [
      ...GOOGLE_COMMON_SCRIPT,
      'https://www.googleadservices.com',
      'https://pagead2.googlesyndication.com',
      'https://*.googlesyndication.com',
      // View-through conversion endpoint — émis par le gtag pixel
      // Google Ads. Bloqué par script-src-elem sans whitelist.
      'https://googleads.g.doubleclick.net',
      'https://*.doubleclick.net',
    ],
    connectSrc: [
      ...GOOGLE_COMMON_CONNECT,
      // Endpoint conversion ping — silencieusement bloqué sans ça
      // (Google Ads ne compte aucune conversion → ROAS faux).
      'https://pagead2.googlesyndication.com',
      'https://*.googlesyndication.com',
      'https://www.googleadservices.com',
      // Beacons additionnels Google Ads / DSP
      'https://td.doubleclick.net',
      'https://adservice.google.com',
      'https://adservice.google.fr',
      'https://adservice.google.ma',
    ],
    frameSrc: [...GOOGLE_COMMON_FRAME],
  },
  tiktok: {
    scriptSrc: [
      'https://analytics.tiktok.com',
      // Endpoint EU (DPA TikTok Ads) — utile selon hébergement visiteur
      'https://analytics-eu.tiktok.com',
      'https://*.tiktok.com',
    ],
    connectSrc: [
      'https://analytics.tiktok.com',
      'https://analytics-eu.tiktok.com',
      'https://business-api.tiktok.com',
      'https://*.tiktok.com',
    ],
  },
  snap: {
    scriptSrc: [
      'https://sc-static.net',
      'https://*.snapchat.com',
    ],
    connectSrc: [
      'https://tr.snapchat.com',
      'https://*.snapchat.com',
    ],
  },
  pinterest: {
    scriptSrc: [
      'https://s.pinimg.com',
      'https://*.pinimg.com',
    ],
    connectSrc: [
      'https://ct.pinterest.com',
      'https://api.pinterest.com',
      'https://*.pinterest.com',
    ],
  },
  gtm: {
    scriptSrc: [
      ...GOOGLE_COMMON_SCRIPT,
      // Server-side GTM (futur — proxy /gtag sur même domaine)
      'https://*.serverside.gtm.com',
    ],
    connectSrc: [...GOOGLE_COMMON_CONNECT],
    frameSrc: [...GOOGLE_COMMON_FRAME],
  },
  custom: {
    scriptSrc: [],
    connectSrc: [],
  },
};
