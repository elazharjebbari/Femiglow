'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Globe } from 'lucide-react';
import { toast } from 'sonner';

export type GenerationMode = 'mock' | 'live';

const STORAGE_KEY = 'cs-generation-mode';
const COOKIE_NAME = 'cs_generation_mode';

/**
 * Persist the choice in both localStorage (fast read) and a cookie (so the
 * backend route handlers can read it via `cookies().get('cs_generation_mode')`).
 * The cookie is scoped to the admin path, valid for 30 days.
 */
function persistMode(mode: GenerationMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
    document.cookie = `${COOKIE_NAME}=${mode}; path=/; max-age=${30 * 24 * 3600}; SameSite=Lax`;
  } catch {
    /* localStorage may be unavailable */
  }
}

function readPersistedMode(envDefault: GenerationMode): GenerationMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'mock' || stored === 'live') return stored;
  } catch {
    /* ignore */
  }
  return envDefault;
}

interface GenerationModeToggleProps {
  /** Default mode if no user choice yet (typically from env CONTENT_STUDIO_V2_MOCK_MODE). */
  envDefault?: GenerationMode;
  /** Notified when the mode changes. */
  onChange?: (mode: GenerationMode) => void;
}

export function GenerationModeToggle({
  envDefault = 'mock',
  onChange,
}: GenerationModeToggleProps) {
  const [mode, setMode] = useState<GenerationMode>(envDefault);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount (avoids SSR mismatch).
  useEffect(() => {
    const next = readPersistedMode(envDefault);
    setMode(next);
    setHydrated(true);
    // Sync the cookie even if it was stale (env default with no prior choice).
    persistMode(next);
  }, [envDefault]);

  function switchTo(next: GenerationMode) {
    if (next === mode) return;
    setMode(next);
    persistMode(next);
    onChange?.(next);
    if (next === 'live') {
      toast.warning(
        'Mode live activé — les prochaines générations appelleront de vrais providers (coûts réels).',
        { duration: 5000 },
      );
    } else {
      toast.success('Mode mock activé — générations simulées (aucun coût).');
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Mode de génération"
      data-cs-section="generation-mode-toggle"
      data-cs-generation-mode={mode}
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 3,
        background: 'var(--cs-bg-sunken)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-full)',
        opacity: hydrated ? 1 : 0.6,
      }}
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'mock'}
        data-testid="generation-mode-mock"
        onClick={() => switchTo('mock')}
        title="Générations simulées — pas de coûts, asset statique."
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          borderRadius: 'var(--cs-radius-full)',
          border: 'none',
          background: mode === 'mock' ? 'var(--cs-warning-bg)' : 'transparent',
          color: mode === 'mock' ? 'var(--cs-warning)' : 'var(--cs-fg-muted)',
          cursor: 'pointer',
          transition: 'background 120ms ease, color 120ms ease',
        }}
      >
        <Sparkles size={11} aria-hidden />
        Mock
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'live'}
        data-testid="generation-mode-live"
        onClick={() => switchTo('live')}
        title="Vraies générations via providers configurés (coûts réels)."
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          borderRadius: 'var(--cs-radius-full)',
          border: 'none',
          background: mode === 'live' ? 'var(--cs-success-bg, #ecfdf5)' : 'transparent',
          color: mode === 'live' ? 'var(--cs-success, #047857)' : 'var(--cs-fg-muted)',
          cursor: 'pointer',
          transition: 'background 120ms ease, color 120ms ease',
        }}
      >
        <Globe size={11} aria-hidden />
        Live
      </button>
    </div>
  );
}

/**
 * Server-side helper to read the persisted generation mode from request cookies.
 * Falls back to the env-defined default if no cookie is set.
 */
export function readGenerationModeFromCookie(
  cookieHeader: string | null,
  envDefault: GenerationMode,
): GenerationMode {
  if (!cookieHeader) return envDefault;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=(mock|live)`));
  return (match?.[1] as GenerationMode) ?? envDefault;
}

export const GENERATION_MODE_COOKIE = COOKIE_NAME;
