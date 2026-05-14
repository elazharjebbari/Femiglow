/**
 * Context resolver lead → variables (M5.7.1).
 *
 * Construit le payload de variables Handlebars depuis :
 *   - leads (firstName, city, phone, ...)
 *   - orders agrégés (lastOrderId, orderCount, totalSpent, ...)
 *   - URLs auto (unsubscribeUrl, shopUrl, ...)
 *   - dates système (today, dayOfWeek, ...)
 *   - trigger payload (si automation)
 *   - custom vars du template
 */
import 'server-only';
import { eq, sql, desc } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { leads, orders } from '@/lib/db/schema';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export type ResolvedContext = Record<string, unknown>;

export type BuildContextOpts = {
  triggerEvent?: { eventName: string; properties: Record<string, unknown> };
  customVars?: Record<string, unknown>;
  productContext?: Record<string, unknown>;
  /** Override now() pour tests. */
  now?: Date;
};

function pickFirstName(name: string | null | undefined): string {
  if (!name) return 'cliente';
  const trimmed = name.trim();
  if (!trimmed) return 'cliente';
  return trimmed.split(/\s+/)[0] ?? 'cliente';
}

function formatDateFr(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function formatMad(cents: number): string {
  return `${(cents / 100).toFixed(0)} MAD`;
}

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/**
 * Build le context complet pour un email destiné à `email`.
 *
 * Best-effort : si le lead n'existe pas, retourne uniquement les URLs +
 * dates + customVars + fallback identité (firstName='cliente').
 */
export async function buildEmailContext(
  email: string,
  opts: BuildContextOpts = {},
): Promise<ResolvedContext> {
  const drizzle = requireDb();
  const normalized = email.trim().toLowerCase();
  const now = opts.now ?? new Date();

  // 1. Identité
  const leadRows = await drizzle
    .select()
    .from(leads)
    .where(eq(leads.email, normalized))
    .limit(1);
  const lead = leadRows[0] ?? null;

  // 2. Agrégations commerce
  let lastOrderId = '';
  let lastOrderDateFormatted = '';
  let lastOrderTotal = '';
  let orderCount = 0;
  let totalSpentCents = 0;

  if (lead) {
    const aggRows = await drizzle
      .select({
        cnt: sql<number>`count(*)::int`,
        sum: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      })
      .from(orders)
      .where(eq(orders.leadId, lead.id));
    if (aggRows[0]) {
      orderCount = aggRows[0].cnt;
      totalSpentCents = aggRows[0].sum;
    }

    const lastOrderRows = await drizzle
      .select()
      .from(orders)
      .where(eq(orders.leadId, lead.id))
      .orderBy(desc(orders.createdAt))
      .limit(1);
    if (lastOrderRows[0]) {
      const o = lastOrderRows[0];
      lastOrderId = o.id;
      lastOrderDateFormatted = o.createdAt ? formatDateFr(o.createdAt) : '';
      lastOrderTotal = formatMad(o.totalCents);
    }
  }

  // 3. URLs
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://femiglow-maroc.com';

  // 4. Build context
  const firstName = pickFirstName(lead?.name);
  return {
    // Identité
    firstName,
    fullName: lead?.name ?? firstName,
    email: normalized,
    phone: lead?.phone ?? '',
    city: '', // pas de colonne city sur leads pour l'instant
    address: '', // idem
    country: 'MA',
    language: 'fr',
    // Commerce
    lastOrderId,
    lastOrderDate: lastOrderDateFormatted,
    lastOrderTotal,
    orderCount,
    totalSpent: formatMad(totalSpentCents),
    // Date / temps
    today: formatDateFr(now),
    tomorrow: formatDateFr(new Date(now.getTime() + 86_400_000)),
    dayOfWeek: DAYS_FR[now.getDay()] ?? '',
    currentMonth: MONTHS_FR[now.getMonth()] ?? '',
    currentYear: String(now.getFullYear()),
    // URLs
    unsubscribeUrl: `${siteUrl}/api/mail/unsubscribe?email=${encodeURIComponent(normalized)}`,
    shopUrl: `${siteUrl}/rituel`,
    accountUrl: `${siteUrl}/compte`,
    siteUrl,
    // Trigger (si automation)
    trigger: opts.triggerEvent
      ? {
          eventName: opts.triggerEvent.eventName,
          properties: opts.triggerEvent.properties,
        }
      : undefined,
    // Product context
    ...(opts.productContext ?? {}),
    // Custom vars (template-specific) — last so they can override
    ...(opts.customVars ?? {}),
  };
}
