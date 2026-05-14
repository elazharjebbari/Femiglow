/**
 * Read-side queries for /admin/emails/campaigns.
 *
 * Joins `email_campaign_link` (FemiGlow source of truth for draft/audit)
 * with live Listmonk data (lists, templates, sent counters) via the API
 * client.
 */
import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailCampaignLink, type EmailCampaignLinkRow } from '@/lib/db/schema-emails';
import { listmonk, ListmonkConfigError, ListmonkApiError } from '@/lib/mail/listmonk/client';
import { logger } from '@/lib/logging/logger';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export async function listCampaigns(opts: { limit?: number } = {}): Promise<EmailCampaignLinkRow[]> {
  const drizzle = requireDb();
  return drizzle
    .select()
    .from(emailCampaignLink)
    .orderBy(desc(emailCampaignLink.createdAt))
    .limit(Math.min(opts.limit ?? 100, 500));
}

export async function getCampaignDraft(id: string): Promise<EmailCampaignLinkRow | null> {
  const drizzle = requireDb();
  const rows = await drizzle
    .select()
    .from(emailCampaignLink)
    .where(eq(emailCampaignLink.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export type ListmonkListLite = {
  id: number;
  name: string;
  type: string;
  optin: string;
  subscriberCount: number;
};

export async function fetchListmonkLists(): Promise<{ ok: true; lists: ListmonkListLite[] } | { ok: false; error: string }> {
  try {
    const res = await listmonk.lists.list();
    return {
      ok: true,
      lists: res.data.results.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        optin: l.optin,
        subscriberCount: l.subscriber_count,
      })),
    };
  } catch (err) {
    if (err instanceof ListmonkConfigError) {
      return { ok: false, error: 'Listmonk non configuré — voir docs/emailing/scripts/M3-install-listmonk.sh' };
    }
    if (err instanceof ListmonkApiError) {
      return { ok: false, error: `Listmonk API ${err.status} : ${err.body.slice(0, 80)}` };
    }
    logger.error('admin.emails.listmonk_lists_fetch_failed', { error: String(err) });
    return { ok: false, error: 'Listmonk indisponible' };
  }
}

export type ListmonkTemplateLite = {
  id: number;
  name: string;
  type: string;
  subject: string;
};

export async function fetchListmonkTemplates(): Promise<{ ok: true; templates: ListmonkTemplateLite[] } | { ok: false; error: string }> {
  try {
    const res = await listmonk.templates.list();
    return {
      ok: true,
      templates: res.data.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        subject: t.subject,
      })),
    };
  } catch (err) {
    if (err instanceof ListmonkConfigError) {
      return { ok: false, error: 'Listmonk non configuré' };
    }
    if (err instanceof ListmonkApiError) {
      return { ok: false, error: `Listmonk API ${err.status}` };
    }
    return { ok: false, error: 'Listmonk indisponible' };
  }
}

export async function estimateAudience(listIds: number[]): Promise<{ total: number; perList: Array<{ id: number; name: string; count: number }> }> {
  if (listIds.length === 0) return { total: 0, perList: [] };
  const res = await listmonk.lists.list();
  const perList = res.data.results
    .filter((l) => listIds.includes(l.id))
    .map((l) => ({ id: l.id, name: l.name, count: l.subscriber_count }));
  // No de-duplication across lists — Listmonk handles that on send. We
  // surface the raw sum to set user expectation (upper bound).
  return {
    total: perList.reduce((s, l) => s + l.count, 0),
    perList,
  };
}
