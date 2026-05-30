/**
 * Tests for GenerationModeToggle — segmented control switching between
 * mock (default) and live generation, persisted in localStorage + cookie.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  GenerationModeToggle,
  readGenerationModeFromCookie,
  GENERATION_MODE_COOKIE,
} from './GenerationModeToggle';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { toast } from 'sonner';

beforeEach(() => {
  localStorage.clear();
  document.cookie = `${GENERATION_MODE_COOKIE}=; path=/; max-age=0`;
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

describe('GenerationModeToggle', () => {
  it('renders both Mock and Live radio buttons', () => {
    render(<GenerationModeToggle />);
    expect(screen.getByTestId('generation-mode-mock')).toBeInTheDocument();
    expect(screen.getByTestId('generation-mode-live')).toBeInTheDocument();
  });

  it('defaults to mock', () => {
    render(<GenerationModeToggle />);
    expect(screen.getByTestId('generation-mode-mock')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('generation-mode-live')).toHaveAttribute('aria-checked', 'false');
  });

  it('respects envDefault=live when no localStorage entry', () => {
    render(<GenerationModeToggle envDefault="live" />);
    expect(screen.getByTestId('generation-mode-live')).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking Live switches to live and persists in localStorage + cookie', () => {
    render(<GenerationModeToggle />);
    fireEvent.click(screen.getByTestId('generation-mode-live'));
    expect(screen.getByTestId('generation-mode-live')).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('cs-generation-mode')).toBe('live');
    expect(document.cookie).toMatch(/cs_generation_mode=live/);
  });

  it('clicking Mock switches back to mock and persists', () => {
    render(<GenerationModeToggle envDefault="live" />);
    fireEvent.click(screen.getByTestId('generation-mode-mock'));
    expect(screen.getByTestId('generation-mode-mock')).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('cs-generation-mode')).toBe('mock');
    expect(document.cookie).toMatch(/cs_generation_mode=mock/);
  });

  it('reads localStorage preference over envDefault', () => {
    localStorage.setItem('cs-generation-mode', 'live');
    render(<GenerationModeToggle envDefault="mock" />);
    expect(screen.getByTestId('generation-mode-live')).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange when switching to live', () => {
    const onChange = vi.fn();
    render(<GenerationModeToggle onChange={onChange} />);
    fireEvent.click(screen.getByTestId('generation-mode-live'));
    expect(onChange).toHaveBeenCalledWith('live');
  });

  it('does not call onChange when clicking same mode twice', () => {
    const onChange = vi.fn();
    render(<GenerationModeToggle onChange={onChange} />);
    fireEvent.click(screen.getByTestId('generation-mode-mock'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toasts a warning when switching to live', () => {
    render(<GenerationModeToggle />);
    fireEvent.click(screen.getByTestId('generation-mode-live'));
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringMatching(/Mode live activé.*coûts réels/i),
      expect.any(Object),
    );
  });

  it('toasts success when switching back to mock', () => {
    render(<GenerationModeToggle envDefault="live" />);
    fireEvent.click(screen.getByTestId('generation-mode-mock'));
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/Mode mock activé/i),
    );
  });

  it('renders with data-cs-generation-mode attribute reflecting current mode', () => {
    const { container } = render(<GenerationModeToggle envDefault="live" />);
    const toggle = container.querySelector('[data-cs-section="generation-mode-toggle"]');
    expect(toggle?.getAttribute('data-cs-generation-mode')).toBe('live');
  });
});

describe('readGenerationModeFromCookie', () => {
  it('returns "live" when cookie has live', () => {
    expect(readGenerationModeFromCookie('foo=bar; cs_generation_mode=live; baz=qux', 'mock')).toBe(
      'live',
    );
  });

  it('returns "mock" when cookie has mock', () => {
    expect(readGenerationModeFromCookie('cs_generation_mode=mock', 'live')).toBe('mock');
  });

  it('returns envDefault when cookie absent', () => {
    expect(readGenerationModeFromCookie('foo=bar', 'live')).toBe('live');
    expect(readGenerationModeFromCookie(null, 'mock')).toBe('mock');
  });

  it('returns envDefault when cookie has invalid value', () => {
    expect(readGenerationModeFromCookie('cs_generation_mode=garbage', 'mock')).toBe('mock');
  });
});
