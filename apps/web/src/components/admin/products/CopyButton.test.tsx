/**
 * Tests unitaires de `<CopyButton/>`.
 *
 * Couvre :
 *  - rendu initial avec le label par défaut,
 *  - clic → écrit dans `navigator.clipboard.writeText`,
 *  - feedback transient « Copié ✓ » qui disparaît après 1.5 s,
 *  - fallback sur `document.execCommand('copy')` quand l'API
 *    asynchrone échoue (contexte non-secure, vieux navigateur),
 *  - état d'erreur quand les deux mécanismes échouent.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CopyButton } from './CopyButton';

describe('<CopyButton/>', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rend un bouton avec le label par défaut « Copier »', () => {
    render(<CopyButton text="hello" />);
    expect(
      screen.getByRole('button', { name: /copier/i }),
    ).toBeInTheDocument();
  });

  it('rend un label custom quand fourni', () => {
    render(<CopyButton text="hello" label="Copier le JSON" />);
    expect(
      screen.getByRole('button', { name: /copier le json/i }),
    ).toBeInTheDocument();
  });

  it('appelle navigator.clipboard.writeText avec le texte fourni au clic', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<CopyButton text="payload-1234" />);
    const btn = screen.getByRole('button', { name: /copier/i });

    await act(async () => {
      fireEvent.click(btn);
      // writeText est async — on laisse résoudre la microtask.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('payload-1234');
  });

  it('affiche « Copié ✓ » après une copie réussie, puis revient au label initial', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<CopyButton text="payload" successLabel="Copié ✓" />);
    const btn = screen.getByRole('button');

    await act(async () => {
      fireEvent.click(btn);
      // Laisse résoudre la microtask de writeText avant de re-render.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(btn.textContent).toContain('Copié');

    // Avance les timers : après 1.5 s, le label revient à « Copier ».
    // `act` est nécessaire pour que le setState dans le setTimeout
    // soit flushé dans le DOM avant l'assertion.
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(btn.textContent).toContain('Copier');
  });

  it('tombe sur document.execCommand si navigator.clipboard.writeText rejette', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    render(<CopyButton text="payload" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('affiche « Échec de copie » si writeText ET execCommand échouent', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    document.execCommand = vi.fn().mockReturnValue(false);

    render(<CopyButton text="payload" />);
    const btn = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(btn.textContent).toContain('Échec');
  });
});
