import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import '@/styles/globals.css';
import { SkipLink } from '@/components/layout/SkipLink';
import { TrackingProvider } from '@/lib/tracking/provider';
import { TrackingGlobalListener } from '@/lib/tracking/global-listener';
import { ConsentBanner } from '@/components/tracking/ConsentBanner';
import { DebugOverlay } from '@/components/tracking/DebugOverlay';
import { PixelLoader } from '@/components/tracking/PixelLoader';
import {
  getTrackingSetting,
  TRACKING_SETTING_KEYS,
} from '@/lib/db/queries/tracking/settings';
import { ensureSeedOnce } from '@/lib/boot/seed-on-boot';
import { ChatWidgetMount } from '@/components/chat/ChatWidgetMount';

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
  // CHA-mobile-ux : `resizes-content` indique aux navigateurs mobiles
  // (Chrome Android d'abord) de réduire la viewport quand le clavier
  // virtuel apparaît, au lieu de la laisser couvrir le composer. Sur
  // iOS Safari, le combo `100dvh` + `visualViewport` API fait le reste.
  // ⚠ Volontairement PAS de `maximumScale: 1` ni `userScalable: false`
  // qui violeraient WCAG SC 1.4.4 (Resize Text).
  interactiveWidget: 'resizes-content',
  themeColor: '#FBF8F1',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Auto-seed (mémoire ou AUTO_SEED=1) — idempotent, exécuté une seule
  // fois par process Node. Garantit que /admin/products + /admin/seo
  // soient peuplés au premier rendu serveur.
  await ensureSeedOnce();

  // Lit la configuration globale du bandeau cookies. Les valeurs par
  // défaut (banner activé, consent denied) couvrent l'install initiale ;
  // l'admin peut désactiver le bandeau dans /admin/tracking/settings pour
  // les juridictions où il n'est pas obligatoire (Maroc, US…).
  const [bannerEnabled, defaultGranted] = await Promise.all([
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.CONSENT_BANNER_ENABLED, true),
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.CONSENT_DEFAULT_GRANTED, false),
  ]);

  return (
    <html
      lang="fr"
      dir="ltr"
      className={`${cormorant.variable} ${inter.variable} ${pinyon.variable}`}
    >
      <body className="min-h-screen bg-creme font-body text-encre antialiased">
        <SkipLink />
        <TrackingProvider
          bannerEnabled={bannerEnabled}
          defaultGranted={defaultGranted}
        >
          <TrackingGlobalListener />
          {children}
          <ConsentBanner enabled={bannerEnabled} defaultGranted={defaultGranted} />
          <PixelLoader />
          <DebugOverlay />
          <ChatWidgetMount />
        </TrackingProvider>
      </body>
    </html>
  );
}
