/**
 * MP-SU-01 (BUG-004) — pure SRT library (no fs, no network). Used by the
 * per-draft subtitles service (pipeline B). The AI-engine node keeps its own
 * legacy generator so its test stays green; this library supersedes it for the
 * operator flow with line-wrapping (instead of lossy 120-char truncation),
 * round-trip parse/serialize, and a severity-tiered validator.
 */

export interface Cue {
  /** 1-based on serialize; UI uses array order. */
  index: number;
  /** integer ms ≥ 0 */
  startMs: number;
  /** integer ms, > startMs */
  endMs: number;
  /** 1..2 lines */
  lines: string[];
}

export interface BurnInStyle {
  font: 'sans' | 'serif' | 'mono';
  sizePx: number;
  position: 'top' | 'middle' | 'bottom';
  textColor: string;
  boxColor?: string;
  boxOpacity?: number;
}

export const SUBTITLE_LIMITS = {
  MAX_CHARS_PER_LINE: 42,
  MAX_LINES_PER_CUE: 2,
  MIN_CUE_MS: 700,
  MIN_GAP_MS: 80,
  MAX_CPS: 17,
  MAX_CUES: 200,
} as const;

export const DEFAULT_BURN_IN_STYLE: BurnInStyle = {
  font: 'sans',
  sizePx: 28,
  position: 'bottom',
  textColor: '#FFFFFF',
  boxColor: '#000000',
  boxOpacity: 0.5,
};

/** "HH:MM:SS,mmm" (comma decimal, zero-padded). */
export function formatTimecode(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const millis = clamped % 1000;
  return (
    [
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(seconds).padStart(2, '0'),
    ].join(':') +
    ',' +
    String(millis).padStart(3, '0')
  );
}

/** Parses "HH:MM:SS,mmm" (also tolerates '.'); throws on malformed. */
export function parseTimecode(tc: string): number {
  const m = tc.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!m) throw new Error(`Timecode malformé: "${tc}"`);
  const [, h, min, s, ms] = m;
  return (
    Number(h) * 3_600_000 +
    Number(min) * 60_000 +
    Number(s) * 1000 +
    Number(ms!.padEnd(3, '0'))
  );
}

/** Canonical SRT: 1-based indices, LF, blank line between blocks. */
export function serializeSrt(cues: Cue[]): string {
  if (cues.length === 0) return '';
  const blocks = cues.map((c, i) => {
    const head = `${i + 1}`;
    const time = `${formatTimecode(c.startMs)} --> ${formatTimecode(c.endMs)}`;
    return [head, time, ...c.lines].join('\n');
  });
  return blocks.join('\n\n') + '\n';
}

/** Tolerant parse (CRLF, extra blanks); returns ms-based cues. */
export function parseSrt(srt: string): Cue[] {
  const normalized = srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    // first line may be the numeric index (optional); find the timecode line.
    const tcIdx = lines.findIndex((l) => l.includes('-->'));
    if (tcIdx === -1) continue;
    const tcLine = lines[tcIdx]!;
    const parts = tcLine.split('-->');
    if (parts.length !== 2) continue;
    let startMs: number;
    let endMs: number;
    try {
      startMs = parseTimecode(parts[0]!);
      endMs = parseTimecode(parts[1]!);
    } catch {
      continue;
    }
    const text = lines.slice(tcIdx + 1).filter((l) => l.length > 0);
    if (text.length === 0) continue;
    cues.push({ index: cues.length + 1, startMs, endMs, lines: text.slice(0, SUBTITLE_LIMITS.MAX_LINES_PER_CUE) });
  }
  return cues;
}

/** Greedy word-wrap into lines ≤ maxChars (a single overlong word is hard-split). */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }
      let rest = word;
      while (rest.length > maxChars) {
        lines.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      current = rest;
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface ScriptScene {
  narration?: string;
  onScreenText?: string;
  textOverlay?: string;
  description?: string;
  durationSeconds?: number;
}

/**
 * Segment a script (hook + scenes) or a raw text into wrapped, timed cues.
 * Deterministic and pure. Cumulative timing mirrors the legacy node (hook ≤ 3 s,
 * then `durationSeconds ?? 4` per scene) but WRAPS to ≤ 2 lines/cue, splitting an
 * over-long block's window across consecutive cues instead of truncating.
 */
export function parseScriptToCues(input: {
  hook?: string;
  scenes?: ScriptScene[];
  rawText?: string;
}): Cue[] {
  const maxChars = SUBTITLE_LIMITS.MAX_CHARS_PER_LINE;
  const maxLines = SUBTITLE_LIMITS.MAX_LINES_PER_CUE;
  const cues: Cue[] = [];
  let elapsedMs = 0;

  const emitBlock = (text: string, windowMs: number) => {
    const clean = text.trim();
    if (!clean) {
      elapsedMs += windowMs;
      return;
    }
    const lines = wrapText(clean, maxChars);
    // chunk into groups of ≤ maxLines, distribute the window evenly.
    const groups: string[][] = [];
    for (let i = 0; i < lines.length; i += maxLines) groups.push(lines.slice(i, i + maxLines));
    const per = Math.max(SUBTITLE_LIMITS.MIN_CUE_MS, Math.floor(windowMs / groups.length));
    for (const group of groups) {
      const start = elapsedMs;
      const end = start + per;
      cues.push({ index: cues.length + 1, startMs: start, endMs: end, lines: group });
      elapsedMs = end;
    }
  };

  // rawText override: one window, default 4s per ~12 words.
  if (input.rawText && input.rawText.trim()) {
    const words = input.rawText.trim().split(/\s+/).filter(Boolean).length;
    emitBlock(input.rawText, Math.max(3000, Math.ceil(words / 2.5) * 1000));
    return cues;
  }

  if (input.hook && input.hook.trim()) {
    const hookWindow = Math.min(3000, (input.scenes?.[0]?.durationSeconds ?? 3) * 1000);
    emitBlock(input.hook, hookWindow);
  }
  for (const scene of input.scenes ?? []) {
    const text = scene.narration ?? scene.onScreenText ?? scene.textOverlay ?? scene.description ?? '';
    emitBlock(text, (scene.durationSeconds ?? 4) * 1000);
  }
  return cues;
}

/** Sort cues by start time and re-assign 1-based indices. */
export function sortAndReindex(cues: Cue[]): Cue[] {
  return [...cues]
    .sort((a, b) => a.startMs - b.startMs)
    .map((c, i) => ({ ...c, index: i + 1 }));
}

export type CueValidationCode =
  | 'timecode'
  | 'duration'
  | 'order'
  | 'overlap'
  | 'lines'
  | 'line_length'
  | 'empty'
  | 'min_duration'
  | 'cps'
  | 'min_gap'
  | 'beyond_video';

export interface CueIssue {
  cueIndex: number;
  code: CueValidationCode;
  severity: 'error' | 'warning';
  message: string;
}

/** Pure validator. Errors block save; warnings are advisory. */
export function validateCues(cues: Cue[], opts?: { videoDurationMs?: number }): CueIssue[] {
  const issues: CueIssue[] = [];
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs);
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]!;
    const at = i + 1;
    if (!Number.isInteger(c.startMs) || !Number.isInteger(c.endMs) || c.startMs < 0) {
      issues.push({ cueIndex: at, code: 'timecode', severity: 'error', message: 'Timecode invalide.' });
    }
    if (c.endMs <= c.startMs) {
      issues.push({ cueIndex: at, code: 'duration', severity: 'error', message: 'La fin doit suivre le début.' });
    }
    const text = c.lines.join(' ').trim();
    if (text.length === 0) {
      issues.push({ cueIndex: at, code: 'empty', severity: 'error', message: 'Sous-titre vide.' });
    }
    if (c.lines.length > SUBTITLE_LIMITS.MAX_LINES_PER_CUE) {
      issues.push({ cueIndex: at, code: 'lines', severity: 'error', message: `Maximum ${SUBTITLE_LIMITS.MAX_LINES_PER_CUE} lignes.` });
    }
    for (const line of c.lines) {
      if (line.length > SUBTITLE_LIMITS.MAX_CHARS_PER_LINE) {
        issues.push({ cueIndex: at, code: 'line_length', severity: 'warning', message: `Ligne > ${SUBTITLE_LIMITS.MAX_CHARS_PER_LINE} caractères.` });
        break;
      }
    }
    const durationMs = c.endMs - c.startMs;
    if (durationMs > 0 && durationMs < SUBTITLE_LIMITS.MIN_CUE_MS) {
      issues.push({ cueIndex: at, code: 'min_duration', severity: 'warning', message: 'Sous-titre très court.' });
    }
    if (durationMs > 0) {
      const cps = (text.length / durationMs) * 1000;
      if (cps > SUBTITLE_LIMITS.MAX_CPS) {
        issues.push({ cueIndex: at, code: 'cps', severity: 'warning', message: 'Vitesse de lecture élevée.' });
      }
    }
    if (opts?.videoDurationMs && c.endMs > opts.videoDurationMs) {
      issues.push({ cueIndex: at, code: 'beyond_video', severity: 'warning', message: 'Au-delà de la durée de la vidéo.' });
    }
    if (i > 0) {
      const prev = sorted[i - 1]!;
      if (c.startMs < prev.endMs) {
        issues.push({ cueIndex: at, code: 'overlap', severity: 'error', message: 'Chevauchement avec le sous-titre précédent.' });
      } else if (c.startMs - prev.endMs < SUBTITLE_LIMITS.MIN_GAP_MS) {
        issues.push({ cueIndex: at, code: 'min_gap', severity: 'warning', message: 'Écart trop court avec le précédent.' });
      }
    }
  }
  return issues;
}
