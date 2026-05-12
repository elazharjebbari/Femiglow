/**
 * Client DB dual-driver :
 *  - `memoryStore()` : Map en mémoire pour les tests vitest et le dev local
 *    sans Postgres (toujours disponible).
 *  - `db()` : driver Drizzle/Neon, instancié uniquement si `DATABASE_URL`
 *    est défini ; sinon retourne `null` et l'appelant retombe sur
 *    `memoryStore()`. Permet une transition progressive.
 */
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';
import type {
  AdminUser,
  AuditEvent,
  InsightsComponentDailyRow,
  InsightsEventDailyRow,
  InsightsFunnelDailyRow,
  InsightsPageDailyRow,
  InsightsRefreshRunRow,
  InsightsSectionDailyRow,
  Lead,
  LeadEvent,
  Media,
  MediaJob,
  MediaTag,
  MediaUsage,
  MediaVariant,
  Order,
  OrderItem,
  TrackingComponent,
  TrackingComponentEvent,
  TrackingConsentSnapshot,
  TrackingEventDefinition,
  TrackingEventLogEntry,
  TrackingPage,
  TrackingPageComponent,
  TrackingProvider,
  TrackingSetting,
  SiteComponent,
  ComponentMediaBinding,
  ComponentAnimation,
  ComponentAnimationBinding,
  ComponentFieldBinding,
  ComponentFieldHistoryEntry,
  WebhookDelivery,
  WebhookEndpoint,
  OutboundWebhookLogRow,
  RitualTestimonial,
  RitualTestimonialPhoto,
  RitualAuditEntry,
  RitualAggregateRow,
} from '@/lib/db/types';

interface Store {
  adminUsers: Map<string, AdminUser>;
  leads: Map<string, Lead>;
  orders: Map<string, Order>;
  orderItems: Map<string, OrderItem>;
  leadEvents: Map<string, LeadEvent>;
  webhookEndpoints: Map<string, WebhookEndpoint>;
  webhookDeliveries: Map<string, WebhookDelivery>;
  outboundWebhookLog: Map<string, OutboundWebhookLogRow>;
  auditEvents: Map<string, AuditEvent>;
  loginAttempts: Map<string, { ip: string; email: string; failedAt: Date }>;
  rateLimitCounters: Map<string, { count: number; resetAt: number }>;
  media: Map<string, Media>;
  mediaVariants: Map<string, MediaVariant>;
  mediaTags: Map<string, MediaTag>;
  mediaToTags: Set<string>;
  mediaUsages: Map<string, MediaUsage>;
  mediaJobs: Map<string, MediaJob>;
  trackingPages: Map<string, TrackingPage>;
  trackingComponents: Map<string, TrackingComponent>;
  trackingPagesComponents: Map<string, TrackingPageComponent>;
  trackingEventDefinitions: Map<string, TrackingEventDefinition>;
  trackingComponentEvents: Map<string, TrackingComponentEvent>;
  trackingProviders: Map<string, TrackingProvider>;
  trackingEventsLog: Map<string, TrackingEventLogEntry>;
  trackingEventsLogOrder: string[];
  trackingConsentSnapshots: Map<string, TrackingConsentSnapshot>;
  trackingConsentOrder: string[];
  trackingSettings: Map<string, TrackingSetting>;
  siteComponents: Map<string, SiteComponent>;
  componentMediaBindings: Map<string, ComponentMediaBinding>;
  componentAnimations: Map<string, ComponentAnimation>;
  componentAnimationBindings: Map<string, ComponentAnimationBinding>;
  componentFieldBindings: Map<string, ComponentFieldBinding>;
  componentFieldHistory: Map<string, ComponentFieldHistoryEntry>;
  insightsEventDaily: Map<string, InsightsEventDailyRow>;
  insightsPageDaily: Map<string, InsightsPageDailyRow>;
  insightsComponentDaily: Map<string, InsightsComponentDailyRow>;
  insightsSectionDaily: Map<string, InsightsSectionDailyRow>;
  insightsFunnelDaily: Map<string, InsightsFunnelDailyRow>;
  insightsRefreshRun: Map<string, InsightsRefreshRunRow>;
  // Rituels partagés
  ritualTestimonials: Map<string, RitualTestimonial>;
  ritualTestimonialPhotos: Map<string, RitualTestimonialPhoto>;
  ritualAuditLog: Map<string, RitualAuditEntry>;
  ritualAggregate: Map<string, RitualAggregateRow>;
}

const globalAny = globalThis as typeof globalThis & { __femiglowStore?: Store };

function makeStore(): Store {
  return {
    adminUsers: new Map(),
    leads: new Map(),
    orders: new Map(),
    orderItems: new Map(),
    leadEvents: new Map(),
    webhookEndpoints: new Map(),
    webhookDeliveries: new Map(),
    outboundWebhookLog: new Map(),
    auditEvents: new Map(),
    loginAttempts: new Map(),
    rateLimitCounters: new Map(),
    media: new Map(),
    mediaVariants: new Map(),
    mediaTags: new Map(),
    mediaToTags: new Set(),
    mediaUsages: new Map(),
    mediaJobs: new Map(),
    trackingPages: new Map(),
    trackingComponents: new Map(),
    trackingPagesComponents: new Map(),
    trackingEventDefinitions: new Map(),
    trackingComponentEvents: new Map(),
    trackingProviders: new Map(),
    trackingEventsLog: new Map(),
    trackingEventsLogOrder: [],
    trackingConsentSnapshots: new Map(),
    trackingConsentOrder: [],
    trackingSettings: new Map(),
    siteComponents: new Map(),
    componentMediaBindings: new Map(),
    componentAnimations: new Map(),
    componentAnimationBindings: new Map(),
    componentFieldBindings: new Map(),
    componentFieldHistory: new Map(),
    insightsEventDaily: new Map(),
    insightsPageDaily: new Map(),
    insightsComponentDaily: new Map(),
    insightsSectionDaily: new Map(),
    insightsFunnelDaily: new Map(),
    insightsRefreshRun: new Map(),
    ritualTestimonials: new Map(),
    ritualTestimonialPhotos: new Map(),
    ritualAuditLog: new Map(),
    ritualAggregate: new Map(),
  };
}

export function memoryStore(): Store {
  if (!globalAny.__femiglowStore) {
    globalAny.__femiglowStore = makeStore();
  }
  return globalAny.__femiglowStore;
}

export function resetMemoryStore(): void {
  globalAny.__femiglowStore = makeStore();
}

type DrizzleDb =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePg<typeof schema>>;
const dbCache = globalAny as typeof globalAny & { __femiglowDb?: DrizzleDb | null };

function isNeonUrl(url: string): boolean {
  return /neon\.tech|neon\.build/i.test(url);
}

export function db(): DrizzleDb | null {
  if (dbCache.__femiglowDb !== undefined) return dbCache.__femiglowDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    dbCache.__femiglowDb = null;
    return null;
  }
  if (isNeonUrl(url)) {
    const sql = neon(url);
    dbCache.__femiglowDb = drizzleNeon(sql, { schema }) as DrizzleDb;
  } else {
    const client = postgres(url, { prepare: false, max: 5 });
    dbCache.__femiglowDb = drizzlePg(client, { schema }) as DrizzleDb;
  }
  return dbCache.__femiglowDb;
}

export { schema };
