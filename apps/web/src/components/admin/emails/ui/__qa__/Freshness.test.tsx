// @vitest-environment jsdom
/**
 * F01 — Freshness (SOC-F04 / TRV-05, DASH-08) : batterie F01-U-033..035 +
 * F01-C-036..042 + F01-A-043. Horloge ENTIÈREMENT contrôlée (fake timers +
 * setSystemTime) — c'est le composant le plus sensible au temps du socle.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expectNoAxeViolations } from '@/test/axe';

import { Freshness } from '@/components/admin/emails/ui/Freshness';
import { formatAge } from '@/components/admin/emails/ui/format-datetime';

const T0 = new Date('2026-06-06T10:00:00.000Z');
const iso = (offsetMs: number) => new Date(T0.getTime() + offsetMs).toISOString();

/** Pose document.hidden (jsdom le fige à false par défaut). */
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});

describe('formatAge — unitaires', () => {
  it('F01-U-033 — secondes : « il y a 12 s »', () => {
    expect(formatAge(iso(-12_000), T0)).toBe('il y a 12 s');
  });
  it('F01-U-034 — minutes : « il y a 3 min »', () => {
    expect(formatAge(iso(-3 * 60_000), T0)).toBe('il y a 3 min');
  });
  it('F01-U-035 — heures : « il y a 2 h »', () => {
    expect(formatAge(iso(-2 * 3_600_000), T0)).toBe('il y a 2 h');
  });
});

describe('Freshness — rendu', () => {
  it('F01-C-036 — la timezone est VISIBLE (« Casablanca »)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    render(<Freshness generatedAt={iso(-5_000)} />);
    expect(screen.getByRole('status')).toHaveTextContent(/casablanca/i);
  });

  it('F01-C-037 — <time> porte datetime = ISO fourni', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const at = iso(-5_000);
    const { container } = render(<Freshness generatedAt={at} />);
    expect(container.querySelector('time')).toHaveAttribute('dateTime', at);
  });
});

describe('Freshness — auto-refresh & honnêteté du temps', () => {
  /** Harnais : onRefresh rafraîchit generatedAt (comme un vrai parent). */
  function Harness({ onRefreshSpy }: { onRefreshSpy: () => void }) {
    const [at, setAt] = useState(() => new Date().toISOString());
    return (
      <Freshness
        generatedAt={at}
        autoRefresh={{
          intervalMs: 60_000,
          onRefresh: () => {
            onRefreshSpy();
            setAt(new Date().toISOString());
          },
        }}
      />
    );
  }

  it('F01-C-038 — au tick : onRefresh déclenché, l’âge repasse à « il y a 0 s »', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const spy = vi.fn();
    render(<Harness onRefreshSpy={spy} />);

    act(() => vi.advanceTimersByTime(60_000));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('il y a 0 s');
  });

  it('F01-C-039 — onglet caché : l’intervalle écoulé ne déclenche PAS onRefresh', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const spy = vi.fn();
    render(<Harness onRefreshSpy={spy} />);

    act(() => setHidden(true));
    act(() => vi.advanceTimersByTime(60_000));
    expect(spy).not.toHaveBeenCalled();
  });

  it('F01-C-040 — âge HONNÊTE après veille : « il y a 2 h », jamais « 0 s »', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    render(<Freshness generatedAt={T0.toISOString()} />);

    // 2 h de veille : on saute l'horloge système puis UN tick d'affichage.
    vi.setSystemTime(new Date(T0.getTime() + 2 * 3_600_000));
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole('status')).toHaveTextContent('il y a 2 h');
  });

  it('F01-C-041 — retour visible : onRefresh immédiat, UNE fois', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const spy = vi.fn();
    render(<Harness onRefreshSpy={spy} />);

    act(() => setHidden(true));
    act(() => vi.advanceTimersByTime(30_000));
    expect(spy).not.toHaveBeenCalled();

    act(() => setHidden(false));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('F01-C-042 — bouton busy anti double-clic pendant un refresh lent', async () => {
    // Refresh qui pend : promesse jamais résolue.
    let calls = 0;
    function SlowHarness() {
      const [at] = useState(() => new Date().toISOString());
      return (
        <Freshness
          generatedAt={at}
          autoRefresh={{
            intervalMs: 600_000,
            onRefresh: () => {
              calls += 1;
              return new Promise<void>(() => {});
            },
          }}
        />
      );
    }
    render(<SlowHarness />);
    const btn = screen.getByRole('button', { name: /rafraîchir/i });
    await act(async () => btn.click());

    const busy = screen.getByRole('button', { name: /rafraîchissement…/i });
    expect(busy).toBeDisabled();
    await act(async () => busy.click()); // double-clic agressif
    expect(calls).toBe(1);
  });
});

describe('Freshness — a11y', () => {
  it('F01-A-043 — axe : 0 violation serious/critical', async () => {
    const { container } = render(
      <Freshness
        generatedAt={new Date().toISOString()}
        autoRefresh={{ onRefresh: () => {} }}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
