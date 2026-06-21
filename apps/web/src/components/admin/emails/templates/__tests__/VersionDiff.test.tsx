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
});
