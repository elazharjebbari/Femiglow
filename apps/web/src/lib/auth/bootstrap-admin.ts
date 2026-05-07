import { env } from '@/lib/env';
import { findAdminByEmail, createAdmin } from '@/lib/db/queries/admin-users';
import { hashPassword } from '@/lib/auth/password';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';

let bootstrapped = false;

export async function ensureBootstrapAdmin(): Promise<{
  status: 'skipped' | 'created' | 'exists';
  email?: string;
}> {
  const email = env.ADMIN_BOOTSTRAP_EMAIL;
  const password = env.ADMIN_BOOTSTRAP_PASSWORD;
  const name = env.ADMIN_BOOTSTRAP_NAME ?? 'Super Admin';

  if (!email || !password) return { status: 'skipped' };

  const existing = await findAdminByEmail(email);
  if (existing) {
    bootstrapped = true;
    return { status: 'exists', email };
  }

  const passwordHash = await hashPassword(password);
  const admin = await createAdmin({ email, passwordHash, name });
  bootstrapped = true;
  await logAuditEvent({
    action: 'admin.bootstrap.created',
    actorId: admin.id,
    meta: { email: admin.email },
  });
  logger.info('admin.bootstrap.created', { admin_id: admin.id, email: admin.email });
  return { status: 'created', email: admin.email };
}

export async function ensureBootstrapAdminOnce(): Promise<void> {
  if (bootstrapped) return;
  try {
    await ensureBootstrapAdmin();
  } catch (err) {
    logger.warn('admin.bootstrap.failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
