/**
 * N01/N02/N04 — <AdminShell/> navigation : inventaire & ordre, onglet actif,
 * a11y + responsive + déconnexion. Cible l'onglet « Coupons » nouvellement ajouté.
 * cf. docs/admin-nav-coupons-qa-2026-06-03/{N01,N02,N04}.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AdminShell } from './AdminShell';
import { expectNoAxeViolations } from '@/test/axe';

/**
 * Ordre canonique attendu des onglets (clé). Coupons inséré avant Audit.
 * NB: les éditeurs /kit (kit-video/composition/pack) ont été déplacés vers
 * /admin/components?group=kit (commit 7ee13de9) → retirés du sidebar.
 */
const EXPECTED_KEYS = [
  'dashboard', 'leads', 'rituals', 'media', 'components', 'i18n', 'seo',
  'legal', 'products', 'content-studio', 'chat', 'emails', 'webhooks',
  'tracking', 'analytics', 'coupons', 'audit', 'settings',
];

function renderShell(active: Parameters<typeof AdminShell>[0]['active'] = 'dashboard') {
  return render(
    <AdminShell adminEmail="op@femiglow.ma" active={active}>
      <p>contenu</p>
    </AdminShell>,
  );
}

describe('N01 AdminShell — inventaire & ordre des onglets', () => {
  it('N01-C001 rend exactement les onglets attendus, dans l’ordre', () => {
    renderShell();
    const nav = screen.getByRole('navigation', { name: /navigation principale/i });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(EXPECTED_KEYS.length);
    const testids = links.map((l) => l.getAttribute('data-testid'));
    expect(testids).toEqual(EXPECTED_KEYS.map((k) => `admin-nav-${k}`));
  });

  it('N01-C002 onglet Coupons présent (testid, libellé, href)', () => {
    renderShell();
    const coupons = screen.getByTestId('admin-nav-coupons');
    expect(coupons).toHaveTextContent('Coupons');
    expect(coupons).toHaveAttribute('href', '/admin/coupons');
  });

  it('N01-C003 Coupons est positionné juste avant Audit', () => {
    renderShell();
    const keys = within(screen.getByRole('navigation', { name: /navigation principale/i }))
      .getAllByRole('link')
      .map((l) => l.getAttribute('data-testid'));
    expect(keys.indexOf('admin-nav-coupons')).toBe(keys.indexOf('admin-nav-audit') - 1);
  });

  it('N01-C004 chaque onglet a un href /admin et un data-testid admin-nav-*', () => {
    renderShell();
    for (const l of within(screen.getByRole('navigation', { name: /navigation principale/i })).getAllByRole('link')) {
      expect(l.getAttribute('data-testid')).toMatch(/^admin-nav-/);
      expect(l.getAttribute('href')).toMatch(/^\/admin/);
    }
  });
});

describe('N02 AdminShell — onglet actif', () => {
  it('N02-C001 active=coupons → l’onglet Coupons porte aria-current=page', () => {
    renderShell('coupons');
    expect(screen.getByTestId('admin-nav-coupons')).toHaveAttribute('aria-current', 'page');
  });

  it('N02-C002 active=coupons → classe active appliquée (bg-stone-900)', () => {
    renderShell('coupons');
    expect(screen.getByTestId('admin-nav-coupons').className).toContain('bg-stone-900');
  });

  it('N02-C003 un seul onglet actif à la fois', () => {
    renderShell('coupons');
    const current = within(screen.getByRole('navigation', { name: /navigation principale/i }))
      .getAllByRole('link')
      .filter((l) => l.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('data-testid', 'admin-nav-coupons');
  });

  it('N02-C004 active=leads → Coupons inactif (pas d’aria-current)', () => {
    renderShell('leads');
    expect(screen.getByTestId('admin-nav-coupons')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('admin-nav-leads')).toHaveAttribute('aria-current', 'page');
  });
});

describe('N04 AdminShell — a11y, responsive, déconnexion', () => {
  it('N04-C001 nav nommée « Navigation principale »', () => {
    renderShell();
    expect(screen.getByRole('navigation', { name: /navigation principale/i })).toBeInTheDocument();
  });

  it('N04-A002 aucune violation axe (onglet Coupons actif)', async () => {
    const { container } = renderShell('coupons');
    await expectNoAxeViolations(container);
  });

  it('N04-C003 déconnexion : form POST vers /api/admin/logout', () => {
    const { container } = renderShell();
    const form = container.querySelector('form[action="/api/admin/logout"]');
    expect(form).not.toBeNull();
    expect(form).toHaveAttribute('method', 'post');
  });

  it('N04-C004 liste responsive (colonne en desktop : classe lg:flex-col)', () => {
    renderShell();
    const list = within(screen.getByRole('navigation', { name: /navigation principale/i })).getAllByRole('listitem')[0]!.parentElement!;
    expect(list.className).toContain('lg:flex-col');
  });
});
