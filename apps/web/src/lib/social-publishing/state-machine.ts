import type { SocialPublishJobStatus } from './contracts';
import { SocialPublishingError } from './errors';

const ALLOWED_TRANSITIONS: Record<SocialPublishJobStatus, SocialPublishJobStatus[]> = {
  draft: ['approved', 'cancelled'],
  approved: ['queued', 'cancelled'],
  queued: ['publishing', 'cancelled', 'failed'],
  publishing: ['published', 'failed'],
  published: [],
  failed: ['queued', 'cancelled'],
  cancelled: [],
};

export function canTransitionSocialPublishJob(
  from: SocialPublishJobStatus,
  to: SocialPublishJobStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertSocialPublishJobTransition(
  from: SocialPublishJobStatus,
  to: SocialPublishJobStatus,
): void {
  if (!canTransitionSocialPublishJob(from, to)) {
    throw new SocialPublishingError({
      code: 'invalid_request',
      message: `Invalid social publish transition: ${from} -> ${to}`,
      retryable: false,
    });
  }
}

export function isTerminalSocialPublishJobStatus(status: SocialPublishJobStatus): boolean {
  return status === 'published' || status === 'cancelled';
}

export function nextRetryStatus(status: SocialPublishJobStatus): SocialPublishJobStatus {
  if (status !== 'failed') {
    throw new SocialPublishingError({
      code: 'invalid_request',
      message: `Only failed social publish jobs can be retried, got ${status}`,
      retryable: false,
    });
  }
  return 'queued';
}
