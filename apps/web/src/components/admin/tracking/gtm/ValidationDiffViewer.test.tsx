import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationDiffViewer } from './ValidationDiffViewer';
import type { PairValidationResult } from '@/lib/tracking/gtm/sentinel-schemas';

const okResult = (): PairValidationResult => ({
  ok: true,
  bundleId: { config: 'a7c4f2e9b81d', mapping: 'a7c4f2e9b81d', match: true },
  errors: [],
  warnings: [],
  recommendations: [
    { order: 1, action: 'Importer la config GTM en premier.' },
    { order: 2, action: 'Importer le mapping en second.' },
  ],
});

const errorResult = (): PairValidationResult => ({
  ok: false,
  bundleId: { config: 'aaaa', mapping: 'bbbb', match: false },
  errors: [
    {
      code: 'bundle_mismatch',
      severity: 'error',
      message: 'Bundle ID incohérent.',
      fix: 'Re-générer les 2 fichiers ensemble.',
    },
  ],
  warnings: [],
  recommendations: [{ order: 1, action: 'Corriger les erreurs.' }],
});

const warningResult = (): PairValidationResult => ({
  ok: true,
  bundleId: { config: 'a7c4f2e9b81d', mapping: 'a7c4f2e9b81d', match: true },
  errors: [],
  warnings: [
    {
      code: 'missing_variable',
      severity: 'warning',
      message: 'Variable manquante.',
      fix: 'Ajouter la variable.',
    },
  ],
  recommendations: [{ order: 1, action: 'Importer la config.' }],
});

describe('ValidationDiffViewer', () => {
  it('affiche verdict OK quand pas d\'erreur ni warning', () => {
    render(<ValidationDiffViewer result={okResult()} />);
    expect(screen.getByTestId('verdict')).toHaveAttribute('data-ok', 'true');
    expect(screen.getByText(/Cohérent — prêt à importer/i)).toBeInTheDocument();
  });

  it('affiche verdict warning quand ok=true avec warnings', () => {
    render(<ValidationDiffViewer result={warningResult()} />);
    expect(screen.getByTestId('verdict')).toHaveAttribute('data-ok', 'true');
    expect(screen.getByText(/OK avec 1 warning/i)).toBeInTheDocument();
    expect(screen.getByTestId('issues-warnings')).toBeInTheDocument();
  });

  it('affiche verdict KO + section errors', () => {
    render(<ValidationDiffViewer result={errorResult()} />);
    expect(screen.getByTestId('verdict')).toHaveAttribute('data-ok', 'false');
    expect(screen.getByText(/Import bloqué/i)).toBeInTheDocument();
    expect(screen.getByTestId('issues-errors')).toBeInTheDocument();
    expect(screen.getByText(/Bundle ID incohérent/)).toBeInTheDocument();
    expect(screen.getByText(/Re-générer les 2 fichiers/)).toBeInTheDocument();
  });

  it('affiche le bundle id pair avec =/≠ selon match', () => {
    const { rerender } = render(<ValidationDiffViewer result={okResult()} />);
    expect(screen.getByText(/config=a7c4f2e9b81d = mapping=a7c4f2e9b81d/)).toBeInTheDocument();
    rerender(<ValidationDiffViewer result={errorResult()} />);
    expect(screen.getByText(/config=aaaa ≠ mapping=bbbb/)).toBeInTheDocument();
  });

  it('liste les recommendations dans l\'ordre', () => {
    render(<ValidationDiffViewer result={okResult()} />);
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]!.textContent).toMatch(/Importer la config/);
    expect(items[1]!.textContent).toMatch(/Importer le mapping/);
  });

  it('affiche le code technique de chaque issue', () => {
    render(<ValidationDiffViewer result={errorResult()} />);
    expect(screen.getByText(/code: bundle_mismatch/)).toBeInTheDocument();
  });

  it('pluralise warnings/erreurs selon count', () => {
    const multi = errorResult();
    multi.errors.push({
      code: 'missing_variable',
      severity: 'error',
      message: 'Variable manquante.',
      fix: 'Ajouter.',
    });
    render(<ValidationDiffViewer result={multi} />);
    expect(screen.getByText(/2 erreurs/)).toBeInTheDocument();
  });
});
