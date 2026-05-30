import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ db: vi.fn() }));

import { db } from '@/lib/db/client';
import {
  enrichPurchase,
  isValidCurrency,
  isValidValue,
} from './_enrich-purchase';

const dbMock = vi.mocked(db);

type MaybeRow = { totalCents: number; currency: string } | null;

function mockDbReturns(row: MaybeRow): void {
  dbMock.mockReturnValue({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(row ? [row] : []),
        }),
      }),
    }),
  } as any);
}

function mockDbAbsent(): void {
  dbMock.mockReturnValue(null);
}

describe('isValidValue', () => {
  it.each([
    [0, false],
    [-5, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
    [Number.NEGATIVE_INFINITY, false],
    [0.01, true],
    [320, true],
    [99999.99, true],
  ])('isValidValue(%s) → %s', (input, expected) => {
    expect(isValidValue(input)).toBe(expected);
  });

  it('rejects non-numbers', () => {
    expect(isValidValue('320')).toBe(false);
    expect(isValidValue(null)).toBe(false);
    expect(isValidValue(undefined)).toBe(false);
    expect(isValidValue({})).toBe(false);
  });
});

describe('isValidCurrency', () => {
  it.each([
    ['MAD', true],
    ['USD', true],
    ['EUR', true],
    ['mad', false],
    ['MA', false],
    ['MADD', false],
    ['', false],
    ['12A', false],
    ['M A', false],
  ])('isValidCurrency(%s) → %s', (input, expected) => {
    expect(isValidCurrency(input)).toBe(expected);
  });

  it('rejects non-strings', () => {
    expect(isValidCurrency(123)).toBe(false);
    expect(isValidCurrency(null)).toBe(false);
    expect(isValidCurrency(undefined)).toBe(false);
  });
});

describe('enrichPurchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns source=params when value+currency are already valid', async () => {
    const result = await enrichPurchase({
      transaction_id: 'ord_1',
      value: 250,
      currency: 'MAD',
    });
    expect(result).toEqual({ value: 250, currency: 'MAD', source: 'params' });
    expect(dbMock).not.toHaveBeenCalled();
  });

  it('reads from DB when value is missing but transaction_id is known', async () => {
    mockDbReturns({ totalCents: 32000, currency: 'mad' });
    const result = await enrichPurchase({ transaction_id: 'ord_existing' });
    expect(result).toEqual({ value: 320, currency: 'MAD', source: 'db' });
  });

  it('reads from DB when currency is missing but value present', async () => {
    mockDbReturns({ totalCents: 15000, currency: 'MAD' });
    const result = await enrichPurchase({
      transaction_id: 'ord_x',
      value: 150,
    });
    expect(result).toEqual({ value: 150, currency: 'MAD', source: 'db' });
  });

  it('reads from DB when value is present but invalid (0)', async () => {
    mockDbReturns({ totalCents: 32000, currency: 'MAD' });
    const result = await enrichPurchase({
      transaction_id: 'ord_x',
      value: 0,
      currency: 'MAD',
    });
    expect(result).toEqual({ value: 320, currency: 'MAD', source: 'db' });
  });

  it('returns unavailable when transaction_id absent and params invalid', async () => {
    const result = await enrichPurchase({});
    expect(result).toEqual({ source: 'unavailable' });
    expect(dbMock).not.toHaveBeenCalled();
  });

  it('returns unavailable when transaction_id given but DB row not found', async () => {
    mockDbReturns(null);
    const result = await enrichPurchase({ transaction_id: 'ord_unknown' });
    expect(result).toEqual({ source: 'unavailable' });
  });

  it('returns unavailable when DB returns currency that is not 3-letter', async () => {
    mockDbReturns({ totalCents: 10000, currency: 'X' });
    const result = await enrichPurchase({ transaction_id: 'ord_bad' });
    expect(result).toEqual({ source: 'unavailable' });
  });

  it('returns unavailable when DB returns totalCents = 0', async () => {
    mockDbReturns({ totalCents: 0, currency: 'MAD' });
    const result = await enrichPurchase({ transaction_id: 'ord_zero' });
    expect(result).toEqual({ source: 'unavailable' });
  });

  it('returns unavailable when DB driver is not configured', async () => {
    mockDbAbsent();
    const result = await enrichPurchase({ transaction_id: 'ord_any' });
    expect(result).toEqual({ source: 'unavailable' });
  });

  it('uppercases currency from DB even if stored lowercase', async () => {
    mockDbReturns({ totalCents: 50000, currency: 'usd' });
    const result = await enrichPurchase({ transaction_id: 'ord_usd' });
    expect(result.currency).toBe('USD');
  });

  it('does NOT query DB when transaction_id is empty string', async () => {
    const result = await enrichPurchase({ transaction_id: '' });
    expect(result).toEqual({ source: 'unavailable' });
    expect(dbMock).not.toHaveBeenCalled();
  });

  it('does NOT query DB when transaction_id is a non-string', async () => {
    const result = await enrichPurchase({ transaction_id: 123 as unknown as string });
    expect(result).toEqual({ source: 'unavailable' });
    expect(dbMock).not.toHaveBeenCalled();
  });
});
