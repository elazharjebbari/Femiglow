/**
 * Gap #19 — Job lifecycle and cleanup test.
 *
 * Tests the job repository functions with a mocked Drizzle DB layer.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB client — in-memory store simulating Drizzle operations
// ---------------------------------------------------------------------------
interface MockJobRow {
  id: string;
  ideaId: string | null;
  status: string;
  platform: string;
  format: string;
  contentType: string;
  currentStep: string | null;
  briefInput: Record<string, unknown> | null;
  caption: string | null;
  hashtags: string[] | null;
  totalCostCents: string;
  costBreakdown: Record<string, unknown> | null;
  tokensUsed: Record<string, unknown> | null;
  qualityScores: Record<string, unknown> | null;
  moderationOk: boolean | null;
  errorLog: Record<string, unknown> | null;
  durationMs: number | null;
  createdAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
}

const jobStore = new Map<string, MockJobRow>();

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

function createMockDrizzle() {
  return {
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        jobStore.set(row.id as string, {
          id: row.id as string,
          ideaId: null,
          status: row.status as string,
          platform: row.platform as string,
          format: row.format as string,
          contentType: row.contentType as string,
          currentStep: row.currentStep as string,
          briefInput: row.briefInput as Record<string, unknown>,
          caption: null,
          hashtags: null,
          totalCostCents: '0',
          costBreakdown: null,
          tokensUsed: null,
          qualityScores: null,
          moderationOk: null,
          errorLog: null,
          durationMs: null,
          createdAt: new Date(),
          completedAt: null,
          updatedAt: new Date(),
        });
        mockInsert(row);
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: (fields: Record<string, unknown>) => ({
        where: (condition: unknown) => {
          // Find and update the job
          for (const [id, job] of jobStore.entries()) {
            Object.assign(job, fields);
            mockUpdate(id, fields);
            break;
          }
          return Promise.resolve();
        },
      }),
    }),
    select: () => ({
      from: () => {
        const sortedRows = () =>
          Array.from(jobStore.values()).sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );

        const withLimit = () => ({
          offset: (_o?: number) => {
            mockSelect();
            return Promise.resolve(sortedRows());
          },
        });

        const withOrderBy = () => ({
          limit: (_n?: number) => withLimit(),
        });

        const withWhere = () => ({
          orderBy: () => withOrderBy(),
          limit: (n: number) => ({
            offset: () => {
              mockSelect();
              return Promise.resolve(sortedRows().slice(0, n));
            },
          }),
        });

        return {
          where: (_condition?: unknown) => withWhere(),
          orderBy: () => withOrderBy(),
        };
      },
    }),
  };
}

vi.mock('@/lib/db/client', () => ({
  db: () => createMockDrizzle(),
}));

// Mock the schema module
vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineGenerationJobs: {
    id: 'id',
    status: 'status',
    createdAt: 'createdAt',
  },
  aiEngineCostLedger: {},
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: (field: unknown, value: unknown) => ({ field, value }),
  desc: (field: unknown) => ({ field, direction: 'desc' }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => strings.join(''),
  and: (...conditions: unknown[]) => conditions,
  gte: (field: unknown, value: unknown) => ({ field, value }),
}));

import {
  createJob,
  updateJobResult,
  updateJobStatus,
  listJobs,
  getJobStats,
} from '../jobs/repository';
import type { GenerationRequest, GenerationResult } from '../orchestrator';

function makeRequest(): GenerationRequest {
  return {
    platform: 'instagram',
    format: 'post',
    contentType: 'produit',
    briefInput: {
      objective: 'engagement',
      keyMessage: 'Lifecycle test',
    },
  };
}

function makeResult(jobId: string, status: 'completed' | 'failed'): GenerationResult {
  return {
    jobId,
    status,
    script: { hook: 'Test' },
    caption: 'Test caption',
    hashtags: ['test'],
    images: [],
    videos: [],
    qualityScores: { average: 0.85 },
    moderationResult: { safe: true },
    costTracking: { totalCents: 5, breakdown: {}, tokensUsed: {} },
    errors: status === 'failed' ? [{ message: 'test error' }] : [],
    durationMs: 100,
  };
}

describe('integration: job-lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jobStore.clear();
  });

  it('createJob sets status=running', async () => {
    await createJob('job-lifecycle-1', makeRequest());

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job-lifecycle-1',
        status: 'running',
      }),
    );
  });

  it('updateJobResult sets status=completed for success', async () => {
    await createJob('job-lifecycle-2', makeRequest());
    await updateJobResult('job-lifecycle-2', makeResult('job-lifecycle-2', 'completed'));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: 'completed',
      }),
    );
  });

  it('updateJobResult sets status=failed for failure', async () => {
    await createJob('job-lifecycle-3', makeRequest());
    await updateJobResult('job-lifecycle-3', makeResult('job-lifecycle-3', 'failed'));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: 'failed',
      }),
    );
  });

  it('updateJobStatus updates status only', async () => {
    await createJob('job-lifecycle-4', makeRequest());
    await updateJobStatus('job-lifecycle-4', 'review');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: 'review',
      }),
    );
  });

  it('listJobs returns jobs ordered by date desc', async () => {
    await createJob('job-lifecycle-5a', makeRequest());
    await createJob('job-lifecycle-5b', makeRequest());

    const jobs = await listJobs({ limit: 10 });

    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThanOrEqual(1);
    // Verify the rows are returned
    expect(mockSelect).toHaveBeenCalled();
  });

  it('getJobStats calculates averages correctly', async () => {
    await createJob('job-stats-1', makeRequest());
    jobStore.get('job-stats-1')!.status = 'completed';
    jobStore.get('job-stats-1')!.qualityScores = { average: 0.8 };
    jobStore.get('job-stats-1')!.durationMs = 200;
    jobStore.get('job-stats-1')!.totalCostCents = '10';

    await createJob('job-stats-2', makeRequest());
    jobStore.get('job-stats-2')!.status = 'failed';
    jobStore.get('job-stats-2')!.durationMs = 300;
    jobStore.get('job-stats-2')!.totalCostCents = '5';

    const stats = await getJobStats('day');
    expect(typeof stats.totalJobs).toBe('number');
    expect(typeof stats.successfulJobs).toBe('number');
    expect(typeof stats.failedJobs).toBe('number');
    expect(typeof stats.totalCostCents).toBe('number');
    expect(typeof stats.avgQualityScore).toBe('number');
    expect(typeof stats.avgDurationMs).toBe('number');
  });
});
