import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { HttpError } from '@/lib/errors/http-error';
import { decodeSession, SESSION_COOKIE, type AdminSession } from '@/lib/auth/session';

let loggedStudioDisabled = false;

export function requireContentStudioEnabled(): void {
  if (env.CONTENT_STUDIO_ENABLED !== 'true') {
    if (!loggedStudioDisabled) {
      console.warn('[content-studio] Feature désactivée. Activez CONTENT_STUDIO_ENABLED=true en staging.');
      loggedStudioDisabled = true;
    }
    throw new HttpError('forbidden', 'Content Studio désactivé.');
  }
}

/**
 * MP-AR-006 (BUG-004) — is the operator media studio (voice-over, montage,
 * subtitles) enabled? Additive flag, default off; the 4-step create flow is
 * unaffected when false.
 */
export function isMediaStudioEnabled(): boolean {
  return env.CONTENT_STUDIO_MEDIA_STUDIO_ENABLED === 'true';
}

/** Gate the media-studio routes (voice-over, montage, subtitles) on the flag. */
export function requireMediaStudioEnabled(): void {
  if (!isMediaStudioEnabled()) {
    throw new HttpError('forbidden', 'Studio média désactivé (CONTENT_STUDIO_MEDIA_STUDIO_ENABLED).');
  }
}

export async function requireAdminApi(): Promise<AdminSession> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await decodeSession(token);
  if (!session) {
    throw new HttpError('unauthorized', 'Session expirée. Veuillez vous reconnecter.');
  }
  return session;
}

