/**
 * CHA-300 — Repository chat_canned_pair (V5/V6).
 *
 * Sert les SuggestionPills page-aware : on filtre par `pagePattern`,
 * `audience`, `status = 'published'` et `enabled = true`. Tri par `order`.
 *
 * Le canned-engine consomme `getByKey(key)` pour rendre la `scripted_reply_*`
 * dans la langue de session.
 */
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { createId } from '@/lib/ids';

import { requireChatDb } from '../db/client';
import {
  chatCannedPair,
  type ChatCannedPairRow,
} from '../db/schema';

import type { ChatLanguage } from '../contracts';

export interface CannedPairForPill {
  key: string;
  label: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  order: number;
}

/**
 * Sélectionne le label localisé pour la langue donnée. Fallback FR.
 */
function localizedLabel(row: ChatCannedPairRow, lang: ChatLanguage | string | null | undefined): string {
  if (lang === 'ar') return row.labelAr;
  if (lang === 'ar-MA') return row.labelArMa;
  return row.labelFr;
}

function localizedReply(row: ChatCannedPairRow, lang: ChatLanguage | string | null | undefined): string {
  if (lang === 'ar') return row.scriptedReplyAr;
  if (lang === 'ar-MA') return row.scriptedReplyArMa;
  return row.scriptedReplyFr;
}

/**
 * Match page_pattern simple :
 *   - '*' → match toujours
 *   - '/kit' → exact match sur '/kit'
 *   - '/kit/*' → match '/kit' + descendants
 *   - '/' → exact match sur '/'
 *
 * On filtre côté JS (volume faible, ~50 paires max) plutôt que SQL LIKE
 * pour éviter les ambiguïtés et garder la logique testable.
 */
function pageMatches(pagePattern: string, page: string): boolean {
  if (pagePattern === '*') return true;
  if (pagePattern.endsWith('/*')) {
    const base = pagePattern.slice(0, -2);
    return page === base || page.startsWith(`${base}/`);
  }
  return pagePattern === page;
}

export const cannedPairRepo = {
  /**
   * Liste les paires publiées + enabled visibles pour la page courante.
   * Tri par `order` ascendant.
   */
  async listForPage(opts: {
    page: string;
    audience?: 'all' | 'b2c' | 'b2b';
    language?: ChatLanguage | string | null;
    limit?: number;
  }): Promise<CannedPairForPill[]> {
    const db = requireChatDb();
    const audiences: ('all' | 'b2c' | 'b2b')[] =
      opts.audience && opts.audience !== 'all'
        ? ['all', opts.audience]
        : ['all'];
    const rows = await db
      .select()
      .from(chatCannedPair)
      .where(
        and(
          eq(chatCannedPair.status, 'published'),
          eq(chatCannedPair.enabled, true),
          inArray(chatCannedPair.audience, audiences),
        ),
      )
      .orderBy(asc(chatCannedPair.order));

    const filtered = rows.filter((r) => pageMatches(r.pagePattern, opts.page));
    const limit = opts.limit ?? 6;
    return filtered.slice(0, limit).map((r) => ({
      key: r.key,
      label: localizedLabel(r, opts.language),
      ctaLabel: r.ctaLabel,
      ctaUrl: r.ctaUrl,
      order: r.order,
    }));
  },

  async getByKey(key: string): Promise<ChatCannedPairRow | null> {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatCannedPair)
      .where(eq(chatCannedPair.key, key))
      .limit(1);
    return rows[0] ?? null;
  },

  /**
   * Liste exhaustive admin (toutes audiences/status). Tri par
   * `updated_at` descendant pour voir les modifs récentes en haut.
   */
  async listAll(): Promise<ChatCannedPairRow[]> {
    const db = requireChatDb();
    return db
      .select()
      .from(chatCannedPair)
      .orderBy(desc(chatCannedPair.updatedAt));
  },

  async getById(id: string): Promise<ChatCannedPairRow | null> {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatCannedPair)
      .where(eq(chatCannedPair.id, id))
      .limit(1);
    return rows[0] ?? null;
  },

  async create(input: {
    key: string;
    pagePattern: string;
    audience: 'all' | 'b2c' | 'b2b';
    order: number;
    enabled: boolean;
    labelFr: string;
    labelAr: string;
    labelArMa: string;
    scriptedReplyFr: string;
    scriptedReplyAr: string;
    scriptedReplyArMa: string;
    ctaLabel: string | null;
    ctaUrl: string | null;
    allowFollowupLlm: boolean;
    triggersLeadForm?: boolean;
    leadFormCopyKey?: string | null;
    status: 'draft' | 'review' | 'published' | 'archived';
  }): Promise<ChatCannedPairRow> {
    const db = requireChatDb();
    const id = createId('cnp');
    const rows = await db
      .insert(chatCannedPair)
      .values({
        id,
        ...input,
        triggersLeadForm: input.triggersLeadForm ?? false,
        leadFormCopyKey:
          (input.leadFormCopyKey as ChatCannedPairRow['leadFormCopyKey']) ?? null,
      })
      .returning();
    return rows[0]!;
  },

  /**
   * Patch partiel par id. On bypass Drizzle pour les sets dynamiques —
   * sql template fonctionne mieux que `.update().set(obj)` quand certains
   * champs sont conditionnels (et reste lisible).
   */
  async update(
    id: string,
    patch: Partial<{
      key: string;
      pagePattern: string;
      audience: 'all' | 'b2c' | 'b2b';
      order: number;
      enabled: boolean;
      labelFr: string;
      labelAr: string;
      labelArMa: string;
      scriptedReplyFr: string;
      scriptedReplyAr: string;
      scriptedReplyArMa: string;
      ctaLabel: string | null;
      ctaUrl: string | null;
      allowFollowupLlm: boolean;
      triggersLeadForm: boolean;
      leadFormCopyKey: string | null;
      status: 'draft' | 'review' | 'published' | 'archived';
    }>,
  ): Promise<ChatCannedPairRow | null> {
    const db = requireChatDb();
    const sets: ReturnType<typeof sql>[] = [];
    const push = (col: string, val: unknown): void => {
      sets.push(sql.raw(`${col} = `).append(sql`${val}`));
    };
    if (patch.key !== undefined) push('key', patch.key);
    if (patch.pagePattern !== undefined) push('page_pattern', patch.pagePattern);
    if (patch.audience !== undefined) push('audience', patch.audience);
    if (patch.order !== undefined) push('"order"', patch.order);
    if (patch.enabled !== undefined) push('enabled', patch.enabled);
    if (patch.labelFr !== undefined) push('label_fr', patch.labelFr);
    if (patch.labelAr !== undefined) push('label_ar', patch.labelAr);
    if (patch.labelArMa !== undefined) push('label_ar_ma', patch.labelArMa);
    if (patch.scriptedReplyFr !== undefined) push('scripted_reply_fr', patch.scriptedReplyFr);
    if (patch.scriptedReplyAr !== undefined) push('scripted_reply_ar', patch.scriptedReplyAr);
    if (patch.scriptedReplyArMa !== undefined) push('scripted_reply_ar_ma', patch.scriptedReplyArMa);
    if (patch.ctaLabel !== undefined) push('cta_label', patch.ctaLabel);
    if (patch.ctaUrl !== undefined) push('cta_url', patch.ctaUrl);
    if (patch.allowFollowupLlm !== undefined) push('allow_followup_llm', patch.allowFollowupLlm);
    if (patch.triggersLeadForm !== undefined) push('triggers_lead_form', patch.triggersLeadForm);
    if (patch.leadFormCopyKey !== undefined) push('lead_form_copy_key', patch.leadFormCopyKey);
    if (patch.status !== undefined) push('status', patch.status);
    if (sets.length === 0) return this.getById(id);
    sets.push(sql`updated_at = now()`);
    await db.execute(sql`
      UPDATE chat_canned_pair SET ${sql.join(sets, sql`, `)}
      WHERE id = ${id}
    `);
    return this.getById(id);
  },

  async deleteById(id: string): Promise<boolean> {
    const db = requireChatDb();
    const rows = await db
      .delete(chatCannedPair)
      .where(eq(chatCannedPair.id, id))
      .returning();
    return rows.length > 0;
  },

  /**
   * Helper de localisation exportable pour les tests + l'orchestrator.
   */
  localizedReply,
  localizedLabel,
};

export { localizedReply, localizedLabel, pageMatches };
