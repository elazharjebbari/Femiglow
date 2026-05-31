import { describe, it, expect } from 'vitest';
import { safeParseResetConfig } from './config-schema';

describe('reset/config-schema', () => {
  it('parses a valid soft config', () => {
    const r = safeParseResetConfig({
      mode: 'soft',
      preserve: ['admin_users', 'audit_events'],
      wipeMedia: false, wipeNextCache: false,
      withBackup: true, keepBackups: 5, dryRun: false,
      confirm: 'RESET', actorId: null,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.mode).toBe('soft');
  });

  it('rejects soft with HARD RESET confirm', () => {
    const r = safeParseResetConfig({
      mode: 'soft',
      preserve: [],
      wipeMedia: false, wipeNextCache: false,
      withBackup: true, keepBackups: 5, dryRun: false,
      confirm: 'HARD RESET', actorId: null,
    });
    expect(r.ok).toBe(false);
  });

  it('forces wipeMedia + wipeNextCache in hard mode', () => {
    const r = safeParseResetConfig({
      mode: 'hard',
      preserve: [], wipeMedia: false, wipeNextCache: false,
      withBackup: true, keepBackups: 5, dryRun: false,
      confirm: 'HARD RESET', actorId: null,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.wipeMedia).toBe(true);
      expect(r.config.wipeNextCache).toBe(true);
    }
  });

  it('rejects hard without HARD RESET confirm', () => {
    const r = safeParseResetConfig({
      mode: 'hard',
      preserve: [], wipeMedia: true, wipeNextCache: true,
      withBackup: true, keepBackups: 5, dryRun: false,
      confirm: 'RESET', actorId: null,
    });
    expect(r.ok).toBe(false);
  });

  it('requires domains for custom', () => {
    const r = safeParseResetConfig({
      mode: 'custom',
      preserve: [], wipeMedia: false, wipeNextCache: false,
      withBackup: true, keepBackups: 5, dryRun: false,
      confirm: 'RESET', actorId: null,
    });
    expect(r.ok).toBe(false);
  });

  it('accepts custom with domains', () => {
    const r = safeParseResetConfig({
      mode: 'custom',
      domains: ['commerce'],
      preserve: [], wipeMedia: false, wipeNextCache: false,
      withBackup: true, keepBackups: 5, dryRun: false,
      confirm: 'RESET', actorId: null,
    });
    expect(r.ok).toBe(true);
  });

  it('always preserves admin_users + audit_events', () => {
    const r = safeParseResetConfig({
      mode: 'soft',
      preserve: ['orders'],
      wipeMedia: false, wipeNextCache: false,
      withBackup: true, keepBackups: 5, dryRun: false,
      confirm: 'RESET', actorId: null,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.preserve).toContain('admin_users');
      expect(r.config.preserve).toContain('audit_events');
    }
  });

  it('rejects hard with withBackup=false', () => {
    const r = safeParseResetConfig({
      mode: 'hard',
      preserve: [], wipeMedia: true, wipeNextCache: true,
      withBackup: false, keepBackups: 5, dryRun: false,
      confirm: 'HARD RESET', actorId: null,
    });
    expect(r.ok).toBe(false);
  });
});
