import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';

const log = createLogger('node:human-review');

export async function humanReviewNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();

  log.info('Processing human review gate', { jobId, node: 'human_review' });

  const startTime = Date.now();
  const existingReview = state.humanReview as Record<string, unknown> | null;

  if (existingReview?.decision) {
    const durationMs = Date.now() - startTime;
    log.info('Human review already present', {
      jobId,
      node: 'human_review',
      durationMs,
      data: { decision: existingReview.decision },
    });

    return {
      currentStep: 'human_review',
    };
  }

  if (!config.quality.humanReviewRequired) {
    const durationMs = Date.now() - startTime;
    log.info('Human review not required, auto-approving', {
      jobId,
      node: 'human_review',
      durationMs,
    });

    return {
      humanReview: {
        decision: 'approved' as const,
        feedback: undefined,
      },
      currentStep: 'human_review',
    };
  }

  const durationMs = Date.now() - startTime;
  log.info('Human review auto-approved (MVP)', {
    jobId,
    node: 'human_review',
    durationMs,
  });

  return {
    humanReview: {
      decision: 'approved' as const,
      feedback: undefined,
    },
    currentStep: 'human_review',
  };
}
