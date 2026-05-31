/**
 * Suppression list check — must be invoked before any send.
 *
 * Sources of truth: `email_suppression` table (canonical) + Listmonk blocklist
 * (mirrored bi-directionally by `femiglow-cron-email-suppression-sync`).
 */
import { eq, inArray } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailSuppression, type EmailSuppressionInsert } from '@/lib/db/schema-emails';

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) {
    throw new Error('Database not configured (DATABASE_URL missing)');
  }
  return drizzle;
}

export async function isSuppressed(email: string): Promise<boolean> {
  const drizzle = requireDb();
  const normalized = normalize(email);
  const rows = await drizzle
    .select({ email: emailSuppression.email })
    .from(emailSuppression)
    .where(eq(emailSuppression.email, normalized))
    .limit(1);
  return rows.length > 0;
}

export async function findSuppressed(emails: string[]): Promise<Set<string>> {
  const normalized = emails.map(normalize);
  if (normalized.length === 0) return new Set();
  const drizzle = requireDb();
  const rows = await drizzle
    .select({ email: emailSuppression.email })
    .from(emailSuppression)
    .where(inArray(emailSuppression.email, normalized));
  return new Set(rows.map((r: { email: string }) => r.email));
}

export async function addSuppression(input: EmailSuppressionInsert): Promise<void> {
  const drizzle = requireDb();
  await drizzle
    .insert(emailSuppression)
    .values({ ...input, email: normalize(input.email) })
    .onConflictDoNothing();
}
