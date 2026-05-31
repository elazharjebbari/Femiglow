import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { LegalEmptyState } from '../EmptyState';

describe('LegalEmptyState', () => {
  it('rend title + description', () => {
    render(<LegalEmptyState title="Aucune donnée" description="Crée la première." />);
    expect(screen.getByText('Aucune donnée')).toBeInTheDocument();
    expect(screen.getByText('Crée la première.')).toBeInTheDocument();
  });

  it('rend CTA si ctaHref + ctaLabel', () => {
    render(
      <LegalEmptyState
        title="x"
        description="y"
        ctaHref="/admin/legal/new"
        ctaLabel="+ Créer"
      />,
    );
    const link = screen.getByRole('link', { name: /Créer/ });
    expect(link).toHaveAttribute('href', '/admin/legal/new');
  });

  it('pas de CTA si ctaHref absent', () => {
    render(<LegalEmptyState title="x" description="y" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('a region role + aria-label', () => {
    const { container } = render(<LegalEmptyState title="x" description="y" />);
    const region = container.querySelector('[role="region"]');
    expect(region?.getAttribute('aria-label')).toBe('État vide');
  });

  it('CTA a focus-visible outline', () => {
    render(
      <LegalEmptyState title="x" description="y" ctaHref="/admin" ctaLabel="Go" />,
    );
    const link = screen.getByRole('link', { name: /Go/ });
    expect(link.className).toContain('focus-visible:outline');
  });
});
