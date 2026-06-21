// @vitest-environment jsdom
/**
 * F07 P3.4-j (Lot 6) — composant VersionDiff (rendu gouttière + stats + close).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VersionDiff } from '../VersionDiff';

afterEach(() => vi.clearAllMocks());

describe('F07 — VersionDiff', () => {
  it('F07-C-026 — rend les lignes add/remove + stats + Fermer', () => {
    const onClose = vi.fn();
    render(
      <VersionDiff
        versionNumber={3}
        oldSource={'a\nVIEUX\nb'}
        newSource={'a\nNOUVEAU\nb'}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('version-diff-stats')).toHaveTextContent('+1');
    expect(screen.getByTestId('version-diff-stats')).toHaveTextContent('−1');
    expect(screen.getByText(/NOUVEAU/)).toHaveAttribute('data-diff', 'add');
    expect(screen.getByText(/VIEUX/)).toHaveAttribute('data-diff', 'remove');
    fireEvent.click(screen.getByRole('button', { name: /Fermer/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('F07-C-038 — navigation entre hunks : compteur + bornes + ligne active', () => {
    render(
      <VersionDiff
        versionNumber={2}
        oldSource={'a\nX\nb\nc\nY\nd'}
        newSource={'a\nb\nc\nd'}
        onClose={() => {}}
      />,
    );
    const counter = screen.getByTestId('version-diff-hunk');
    expect(counter).toHaveTextContent('1 / 2');
    // Au 1er hunk : ◀ désactivé, la 1re ligne modifiée est active.
    expect(screen.getByRole('button', { name: 'Modification précédente' })).toBeDisabled();
    expect(screen.getByText(/^X$/).closest('[data-diff]')).toHaveAttribute('data-active-hunk', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Modification suivante' }));
    expect(counter).toHaveTextContent('2 / 2');
    expect(screen.getByText(/^Y$/).closest('[data-diff]')).toHaveAttribute('data-active-hunk', 'true');
    // Au dernier hunk : ▶ désactivé.
    expect(screen.getByRole('button', { name: 'Modification suivante' })).toBeDisabled();
  });

  it('F07-C-039 — aucun changement → pas de contrôles de navigation', () => {
    render(
      <VersionDiff versionNumber={1} oldSource={'a\nb'} newSource={'a\nb'} onClose={() => {}} />,
    );
    expect(screen.queryByTestId('version-diff-hunk')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Modification suivante' }),
    ).not.toBeInTheDocument();
  });
});
