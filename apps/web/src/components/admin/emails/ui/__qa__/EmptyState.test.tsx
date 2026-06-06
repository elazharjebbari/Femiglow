// @vitest-environment jsdom
/**
 * F01 — EmptyState (SOC-F03 / TRV-09) : batterie F01-C-029..031 + F01-A-032.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';

import { EmptyState } from '@/components/admin/emails/ui/EmptyState';

describe('EmptyState', () => {
  it('F01-C-029 — vide absolu : titre + explication + CTA création', () => {
    render(
      <EmptyState
        icon="🎯"
        title="Aucune audience définie"
        body="Créez votre premier segment pour cibler vos campagnes."
        cta={{ label: '+ Nouvelle audience', href: '/admin/emails/audiences/new' }}
      />,
    );
    const zone = screen.getByRole('status');
    expect(zone).toHaveTextContent('Aucune audience définie');
    expect(zone).toHaveTextContent(/créez votre premier segment/i);
    expect(screen.getByRole('link', { name: /nouvelle audience/i })).toHaveAttribute(
      'href',
      '/admin/emails/audiences/new',
    );
  });

  it('F01-C-030 — vide filtré : cite le filtre + CTA « Réinitialiser le filtre »', () => {
    const onReset = vi.fn();
    render(
      <EmptyState
        variant="filtered"
        icon="📭"
        title="Aucun email ne correspond à ces filtres"
        body={
          <>
            Le filtre <code>status:dlq</code> ne retient aucun résultat.
          </>
        }
        cta={{ label: 'Réinitialiser le filtre', onClick: onReset }}
      />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('data-variant', 'filtered');
    expect(screen.getByText('status:dlq')).toBeInTheDocument();
    screen.getByRole('button', { name: /réinitialiser le filtre/i }).click();
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('F01-C-031 — icône décorative hors de l’arbre accessible (aria-hidden)', () => {
    render(<EmptyState icon="🎯" title="Vide" />);
    const icon = screen.getByText('🎯');
    expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('F01-A-032 — axe : 0 violation serious/critical', async () => {
    const { container } = render(
      <EmptyState
        icon="📭"
        title="Aucun envoi sur 7 jours"
        body="Les envois apparaîtront ici."
        cta={{ label: 'Ouvrir le cockpit', href: '/admin/emails/transactional' }}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
