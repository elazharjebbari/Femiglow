/**
 * Tests `StepIcon` — Server Component pur, 4 SVG inline.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { StepIcon } from './StepIcon';

afterEach(() => cleanup());

describe('StepIcon', () => {
  it('rend l\'icône buffer', () => {
    render(<StepIcon name="buffer" />);
    expect(screen.getByTestId('step-icon-buffer')).toBeDefined();
  });

  it('rend l\'icône drop', () => {
    render(<StepIcon name="drop" />);
    expect(screen.getByTestId('step-icon-drop')).toBeDefined();
  });

  it('rend l\'icône sparkle', () => {
    render(<StepIcon name="sparkle" />);
    expect(screen.getByTestId('step-icon-sparkle')).toBeDefined();
  });

  it('rend l\'icône mirror', () => {
    render(<StepIcon name="mirror" />);
    expect(screen.getByTestId('step-icon-mirror')).toBeDefined();
  });

  it('aria-hidden="true" sur chaque SVG', () => {
    render(<StepIcon name="buffer" />);
    expect(
      screen.getByTestId('step-icon-buffer').getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('propage className', () => {
    render(<StepIcon name="drop" className="h-6 w-6" />);
    expect(screen.getByTestId('step-icon-drop').getAttribute('class')).toBe(
      'h-6 w-6',
    );
  });

  it('utilise viewBox 0 0 24 24', () => {
    render(<StepIcon name="mirror" />);
    expect(
      screen.getByTestId('step-icon-mirror').getAttribute('viewBox'),
    ).toBe('0 0 24 24');
  });
});
