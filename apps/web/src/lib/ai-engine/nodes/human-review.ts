import { interrupt } from '@langchain/langgraph';
import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';

const log = createLogger('node:human-review');

/**
 * Human review gate node.
 *
 * Behaviour depends on the engine configuration and the current state:
 *
 * 1. If `humanReviewRequired` is **false** the node auto-approves and the
 *    graph continues without pausing.
 *
 * 2. If `humanReviewRequired` is **true** and the graph was compiled with
 *    `interruptBefore: ['reviewGate']`, the graph will have already paused
 *    *before* this node runs.  When the operator resumes the graph (via
 *    `Command({ resume: ... })`), the `interrupt()` call below returns the
 *    resume payload -- i.e. the human decision.
 *
 * 3. If a review decision already exists in state (e.g. the operator set
 *    `humanReview` before resuming), we honour it directly.
 */
export async function humanReviewNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();

  log.info('Processing human review gate', { jobId, node: 'human_review' });

  const startTime = Date.now();
  const existingReview = state.humanReview as Record<string, unknown> | null;

  // ── Fast path: review decision already present ──────────────────────
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

  // ── Auto-approve when human review is disabled ──────────────────────
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

  // ── HITL: call interrupt() to pause the graph ───────────────────────
  // When the graph is compiled with a checkpointer, `interrupt()` throws
  // a GraphInterrupt which pauses execution.  When the graph is later
  // resumed with `Command({ resume: <decision> })`, `interrupt()` returns
  // the resume value.
  log.info('Human review required -- interrupting for operator decision', {
    jobId,
    node: 'human_review',
  });

  const reviewPayload = {
    jobId,
    script: state.script,
    caption: state.caption,
    hashtags: state.hashtags,
    images: state.images,
    videos: state.videos,
    qualityScores: state.qualityScores,
    moderationResult: state.moderationResult,
  };

  // interrupt() pauses here.  The resume value is the operator's decision.
  const decision = interrupt(reviewPayload) as {
    decision: 'approved' | 'rejected' | 'edit_requested';
    feedback?: string;
  };

  const durationMs = Date.now() - startTime;
  log.info('Human review decision received', {
    jobId,
    node: 'human_review',
    durationMs,
    data: { decision: decision.decision },
  });

  return {
    humanReview: {
      decision: decision.decision,
      feedback: decision.feedback,
    },
    currentStep: 'human_review',
  };
}
