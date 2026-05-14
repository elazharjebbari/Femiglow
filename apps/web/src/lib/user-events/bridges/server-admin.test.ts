/**
 * Tests server-actions + admin-actions bridges.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import {
  recordServerEvent,
  recordLeadCreated,
  recordOrderPlaced,
  recordContactSubmitted,
} from './server-actions';
import {
  recordAdminEvent,
  recordLeadStatusChanged,
  recordLeadNoteAdded,
} from './admin-actions';

beforeEach(() => {
  vi.clearAllMocks();
});

function setupSuccessfulInsert() {
  const drizzle = makeFakeDrizzle({
    selectResult: [],
    insertReturning: [{ id: 1, leadId: null }],
  });
  vi.mocked(getDb).mockReturnValue(drizzle as never);
  return drizzle;
}

// ── server-actions ────────────────────────────────────────────────────

describe('recordServerEvent', () => {
  it('returns false on missing email', async () => {
    const ok = await recordServerEvent({ email: '', eventName: 'x.y' });
    expect(ok).toBe(false);
  });

  it('returns false on missing eventName', async () => {
    const ok = await recordServerEvent({ email: 'x@y.com', eventName: '' });
    expect(ok).toBe(false);
  });

  it('inserts with source=server', async () => {
    const drizzle = setupSuccessfulInsert();
    await recordServerEvent({
      email: 'u@example.com',
      eventName: 'something.happened',
    });
    const values = drizzle.calls.insert[0]!.values as { source: string };
    expect(values.source).toBe('server');
  });

  it('uses provided leadId without DB lookup', async () => {
    const drizzle = setupSuccessfulInsert();
    await recordServerEvent({
      email: 'u@example.com',
      eventName: 'a.b',
      leadId: 'lead-explicit',
    });
    expect(drizzle.calls.select).toHaveLength(0);
  });
});

describe('recordLeadCreated', () => {
  it('emits lead.created with source/formType props', async () => {
    const drizzle = setupSuccessfulInsert();
    await recordLeadCreated({
      email: 'new@example.com',
      leadId: 'lead-1',
      source: 'newsletter-form',
      formType: 'inline',
    });
    const values = drizzle.calls.insert[0]!.values as {
      eventName: string;
      properties: Record<string, unknown>;
    };
    expect(values.eventName).toBe('lead.created');
    expect(values.properties).toMatchObject({
      source: 'newsletter-form',
      formType: 'inline',
    });
  });
});

describe('recordOrderPlaced', () => {
  it('emits order.placed with orderId/total/items props', async () => {
    const drizzle = setupSuccessfulInsert();
    await recordOrderPlaced({
      email: 'buyer@example.com',
      orderId: 'FG-2026-0042',
      totalCents: 78000,
      currency: 'MAD',
      itemsCount: 2,
    });
    const values = drizzle.calls.insert[0]!.values as {
      eventName: string;
      properties: Record<string, unknown>;
    };
    expect(values.eventName).toBe('order.placed');
    expect(values.properties.orderId).toBe('FG-2026-0042');
    expect(values.properties.totalCents).toBe(78000);
    expect(values.properties.itemsCount).toBe(2);
  });
});

describe('recordContactSubmitted', () => {
  it('emits contact.submitted with contactType + hasPhone', async () => {
    const drizzle = setupSuccessfulInsert();
    await recordContactSubmitted({
      email: 'asker@example.com',
      contactType: 'question',
      hasPhone: true,
    });
    const values = drizzle.calls.insert[0]!.values as {
      eventName: string;
      properties: Record<string, unknown>;
    };
    expect(values.eventName).toBe('contact.submitted');
    expect(values.properties.contactType).toBe('question');
    expect(values.properties.hasPhone).toBe(true);
  });
});

// ── admin-actions ─────────────────────────────────────────────────────

describe('recordAdminEvent', () => {
  it('inserts with source=admin + actor in properties', async () => {
    const drizzle = setupSuccessfulInsert();
    await recordAdminEvent({
      targetEmail: 'lead@example.com',
      actorEmail: 'admin@femiglow',
      eventName: 'lead.tag_added',
      properties: { tag: 'vip' },
    });
    const values = drizzle.calls.insert[0]!.values as {
      source: string;
      properties: Record<string, unknown>;
    };
    expect(values.source).toBe('admin');
    expect(values.properties.actorEmail).toBe('admin@femiglow');
    expect(values.properties.tag).toBe('vip');
  });

  it('returns false on missing targetEmail', async () => {
    const ok = await recordAdminEvent({ targetEmail: '', eventName: 'x.y' });
    expect(ok).toBe(false);
  });
});

describe('recordLeadStatusChanged', () => {
  it('emits lead.status_changed with oldStatus/newStatus', async () => {
    const drizzle = setupSuccessfulInsert();
    await recordLeadStatusChanged({
      targetEmail: 'lead@example.com',
      actorEmail: 'admin@femiglow',
      oldStatus: 'new',
      newStatus: 'qualified',
    });
    const values = drizzle.calls.insert[0]!.values as {
      eventName: string;
      properties: Record<string, unknown>;
    };
    expect(values.eventName).toBe('lead.status_changed');
    expect(values.properties.oldStatus).toBe('new');
    expect(values.properties.newStatus).toBe('qualified');
  });
});

describe('recordLeadNoteAdded', () => {
  it('truncates long note excerpts to 200 chars', async () => {
    const drizzle = setupSuccessfulInsert();
    const longNote = 'x'.repeat(500);
    await recordLeadNoteAdded({
      targetEmail: 'lead@example.com',
      actorEmail: 'admin@femiglow',
      noteExcerpt: longNote,
    });
    const values = drizzle.calls.insert[0]!.values as {
      properties: Record<string, unknown>;
    };
    expect((values.properties.noteExcerpt as string).length).toBe(200);
  });
});
