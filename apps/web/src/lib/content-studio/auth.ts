import { env } from '@/lib/env';
import { HttpError } from '@/lib/errors/http-error';

export function requireContentStudioEnabled(): void {
  if (env.CONTENT_STUDIO_ENABLED !== 'true') {
    throw new HttpError('forbidden', 'Content Studio désactivé.');
  }
}

