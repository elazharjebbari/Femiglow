/**
 * Tests `SensationLine` — phrase italique sous la description.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SensationLine } from './SensationLine';

describe('SensationLine', () => {
  it('rend le texte tel quel', () => {
    render(<SensationLine text="« Tiède au contact. »" />);
    expect(screen.getByTestId('composition-card-sensation').textContent).toBe(
      '« Tiède au contact. »',
    );
  });

  it('est un paragraphe italique Cormorant', () => {
    render(<SensationLine text="x" />);
    const p = screen.getByTestId('composition-card-sensation');
    expect(p.tagName).toBe('P');
    expect(p.className).toMatch(/font-display/);
    expect(p.className).toMatch(/italic/);
  });
});
