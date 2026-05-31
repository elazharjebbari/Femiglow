import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import localFont from 'next/font/local';
import { Cairo } from 'next/font/google';
import { getTranslations } from 'next-intl/server';
import { coerceLocale, getLocaleConfig } from '@/i18n.config';
import '@/styles/globals.css';
import { SkipLink } from '@/components/layout/SkipLink';
import { TrackingProvider } from '@/lib/tracking/provider';
import { TrackingGlobalListener } from '@/lib/tracking/global-listener';
import {
  ConsentBanner,
  DEFAULT_CONSENT_LABELS,
  type ConsentBannerLabels,
} from '@/components/tracking/ConsentBanner';
import { DebugOverlay } from '@/components/tracking/DebugOverlay';
import { PixelLoader } from '@/components/tracking/PixelLoader';
import { SnapPixelEvents } from '@/components/tracking/SnapPixelEvents';
import { GtmHeadScript } from '@/components/tracking/GtmHeadScript';
import { AttributionCaptureBridge } from '@/components/tracking/AttributionCaptureBridge';
import { getAttributionStrategy } from '@/lib/tracking/attribution/server';
import {
  getTrackingSetting,
  TRACKING_SETTING_KEYS,
} from '@/lib/db/queries/tracking/settings';
import { ensureSeedOnce } from '@/lib/boot/seed-on-boot';
import { ChatWidgetMount } from '@/components/chat/ChatWidgetMount';
import { MobileFocusGuard } from '@/components/a11y/MobileFocusGuard';
import { listPlacementsForZone } from '@/lib/legal/repository';

async function loadCookieBannerLegalLinks(): Promise<Array<{ slug: string; label: string }>> {
  try {
    const rows = await listPlacementsForZone('cookie-banner-links');
    return rows.map((r) => ({ slug: r.pageSlug, label: r.labelOverride ?? r.title }));
  } catch {
    return [];
  }
}

/**
 * Libellés du bandeau cookies traduits pour la locale active. Le ConsentBanner
 * est rendu dans le layout RACINE (hors `NextIntlClientProvider`), donc on
 * résout les strings côté serveur et on les passe en props. Fail-soft → FR.
 */
async function loadConsentLabels(locale: string): Promise<ConsentBannerLabels> {
  try {
    const t = await getTranslations({ locale, namespace: 'consentBanner' });
    return {
      title: t('title'),
      description: t('description'),
      learnMore: t('learnMore'),
      categories: {
        analytics_storage: t('categories.analytics_storage'),
        ad_storage: t('categories.ad_storage'),
        ad_user_data: t('categories.ad_user_data'),
        ad_personalization: t('categories.ad_personalization'),
        functional_storage: t('categories.functional_storage'),
      },
      rejectAll: t('rejectAll'),
      customize: t('customize'),
      close: t('close'),
      save: t('save'),
      acceptAll: t('acceptAll'),
    };
  } catch {
    return DEFAULT_CONSENT_LABELS;
  }
}

const cormorant = localFont({
  src: '../../public/fonts/cormorant-garamond.woff2',
  weight: '400 600',
  style: 'normal',
  display: 'swap',
  variable: '--font-cormorant',
});

const inter = localFont({
  src: '../../public/fonts/inter.woff2',
  weight: '400 500',
  style: 'normal',
  display: 'swap',
  variable: '--font-inter',
});

const pinyon = localFont({
  src: '../../public/fonts/pinyon-script.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-pinyon',
});

// Phase 4.3 — Police arabe Cairo (Google Fonts) chargée à côté d'Inter/Cormorant.
// Activée via CSS `[lang='ar']` dans globals.css — pas de bandwidth perdu en
// LTR car next/font/google subsette automatiquement à `subsets: ['arabic']`.
// `display: 'swap'` évite le FOIT (Flash of Invisible Text) sur transition.
const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  style: 'normal',
  display: 'swap',
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    template: '%s — FemiGlow',
    default: 'FemiGlow — Le rituel ongles, en cinq minutes',
  },
  description:
    'FemiGlow — maison marocaine de soin pour les ongles. Un rituel saisonnier, en cinq minutes, à la maison.',
  authors: [{ name: 'FemiGlow' }],
  creator: 'FemiGlow',
  publisher: 'FemiGlow',
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: '/', languages: { 'fr-MA': '/' } },
  openGraph: {
    type: 'website',
    locale: 'fr_MA',
    siteName: 'FemiGlow',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // NB: `interactiveWidget: 'resizes-content'` (Chrome Android) retiré car
  // Safari logge un warning "Viewport argument key 'interactive-widget' not
  // recognized" qui pollue la console. iOS Safari gère déjà le clavier via
  // `100dvh` + `visualViewport` API. WCAG SC 1.4.4 OK (pas de maximumScale).
  themeColor: '#FBF8F1',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Auto-seed (mémoire ou AUTO_SEED=1) — idempotent, exécuté une seule
  // fois par process Node. Garantit que /admin/products + /admin/seo
  // soient peuplés au premier rendu serveur.
  await ensureSeedOnce();

  // i18n SSR — locale active posée par le middleware (`x-locale`, dérivée du
  // 1er segment d'URL). Elle pilote `<html lang/dir>` dès le HTML initial :
  // source unique serveur+client, donc plus de divergence d'hydratation ni de
  // flash LTR. Fallback DEFAULT_LOCALE pour les routes legacy non préfixées.
  const activeLocale = coerceLocale(headers().get('x-locale'));
  const { direction } = getLocaleConfig(activeLocale);

  // Lit la configuration globale du bandeau cookies. Les valeurs par
  // défaut (banner activé, consent denied) couvrent l'install initiale ;
  // l'admin peut désactiver le bandeau dans /admin/tracking/settings pour
  // les juridictions où il n'est pas obligatoire (Maroc, US…).
  const [
    bannerEnabled,
    defaultGranted,
    cookieBannerLegalLinks,
    attributionStrategy,
    consentLabels,
  ] = await Promise.all([
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.CONSENT_BANNER_ENABLED, true),
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.CONSENT_DEFAULT_GRANTED, false),
    loadCookieBannerLegalLinks(),
    getAttributionStrategy(),
    loadConsentLabels(activeLocale),
  ]);

  return (
    <html
      lang={activeLocale}
      dir={direction}
      className={`${cormorant.variable} ${inter.variable} ${pinyon.variable} ${cairo.variable}`}
    >
      <body className="min-h-screen bg-creme font-body text-encre antialiased">
        {/* GTM bootstrap — chargé synchroniquement pour que Tag
            Assistant / Preview Mode détecte le conteneur dès le HTML
            initial. Le consentement est géré via Consent Mode v2
            (defaults = denied tant que le bandeau n'est pas accepté). */}
        <GtmHeadScript defaultGranted={defaultGranted} />
        <SkipLink />
        {/* Bloque l'auto-zoom iOS/Android sur les champs texte. Aucun
            impact UX en dehors d'une saisie. cf. MobileFocusGuard. */}
        <MobileFocusGuard />
        <TrackingProvider
          bannerEnabled={bannerEnabled}
          defaultGranted={defaultGranted}
          attributionStrategy={attributionStrategy}
        >
          <TrackingGlobalListener />
          {children}
          <ConsentBanner
            enabled={bannerEnabled}
            defaultGranted={defaultGranted}
            legalLinks={cookieBannerLegalLinks}
            labels={consentLabels}
          />
          <AttributionCaptureBridge />
          <PixelLoader />
          <SnapPixelEvents />
          <DebugOverlay />
          <ChatWidgetMount />
        </TrackingProvider>
      </body>
    </html>
  );
}
