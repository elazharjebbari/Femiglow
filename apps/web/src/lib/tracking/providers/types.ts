import type {
  TrackingConsentState,
  TrackingProvider,
  TrackingProviderKind,
  TrackingProviderResult,
} from '@/lib/db/types';

export interface DispatchContext {
  eventName: string;
  eventId: string;
  receivedAt: Date;
  pageRoute: string;
  pageUrl: string;
  pageTitle?: string;
  referrer?: string;
  anonymousId: string;
  sessionId: string;
  userId?: string | null;
  consent: TrackingConsentState;
  uaHash: string;
  ipAnonymized: string;
  device: 'mobile' | 'tablet' | 'desktop';
  locale: string;
  params: Record<string, unknown>;
  userData?: {
    sha256_email_address?: string;
    sha256_phone_number?: string;
    address?: {
      sha256_first_name?: string;
      sha256_last_name?: string;
      city?: string;
      country?: string;
    };
  };
  attribution?: {
    channel: string;
    is_paid: boolean;
    strategy: string;
    reason: string;
    click_id?: string;
    click_id_field?: string;
    utm?: Record<string, string | undefined>;
  };
  /** Identité éventuelle (email/phone/nom) — non hachée. Hashing à la charge de l'adapter. */
  identity?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    country?: string;
  };
  /** External_id stable pour matching CAPI (souvent = userId ou anonymousId). */
  externalId?: string;
  fbp?: string;
  fbc?: string;
  ttclid?: string;
  gclid?: string;
  /**
   * Mappings event_name → vendor_name résolus depuis la version active
   * d'event_mapping_versions. Si présent, les adapters DOIVENT utiliser
   * cette valeur au lieu d'appeler `mapEventName` directement. cf. ADR-001.
   */
  resolvedMappings?: Partial<
    Record<
      TrackingProviderKind,
      { mappedName: string; isCustom: boolean; notes: string | null }
    >
  >;
}

export interface ProviderAdapter {
  kind: TrackingProviderKind;
  /** Indique si l'event est mappé pour ce provider. */
  supports(eventName: string): boolean;
  /** Construit le payload + dispatch CAPI/server-side. Renvoie un résultat structuré. */
  dispatch(provider: TrackingProvider, ctx: DispatchContext): Promise<TrackingProviderResult>;
  /** Snippet client (pixel) à injecter dans le DOM, ou null si pas de pixel client. */
  clientSnippet?(provider: TrackingProvider): string | null;
  /** Hosts à whitelist dans la CSP pour script-src/connect-src. */
  cspHosts(): { scriptSrc: string[]; connectSrc: string[] };
}

export type ProviderResultMap = Record<string, TrackingProviderResult>;
