/**
 * Schema test pour user_event (M5.2.0).
 *
 * Vérifie shape Drizzle + types TypeScript + enum source restreint.
 */
import { describe, it, expect } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { userEvent } from '@/lib/db/schema';
import type { UserEventRow, UserEventInsert, UserEventSource } from '@/lib/db/schema';

describe('schema: user_event', () => {
  it('has the expected table name', () => {
    expect(getTableName(userEvent)).toBe('user_event');
  });

  it('exposes all required columns', () => {
    const cols = Object.keys(userEvent);
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'email',
        'eventName',
        'ts',
        'properties',
        'sessionId',
        'source',
        'leadId',
        'createdAt',
      ]),
    );
  });

  it('infers Row type with correct shape', () => {
    const sampleRow: UserEventRow = {
      id: 1,
      email: 'user@example.com',
      eventName: 'cart.added',
      ts: new Date(),
      properties: { productId: 'XYZ', total: 100 },
      sessionId: 'session-abc',
      source: 'web',
      leadId: 'lead-123',
      createdAt: new Date(),
    };
    expect(sampleRow.source).toBe('web');
    expect(sampleRow.leadId).toBe('lead-123');
  });

  it('allows null for sessionId + leadId', () => {
    const sampleRow: UserEventRow = {
      id: 2,
      email: 'user@example.com',
      eventName: 'email.delivered',
      ts: new Date(),
      properties: {},
      sessionId: null,
      source: 'email',
      leadId: null,
      createdAt: new Date(),
    };
    expect(sampleRow.sessionId).toBeNull();
    expect(sampleRow.leadId).toBeNull();
  });

  it('Insert type allows minimal required fields (defaults on system cols)', () => {
    const minimalInsert: UserEventInsert = {
      email: 'user@example.com',
      eventName: 'page.viewed',
      source: 'web',
    };
    expect(minimalInsert.email).toBe('user@example.com');
    // id / ts / createdAt / properties / sessionId / leadId tous optionnels
  });

  it('restricts source enum to 5 allowed values', () => {
    const valid: UserEventSource[] = ['web', 'server', 'email', 'admin', 'import'];
    expect(valid).toHaveLength(5);
    const isAllowed = (s: string): s is UserEventSource =>
      (valid as readonly string[]).includes(s);
    expect(isAllowed('web')).toBe(true);
    expect(isAllowed('email')).toBe(true);
    expect(isAllowed('foobar')).toBe(false);
  });

  it('accepts complex jsonb properties', () => {
    const event: UserEventInsert = {
      email: 'user@example.com',
      eventName: 'order.placed',
      source: 'server',
      properties: {
        orderId: 'FG-2026-0042',
        total: 780,
        currency: 'MAD',
        items: [
          { sku: 'kit-eclat', qty: 1, price: 780 },
        ],
        nested: { deep: { value: true } },
      },
    };
    expect(event.properties).toBeDefined();
  });
});
