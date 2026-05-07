import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginInputSchema } from '@/lib/schemas/admin/login';
import { findAdminByEmail, recordLoginAttempt, countRecentFailedAttempts } from '@/lib/db/queries/admin-users';
import { verifyPassword } from '@/lib/auth/password';
import { ensureBootstrapAdminOnce } from '@/lib/auth/bootstrap-admin';
import { createSession, encodeSession, sessionCookieOptions } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';
import { getClientIp, hashIp } from '@/lib/http/client-ip';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BRUTEFORCE_LIMIT = 5;
const BRUTEFORCE_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const ipDigest = hashIp(ip);
  try {
    await ensureBootstrapAdminOnce();
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = loginInputSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Email ou mot de passe invalide');
    }
    const { email, password } = parsed.data;

    const failed = await countRecentFailedAttempts(ip, email, BRUTEFORCE_WINDOW_MS);
    if (failed >= BRUTEFORCE_LIMIT) {
      logger.warn('admin.login.rate_limited', { ip_hash: ipDigest, email_hash: hashIp(email) });
      throw new HttpError('rate_limited', 'Trop de tentatives, réessayez dans 15 min');
    }
    const rate = await checkRateLimit({
      key: `login:${ip}`,
      limit: 20,
      windowMs: BRUTEFORCE_WINDOW_MS,
    });
    if (!rate.ok) {
      throw new HttpError('rate_limited', 'Trop de tentatives');
    }

    const admin = await findAdminByEmail(email);
    const passwordOk = admin ? await verifyPassword(password, admin.passwordHash) : false;

    if (!admin || !passwordOk) {
      await recordLoginAttempt({ ip, email, failed: true });
      await logAuditEvent({
        action: 'admin.login.failed',
        actorId: null,
        meta: { ip_hash: ipDigest, email },
      });
      throw new HttpError('unauthorized', 'Email ou mot de passe invalide');
    }

    const session = createSession(admin.id, admin.email);
    const token = await encodeSession(session);
    cookies().set({ ...sessionCookieOptions(), value: token });
    await logAuditEvent({
      action: 'admin.login.success',
      actorId: admin.id,
      meta: { ip_hash: ipDigest },
    });
    logger.info('admin.login.success', { admin_id: admin.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
