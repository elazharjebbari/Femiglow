import { describe, it, expect } from 'vitest';
import {
  formatTimecode,
  parseTimecode,
  serializeSrt,
  parseSrt,
  parseScriptToCues,
  sortAndReindex,
  validateCues,
  SUBTITLE_LIMITS,
  type Cue,
} from './srt';

describe('SRT timecodes (MP-SU-01)', () => {
  it('formats ms to HH:MM:SS,mmm', () => {
    expect(formatTimecode(0)).toBe('00:00:00,000');
    expect(formatTimecode(1500)).toBe('00:00:01,500');
    expect(formatTimecode(3_661_007)).toBe('01:01:01,007');
  });

  it('round-trips format/parse', () => {
    for (const ms of [0, 999, 1500, 61_000, 3_661_007]) {
      expect(parseTimecode(formatTimecode(ms))).toBe(ms);
    }
  });

  it('tolerates a dot decimal and throws on garbage', () => {
    expect(parseTimecode('00:00:02.250')).toBe(2250);
    expect(() => parseTimecode('nope')).toThrow();
  });
});

describe('serialize/parse round-trip (MP-SU-01)', () => {
  it('serializes canonical SRT with 1-based indices and reparses identically', () => {
    const cues: Cue[] = [
      { index: 5, startMs: 0, endMs: 1500, lines: ['Bonjour'] },
      { index: 9, startMs: 1600, endMs: 3000, lines: ['Ligne A', 'Ligne B'] },
    ];
    const srt = serializeSrt(cues);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:01,500\nBonjour');
    expect(srt).toContain('2\n00:00:01,600 --> 00:00:03,000\nLigne A\nLigne B');
    const back = parseSrt(srt);
    expect(back).toHaveLength(2);
    expect(back[1]!.lines).toEqual(['Ligne A', 'Ligne B']);
    expect(back[0]!.startMs).toBe(0);
    expect(back[1]!.endMs).toBe(3000);
  });

  it('empty cues serialize to empty string', () => {
    expect(serializeSrt([])).toBe('');
  });
});

describe('parseScriptToCues (MP-SU-01)', () => {
  it('wraps long text to <= 2 lines per cue instead of truncating', () => {
    const long = 'Un rituel de beauté japonais inspiré du camélia pour des ongles éclatants et une peau lumineuse au quotidien sans abîmer';
    const cues = parseScriptToCues({ rawText: long });
    expect(cues.length).toBeGreaterThan(0);
    for (const c of cues) {
      expect(c.lines.length).toBeLessThanOrEqual(SUBTITLE_LIMITS.MAX_LINES_PER_CUE);
      for (const line of c.lines) {
        expect(line.length).toBeLessThanOrEqual(SUBTITLE_LIMITS.MAX_CHARS_PER_LINE);
      }
    }
  });

  it('produces cumulative non-overlapping timing from hook + scenes', () => {
    const cues = parseScriptToCues({
      hook: 'Le rituel',
      scenes: [{ narration: 'Étape une', durationSeconds: 4 }, { narration: 'Étape deux', durationSeconds: 4 }],
    });
    expect(cues.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i]!.startMs).toBeGreaterThanOrEqual(cues[i - 1]!.endMs);
    }
  });

  it('empty input → no cues', () => {
    expect(parseScriptToCues({})).toEqual([]);
  });
});

describe('validateCues (MP-SU-01)', () => {
  it('flags overlap and bad duration as errors', () => {
    const cues: Cue[] = [
      { index: 1, startMs: 0, endMs: 2000, lines: ['A'] },
      { index: 2, startMs: 1000, endMs: 3000, lines: ['B'] }, // overlaps cue 1
      { index: 3, startMs: 4000, endMs: 4000, lines: ['C'] }, // zero duration
    ];
    const codes = validateCues(cues).filter((i) => i.severity === 'error').map((i) => i.code);
    expect(codes).toContain('overlap');
    expect(codes).toContain('duration');
  });

  it('flags an over-long line and high CPS as warnings', () => {
    const cues: Cue[] = [
      { index: 1, startMs: 0, endMs: 400, lines: ['x'.repeat(50)] },
    ];
    const warnings = validateCues(cues).filter((i) => i.severity === 'warning').map((i) => i.code);
    expect(warnings).toContain('line_length');
    expect(warnings).toContain('cps');
  });

  it('clean cues produce no errors', () => {
    const cues = sortAndReindex([
      { index: 1, startMs: 0, endMs: 1500, lines: ['Bonjour'] },
      { index: 2, startMs: 1600, endMs: 3100, lines: ['Au revoir'] },
    ]);
    expect(validateCues(cues).filter((i) => i.severity === 'error')).toHaveLength(0);
  });
});
