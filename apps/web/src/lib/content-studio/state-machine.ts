import type { ContentStatus } from './types';
import { HttpError } from '@/lib/errors/http-error';

const ALLOWED: Record<ContentStatus, ContentStatus[]> = {
  idea: ['brief', 'generated', 'archived'],
  brief: ['generated', 'rejected', 'archived'],
  generated: ['needs_review', 'rejected', 'archived'],
  needs_review: ['approved', 'generated', 'rejected', 'archived'],
  approved: ['scheduled', 'published', 'failed', 'archived'],
  scheduled: ['published', 'failed', 'cancelled', 'approved'],
  published: ['measured', 'archived'],
  failed: ['scheduled', 'archived'],
  cancelled: ['archived'],
  rejected: ['archived', 'generated'],
  archived: [],
  measured: ['archived'],
};

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: ContentStatus, to: ContentStatus): void {
  if (!canTransition(from, to)) {
    throw new HttpError('invalid_state', `Transition Content Studio invalide: ${from} → ${to}`);
  }
}
