/**
 * GET /api/admin/emails/transactional/recipients-autocomplete?q=
 *
 * Typeahead destinataire pour le cockpit (filtre `to:`), le wizard campagne
 * (test-send) et tout champ destinataire. Renvoie les `to_email` DISTINCTS de
 * `email_outbox` dont le préfixe correspond à `q` (ILIKE `q%`), plafonné à 20,
 * triés alphabétiquement.
 *
 * Contrat : `{ recipients: string[] }`. Validation Zod sur `q` (string ≤ 200).
 * Auth admin requise (comme les routes voisines). Si la DB est indisponible, on
 * renvoie une liste vide (200) plutôt qu'une 500 — le champ reste libre.
 *
 * SÉCURITÉ : `q` est échappé des métacaractères LIKE (`%`, `_`, `\`) avant le
 * `ILIKE prefix%` — pas d'injection de wildcard via la saisie utilisateur.
 */
import { NextResponse } from 'next/server';
import { and, asc, ilike, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { db as getDb } from '@/lib/db/client';
import { emailOutbox } from '@/lib/db/schema-emails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  q: z.string().max(200).optional().default(''),
});

/** Échappe les métacaractères LIKE pour neutraliser l'injection de wildcard. */
export function escapeLikePrefix(raw: string): string {
  return raw.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function GET(req: Request): Promise<Response> {
  await requireAdmin('/api/admin/emails/transactional/recipients-autocomplete');

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ q: url.searchParams.get('q') ?? '' });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const q = parsed.data.q.trim();

  const drizzle = getDb();
  if (!drizzle) return NextResponse.json({ recipients: [] });

  const pattern = `${escapeLikePrefix(q)}%`;
  const rows = await drizzle
    .selectDistinct({ toEmail: emailOutbox.toEmail })
    .from(emailOutbox)
    .where(
      q.length > 0
        ? and(isNotNull(emailOutbox.toEmail), ilike(emailOutbox.toEmail, pattern))
        : isNotNull(emailOutbox.toEmail),
    )
    .orderBy(asc(emailOutbox.toEmail))
    .limit(20);

  const recipients = rows.map((r) => r.toEmail).filter((e): e is string => !!e);
  return NextResponse.json({ recipients });
}
