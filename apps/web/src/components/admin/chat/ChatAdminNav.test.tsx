/**
 * CHA-225 — Tests de la sous-navigation `/admin/chat`.
 *
 * Vérifie en particulier que :
 *  - les onglets attendus sont rendus dans l'ordre (incluant « Leads chat »)
 *  - chaque onglet pointe vers la bonne route
 *  - l'onglet actif reçoit `aria-current="page"` (a11y)
 *  - aucune violation axe
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ChatAdminNav } from './ChatAdminNav';
import { expectNoAxeViolations } from '@/test/axe';

const EXPECTED_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Vue d'ensemble", href: '/admin/chat' },
  { label: 'Conversations', href: '/admin/chat/conversations' },
  { label: 'Leads chat', href: '/admin/chat/leads' },
  { label: 'Care', href: '/admin/chat/care' },
  { label: 'KPIs', href: '/admin/chat/kpis' },
  // CHA-230 Phase 3 — dashboard qualité intent + curator du golden-set.
  { label: 'Qualité', href: '/admin/chat/quality' },
  { label: 'Curator', href: '/admin/chat/intent-curator' },
  { label: 'Analytics', href: '/admin/chat/analytics' },
  { label: 'Instructions', href: '/admin/chat/instructions' },
  { label: 'Sources', href: '/admin/chat/sources' },
  { label: 'FAQ', href: '/admin/chat/faq' },
  { label: 'Suggestions', href: '/admin/chat/suggestions' },
  { label: 'Providers', href: '/admin/chat/providers' },
  { label: 'Themes', href: '/admin/chat/themes' },
  { label: 'Langues', href: '/admin/chat/lang' },
  { label: 'Audit', href: '/admin/chat/audit' },
  { label: 'Système', href: '/admin/chat/system' },
];

describe('ChatAdminNav', () => {
  it('rend les sections attendues, dans l\'ordre, avec les bonnes routes', () => {
    render(<ChatAdminNav active="overview" />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(EXPECTED_LINKS.length);
    EXPECTED_LINKS.forEach((expected, index) => {
      const link = links[index];
      expect(link).not.toBeUndefined();
      expect(link!.textContent).toBe(expected.label);
      expect(link!.getAttribute('href')).toBe(expected.href);
    });
  });

  it('inclut explicitement l\'onglet « Leads chat » pointant vers /admin/chat/leads (CHA-225)', () => {
    render(<ChatAdminNav active="overview" />);
    const leadsTab = screen.getByRole('link', { name: 'Leads chat' });
    expect(leadsTab.getAttribute('href')).toBe('/admin/chat/leads');
  });

  it('marque l\'onglet actif avec aria-current="page" (et seulement celui-là)', () => {
    render(<ChatAdminNav active="leads" />);
    const leadsTab = screen.getByRole('link', { name: 'Leads chat' });
    expect(leadsTab).toHaveAttribute('aria-current', 'page');

    // Un seul onglet doit porter aria-current.
    const currents = screen.getAllByRole('link').filter(
      (l) => l.getAttribute('aria-current') === 'page',
    );
    expect(currents).toHaveLength(1);
  });

  it('marque correctement l\'onglet « Vue d\'ensemble » comme actif', () => {
    render(<ChatAdminNav active="overview" />);
    const overviewTab = screen.getByRole('link', { name: "Vue d'ensemble" });
    expect(overviewTab).toHaveAttribute('aria-current', 'page');
  });

  it('expose un landmark de navigation nommé', () => {
    render(<ChatAdminNav active="conversations" />);
    expect(
      screen.getByRole('navigation', { name: /sections chat/i }),
    ).toBeInTheDocument();
  });

  it('respecte axe (a11y)', async () => {
    const { container } = render(<ChatAdminNav active="leads" />);
    await expectNoAxeViolations(container);
  });
});
