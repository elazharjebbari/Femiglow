import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectOrderBy = vi.fn();
const mockSelectLimit = vi.fn();
const mockSelectOffset = vi.fn();

const baseJobRow = {
  id: 'job-1',
  ideaId: null,
  status: 'completed',
  platform: 'instagram',
  format: 'reel',
  contentType: 'beauty',
  currentStep: 'compose',
  briefInput: { objective: 'awareness', keyMessage: 'Test' },
  caption: 'Test caption',
  hashtags: ['femiglow', 'beauty'],
  totalCostCents: '15',
  qualityScores: { average: 0.85, engagement: 0.9, brand: 0.8 },
  durationMs: 5000,
  createdAt: new Date('2026-05-24'),
  completedAt: new Date('2026-05-24'),
  updatedAt: new Date('2026-05-24'),
};

const mockDb = {
  insert: vi.fn(() => ({
    values: mockInsertValues.mockResolvedValue(undefined),
  })),
  update: vi.fn(() => ({
    set: mockUpdateSet.mockReturnValue({
      where: mockUpdateWhere.mockResolvedValue(undefined),
    }),
  })),
  select: vi.fn(() => ({
    from: mockSelectFrom.mockReturnValue({
      where: mockSelectWhere.mockReturnValue({
        orderBy: mockSelectOrderBy.mockReturnValue({
          limit: mockSelectLimit.mockReturnValue({
            offset: mockSelectOffset.mockResolvedValue([baseJobRow]),
          }),
        }),
        limit: mockSelectLimit.mockReturnValue({
          offset: mockSelectOffset.mockResolvedValue([baseJobRow]),
        }),
      }),
      orderBy: mockSelectOrderBy.mockReturnValue({
        limit: mockSelectLimit.mockReturnValue({
          offset: mockSelectOffset.mockResolvedValue([baseJobRow]),
        }),
      }),
      limit: mockSelectLimit,
    }),
  })),
};

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => mockDb),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineGenerationJobs: {
    id: 'id',
    status: 'status',
    createdAt: 'created_at',
  },
  aiEngineCostLedger: {},
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  createJob,
  updateJobResult,
  updateJobStatus,
  getJob,
  listJobs,
  getJobStats,
  recordCost,
} from './repository';
import { db } from '@/lib/db/client';

describe('jobs/repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockInsertValues.mockResolvedValue(undefined);
    mockDb.insert.mockReturnValue({ values: mockInsertValues });

    mockUpdateWhere.mockResolvedValue(undefined);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockDb.update.mockReturnValue({ set: mockUpdateSet });

    mockSelectOffset.mockResolvedValue([baseJobRow]);
    mockSelectLimit.mockReturnValue({ offset: mockSelectOffset });
    mockSelectOrderBy.mockReturnValue({ limit: mockSelectLimit });
    mockSelectWhere.mockReturnValue({
      orderBy: mockSelectOrderBy,
      limit: mockSelectLimit,
    });
    mockSelectFrom.mockReturnValue({
      where: mockSelectWhere,
      orderBy: mockSelectOrderBy,
    });
    mockDb.select.mockReturnValue({ from: mockSelectFrom });
  });

  it('createJob inserts job record', async () => {
    await createJob('job-1', {
      platform: 'instagram',
      format: 'reel',
      contentType: 'beauty',
      briefInput: { objective: 'awareness', keyMessage: 'Test FemiGlow' },
    });
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job-1',
        status: 'running',
        platform: 'instagram',
        format: 'reel',
        contentType: 'beauty',
      }),
    );
  });

  it('updateJobResult updates status and fields', async () => {
    await updateJobResult('job-1', {
      jobId: 'job-1',
      status: 'completed',
      script: null,
      caption: 'Great caption',
      hashtags: ['femiglow'],
      images: [],
      videos: [],
      qualityScores: { average: 0.9 },
      moderationResult: { safe: true },
      costTracking: { totalCents: 10, breakdown: {} },
      errors: [],
      durationMs: 3000,
    });
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        caption: 'Great caption',
      }),
    );
  });

  it('updateJobStatus changes status only', async () => {
    await updateJobStatus('job-1', 'failed');
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('getJob returns job by ID', async () => {
    mockSelectLimit.mockResolvedValueOnce([baseJobRow]);
    mockSelectWhere.mockReturnValueOnce({
      limit: mockSelectLimit,
    });

    const job = await getJob('job-1');
    expect(job).not.toBeNull();
    expect(job!.id).toBe('job-1');
    expect(job!.status).toBe('completed');
    expect(job!.platform).toBe('instagram');
  });

  it('getJob returns null for unknown ID', async () => {
    mockSelectLimit.mockResolvedValueOnce([]);
    mockSelectWhere.mockReturnValueOnce({
      limit: mockSelectLimit,
    });

    const job = await getJob('non-existent');
    expect(job).toBeNull();
  });

  it('listJobs returns recent jobs ordered by date', async () => {
    const jobs = await listJobs();
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0]!.id).toBe('job-1');
  });

  it('listJobs filters by status', async () => {
    await listJobs({ status: 'completed' });
    expect(mockSelectWhere).toHaveBeenCalled();
  });

  it('listJobs respects limit/offset', async () => {
    await listJobs({ limit: 5, offset: 10 });
    expect(mockSelectLimit).toHaveBeenCalledWith(5);
    expect(mockSelectOffset).toHaveBeenCalledWith(10);
  });

  it('getJobStats calculates correctly for period', async () => {
    // Mock the select to return jobs for stats calculation
    const rows = [
      { ...baseJobRow, status: 'completed', totalCostCents: '10', qualityScores: { average: 0.85 }, durationMs: 3000 },
      { ...baseJobRow, id: 'job-2', status: 'failed', totalCostCents: '5', qualityScores: null, durationMs: 1000 },
    ];
    mockSelectWhere.mockResolvedValueOnce(rows);
    mockSelectFrom.mockReturnValueOnce({
      where: mockSelectWhere,
    });
    mockDb.select.mockReturnValueOnce({ from: mockSelectFrom });

    const stats = await getJobStats('day');
    expect(stats.totalJobs).toBe(2);
    expect(stats.successfulJobs).toBe(1);
    expect(stats.failedJobs).toBe(1);
    expect(stats.totalCostCents).toBe(15);
    expect(stats.avgQualityScore).toBe(0.85);
    expect(stats.avgDurationMs).toBe(2000);
  });

  it('recordCost inserts cost ledger entry', async () => {
    await recordCost('job-1', 'openai', 'gpt-4o-mini', 'generate_script', 500, 200, 3);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        provider: 'openai',
        model: 'gpt-4o-mini',
        nodeName: 'generate_script',
        inputTokens: 500,
        outputTokens: 200,
        costCents: '3',
      }),
    );
  });
});
