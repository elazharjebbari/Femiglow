/**
 * Tiny fake-drizzle harness for unit tests.
 *
 * Records the chain of method calls (.select/.from/.where/.set/etc.) so
 * tests can assert :
 *   - which table was hit
 *   - what set() values were passed
 *   - the resolved value of the chain (rows for select, returning for
 *     update)
 *
 * Usage :
 *   const drizzle = makeFakeDrizzle({
 *     selectResult: [{ id: 'a', email: 'x@y.z' }],
 *     updateReturning: [{ id: 'a' }],
 *   });
 *   vi.mocked(getDb).mockReturnValue(drizzle);
 *   // ... call your code
 *   expect(drizzle.calls.update).toHaveLength(1);
 *   expect(drizzle.calls.update[0]!.set).toMatchObject({ status: 'failed' });
 */
import { vi } from 'vitest';

export type FakeDrizzle = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  calls: {
    select: Array<{ from?: unknown; where?: unknown; limit?: number }>;
    insert: Array<{ into?: unknown; values?: unknown; onConflict?: 'doNothing' | 'doUpdate' | null }>;
    update: Array<{ table?: unknown; set?: unknown; where?: unknown; returning?: boolean }>;
    delete: Array<{ from?: unknown; where?: unknown }>;
    execute: Array<{ sql: unknown }>;
  };
};

export type FakeDrizzleOpts = {
  selectResult?: unknown[];
  insertReturning?: unknown[];
  updateReturning?: unknown[];
  executeResult?: { rows: unknown[] } | unknown[];
};

export function makeFakeDrizzle(opts: FakeDrizzleOpts = {}): FakeDrizzle {
  const calls: FakeDrizzle['calls'] = {
    select: [],
    insert: [],
    update: [],
    delete: [],
    execute: [],
  };

  // ── select chain ────────────────────────────────────────────────────
  const select = vi.fn((_columns?: unknown) => {
    const sel: Record<string, unknown> = {};
    const obj = {
      from: vi.fn((t: unknown) => {
        sel.from = t;
        return obj;
      }),
      where: vi.fn((w: unknown) => {
        sel.where = w;
        return obj;
      }),
      limit: vi.fn((n: number) => {
        sel.limit = n;
        calls.select.push(sel);
        return Promise.resolve(opts.selectResult ?? []);
      }),
      orderBy: vi.fn(() => obj),
    };
    // If user never calls .limit() but awaits the chain, register on .then
    Object.assign(obj, {
      then: (cb: (rows: unknown[]) => unknown) => {
        calls.select.push(sel);
        return Promise.resolve(opts.selectResult ?? []).then(cb);
      },
    });
    return obj;
  });

  // ── insert chain ────────────────────────────────────────────────────
  const insert = vi.fn((table: unknown) => {
    const ins: { into: unknown; values?: unknown; onConflict?: 'doNothing' | 'doUpdate' | null } = {
      into: table,
      onConflict: null,
    };
    const obj = {
      values: vi.fn((v: unknown) => {
        ins.values = v;
        const after = {
          onConflictDoNothing: vi.fn(() => {
            ins.onConflict = 'doNothing';
            calls.insert.push(ins);
            return Promise.resolve();
          }),
          onConflictDoUpdate: vi.fn(() => {
            ins.onConflict = 'doUpdate';
            calls.insert.push(ins);
            return Promise.resolve();
          }),
          returning: vi.fn(() => {
            calls.insert.push(ins);
            return Promise.resolve(opts.insertReturning ?? []);
          }),
          then: (cb: (r: unknown) => unknown) => {
            calls.insert.push(ins);
            return Promise.resolve().then(cb);
          },
        };
        return after;
      }),
    };
    return obj;
  });

  // ── update chain ────────────────────────────────────────────────────
  const update = vi.fn((table: unknown) => {
    const upd: { table: unknown; set?: unknown; where?: unknown; returning?: boolean } = {
      table,
    };
    const obj = {
      set: vi.fn((s: unknown) => {
        upd.set = s;
        return obj;
      }),
      where: vi.fn((w: unknown) => {
        upd.where = w;
        const after = {
          returning: vi.fn(() => {
            upd.returning = true;
            calls.update.push(upd);
            return Promise.resolve(opts.updateReturning ?? []);
          }),
          then: (cb: (r: unknown) => unknown) => {
            calls.update.push(upd);
            return Promise.resolve().then(cb);
          },
        };
        return after;
      }),
    };
    return obj;
  });

  // ── delete chain ────────────────────────────────────────────────────
  const del = vi.fn((table: unknown) => {
    const d: { from: unknown; where?: unknown } = { from: table };
    return {
      where: vi.fn((w: unknown) => {
        d.where = w;
        calls.delete.push(d);
        return Promise.resolve();
      }),
    };
  });

  // ── execute ────────────────────────────────────────────────────────
  const execute = vi.fn((sql: unknown) => {
    calls.execute.push({ sql });
    return Promise.resolve(opts.executeResult ?? { rows: [] });
  });

  // ── transaction ────────────────────────────────────────────────────
  const transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    // Pass the same fake drizzle as tx for simplicity (no nested isolation).
    return cb({ select, insert, update, delete: del, execute });
  });

  return {
    select,
    insert,
    update,
    delete: del,
    execute,
    transaction,
    calls,
  } as FakeDrizzle;
}
