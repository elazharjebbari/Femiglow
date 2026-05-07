/**
 * Helper d'authentification des routes cron Vercel.
 *
 * Vercel envoie un header `Authorization: Bearer <CRON_SECRET>` aux
 * jobs déclenchés depuis `vercel.json`. On valide ce secret avant
 * d'exécuter du travail. cf. https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 */
import { type NextRequest } from 'next/server';

import { env } from '@/lib/env';

export function isAuthorizedCron(req: NextRequest): boolean {
  const expected = env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${expected}`;
}
