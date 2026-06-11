/**
 * Lecture paginée des membres d'un snapshot (UX-AUD-012).
 *
 * `email_audience_snapshot_member` matérialise la liste figée d'un snapshot
 * (objectif métier AUD-S2 : envoi reproductible). Aucune lecture UI n'existait
 * → impossible d'auditer qui a été ciblé. Ce module expose :
 *   - listSnapshotMembers(snapshotId, { limit, offset }) → { members, total }
 *   - snapshotMembersToCsv(members) → string (export CSV)
 *
 * Le snapshot DOIT appartenir à l'audience (vérifié par la route appelante) —
 * ici on se borne au snapshotId pour rester réutilisable.
 */
import 'server-only';
import { asc, eq, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailAudienceSnapshotMember } from '@/lib/db/schema-emails';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export type SnapshotMember = {
  email: string;
  payload: Record<string, unknown> | null;
};

export type ListSnapshotMembersResult = {
  members: SnapshotMember[];
  total: number;
};

const MAX_LIMIT = 500;

export async function listSnapshotMembers(
  snapshotId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<ListSnapshotMembersResult> {
  const drizzle = requireDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), MAX_LIMIT);
  const offset = Math.max(0, opts.offset ?? 0);

  const [members, totalRows] = await Promise.all([
    drizzle
      .select({
        email: emailAudienceSnapshotMember.email,
        payload: emailAudienceSnapshotMember.payload,
      })
      .from(emailAudienceSnapshotMember)
      .where(eq(emailAudienceSnapshotMember.snapshotId, snapshotId))
      .orderBy(asc(emailAudienceSnapshotMember.email))
      .limit(limit)
      .offset(offset),
    drizzle
      .select({ n: sql<number>`count(*)::int` })
      .from(emailAudienceSnapshotMember)
      .where(eq(emailAudienceSnapshotMember.snapshotId, snapshotId)),
  ]);

  return {
    members: members as SnapshotMember[],
    total: (totalRows as Array<{ n: number }>)[0]?.n ?? 0,
  };
}

/** Échappe un champ CSV (guillemets doublés, encadrement si nécessaire). */
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Sérialise les membres en CSV (colonnes : email, name). Le `name` est lu du
 * payload (jsonb), où le snapshot engine stocke `{ name }`.
 */
export function snapshotMembersToCsv(members: SnapshotMember[]): string {
  const header = 'email,name';
  const lines = members.map((m) => {
    const name =
      m.payload && typeof m.payload === 'object' && 'name' in m.payload
        ? String((m.payload as { name?: unknown }).name ?? '')
        : '';
    return `${csvCell(m.email)},${csvCell(name)}`;
  });
  return [header, ...lines].join('\n');
}
