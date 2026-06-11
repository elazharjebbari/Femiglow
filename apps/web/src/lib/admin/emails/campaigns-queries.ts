/**
 * Read-side queries for /admin/emails/campaigns.
 *
 * Joins `email_campaign_link` (FemiGlow source of truth for draft/audit)
 * with live Listmonk data (lists, templates, sent counters) via the API
 * client.
 */
import 'server-only';
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import {
  emailAudience,
  emailCampaignLink,
  type EmailCampaignLinkRow,
} from '@/lib/db/schema-emails';
import { listmonk, ListmonkConfigError, ListmonkApiError } from '@/lib/mail/listmonk/client';
import { logger } from '@/lib/logging/logger';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

/**
 * Statuts filtrables (UX-CAMP-012) : déplacés dans campaigns-shared.ts
 * (client-safe — ce module est server-only et CampaignsListClient est
 * 'use client'). Ré-exportés ici pour la compat des imports serveur.
 */
export { CAMPAIGN_STATUSES, type CampaignStatusFilter } from './campaigns-shared';
import { CAMPAIGN_STATUSES, type CampaignStatusFilter } from './campaigns-shared';

export interface ListCampaignsParams {
  /** Filtre statut exact (omis ou 'all' = tous). */
  status?: string;
  /** Recherche plein-texte sur nom + sujet (insensible à la casse). */
  q?: string;
  /** Page 1-based. */
  page?: number;
  /** Taille de page (déf. 20, max 100). */
  pageSize?: number;
  /** Compat ascendante : ancien appel `{ limit }`. Ignoré si page/pageSize. */
  limit?: number;
}

export interface ListCampaignsResult {
  rows: EmailCampaignLinkRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * Liste paginée + filtrable des campagnes (UX-CAMP-012). Les filtres sont
 * portés par l'URL côté page ; ici on traduit en clauses SQL sûres.
 */
export async function listCampaigns(
  params: ListCampaignsParams = {},
): Promise<ListCampaignsResult> {
  const drizzle = requireDb();

  const pageSize = Math.min(Math.max(params.pageSize ?? params.limit ?? 20, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const clauses: SQL[] = [];
  if (
    params.status &&
    params.status !== 'all' &&
    (CAMPAIGN_STATUSES as readonly string[]).includes(params.status)
  ) {
    clauses.push(eq(emailCampaignLink.status, params.status as CampaignStatusFilter));
  }
  const q = params.q?.trim();
  if (q) {
    const needle = `%${q}%`;
    const search = or(
      ilike(emailCampaignLink.name, needle),
      ilike(emailCampaignLink.subject, needle),
    );
    if (search) clauses.push(search);
  }
  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const totalRows = await drizzle
    .select({ total: sql<number>`count(*)::int` })
    .from(emailCampaignLink)
    .where(where);
  const total = totalRows[0]?.total ?? 0;

  const rows = await drizzle
    .select()
    .from(emailCampaignLink)
    .where(where)
    .orderBy(desc(emailCampaignLink.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Résout le nom + slug d'une audience FemiGlow pour les deep-links du détail
 * campagne (UX-CAMP-005). Renvoie null si l'id est absent/introuvable.
 */
export async function getAudienceLabel(
  audienceId: string | null,
): Promise<{ id: string; name: string; slug: string } | null> {
  if (!audienceId) return null;
  const drizzle = requireDb();
  const [row] = await drizzle
    .select({ id: emailAudience.id, name: emailAudience.name, slug: emailAudience.slug })
    .from(emailAudience)
    .where(eq(emailAudience.id, audienceId))
    .limit(1);
  return row ?? null;
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
