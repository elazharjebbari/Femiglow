/**
 * Tests `ResumeBanner` — Client Component.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

const emitMock = vi.fn();
const markShownMock = vi.fn();
const dismissMock = vi.fn();

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock, consent: { analytics: 'granted' } }),
}));

vi.mock('@/lib/checkout/state/wizard-store', () => ({
  useWizardStore: (selector: (state: unknown) => unknown) =>
    selector({
      currentStep: 'lead',
      markResumeBannerShown: markShownMock,
      dismissResumeBanner: dismissMock,
    }),
  // CHA-232 — `useWizardTranslation` lit la langue via `selectLanguage`.
  // Le mock du store doit donc l'exposer ; défaut FR (pas de formContext).
  selectLanguage: () => 'fr',
}));

import { ResumeBanner } from './ResumeBanner';

beforeEach(() => {
  emitMock.mockReset();
  markShownMock.mockReset();
  dismissMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ResumeBanner', () => {
  it('rend template avec {firstName} remplacé', () => {
    render(<ResumeBanner firstName="Yasmine" />);
    expect(
      screen.getByTestId('wizard-resume-banner').textContent,
    ).toContain('Yasmine');
  });

  it('émet wizard_resume_shown au mount (1 fois)', () => {
    render(<ResumeBanner firstName="Y" />);
    const calls = emitMock.mock.calls.filter(
      (c) => c[0] === 'wizard_resume_shown',
    );
    expect(calls).toHaveLength(1);
    expect(markShownMock).toHaveBeenCalledOnce();
  });

  it('Click ✕ émet wizard_resume_dismissed + dismissPersist + cache la banner', () => {
    render(<ResumeBanner firstName="Y" />);
    fireEvent.click(screen.getByTestId('wizard-resume-dismiss'));
    expect(
      emitMock.mock.calls.some((c) => c[0] === 'wizard_resume_dismissed'),
    ).toBe(true);
    expect(dismissMock).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('wizard-resume-banner')).toBeNull();
  });

  it('auto-hide après autoHideMs (vi.useFakeTimers)', () => {
    vi.useFakeTimers();
    render(<ResumeBanner firstName="Y" autoHideMs={5000} />);
    expect(screen.getByTestId('wizard-resume-banner')).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId('wizard-resume-banner')).toBeNull();
  });

  it('autoHideMs=0 → ne se cache pas (timer skip)', () => {
    vi.useFakeTimers();
    render(<ResumeBanner firstName="Y" autoHideMs={0} />);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByTestId('wizard-resume-banner')).toBeDefined();
  });

  it('role="status" + aria-live="polite"', () => {
    render(<ResumeBanner firstName="Y" />);
    const el = screen.getByTestId('wizard-resume-banner');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('bouton ✕ porte aria-label', () => {
    render(<ResumeBanner firstName="Y" />);
    const btn = screen.getByTestId('wizard-resume-dismiss');
    expect(btn.getAttribute('aria-label')).toContain('Fermer');
  });
});
