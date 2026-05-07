/**
 * CHA-124 — Auth gate des routes admin /api/admin/chat/*.
 *
 * Reuse `getAdminSession()` (cookie iron-session déjà présent dans le
 * template). Renvoie 401 si pas de session.
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';

export async function requireAdminApi(): Promise<
  | { ok: true; email: string }
  | { ok: false; response: Response }
> {
  const session = await getAdminSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true, email: session.email };
}
