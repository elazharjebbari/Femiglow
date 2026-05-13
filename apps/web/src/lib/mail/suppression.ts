/**
 * Suppression list check — must be invoked before any send.
 *
 * Sources of truth: `email_suppression` table (canonical) + Listmonk blocklist
 * (mirrored bi-directionally by `femiglow-cron-email-suppression-sync`).
 */
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { emailSuppression, type EmailSuppressionInsert } from '@/lib/db/schema-emails';

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

export async function isSuppressed(email: string): Promise<boolean> {
  const normalized = normalize(email);
  const rows = await db
    .select({ email: emailSuppression.email })
    .from(emailSuppression)
    .where(eq(emailSuppression.email, normalized))
    .limit(1);
  return rows.length > 0;
}

export async function findSuppressed(emails: string[]): Promise<Set<string>> {
  const normalized = emails.map(normalize);
  if (normalized.length === 0) return new Set();
  const rows = await db
    .select({ email: emailSuppression.email })
    .from(emailSuppression)
    .where(inArray(emailSuppression.email, normalized));
  return new Set(rows.map((r) => r.email));
}

export async function addSuppression(input: EmailSuppressionInsert): Promise<void> {
  await db
    .insert(emailSuppression)
    .values({ ...input, email: normalize(input.email) })
    .onConflictDoNothing();
}
