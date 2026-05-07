/**
 * CHA-078 / CHA-079 — Cadenceur côté client.
 *
 * Reçoit un flux de tokens (chunks) brut et les transmet à un
 * consumer en y appliquant :
 * - un jitter pseudo-aléatoire entre 30 et 60 ms (configurable),
 * - une pause supplémentaire après une fin de phrase (`. ! ? …`)
 *   ou une virgule longue,
 * - un délai minimum avant le PREMIER token (≥ 600 ms) pour donner
 *   l'impression d'une réflexion.
 *
 * Cette fonction est volontairement déconnectée du store Zustand —
 * elle accepte un callback `onTick(delta)` pour être facile à
 * tester. Le coupleur store/cadenceur est dans `use-chat-send.ts`.
 *
 * cf. docs/chat-assistant/06-multilingue-humanisation.md §3
 */

export interface HumanizeOptions {
  jitterMinMs?: number;
  jitterMaxMs?: number;
  punctPauseMs?: number;
  minTypingMs?: number;
  /** Désactive complètement la cadence (tests, prefers-reduced-motion). */
  disabled?: boolean;
}

export interface HumanizeContext {
  signal?: AbortSignal;
}

const PUNCT_RE = /[.!?…؟]\s*$/;
const COMMA_RE = /[,;،]\s*$/;

const DEFAULT: Required<Omit<HumanizeOptions, 'disabled'>> = {
  jitterMinMs: 30,
  jitterMaxMs: 60,
  punctPauseMs: 120,
  minTypingMs: 600,
};

/**
 * Pousse `text` au consumer caractère par caractère (ou token par
 * token, en respectant les espaces) avec la cadence humanisée.
 */
export async function humanizeStream(
  source: AsyncIterable<string>,
  onTick: (delta: string) => void,
  opts: HumanizeOptions = {},
  ctx: HumanizeContext = {},
): Promise<void> {
  const cfg = { ...DEFAULT, ...opts };
  if (opts.disabled || prefersReducedMotion()) {
    for await (const delta of source) {
      onTick(delta);
    }
    return;
  }

  const t0 = Date.now();
  let firstTickEmitted = false;

  for await (const delta of source) {
    if (ctx.signal?.aborted) break;
    if (!delta) continue;

    if (!firstTickEmitted) {
      const elapsed = Date.now() - t0;
      const remaining = Math.max(0, cfg.minTypingMs - elapsed);
      if (remaining > 0) await sleep(remaining, ctx.signal);
      firstTickEmitted = true;
    } else {
      const jitter = randInt(cfg.jitterMinMs, cfg.jitterMaxMs);
      await sleep(jitter, ctx.signal);
    }

    onTick(delta);

    // Pause supplémentaire si fin de phrase / virgule.
    if (PUNCT_RE.test(delta)) {
      await sleep(cfg.punctPauseMs, ctx.signal);
    } else if (COMMA_RE.test(delta)) {
      await sleep(Math.round(cfg.punctPauseMs / 2), ctx.signal);
    }
  }
}

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
