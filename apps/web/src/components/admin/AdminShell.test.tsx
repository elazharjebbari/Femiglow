import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminShell } from './AdminShell';
import { expectNoAxeViolations } from '@/test/axe';

describe('AdminShell', () => {
  it('marque l’entrée active avec aria-current=page', () => {
    render(
      <AdminShell adminEmail="admin@femiglow.ma" active="leads">
        <p>contenu</p>
      </AdminShell>,
    );
    const leadsLink = screen.getByRole('link', { name: /leads/i });
    expect(leadsLink).toHaveAttribute('aria-current', 'page');
  });

  it('expose une nav nommée', () => {
    render(
      <AdminShell adminEmail="admin@femiglow.ma" active="dashboard">
        <p>contenu</p>
      </AdminShell>,
    );
    expect(screen.getByRole('navigation', { name: /navigation principale/i })).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(
      <AdminShell adminEmail="admin@femiglow.ma" active="dashboard">
        <p>contenu</p>
      </AdminShell>,
    );
    await expectNoAxeViolations(container);
  });
});
