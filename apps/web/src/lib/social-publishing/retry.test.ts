/**
 * Retry tests — F23.
 *
 * Couvre :
 * - normalizeRetryPolicy : bornes attempts, défauts delaysMs
 * - withRetry : 1 attempt on success, max attempts on shouldRetry=true,
 *   no retry quand shouldRetry=false, onRetry events
 * - isTransientHttpStatus : table HTTP code → transient
 */
import { describe, expect, it, vi } from 'vitest';
import { isTransientHttpStatus, normalizeRetryPolicy, withRetry } from './retry';

describe('social publishing retry', () => {
  describe('normalizeRetryPolicy', () => {
    it('borne attempts en bas à 1', () => {
      expect(normalizeRetryPolicy({ attempts: 0 }).attempts).toBe(1);
      expect(normalizeRetryPolicy({ attempts: -5 }).attempts).toBe(1);
    });

    it('borne attempts en haut à 5', () => {
      expect(normalizeRetryPolicy({ attempts: 99 }).attempts).toBe(5);
      expect(normalizeRetryPolicy({ attempts: 6 }).attempts).toBe(5);
    });

    it('default attempts = 3 quand non fourni', () => {
      expect(normalizeRetryPolicy().attempts).toBe(3);
    });

    it('utilise delaysMs custom si fourni', () => {
      const p = normalizeRetryPolicy({ delaysMs: [50, 100] });
      expect(p.delaysMs).toEqual([50, 100]);
    });

    it('default delaysMs quand non fourni ou vide', () => {
      expect(normalizeRetryPolicy().delaysMs).toEqual([100, 300, 900, 1500]);
      expect(normalizeRetryPolicy({ delaysMs: [] }).delaysMs).toEqual([100, 300, 900, 1500]);
    });
  });

  describe('withRetry', () => {
    it('appelle l opération une fois en cas de succès immédiat', async () => {
      const fn = vi.fn(async () => 'ok');
      const result = await withRetry(fn, { attempts: 3, delaysMs: [0], shouldRetry: () => true });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retry les erreurs explicitement retryables', async () => {
      let count = 0;
      const result = await withRetry(
        async () => {
          count += 1;
          if (count < 3) throw new Error('temporary');
          return 'ok';
        },
        { attempts: 3, delaysMs: [0], shouldRetry: () => true },
      );
      expect(result).toBe('ok');
      expect(count).toBe(3);
    });

    it('ne retry pas quand shouldRetry retourne false', async () => {
      const fn = vi.fn(async () => {
        throw new Error('terminal');
      });
      await expect(
        withRetry(fn, { attempts: 3, delaysMs: [0], shouldRetry: () => false }),
      ).rejects.toThrow('terminal');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('lance la dernière erreur après max attempts', async () => {
      const fn = vi.fn(async () => {
        throw new Error('persistent');
      });
      await expect(
        withRetry(fn, { attempts: 3, delaysMs: [0], shouldRetry: () => true }),
      ).rejects.toThrow('persistent');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('appelle onRetry avec le délai choisi', async () => {
      const onRetry = vi.fn();
      await expect(
        withRetry(
          async () => {
            throw new Error('temporary');
          },
          { attempts: 2, delaysMs: [0], shouldRetry: () => true, onRetry },
        ),
      ).rejects.toThrow('temporary');
      expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, delayMs: 0 }));
    });

    it('onRetry n est PAS appelé sur la dernière tentative', async () => {
      const onRetry = vi.fn();
      await expect(
        withRetry(
          async () => {
            throw new Error('x');
          },
          { attempts: 3, delaysMs: [0], shouldRetry: () => true, onRetry },
        ),
      ).rejects.toThrow();
      // attempt 1 → retry → onRetry; attempt 2 → retry → onRetry; attempt 3 → throw
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('utilise le dernier delay quand attempts dépasse delaysMs.length', async () => {
      const onRetry = vi.fn();
      await expect(
        withRetry(
          async () => {
            throw new Error('x');
          },
          { attempts: 4, delaysMs: [0, 0], shouldRetry: () => true, onRetry },
        ),
      ).rejects.toThrow();
      // attempt 3 → uses delaysMs[1]=0 (last index)
      // attempt 4 → terminal (no onRetry)
      expect(onRetry).toHaveBeenCalledTimes(3);
      expect(onRetry.mock.calls[2]?.[0]?.delayMs).toBe(0);
    });
  });

  describe('isTransientHttpStatus', () => {
    it('429 (rate limited) = transient', () => {
      expect(isTransientHttpStatus(429)).toBe(true);
    });

    it('5xx = transient', () => {
      expect(isTransientHttpStatus(500)).toBe(true);
      expect(isTransientHttpStatus(502)).toBe(true);
      expect(isTransientHttpStatus(503)).toBe(true);
      expect(isTransientHttpStatus(504)).toBe(true);
    });

    it('408 (timeout) = transient', () => {
      expect(isTransientHttpStatus(408)).toBe(true);
    });

    it('425 (too early) = transient', () => {
      expect(isTransientHttpStatus(425)).toBe(true);
    });

    it('4xx (autres) = non-transient', () => {
      expect(isTransientHttpStatus(400)).toBe(false);
      expect(isTransientHttpStatus(401)).toBe(false);
      expect(isTransientHttpStatus(403)).toBe(false);
      expect(isTransientHttpStatus(404)).toBe(false);
      expect(isTransientHttpStatus(409)).toBe(false);
      expect(isTransientHttpStatus(422)).toBe(false);
    });

    it('2xx + 3xx = non-transient', () => {
      expect(isTransientHttpStatus(200)).toBe(false);
      expect(isTransientHttpStatus(301)).toBe(false);
    });
  });
});
