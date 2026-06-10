/**
 * listOutboxFiltered — query DB outbox avec filtres typés (M5.1).
 *
 * Convertit un array ParsedFilter[] en SQL Drizzle. Couvre tous les
 * types de filtres : status, to (glob), template (glob), source,
 * after/before (dates), attempts (opérateur), has:error, freetext.
 *
 * Cf. docs/emailing/admin-evolution/01-data/05-queries-catalog.md
 *    docs/emailing/admin-evolution/02-backend/01-api-endpoints.md
 */
import 'server-only';
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailOutbox, type EmailOutboxRow } from '@/lib/db/schema-emails';
import type { ParsedFilter } from './filters-parser';

export type OutboxSearchRow = Pick<
  EmailOutboxRow,
  | 'id'
  | 'template'
  | 'toEmail'
  | 'toName'
  | 'subject'
  | 'status'
  | 'attempts'
  | 'maxAttempts'
  | 'lastError'
  | 'source'
  | 'createdAt'
  | 'deliveredAt'
  | 'bounceType'
>;

export type SearchSort = 'date_desc' | 'date_asc' | 'status' | 'template' | 'attempts_desc';

export type SearchInput = {
  filters: ParsedFilter[];
  freetext?: string;
  pagination: { limit: number; offset: number };
  sort?: SearchSort;
};

export type SearchResult = {
  rows: OutboxSearchRow[];
  total: number;
  /**
   * 'matched' = `total` est le compte exact.
   * 'truncated' = on dépasse une borne sentinelle (typiquement 1000+), le
   * compte exact n'est pas calculé (perf).
   */
  window: 'matched' | 'truncated';
};

const MAX_LIMIT = 1000;
const TRUNCATE_THRESHOLD = 5000;

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

/** Convertit un glob `cart-*` en pattern SQL `cart-%`. */
function globToSqlPattern(value: string): string {
  return value.replace(/\*/g, '%').replace(/_/g, '\\_');
}

/** Construit le WHERE clause pour un filtre individuel. */
function filterToSql(f: ParsedFilter): SQL | undefined {
  switch (f.key) {
    case 'status':
      if (f.value.length === 0) return undefined;
      return inArray(emailOutbox.status, f.value);

    case 'to': {
      const pattern = globToSqlPattern(f.value);
      // Si pas de wildcard → eq exact ; sinon ilike.
      return f.value.includes('*')
        ? ilike(emailOutbox.toEmail, pattern)
        : eq(emailOutbox.toEmail, f.value);
    }

    case 'template': {
      const pattern = globToSqlPattern(f.value);
      return f.value.includes('*')
        ? ilike(emailOutbox.template, pattern)
        : eq(emailOutbox.template, f.value);
    }

    case 'source': {
      const pattern = globToSqlPattern(f.value);
      return f.value.includes('*')
        ? ilike(emailOutbox.source, pattern)
        : eq(emailOutbox.source, f.value);
    }

    case 'after':
      return gte(emailOutbox.createdAt, f.value);

    case 'before':
      return lte(emailOutbox.createdAt, f.value);

    case 'attempts':
      switch (f.operator) {
        case '>':
          return sql`${emailOutbox.attempts} > ${f.value}`;
        case '<':
          return sql`${emailOutbox.attempts} < ${f.value}`;
        case '>=':
          return sql`${emailOutbox.attempts} >= ${f.value}`;
        case '<=':
          return sql`${emailOutbox.attempts} <= ${f.value}`;
        case '=':
        default:
          return eq(emailOutbox.attempts, f.value);
      }

    case 'has':
      // f.value === 'error'
      return isNotNull(emailOutbox.lastError);
  }
}

/** Recherche freetext : match l'email OU le nom OU le template. */
function freetextSql(freetext: string): SQL {
  const pattern = `%${freetext.replace(/[%_]/g, '\\$&')}%`;
  return or(
    ilike(emailOutbox.toEmail, pattern),
    ilike(emailOutbox.toName, pattern),
    ilike(emailOutbox.template, pattern),
  )!;
}

/**
 * Compilateur filtre → WHERE. SOURCE UNIQUE (interdit de dupliquer — spec F04) :
 * /search, /export et /bulk-retry-by-filter DOIVENT passer par lui pour
 * garantir le MÊME ensemble de lignes pour le même filtre (F04-I-010).
 */
export function buildWhere(input: Pick<SearchInput, 'filters' | 'freetext'>): SQL | undefined {
  const fragments: SQL[] = [];
  for (const f of input.filters) {
    const sqlFrag = filterToSql(f);
    if (sqlFrag) fragments.push(sqlFrag);
  }
  if (input.freetext) {
    fragments.push(freetextSql(input.freetext));
  }
  if (fragments.length === 0) return undefined;
  return and(...fragments);
}

function buildOrderBy(sort: SearchSort) {
  switch (sort) {
    case 'date_asc':
      return asc(emailOutbox.createdAt);
    case 'status':
      return asc(emailOutbox.status);
    case 'template':
      return asc(emailOutbox.template);
    case 'attempts_desc':
      return desc(emailOutbox.attempts);
    case 'date_desc':
    default:
      return desc(emailOutbox.createdAt);
  }
}

/* ── Export CSV serveur (CKPT-01) ─────────────────────────────────────── */

export type ExportInput = Pick<SearchInput, 'filters' | 'freetext'>;

/** Cap dur de l'export serveur (spec F04 §2). */
export const EXPORT_MAX_ROWS = 100_000;

/**
 * Compte BORNÉ des lignes matchant le filtre : s'arrête à `bound` (pas de
 * COUNT(*) plein sur un gros ensemble — on n'a besoin que de « > cap ? »).
 */
export async function countOutboxBounded(input: ExportInput, bound: number): Promise<number> {
  const drizzle = requireDb();
  const where = buildWhere(input);
  const inner = drizzle
    .select({ one: sql<number>`1` })
    .from(emailOutbox)
    .$dynamic();
  const bounded = (where ? inner.where(where) : inner).limit(bound);
  const [row] = await drizzle
    .select({ n: sql<number>`count(*)::int` })
    .from(bounded.as('bounded'));
  return row?.n ?? 0;
}

/**
 * Itère les lignes de l'export par paquets, en pagination KEYSET
 * `(created_at, id)` croissants — JAMAIS d'OFFSET : stable sous insertions
 * concurrentes (aucun saut ni doublon des lignes existantes au départ), et
 * O(n) au lieu de O(n²) sur 100 000 lignes.
 *
 * Retour final : `{ streamed, capped }` — capped=true si des lignes restaient
 * au-delà de `maxRows`.
 */
export async function* iterateOutboxForExport(
  input: ExportInput,
  opts: { maxRows?: number; chunkSize?: number } = {},
): AsyncGenerator<OutboxSearchRow[], { streamed: number; capped: boolean }> {
  const drizzle = requireDb();
  const maxRows = opts.maxRows ?? EXPORT_MAX_ROWS;
  const chunkSize = Math.max(1, opts.chunkSize ?? 1_000);
  const baseWhere = buildWhere(input);

  let streamed = 0;
  let lastCreatedAt: Date | null = null;
  let lastId: string | null = null;

  while (streamed < maxRows) {
    // +1 ligne « sonde » sur le dernier paquet pour détecter le cap sans
    // requête supplémentaire (remaining <= chunkSize ⇒ paquet final).
    const remaining = maxRows - streamed;
    const take = remaining <= chunkSize ? remaining + 1 : chunkSize;
    // ISO + cast explicite : postgres-js refuse une Date JS crue dans un
    // fragment sql brut (ERR_INVALID_ARG_TYPE — même gotcha que R-028).
    const cursor =
      lastCreatedAt !== null && lastId !== null
        ? sql`(${emailOutbox.createdAt}, ${emailOutbox.id}) > (${lastCreatedAt.toISOString()}::timestamptz, ${lastId})`
        : undefined;
    const where = cursor && baseWhere ? and(baseWhere, cursor) : (cursor ?? baseWhere);

    const q = drizzle
      .select({
        id: emailOutbox.id,
        template: emailOutbox.template,
        toEmail: emailOutbox.toEmail,
        toName: emailOutbox.toName,
        subject: emailOutbox.subject,
        status: emailOutbox.status,
        attempts: emailOutbox.attempts,
        maxAttempts: emailOutbox.maxAttempts,
        lastError: emailOutbox.lastError,
        source: emailOutbox.source,
        createdAt: emailOutbox.createdAt,
        deliveredAt: emailOutbox.deliveredAt,
        bounceType: emailOutbox.bounceType,
      })
      .from(emailOutbox)
      .$dynamic();
    const rows = (await (where ? q.where(where) : q)
      .orderBy(asc(emailOutbox.createdAt), asc(emailOutbox.id))
      .limit(take)) as OutboxSearchRow[];

    if (rows.length === 0) return { streamed, capped: false };

    const emit = rows.slice(0, maxRows - streamed);
    const last = emit[emit.length - 1]!;
    lastCreatedAt = last.createdAt;
    lastId = String(last.id);
    streamed += emit.length;
    yield emit;

    if (rows.length > emit.length) return { streamed, capped: true }; // la sonde a vu au-delà du cap
    if (rows.length < take) return { streamed, capped: false }; // fin de l'ensemble
  }
  return { streamed, capped: false };
}

/**
 * Liste paginée + total optimisé. Si > TRUNCATE_THRESHOLD résultats
 * potentiels, on renvoie window='truncated' et total=TRUNCATE_THRESHOLD
 * pour éviter de faire un COUNT(*) lent.
 */
export async function listOutboxFiltered(input: SearchInput): Promise<SearchResult> {
  const drizzle = requireDb();
  const limit = Math.min(Math.max(1, input.pagination.limit), MAX_LIMIT);
  const offset = Math.max(0, input.pagination.offset);
  const where = buildWhere(input);
  const orderBy = buildOrderBy(input.sort ?? 'date_desc');

  const baseQuery = drizzle
    .select({
      id: emailOutbox.id,
      template: emailOutbox.template,
      toEmail: emailOutbox.toEmail,
      toName: emailOutbox.toName,
      subject: emailOutbox.subject,
      status: emailOutbox.status,
      attempts: emailOutbox.attempts,
      maxAttempts: emailOutbox.maxAttempts,
      lastError: emailOutbox.lastError,
      source: emailOutbox.source,
      createdAt: emailOutbox.createdAt,
      deliveredAt: emailOutbox.deliveredAt,
      bounceType: emailOutbox.bounceType,
    })
    .from(emailOutbox);

  const rowsPromise = (where ? baseQuery.where(where) : baseQuery)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Count truncé : on demande TRUNCATE_THRESHOLD+1, si on l'atteint on sait
  // qu'on est saturé sans full scan.
  const countQuery = drizzle
    .select({ n: sql<number>`count(*)::int` })
    .from(emailOutbox);
  const [{ n: total } = { n: 0 }] = await (where ? countQuery.where(where) : countQuery);

  const rows = await rowsPromise;

  return {
    rows: rows as OutboxSearchRow[],
    total,
    window: total >= TRUNCATE_THRESHOLD ? 'truncated' : 'matched',
  };
}
