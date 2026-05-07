import { and, asc, desc, eq, gte, lte, ilike, or, sql as dsql } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { Lead, LeadStatus, Order, OrderItem } from '@/lib/db/types';

export interface LeadFilters {
  status?: LeadStatus;
  search?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  sort?: 'created_desc' | 'created_asc';
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
    const orderCol =
      filters.sort === 'created_asc'
        ? asc(schema.leads.createdAt)
        : desc(schema.leads.createdAt);
    const rowsQ = drizzle
      .select()
      .from(schema.leads)
      .where(where)
      .orderBy(orderCol)
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const totalQ = drizzle
      .select({ c: dsql<number>`count(*)::int` })
      .from(schema.leads)
      .where(where);
    const [rows, totalRows] = await Promise.all([rowsQ, totalQ]);
    return { rows, total: totalRows[0]?.c ?? 0, page, pageSize };
  }
  const store = memoryStore();
  const all = Array.from(store.leads.values());
  let rows = all.filter((l) => {
    if (filters.status && l.status !== filters.status) return false;
    if (filters.from && l.createdAt < filters.from) return false;
    if (filters.to && l.createdAt > filters.to) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = `${l.email} ${l.name ?? ''} ${l.phone ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
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
      lead,
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
    await drizzle.insert(schema.leads).values(lead);
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
