import { describe, it, expect } from 'vitest';
import { ResetError, classifyError } from './errors';

describe('reset/errors', () => {
  it('preserves code on ResetError', () => {
    const e = new ResetError('DB_UNREACHABLE', 'preflight', 'no db');
    const c = classifyError(e, 'preflight');
    expect(c.code).toBe('DB_UNREACHABLE');
    expect(c.critical).toBe(true);
  });

  it('maps ECONNREFUSED to DB_UNREACHABLE', () => {
    const err = Object.assign(new Error('fail'), { code: 'ECONNREFUSED' });
    const c = classifyError(err, 'migrate');
    expect(c.code).toBe('DB_UNREACHABLE');
  });

  it('maps ENOSPC to DISK_LOW', () => {
    const err = Object.assign(new Error('fail'), { code: 'ENOSPC' });
    const c = classifyError(err, 'backup');
    expect(c.code).toBe('DISK_LOW');
  });

  it('unknown returns UNKNOWN', () => {
    const c = classifyError(new Error('something'), 'seed');
    expect(c.code).toBe('UNKNOWN');
    expect(c.critical).toBe(true);
  });

  it('SEED_FAILED is non-critical', () => {
    const e = new ResetError('SEED_FAILED', 'seed', 'one seeder failed');
    const c = classifyError(e, 'seed');
    expect(c.critical).toBe(false);
  });
});
