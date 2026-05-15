import { and, asc, desc, eq, gte, lte, ilike, or, sql as dsql } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { chatDb } from '@/lib/chat/db/client';
import { chatLead } from '@/lib/chat/db/schema';
import type { ChatLeadRow } from '@/lib/chat/db/schema';
import { createId } from '@/lib/ids';
import type { Lead, LeadStatus, Order, OrderItem } from '@/lib/db/types';
import { computeLeadJourney } from '@/lib/admin/leads/journey';

export interface LeadFilters {
  status?: LeadStatus;
  search?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  sort?: 'created_desc' | 'created_asc';
}

/**
 * CHA-225 — Mappe l'outcome chat vers le statut Lead admin.
 * `pending`   → 'new'        (lead capté, pas encore traité)
 * `reached`   → 'contacted'  (rappelée, en cours)
 * `no-answer` → 'contacted'  (on a essayé, on retentera)
 * `converted` → 'converted'
 * `discarded` → 'lost'
 */
function chatOutcomeToLeadStatus(outcome: ChatLeadRow['outcome']): LeadStatus {
  switch (outcome) {
    case 'pending':
      return 'new';
    case 'reached':
    case 'no-answer':
      return 'contacted';
    case 'converted':
      return 'converted';
    case 'discarded':
      return 'lost';
    default:
      return 'new';
  }
}

/** Convertit un `chat_lead` en `Lead` pour l'affichage admin unifié. */
function chatLeadToLead(row: ChatLeadRow): Lead {
  const journey = computeLeadJourney(row);
  return {
    id: row.id, // garde le préfixe `cl_…` pour disambiguation
    email: null, // chat lead = capture phone-only, pas d'email
    phone: row.phoneE164,
    name: row.firstName,
    status: chatOutcomeToLeadStatus(row.outcome),
    source: `chat:${row.triggerReason}`,
    consentMarketing: false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // CHA-229 — Permet à /admin/leads de wirer la QuickView conversation.
    chatSessionId: row.sessionId,
    journeyStage: journey.stage,
    dataPct: journey.dataPct,
    webhookSummary: journey.webhookSummary,
  };
}

/** Filtre côté mémoire un Lead unifié selon les filtres admin. */
function matchesLeadFilter(lead: Lead, filters: LeadFilters): boolean {
  if (filters.status && lead.status !== filters.status) return false;
  if (filters.from && lead.createdAt < filters.from) return false;
  if (filters.to && lead.createdAt > filters.to) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const hay = `${lead.email ?? ''} ${lead.name ?? ''} ${lead.phone ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export interface LeadListResult {
  rows: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listLeads(filters: LeadFilters = {}): Promise<LeadListResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const drizzle = db();
  if (drizzle) {
    // 1. Leads ecommerce historiques.
    const conditions = [] as ReturnType<typeof eq>[];
    if (filters.status) conditions.push(eq(schema.leads.status, filters.status));
    if (filters.from) conditions.push(gte(schema.leads.createdAt, filters.from));
    if (filters.to) conditions.push(lte(schema.leads.createdAt, filters.to));
    if (filters.search) {
      const q = `%${filters.search}%`;
      const search = or(
        ilike(schema.leads.email, q),
        ilike(schema.leads.name, q),
        ilike(schema.leads.phone, q),
      );
      if (search) conditions.push(search);
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const ecommerceRows = await drizzle
      .select()
      .from(schema.leads)
      .where(where)
      .orderBy(desc(schema.leads.createdAt));

    // 2. Leads issus du chat (CHA-225). On charge tout puis on filtre
    //    en mémoire — le mapping outcome→status diffère et un UNION
    //    SQL deviendrait illisible. Volume attendu < 10k pour un seul
    //    écran admin, OK en pratique.
    const cdb = chatDb();
    const chatRows: Lead[] = [];
    if (cdb) {
      const all = await cdb
        .select()
        .from(chatLead)
        .orderBy(desc(chatLead.createdAt));
      for (const row of all as ChatLeadRow[]) {
        const mapped = chatLeadToLead(row);
        if (matchesLeadFilter(mapped, filters)) chatRows.push(mapped);
      }
    }

    // 3. Merge + tri + pagination.
    const merged: Lead[] = [
      ...(ecommerceRows as Lead[]).map((r) => ({
        ...r,
        // Lead.email peut désormais être null (chat leads). Pour les
        // leads ecommerce, on conserve la string (Drizzle infère
        // string mais on s'aligne sur le type unifié).
        email: r.email ?? null,
      })),
      ...chatRows,
    ];
    merged.sort((a, b) =>
      filters.sort === 'created_asc'
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const total = merged.length;
    const paged = merged.slice((page - 1) * pageSize, page * pageSize);
    return { rows: paged, total, page, pageSize };
  }
  // Mode mémoire (tests). Ne fusionne pas chat_lead — les tests qui
  // veulent l'union utilisent la branche DB drizzle ci-dessus.
  const store = memoryStore();
  const all = Array.from(store.leads.values());
  let rows = all.filter((l) => matchesLeadFilter(l, filters));
  rows.sort((a, b) =>
    filters.sort === 'created_asc'
      ? a.createdAt.getTime() - b.createdAt.getTime()
      : b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const total = rows.length;
  rows = rows.slice((page - 1) * pageSize, page * pageSize);
  return { rows, total, page, pageSize };
}

export async function getLeadById(id: string): Promise<{
  lead: Lead;
  order: Order | null;
  items: OrderItem[];
} | null> {
  const drizzle = db();
  // CHA-225 — Les ids `cl_xxx` désignent des chat leads (table chat_lead).
  // On les sert depuis le chat schema, et on n'a JAMAIS de commande
  // associée pour ce type de lead.
  if (id.startsWith('cl_')) {
    const cdb = chatDb();
    if (!cdb) return null;
    const rows = await cdb
      .select()
      .from(chatLead)
      .where(eq(chatLead.id, id))
      .limit(1);
    const row = rows[0] as ChatLeadRow | undefined;
    if (!row) return null;
    return { lead: chatLeadToLead(row), order: null, items: [] };
  }
  if (drizzle) {
    const leadRows = await drizzle
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.id, id))
      .limit(1);
    const lead = leadRows[0];
    if (!lead) return null;
    const orderRows = await drizzle
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.leadId, id))
      .limit(1);
    const order = orderRows[0] ?? null;
    const items = order
      ? await drizzle.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id))
      : [];
    return {
      lead: { ...lead, email: lead.email ?? null },
      order: order ? (order as Order) : null,
      items: items as OrderItem[],
    };
  }
  const store = memoryStore();
  const lead = store.leads.get(id);
  if (!lead) return null;
  const order = Array.from(store.orders.values()).find((o) => o.leadId === id) ?? null;
  const items = order
    ? Array.from(store.orderItems.values()).filter((i) => i.orderId === order.id)
    : [];
  return { lead, order, items };
}

export async function createLead(input: {
  email: string;
  phone?: string | null;
  name?: string | null;
  source?: string | null;
  consentMarketing?: boolean;
}): Promise<Lead> {
  const now = new Date();
  const lead: Lead = {
    id: createId('l'),
    email: input.email.toLowerCase(),
    phone: input.phone ?? null,
    name: input.name ?? null,
    status: 'new',
    source: input.source ?? null,
    consentMarketing: input.consentMarketing ?? false,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    // CHA-225 — Le type `Lead.email` est désormais `string | null`
    // (les chat leads n'ont pas d'email). Mais `createLead` reçoit
    // toujours un `input.email` non-null, donc on caste sans risque.
    await drizzle.insert(schema.leads).values({ ...lead, email: lead.email! });
    return lead;
  }
  memoryStore().leads.set(lead.id, lead);
  return lead;
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<Lead> {
  const drizzle = db();
  if (drizzle) {
    const updated = new Date();
    const rows = await drizzle
      .update(schema.leads)
      .set({ status, updatedAt: updated })
      .where(eq(schema.leads.id, id))
      .returning();
    const next = rows[0];
    if (!next) throw new Error(`Lead ${id} introuvable`);
    return next;
  }
  const store = memoryStore();
  const lead = store.leads.get(id);
  if (!lead) throw new Error(`Lead ${id} introuvable`);
  const next: Lead = { ...lead, status, updatedAt: new Date() };
  store.leads.set(id, next);
  return next;
}

const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ['contacted', 'qualified', 'lost', 'archived'],
  contacted: ['qualified', 'lost', 'archived'],
  qualified: ['converted', 'lost', 'archived'],
  converted: ['archived'],
  lost: ['archived'],
  archived: [],
};

export function isValidTransition(from: LeadStatus, to: LeadStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function nextValidStatuses(from: LeadStatus): LeadStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}
