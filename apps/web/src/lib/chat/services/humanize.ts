/**
 * CHA-036 — Service `humanize` (côté serveur).
 *
 * Définit les paramètres de cadence transmis au client via le SSE
 * `typing` event ou via le snapshot session. Le rendu humain est
 * réalisé côté client (`humanize.client.ts`, CHA-078) — ici on se
 * contente de :
 * - exposer les paramètres par défaut (jitter, pause ponctuation),
 * - lire les overrides depuis le `chat_theme_preset.motion`,
 * - décider d'un délai minimum avant le premier token (≥ 600 ms) pour
 *   préserver l'illusion de réflexion.
 *
 * cf. docs/chat-assistant/06-multilingue-humanisation.md §3
 */

export interface HumanizeMotion {
  /** Jitter aléatoire entre deux tokens (ms). */
  jitterMinMs: number;
  jitterMaxMs: number;
  /** Pause supplémentaire après une fin de phrase (`. ! ? …`). */
  punctPauseMs: number;
  /** Pause minimum avant le premier token. */
  minTypingMs: number;
}

export const DEFAULT_MOTION: HumanizeMotion = {
  jitterMinMs: 30,
  jitterMaxMs: 60,
  punctPauseMs: 120,
  minTypingMs: 600,
};

/**
 * Fusion par défaut + overrides éventuels (admin via theme preset).
 */
export function resolveMotion(
  override?: Partial<HumanizeMotion> | null,
): HumanizeMotion {
  if (!override) return DEFAULT_MOTION;
  return {
    jitterMinMs: clamp(override.jitterMinMs ?? DEFAULT_MOTION.jitterMinMs, 0, 200),
    jitterMaxMs: clamp(override.jitterMaxMs ?? DEFAULT_MOTION.jitterMaxMs, 0, 400),
    punctPauseMs: clamp(override.punctPauseMs ?? DEFAULT_MOTION.punctPauseMs, 0, 800),
    minTypingMs: clamp(override.minTypingMs ?? DEFAULT_MOTION.minTypingMs, 0, 3000),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
