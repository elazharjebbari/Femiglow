import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PostizPanel } from './PostizPanel';
import type { Integration, RunFunction } from './types';

const integrations: Integration[] = [
  { id: 'int_1', provider: 'instagram', identifier: '@femiglow', name: 'FemiGlow IG', disabled: false },
  { id: 'int_2', provider: 'tiktok', identifier: '@femiglow_tt', name: null, disabled: true },
];

function createRunMock() {
  return vi.fn() as unknown as RunFunction;
}

describe('PostizPanel', () => {
  it('affiche le message vide quand il n’y a pas d’intégrations', () => {
    render(<PostizPanel integrations={[]} setIntegrations={vi.fn()} disabled={false} run={createRunMock()} />);
    expect(screen.getByText(/Aucun compte synchronisé/i)).toBeInTheDocument();
  });

  it('affiche les intégrations avec leur fournisseur', () => {
    render(<PostizPanel integrations={integrations} setIntegrations={vi.fn()} disabled={false} run={createRunMock()} />);
    expect(screen.getByText('instagram')).toBeInTheDocument();
    expect(screen.getByText(/@femiglow_tt/)).toBeInTheDocument();
    expect(screen.getByText(/désactivé/i)).toBeInTheDocument();
  });

  it('désactive le bouton Sync quand disabled', () => {
    render(<PostizPanel integrations={[]} setIntegrations={vi.fn()} disabled={true} run={createRunMock()} />);
    expect(screen.getByRole('button', { name: /Sync/i })).toBeDisabled();
  });
});