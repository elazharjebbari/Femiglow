import { and, eq, gte, sql as dsql } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { AdminUser } from '@/lib/db/types';

export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.adminUsers)
      .where(dsql`lower(${schema.adminUsers.email}) = lower(${email})`)
      .limit(1);
    return rows[0] ?? null;
  }
  const store = memoryStore();
  for (const u of store.adminUsers.values()) {
    if (u.email.toLowerCase() === email.toLowerCase()) return u;
  }
  return null;
}

export async function findAdminById(id: string): Promise<AdminUser | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.adminUsers)
      .where(eq(schema.adminUsers.id, id))
      .limit(1);
    return rows[0] ?? null;
  }
  return memoryStore().adminUsers.get(id) ?? null;
}

export async function createAdmin(input: {
  email: string;
  passwordHash: string;
  name: string;
}): Promise<AdminUser> {
  const now = new Date();
  const admin: AdminUser = {
    id: createId('u'),
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    name: input.name,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.adminUsers).values(admin);
    return admin;
  }
  memoryStore().adminUsers.set(admin.id, admin);
  return admin;
}

const loginAttempts = {
  // table reference for future migration to PG; see schema.ts annexe
};

export async function recordLoginAttempt(input: {
  ip: string;
  email: string;
  failed: boolean;
}): Promise<void> {
  if (!input.failed) return;
  // Login attempts are an in-memory counter only (rate-limit window <= 15min).
  // Pas de table dédiée Postgres : auditEvents capture déjà les évènements
  // significatifs ; ce store sert uniquement au rate-limit /api/admin/login.
  void loginAttempts;
  const store = memoryStore();
  const id = createId('la');
  store.loginAttempts.set(id, {
    ip: input.ip,
    email: input.email.toLowerCase(),
    failedAt: new Date(),
  });
}

export async function countRecentFailedAttempts(
  ip: string,
  email: string,
  windowMs: number,
): Promise<number> {
  const store = memoryStore();
  const cutoff = Date.now() - windowMs;
  let count = 0;
  for (const a of store.loginAttempts.values()) {
    if (a.ip === ip && a.email === email.toLowerCase() && a.failedAt.getTime() >= cutoff) {
      count += 1;
    }
  }
  return count;
}

void and;
void gte;
