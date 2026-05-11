import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RitualsWallFilters } from './RitualsWallFilters';

describe('RitualsWallFilters', () => {
  it('rend les 4 chips', () => {
    render(<RitualsWallFilters value="all" onChange={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('Tous est aria-pressed par défaut', () => {
    render(<RitualsWallFilters value="all" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Tous' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('click chip appelle onChange', async () => {
    const onChange = vi.fn();
    render(<RitualsWallFilters value="all" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Avec photos' }));
    expect(onChange).toHaveBeenCalledWith('with_photos');
  });

  it('seul un chip actif à la fois', () => {
    render(<RitualsWallFilters value="halal" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Halal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Tous' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
