/**
 * Tests step handlers tag + update_lead + webhook.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import { handleTagStep } from '../tag';
import { handleUpdateLeadStep } from '../update-lead';
import { handleWebhookStep } from '../webhook';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleTagStep', () => {
  it('adds a tag on the lead', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [{ id: 'lead-1' }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const r = await handleTagStep(
      { kind: 'tag', action: 'add', tag: 'vip' },
      'user@example.com',
      'welcome-flow',
    );
    expect(r.ok).toBe(true);
    expect(drizzle.calls.insert).toHaveLength(1);
    const values = drizzle.calls.insert[0]!.values as { tag: string; source: string };
    expect(values.tag).toBe('vip');
    expect(values.source).toBe('automation');
  });

  it('removes a tag', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [{ id: 'lead-1' }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const r = await handleTagStep(
      { kind: 'tag', action: 'remove', tag: 'vip' },
      'user@example.com',
      'flow',
    );
    expect(r.ok).toBe(true);
    expect(drizzle.calls.delete).toHaveLength(1);
  });

  it('skips when lead not found', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [] }) as never);
    const r = await handleTagStep(
      { kind: 'tag', action: 'add', tag: 'x' },
      'unknown@x.y',
      'flow',
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_lead');
  });

  it('returns reason db_not_configured if no DB', async () => {
    vi.mocked(getDb).mockReturnValue(undefined as never);
    const r = await handleTagStep({ kind: 'tag', action: 'add', tag: 'x' }, 'x@y.c', 'f');
    expect(r.reason).toBe('db_not_configured');
  });
});

describe('handleUpdateLeadStep', () => {
  it('updates status field', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [{ id: 'lead-1' }] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const r = await handleUpdateLeadStep(
      { kind: 'update_lead', field: 'status', value: 'qualified' },
      'x@y.c',
    );
    expect(r.ok).toBe(true);
    expect(drizzle.calls.update).toHaveLength(1);
    const set = drizzle.calls.update[0]!.set as Record<string, unknown>;
    expect(set.status).toBe('qualified');
  });

  it('rejects unknown status value', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({ selectResult: [{ id: 'lead-1' }] }) as never,
    );
    const r = await handleUpdateLeadStep(
      { kind: 'update_lead', field: 'status', value: 'random' },
      'x@y.c',
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid_status');
  });

  it('skips when lead not found', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [] }) as never);
    const r = await handleUpdateLeadStep(
      { kind: 'update_lead', field: 'source', value: 'manual' },
      'x@y.c',
    );
    expect(r.ok).toBe(false);
  });
});

describe('handleWebhookStep', () => {
  it('POSTs to https URL', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200 }));
    const r = await handleWebhookStep(
      {
        kind: 'webhook',
        url: 'https://hooks.example.com/x',
        method: 'POST',
        body: { custom: 'value' },
      },
      'user@example.com',
      fetchImpl,
    );
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalled();
    const callArgs = fetchImpl.mock.calls[0]!;
    expect(callArgs[0]).toBe('https://hooks.example.com/x');
    expect(callArgs[1].method).toBe('POST');
  });

  it('includes _automation metadata in body', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200 }));
    await handleWebhookStep(
      { kind: 'webhook', url: 'https://x.com/h', method: 'POST', body: { foo: 'bar' } },
      'u@x.y',
      fetchImpl,
    );
    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body);
    expect(body._automation.recipientEmail).toBe('u@x.y');
    expect(body.foo).toBe('bar');
  });

  it('rejects http (non-https)', async () => {
    const r = await handleWebhookStep(
      { kind: 'webhook', url: 'http://x.com/h', method: 'POST' },
      'u@x.y',
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('https_only');
  });

  it('rejects internal hosts', async () => {
    const r = await handleWebhookStep(
      { kind: 'webhook', url: 'https://127.0.0.1/x', method: 'POST' },
      'u@x.y',
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('internal_host_blocked');

    const r2 = await handleWebhookStep(
      { kind: 'webhook', url: 'https://192.168.1.1/x', method: 'POST' },
      'u@x.y',
    );
    expect(r2.reason).toBe('internal_host_blocked');
  });

  it('returns fetch_error on network failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await handleWebhookStep(
      { kind: 'webhook', url: 'https://x.com/h', method: 'POST' },
      'u@x.y',
      fetchImpl,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('fetch_error');
  });

  it('returns ok=false on 500 response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('err', { status: 500 }));
    const r = await handleWebhookStep(
      { kind: 'webhook', url: 'https://x.com/h', method: 'PUT' },
      'u@x.y',
      fetchImpl,
    );
    expect(r.ok).toBe(false);
    expect(r.status).toBe(500);
  });
});
