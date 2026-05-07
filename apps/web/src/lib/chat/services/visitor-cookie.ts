/**
 * Cookie visitor (`fg_v`) — identifiant persistant non-PII pour
 * relier les sessions chat d'un même navigateur.
 *
 * Durée 1 an, HttpOnly, SameSite=Lax. Pas de PII, juste un opaque
 * id généré côté serveur si absent.
 */
import { cookies } from 'next/headers';

import { env } from '@/lib/env';
import { createId } from '@/lib/ids';

const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

export function getVisitorId(): string {
  const store = cookies();
  const existing = store.get(env.CHAT_VISITOR_COOKIE_NAME);
  if (existing?.value) return existing.value;
  const fresh = createId('v');
  // Note : `cookies().set()` ne fonctionne que dans une Route
  // Handler / Server Action. L'appelant doit donc être dans un
  // contexte mutable. Pour les Server Components purement
  // lecteurs, on retourne un id temporaire (à persister via
  // une route POST /api/chat/session).
  try {
    store.set({
      name: env.CHAT_VISITOR_COOKIE_NAME,
      value: fresh,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ONE_YEAR_SEC,
      path: '/',
    });
  } catch {
    // Read-only context : le cookie sera persisté lors du prochain POST.
  }
  return fresh;
}
