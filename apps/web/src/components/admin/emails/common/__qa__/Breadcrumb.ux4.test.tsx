/**
 * Vague 4 — FONDATION — Breadcrumb réutilisable (UX-TRANSVERSE-006).
 *
 * Oracle UX4-FONDATION-007 : nav aria-label="Fil d'Ariane", segments rendus en
 * ordre, les intermédiaires sont des liens (href), le dernier est aria-current
 * page et NON cliquable.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Breadcrumb, EMAILS_ROOT } from '../Breadcrumb';

describe('Breadcrumb — UX4-FONDATION-007', () => {
  it('UX4-FONDATION-007 : nav aria-label "Fil d’Ariane" + trail multi-niveaux', () => {
    render(
      <Breadcrumb
        segments={[
          EMAILS_ROOT,
          { label: 'Campagnes', href: '/admin/emails/campaigns' },
          { label: 'Promo printemps' },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: "Fil d'Ariane" });
    const links = within(nav).getAllByRole('link');
    // Les deux premiers segments sont des liens.
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('Emails');
    expect(links[0]).toHaveAttribute('href', '/admin/emails');
    expect(links[1]).toHaveTextContent('Campagnes');
  });

  it('UX4-FONDATION-007b : le dernier segment porte aria-current=page et n’est pas un lien', () => {
    render(
      <Breadcrumb
        segments={[EMAILS_ROOT, { label: 'Audiences' }]}
      />,
    );
    const current = screen.getByText('Audiences');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.tagName).not.toBe('A');
  });

  it('UX4-FONDATION-007c : libellé racine canonique unique "Emails"', () => {
    expect(EMAILS_ROOT.label).toBe('Emails');
    expect(EMAILS_ROOT.href).toBe('/admin/emails');
  });
});
