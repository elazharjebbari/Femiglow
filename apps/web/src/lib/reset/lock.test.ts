import { describe, it, expect, beforeEach } from 'vitest';
import { tmpdir } from 'node:os';
import path from 'node:path';

const LOCK_FILE = path.join(tmpdir(), `femiglow-reset-test-${Date.now()}.lock`);
process.env.RESET_LOCK_FILE = LOCK_FILE;

// Import AFTER setting env so module reads it
import { acquireLock, releaseLock, getLockInfo, _resetLockForTests } from './lock';

describe('reset/lock', () => {
  beforeEach(() => {
    _resetLockForTests();
  });

  it('acquireLock returns true first time', () => {
    expect(acquireLock('rst_a')).toBe(true);
  });

  it('acquireLock returns false when held', () => {
    expect(acquireLock('rst_a')).toBe(true);
    expect(acquireLock('rst_b')).toBe(false);
  });

  it('release allows re-acquire', () => {
    acquireLock('rst_a');
    releaseLock('rst_a');
    expect(acquireLock('rst_b')).toBe(true);
  });

  it('getLockInfo returns details when locked', () => {
    acquireLock('rst_x');
    const info = getLockInfo();
    expect(info).not.toBeNull();
    expect(info?.jobId).toBe('rst_x');
    expect(info?.pid).toBe(process.pid);
  });

  it('getLockInfo returns null when free', () => {
    expect(getLockInfo()).toBeNull();
  });
});
