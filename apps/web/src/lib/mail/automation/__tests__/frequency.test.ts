/**
 * Tests frequency control (cooldown, daily cap, quiet hours).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import { checkCooldown, checkDailyCap, applyQuietHours } from '../frequency';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkCooldown', () => {
  it('returns blocked=false when cooldown=0', async () => {
    const r = await checkCooldown('aut-1', 'x@y.c', 0);
    expect(r.blocked).toBe(false);
  });

  it('returns blocked=true when recent run exists', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({
        selectResult: [{ triggeredAt: new Date() }],
      }) as never,
    );
    const r = await checkCooldown('aut-1', 'x@y.c', 3600);
    expect(r.blocked).toBe(true);
    expect(r.lastRunAt).toBeInstanceOf(Date);
  });

  it('returns blocked=false when no recent run', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [] }) as never);
    const r = await checkCooldown('aut-1', 'x@y.c', 3600);
    expect(r.blocked).toBe(false);
  });

  it('normalizes email to lowercase', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    await checkCooldown('aut-1', 'USER@X.Y', 3600);
    expect(drizzle.calls.select).toHaveLength(1);
  });
});

describe('checkDailyCap', () => {
  it('returns blocked=false when dailyCap is null', async () => {
    const r = await checkDailyCap('aut-1', null);
    expect(r.blocked).toBe(false);
  });

  it('returns blocked=true when count >= cap', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [{ n: 100 }] }) as never);
    const r = await checkDailyCap('aut-1', 100);
    expect(r.blocked).toBe(true);
    expect(r.todayCount).toBe(100);
  });

  it('returns blocked=false when count < cap', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [{ n: 5 }] }) as never);
    const r = await checkDailyCap('aut-1', 100);
    expect(r.blocked).toBe(false);
  });
});

describe('applyQuietHours', () => {
  it('returns unchanged when quietHoursEnabled=false', () => {
    const t = new Date('2026-05-14T03:00:00Z'); // 3am UTC
    const result = applyQuietHours(t, {
      quietHoursEnabled: false,
      quietHoursStart: '08:00',
      quietHoursEnd: '22:00',
      quietHoursTz: 'UTC',
    });
    expect(result).toEqual(t);
  });

  it('returns unchanged when inside quiet window', () => {
    const t = new Date('2026-05-14T14:00:00Z'); // 2pm UTC, inside 8h-22h
    const result = applyQuietHours(t, {
      quietHoursEnabled: true,
      quietHoursStart: '08:00',
      quietHoursEnd: '22:00',
      quietHoursTz: 'UTC',
    });
    expect(result).toEqual(t);
  });

  it('shifts to next start when before window', () => {
    const t = new Date('2026-05-14T03:00:00Z'); // 3am UTC, before 8am
    const result = applyQuietHours(t, {
      quietHoursEnabled: true,
      quietHoursStart: '08:00',
      quietHoursEnd: '22:00',
      quietHoursTz: 'UTC',
    });
    // Same day, 08:00
    expect(result.getUTCHours()).toBe(8);
    expect(result.getUTCDate()).toBe(14);
  });

  it('shifts to next day start when after window end', () => {
    const t = new Date('2026-05-14T23:30:00Z'); // 11:30pm UTC, after 22h
    const result = applyQuietHours(t, {
      quietHoursEnabled: true,
      quietHoursStart: '08:00',
      quietHoursEnd: '22:00',
      quietHoursTz: 'UTC',
    });
    // Next day at 08:00
    expect(result.getUTCDate()).toBe(15);
    expect(result.getUTCHours()).toBe(8);
  });
});
