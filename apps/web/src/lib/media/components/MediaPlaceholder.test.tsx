import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MediaPlaceholder } from './MediaPlaceholder';

describe('MediaPlaceholder', () => {
  it('rend un <img> si fallback fourni', () => {
    render(<MediaPlaceholder fallback="/fallback.svg" label="placeholder" />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/fallback.svg');
  });

  it('rend un <svg> si pas de fallback', () => {
    const { container } = render(<MediaPlaceholder label="loading" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'loading' })).toBeInTheDocument();
  });

  it('zéro violation a11y', async () => {
    const { container } = render(<MediaPlaceholder label="loading" />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
