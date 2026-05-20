/**
 * Tests `StepsPostCtaLink` — Client.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const emitMock = vi.fn();

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock, consent: { analytics: 'granted' } }),
}));

import { StepsPostCtaLink } from './StepsPostCtaLink';

beforeEach(() => {
  emitMock.mockReset();
  // Ancre cible présente dans le DOM
  const target = document.createElement('div');
  target.id = 'commander-femiglow';
  document.body.appendChild(target);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('StepsPostCtaLink', () => {
  it('rend un <a> vers #anchorId', () => {
    render(
      <StepsPostCtaLink label="Démarrer le rituel" anchorId="commander-femiglow" />,
    );
    const link = screen.getByTestId('steps-post-cta');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('#commander-femiglow');
  });

  it('rend label + chevron ↓', () => {
    render(<StepsPostCtaLink label="Custom label" anchorId="x" />);
    const link = screen.getByTestId('steps-post-cta');
    expect(link.textContent).toContain('Custom label');
    expect(link.textContent).toContain('↓');
  });

  it('au click → émet pack_steps_cta_click avec cta_target', () => {
    render(
      <StepsPostCtaLink label="Démarrer le rituel" anchorId="commander-femiglow" />,
    );
    fireEvent.click(screen.getByTestId('steps-post-cta'));
    expect(emitMock).toHaveBeenCalled();
    expect(emitMock.mock.calls[0]![0]).toBe('pack_steps_cta_click');
    expect(emitMock.mock.calls[0]![1]).toEqual({
      cta_target: '#commander-femiglow',
    });
  });

  it('au click → preventDefault + scrollIntoView si l\'ancre existe', () => {
    const target = document.getElementById('commander-femiglow')!;
    const scrollSpy = vi.spyOn(target, 'scrollIntoView');
    render(
      <StepsPostCtaLink label="Démarrer" anchorId="commander-femiglow" />,
    );
    fireEvent.click(screen.getByTestId('steps-post-cta'));
    expect(scrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
  });

  it('ne crash pas si l\'ancre n\'existe pas (no preventDefault)', () => {
    render(<StepsPostCtaLink label="X" anchorId="anchor-absente" />);
    expect(() =>
      fireEvent.click(screen.getByTestId('steps-post-cta')),
    ).not.toThrow();
    expect(emitMock).toHaveBeenCalled();
  });
});
