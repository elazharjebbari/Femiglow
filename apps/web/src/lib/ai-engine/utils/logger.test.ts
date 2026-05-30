import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// We must re-import createLogger after setting env to control MIN_LEVEL.
// Since MIN_LEVEL is read at module scope, we use vi.resetModules() + dynamic
// import for the debug test. For most tests, 'info' is the default.
// ---------------------------------------------------------------------------

import { createLogger } from './logger';

describe('createLogger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns object with debug, info, warn, error', () => {
    const logger = createLogger('test-module');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('info calls console.log', () => {
    const logger = createLogger('test-module');
    logger.info('Test info message');
    expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    expect(consoleSpy.log.mock.calls[0]![0]).toContain('Test info message');
  });

  it('error calls console.error', () => {
    const logger = createLogger('test-module');
    logger.error('Test error message');
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error.mock.calls[0]![0]).toContain('Test error message');
  });

  it('warn calls console.warn', () => {
    const logger = createLogger('test-module');
    logger.warn('Test warning message');
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.warn.mock.calls[0]![0]).toContain('Test warning message');
  });

  it('log message includes module name', () => {
    const logger = createLogger('my-module');
    logger.info('Hello world');
    const output = consoleSpy.log.mock.calls[0]![0] as string;
    expect(output).toContain('[ai-engine:my-module]');
  });

  it('log message includes timestamp', () => {
    const logger = createLogger('ts-module');
    logger.info('Timestamp test');
    const output = consoleSpy.log.mock.calls[0]![0] as string;
    // Timestamps look like [2026-05-25T...] — ISO format in brackets
    expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
