export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'lost'
  | 'archived';

export type LeadEventType =
  | 'created'
  | 'status_changed'
  | 'note_added'
  | 'order_linked'
  | 'webhook_dispatched';

export type DeliveryStatus = 'pending' | 'in_progress' | 'succeeded' | 'failed' | 'permanent';

export type WebhookEventName =
  | 'lead.created'
  | 'lead.status_changed'
  | 'lead.note_added'
  | 'order.created';

export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lead {
  id: string;
  /**
   * Les leads issus du chat n'ont PAS d'email (capture téléphone-only).
   * Pour ces leads-là, `email` vaut `null`. Le contrat ecommerce reste
   * inchangé : un lead créé via order/checkout aura toujours un email.
   * cf. CHA-225 — unification de /admin/leads.
   */
  email: string | null;
  phone: string | null;
  name: string | null;
  status: LeadStatus;
  source: string | null;
  consentMarketing: boolean;
  createdAt: Date;
  updatedAt: Date;
  /**
   * CHA-229 — ID de la session de chat à l'origine du lead (`cs_…`).
   * Présent uniquement pour les leads chat (`source='chat:…'`) ; `null`
   * pour les leads ecommerce. Permet à `/admin/leads` d'ouvrir la
   * fenêtre rapide `ConversationQuickView` sans round-trip
   * supplémentaire pour résoudre `chat_lead.session_id`.
   */
  chatSessionId?: string | null;
}

export interface Order {
  id: string;
  leadId: string;
  totalCents: number;
  /**
   * Devise ISO 4217 du paiement. Voir `@/lib/products/currency` pour la
   * liste blanche supportée. La colonne DB reste libre (`text`).
   */
  currency: import('@/lib/products/currency').Currency;
  shippingMode: 'pickup' | 'home';
  paymentMethod: 'cod' | 'transfer' | 'card';
  createdAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export interface LeadEvent {
  id: string;
  leadId: string;
  type: LeadEventType;
  actorId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: WebhookEventName[];
  encryptedSecret: string;
  active: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: WebhookEventName;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  status: DeliveryStatus;
  attemptCount: number;
  nextAttemptAt: Date | null;
  responseStatus: number | null;
  responseBody: string | null;
  errorCode: string | null;
  latencyMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditEvent {
  id: string;
  action: string;
  actorId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  meta: Record<string, unknown>;
  createdAt: Date;
}

export type MediaKind = 'image' | 'video' | 'audio';
export type MediaSource = 'upload' | 'external';
export type MediaStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'passthrough';
export type MediaQualityProfile = 'hero' | 'inline' | 'thumb';
export type MediaLoadingStrategy = 'eager' | 'viewport' | 'idle' | 'interaction';
export type VariantFormat =
  | 'avif'
  | 'webp'
  | 'jpeg'
  | 'png'
  | 'mp4'
  | 'webm'
  | 'mp3'
  | 'opus'
  | 'poster';
export type VariantBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type MediaUsageType = 'page' | 'section' | 'og' | 'email' | 'webhook';
export type MediaContext = 'hero' | 'inline' | 'thumb' | 'og';
export type MediaJobKind = 'optimize' | 'regenerate' | 'phash' | 'delete';
export type MediaJobStatus = 'pending' | 'in_progress' | 'done' | 'failed';
export type FetchPriority = 'high' | 'low' | 'auto';

export interface PaletteEntry {
  r: number;
  g: number;
  b: number;
  hex: string;
  weight: number;
}

export interface MediaOverrides {
  loadingStrategy?: MediaLoadingStrategy;
  qualityProfile?: MediaQualityProfile;
  breakpoints?: VariantBreakpoint[];
  formats?: VariantFormat[];
  qualities?: Partial<Record<VariantFormat, number>>;
  lazy?: boolean;
  fetchPriority?: FetchPriority;
  blurhash?: boolean;
  artDirection?: Partial<Record<VariantBreakpoint, { src: string; alt?: string }>>;
  customLoader?: 'next' | 'cloudflare' | 'imgix';
  placeholderSvg?: string;
  preventOptimization?: boolean;
  cacheControl?: string;
  ignoreDedup?: boolean;
  /**
   * Override par-image du mode d'adaptation au cadre. Cascade :
   *   binding.objectFit ?? media.overrides.objectFit ?? slot.objectFitDefault ?? 'cover'.
   * Permet à un Media de porter sa propre politique de fit (utile p.ex.
   * pour un triptyque qu'on veut toujours afficher en `contain` partout).
   */
  objectFit?: MediaObjectFit;
  /** Idem objectFit pour la position. */
  objectPosition?: MediaObjectPosition;
  /** Override fin du focal point en %. NULL = utilise objectPosition. */
  focalX?: number | null;
  focalY?: number | null;
  /**
   * Couleur de fond derrière l'image (utile en `contain` pour ne pas voir
   * le damier de transparence d'un PNG). Token couleur (`creme`,
   * `creme-warm`, `encre`, `champagne-soft`…) ou hex/rgba arbitraire.
   * Si absent, on tombe sur la couleur dominante de la palette.
   */
  backgroundFill?: string;
  /**
   * Si true, demande au pipeline (au seed ou re-générer) de cropper
   * physiquement les variants à l'aspectRatioHint du slot (centré sur le
   * focal point). Élimine définitivement le letterbox en `cover`.
   * Lue uniquement par `seed-pipeline` / worker, pas par le rendu.
   */
  cropToSlotAspect?: boolean;
}

export interface Media {
  id: string;
  kind: MediaKind;
  source: MediaSource;
  slug: string;
  originalUrl: string | null;
  originalFilename: string | null;
  originalSizeBytes: number | null;
  originalMime: string | null;
  originalWidth: number | null;
  originalHeight: number | null;
  originalDurationMs: number | null;
  phash: string | null;
  blurhash: string | null;
  palette: PaletteEntry[];
  alt: string;
  caption: string | null;
  credit: string | null;
  status: MediaStatus;
  failureReason: string | null;
  qualityProfile: MediaQualityProfile;
  loadingStrategy: MediaLoadingStrategy;
  isHero: boolean;
  overrides: MediaOverrides;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface MediaVariant {
  id: string;
  mediaId: string;
  format: VariantFormat;
  breakpoint: VariantBreakpoint | null;
  width: number | null;
  height: number | null;
  bitrateKbps: number | null;
  quality: number | null;
  sizeBytes: number;
  url: string;
  checksum: string;
  createdAt: Date;
}

export interface MediaTag {
  id: string;
  name: string;
  color: string | null;
  createdAt: Date;
}

export interface MediaToTag {
  mediaId: string;
  tagId: string;
}

export interface MediaUsage {
  id: string;
  mediaId: string;
  usageType: MediaUsageType;
  route: string;
  component: string;
  context: MediaContext;
  lastSeenAt: Date;
  createdAt: Date;
}

export interface MediaJob {
  id: string;
  mediaId: string;
  kind: MediaJobKind;
  status: MediaJobStatus;
  attemptCount: number;
  nextAttemptAt: Date;
  errorMessage: string | null;
  payload: Record<string, unknown>;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

export interface MediaWithRelations extends Media {
  variants: MediaVariant[];
  tags: MediaTag[];
}

export type TrackingComponentCategory =
  | 'cta_primary'
  | 'cta_secondary'
  | 'cta_ghost'
  | 'navigation'
  | 'form_input'
  | 'form_submit'
  | 'media_image'
  | 'media_video'
  | 'media_audio'
  | 'list_item'
  | 'card'
  | 'pricing'
  | 'filter'
  | 'search'
  | 'social_share'
  | 'newsletter'
  | 'modal'
  | 'accordion'
  | 'tab'
  | 'carousel'
  | 'progress'
  | 'banner'
  | 'section_hero'
  | 'section_content'
  | 'section_testimonial'
  | 'section_faq'
  | 'commerce_cart'
  | 'commerce_checkout'
  | 'chat'
  | 'admin';

export type TrackingEventScope = 'web' | 'server' | 'both';

export type TrackingEventCategory =
  | 'page'
  | 'engagement'
  | 'ecommerce'
  | 'lead'
  | 'media'
  | 'admin'
  | 'custom';

export type TrackingProviderKind =
  | 'meta'
  | 'tiktok'
  | 'google_ads'
  | 'google_ga4'
  | 'snap'
  | 'pinterest'
  | 'gtm'
  | 'custom';

export type TrackingProviderStatus = 'disabled' | 'enabled' | 'error';

export type TrackingConsentBinaryState = 'granted' | 'denied';

export interface TrackingConsentState {
  ad_storage: TrackingConsentBinaryState;
  analytics_storage: TrackingConsentBinaryState;
  ad_user_data: TrackingConsentBinaryState;
  ad_personalization: TrackingConsentBinaryState;
  functional_storage: TrackingConsentBinaryState;
}

export interface TrackingProviderResult {
  status: 'sent' | 'failed' | 'skipped';
  attempts?: number;
  latencyMs?: number;
  httpStatus?: number;
  error?: string;
}

export interface TrackingPage {
  id: string;
  route: string;
  title: string;
  category: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrackingComponent {
  id: string;
  name: string;
  path: string;
  category: TrackingComponentCategory;
  description: string | null;
  enabled: boolean;
  defaultParams: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TrackingPageComponent {
  pageId: string;
  componentId: string;
  position: number;
}

export interface TrackingEventDefinition {
  id: string;
  name: string;
  category: TrackingEventCategory;
  scope: TrackingEventScope;
  description: string;
  isConversion: boolean;
  paramsSchema: Record<string, unknown>;
  applicableCategories: TrackingComponentCategory[];
  defaultProviders: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TrackingComponentEvent {
  id: string;
  componentId: string;
  eventDefinitionId: string;
  enabled: boolean;
  paramsOverride: Record<string, unknown>;
  providersOverride: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrackingProvider {
  id: string;
  kind: TrackingProviderKind;
  status: TrackingProviderStatus;
  pixelId: string | null;
  capiToken: string | null;
  capiTokenIv: string | null;
  capiTokenTag: string | null;
  testEventCode: string | null;
  customHead: string | null;
  customBody: string | null;
  config: Record<string, unknown>;
  enabledEvents: string[];
  lastEventAt: Date | null;
  errorCount24h: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrackingEventLogEntry {
  id: string;
  eventId: string;
  eventName: string;
  eventCategory: TrackingEventCategory;
  pageId: string | null;
  componentId: string | null;
  pageRoute: string;
  anonymousId: string;
  sessionId: string;
  userId: string | null;
  consentSnapshot: TrackingConsentState;
  payload: Record<string, unknown>;
  uaHash: string;
  ipAnonymized: string;
  device: 'mobile' | 'tablet' | 'desktop';
  locale: string;
  isConversion: boolean;
  providersDispatched: string[];
  providersResults: Record<string, TrackingProviderResult>;
  receivedAt: Date;
  schemaVersion: number;
  /** cf. docs/analytics/02-data-model.md §3.2 — bucket attribution. */
  trafficSource?: string | null;
  trafficMedium?: string | null;
  experimentId?: string | null;
  experimentVariant?: string | null;
}

export interface TrackingConsentSnapshot {
  id: string;
  anonymousId: string;
  state: TrackingConsentState;
  stateHash: string;
  source: 'banner' | 'preferences' | 'api' | 'auto';
  ipAnonymized: string;
  uaHash: string;
  createdAt: Date;
}

export interface TrackingSetting<TValue = unknown> {
  id: string;
  key: string;
  value: TValue;
  updatedAt: Date;
  updatedBy: string | null;
}

/* ─────────────────────────────────────────────────────────────────
 * Component-Media System
 * ───────────────────────────────────────────────────────────────── */

export type ComponentCategory =
  | 'hero'
  | 'section'
  | 'card'
  | 'gallery'
  | 'carousel'
  | 'banner'
  | 'form'
  | 'media-block'
  | 'cta';

export type AnimationKind = 'none' | 'framer-motion' | 'css' | 'svg';

export type PlaceholderStrategy = 'svg' | 'blurhash' | 'palette' | 'none';

/**
 * Mode d'adaptation de l'image au cadre fourni par l'interface.
 *
 * Doctrine: l'image s'adapte au cadre, jamais l'inverse. Les composants
 * (hero, gallery, og…) imposent leur ratio/dimension; ce mode décide
 * comment l'image se comporte dans ce cadre.
 */
export type MediaObjectFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

/**
 * Position du focal point dans le cadre.
 * Pour un contrôle fin, utiliser `focalX` / `focalY` (0-100 %).
 */
export type MediaObjectPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top left'
  | 'top right'
  | 'bottom left'
  | 'bottom right';

export interface SlotDefinition {
  key: string;
  label: string;
  required: boolean;
  acceptKinds: ('image' | 'video')[];
  /**
   * Ratio attendu pour ce slot (ex. `'4/5'`, `'16/9'`, `'1/1'`). Lu par :
   *  - `MediaImageClient` pour fixer l'aspect-ratio du `<picture>` (et
   *    éviter d'épouser le ratio source).
   *  - `seed-pipeline` (si `cropToAspect`) pour cropper les variants.
   */
  aspectRatioHint?: string;
  recommendedWidth?: number;
  description?: string;
  /**
   * Mode d'adaptation par défaut quand ni le binding ni le Media ne le
   * spécifient. Ex. un slot `journal-card` aura `'cover'`, un slot
   * illustratif (diagramme) aura `'contain'`.
   */
  objectFitDefault?: MediaObjectFit;
  /** Position par défaut, idem cascade. */
  objectPositionDefault?: MediaObjectPosition;
  /**
   * Si true et que le slot a un `aspectRatioHint`, le pipeline (seed +
   * worker) crope les variants au ratio cible (centré ou focal point).
   * Élimine les triptyques wide-and-short qui s'affichent en lettrebox.
   */
  cropToAspect?: boolean;
  /**
   * Couleur de fond par défaut (si `contain`). Cascade idem objectFit.
   */
  backgroundFillDefault?: string;
}

export interface SiteComponent {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: ComponentCategory;
  pageGroup: string;
  filePath: string | null;
  slots: SlotDefinition[];
  /** Champs éditoriaux (Components-CMS). Vide tant que le composant n'est pas migré. */
  fields: ComponentFieldDefinition[];
  defaultSvgFallback: string | null;
  defaultLoadingStrategy: MediaLoadingStrategy;
  defaultFetchPriority: FetchPriority;
  supportsAnimation: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComponentMediaBinding {
  id: string;
  componentId: string;
  slot: string;
  mediaId: string | null;
  loadingStrategy: MediaLoadingStrategy;
  fetchPriority: FetchPriority;
  priority: boolean;
  placeholderStrategy: PlaceholderStrategy;
  customAlt: string | null;
  displayOrder: number;
  isActive: boolean;
  notes: string | null;
  /** Mode d'adaptation au cadre (cover par défaut). */
  objectFit: MediaObjectFit;
  /** Position de l'image dans le cadre (center par défaut). */
  objectPosition: MediaObjectPosition;
  /** Override fin du focal point en %. NULL = utilise `objectPosition`. */
  focalX: number | null;
  focalY: number | null;
  /**
   * Couleur de fond derrière l'image (override point-d'usage). Si absent,
   * on tombe en cascade sur `media.overrides.backgroundFill`, puis
   * `slot.backgroundFillDefault`, puis la palette dominante.
   */
  backgroundFill: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComponentAnimation {
  id: string;
  key: string;
  name: string;
  kind: AnimationKind;
  description: string | null;
  config: Record<string, unknown>;
  respectsReducedMotion: boolean;
  previewSnippet: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComponentAnimationBinding {
  id: string;
  componentId: string;
  animationId: string;
  isDefault: boolean;
  params: Record<string, unknown>;
  createdAt: Date;
}

export interface SiteComponentWithRelations extends SiteComponent {
  bindings: ComponentMediaBindingWithMedia[];
  animations: ComponentAnimationBindingWithAnimation[];
}

export interface ComponentMediaBindingWithMedia extends ComponentMediaBinding {
  /**
   * Media joint au binding. Le champ optionnel `thumbUrl` est rempli
   * par `listBindingsWithMediaByComponent` à partir de la plus petite
   * variant disponible — utilisé par `SlotCard` pour afficher la vignette.
   */
  media: (Media & { thumbUrl?: string }) | null;
}

export interface ComponentAnimationBindingWithAnimation extends ComponentAnimationBinding {
  animation: ComponentAnimation;
}

/* ─────────────────────────────────────────────────────────────────
 * Components-CMS — Champs éditoriaux typés
 * cf. docs/components-cms/architecture/02-data-model.md
 * ───────────────────────────────────────────────────────────────── */

export type FieldType =
  | 'text'
  | 'multiline'
  | 'rich-text'
  | 'cta'
  | 'link'
  | 'icon'
  | 'color-token'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'list'
  | 'record'
  | 'kicker'
  | 'quote'
  | 'breadcrumb-segment';

export type FieldBindingStatus = 'draft' | 'published' | 'scheduled' | 'archived';

export type FieldHistoryAction =
  | 'create'
  | 'update'
  | 'publish'
  | 'unpublish'
  | 'restore'
  | 'archive'
  | 'schedule'
  | 'unschedule';

/**
 * Configuration optionnelle d'un type. Toutes les propriétés sont
 * optionnelles. Selon le type, les champs pertinents sont consommés.
 * Cf. A2 pour la documentation par type.
 */
export interface FieldTypeConfig {
  // text / multiline / rich-text / kicker
  minLength?: number;
  maxLength?: number;
  placeholder?: string;

  // rich-text
  allowedTags?: string[];
  allowedHrefSchemes?: ('http' | 'https' | 'mailto' | 'tel')[];

  // cta
  // Aligné sur `ButtonVariant` (Button.tsx) consommé par `ButtonLink`.
  variants?: ('primary' | 'secondary' | 'ghost' | 'link')[];

  // icon
  iconRegistry?: 'lucide' | 'femiglow-curated';

  // color-token
  tokenSet?: 'background' | 'text' | 'border' | 'all';

  // number
  min?: number;
  max?: number;
  step?: number;

  // enum
  options?: { value: string; label: string }[];

  // list
  itemType?: FieldType;
  itemConfig?: FieldTypeConfig;
  minItems?: number;
  maxItems?: number;

  // record
  shape?: Record<
    string,
    { type: FieldType; config?: FieldTypeConfig; required?: boolean }
  >;

  // cta / link
  /** Hôtes externes autorisés pour les `href` non-relatifs. */
  allowedHosts?: string[];
}

export interface ComponentFieldDefinition {
  /** Clé stable, p.ex. 'title'. Jamais renommée. */
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** Source de vérité éditoriale tant qu'aucun binding publié n'a surchargé. */
  defaultValue?: unknown;
  description?: string;
  /** Section logique pour grouper les champs en admin (Tabs / accordéons). */
  group?: string;
  /** Ordre d'affichage en admin (asc). */
  order?: number;
  config?: FieldTypeConfig;
  /** Si true, fallback silencieux en prod. Si false, placeholder dev rouge. */
  fallbackToDefault?: boolean;
}

export interface ComponentFieldBinding {
  id: string;
  componentId: string;
  fieldKey: string;
  locale: string;
  value: unknown;
  status: FieldBindingStatus;
  version: number;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  notes: string | null;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComponentFieldHistoryEntry {
  id: string;
  bindingId: string;
  componentId: string;
  fieldKey: string;
  locale: string;
  version: number;
  value: unknown;
  status: FieldBindingStatus;
  actorId: string | null;
  action: FieldHistoryAction;
  notes: string | null;
  createdAt: Date;
}

export interface ResolvedFieldMeta {
  source: 'binding' | 'default' | 'none';
  bindingId?: string;
  version: number;
  publishedAt?: Date | null;
  locale?: string;
}

export interface ResolvedField<T = unknown> {
  value: T;
  meta: ResolvedFieldMeta;
}

export type ResolvedFields = Record<string, ResolvedField>;

/* ─────────────────────────────────────────────────────────────────
 * Analytics Insights (cf. docs/analytics-insights/)
 * ───────────────────────────────────────────────────────────────── */

export interface InsightsEventDailyRow {
  id: string;
  date: string; // YYYY-MM-DD
  eventName: string;
  eventCategory: string;
  env: string;
  device: string;
  locale: string;
  count: number;
  uniqueSessions: number;
  conversionCount: number;
  refreshedAt: Date;
}

export interface InsightsPageDailyRow {
  id: string;
  date: string;
  pageRoute: string;
  pageViews: number;
  uniqueSessions: number;
  uniqueVisitors: number;
  eventsTotal: number;
  scroll75Count: number;
  conversions: number;
  bounceCount: number;
  avgTimeSeconds: number;
  refreshedAt: Date;
}

export interface InsightsComponentDailyRow {
  id: string;
  date: string;
  componentId: string;
  componentName: string | null;
  pageRoute: string | null;
  eventName: string;
  count: number;
  uniqueSessions: number;
  conversionCount: number;
  refreshedAt: Date;
}

export interface InsightsSectionDailyRow {
  id: string;
  date: string;
  pageRoute: string;
  sectionId: string;
  views: number;
  avgDwellSeconds: number;
  uniqueSessions: number;
  refreshedAt: Date;
}

export interface InsightsFunnelDailyRow {
  id: string;
  date: string;
  viewItem: number;
  addToCart: number;
  beginCheckout: number;
  addPaymentInfo: number;
  purchase: number;
  generateLead: number;
  uniquePurchasers: number;
  revenueTotalCents: number;
  refreshedAt: Date;
}

export type InsightsRefreshTrigger = 'cron' | 'manual';
export type InsightsRefreshStatus = 'running' | 'success' | 'failed' | 'skipped';

export interface InsightsRefreshRunRow {
  id: string;
  trigger: InsightsRefreshTrigger;
  status: InsightsRefreshStatus;
  startedAt: Date;
  finishedAt: Date | null;
  durationsMs: Record<string, number>;
  counts: Record<string, number>;
  errorCode: string | null;
  errorMessage: string | null;
  triggeredBy: string | null;
}
