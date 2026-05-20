/**
 * Server-rendered GTM bootstrap.
 *
 * Loads GTM synchronously as part of the initial HTML so that Tag
 * Assistant / GTM Preview Mode can detect the container immediately,
 * independently of any consent banner state. Consent gating is handled
 * via Google Consent Mode v2: the `gtag('consent','default',...)` call
 * sets every storage class to `denied` by default. Tags inside the GTM
 * container that depend on a given consent type will then self-gate
 * until the visitor accepts, at which point `gtag('consent','update',...)`
 * is fired by the consent banner.
 *
 * Reads the active GTM container ID from the `tracking_providers` table
 * (`kind='gtm'`, `status='enabled'`). If no provider is configured, the
 * component renders nothing.
 */
import 'server-only';
import { findTrackingProviderByKind } from '@/lib/db/queries/tracking/providers';

interface GtmHeadScriptProps {
  defaultGranted: boolean;
}

export async function GtmHeadScript({
  defaultGranted,
}: GtmHeadScriptProps): Promise<JSX.Element | null> {
  let containerId: string | null = null;
  try {
    const provider = await findTrackingProviderByKind('gtm');
    if (provider && provider.status === 'enabled' && provider.pixelId) {
      containerId = provider.pixelId;
    }
  } catch {
    return null;
  }
  if (!containerId) return null;

  const state = defaultGranted ? 'granted' : 'denied';
  // Consent Mode v2 defaults + standard GTM loader snippet. The
  // consent block MUST execute before gtm.js loads.
  const snippet =
    `window.dataLayer=window.dataLayer||[];` +
    `function gtag(){dataLayer.push(arguments);}` +
    `gtag('consent','default',{` +
    `'ad_storage':'${state}',` +
    `'analytics_storage':'${state}',` +
    `'ad_user_data':'${state}',` +
    `'ad_personalization':'${state}',` +
    `'functional_storage':'${state}',` +
    `'security_storage':'granted',` +
    `'wait_for_update':500` +
    `});` +
    `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});` +
    `var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';` +
    `j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;` +
    `f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${containerId}');`;

  return (
    <>
      <script id="fg-gtm-init" dangerouslySetInnerHTML={{ __html: snippet }} />
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${containerId}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  );
}
