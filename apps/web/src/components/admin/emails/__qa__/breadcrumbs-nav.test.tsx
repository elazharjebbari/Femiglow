// @vitest-environment jsdom
/**
 * F02 — breadcrumbs (NAV-F03) + palette enrichie (NAV-F05) :
 * batterie F02-C-019..030.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => '/admin/emails',
}));

import { Breadcrumb } from '@/components/admin/emails/common/Breadcrumb';
import { emailsBreadcrumb, entityLabel } from '@/components/admin/emails/common/breadcrumbs';
import { GlobalCommandPalette } from '@/components/admin/emails/GlobalCommandPalette';

afterEach(() => vi.clearAllMocks());

/* ── Breadcrumb : mapping spec §4 ─────────────────────────────────────────── */
describe('emailsBreadcrumb — mapping route → segments', () => {
  function renderBc(segments: ReturnType<typeof emailsBreadcrumb>) {
    render(<Breadcrumb segments={segments} />);
    return screen.getByRole('navigation', { name: /fil d'ariane/i });
  }

  it('F02-C-019 — dashboard : « Emails » seul, page courante', () => {
    const nav = renderBc(emailsBreadcrumb());
    const current = within(nav).getByText('Emails');
    expect(current.closest('[aria-current="page"]')).not.toBeNull();
    expect(within(nav).queryByRole('link')).not.toBeInTheDocument();
  });

  it('F02-C-020 — liste : Emails (lien) › Transactionnel (courant)', () => {
    const nav = renderBc(emailsBreadcrumb('transactional'));
    expect(within(nav).getByRole('link', { name: 'Emails' })).toHaveAttribute(
      'href',
      '/admin/emails',
    );
    expect(within(nav).getByText('Transactionnel').closest('[aria-current="page"]')).not.toBeNull();
  });

  it('F02-C-021 — détail : 2 liens (Emails, Campagnes) + objet courant', () => {
    const nav = renderBc(emailsBreadcrumb('campaigns', 'Été 2026'));
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Emails', 'Campagnes']);
    expect(within(nav).getByText('Été 2026').closest('[aria-current="page"]')).not.toBeNull();
  });

  it('F02-C-022 — édition : 4 segments, « Édition » courant', () => {
    const nav = renderBc(
      emailsBreadcrumb(
        'campaigns',
        { label: 'Été 2026', href: '/admin/emails/campaigns/42' },
        'Édition',
      ),
    );
    expect(within(nav).getAllByRole('link')).toHaveLength(3); // Emails, Campagnes, Été 2026
    expect(within(nav).getByText('Édition').closest('[aria-current="page"]')).not.toBeNull();
  });

  it('F02-C-023 — runs détail : Emails › Automations › Runs › Run <id>', () => {
    const nav = renderBc(
      emailsBreadcrumb(
        'automation',
        { label: 'Runs', href: '/admin/emails/automation/runs' },
        entityLabel(null, '3a4b5c6d7e8f', 'Run'),
      ),
    );
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Emails',
      'Automations',
      'Runs',
    ]);
    expect(within(nav).getByText('Run 3a4b5c6d…').closest('[aria-current="page"]')).not.toBeNull();
  });

  it('F02-A-002 — axe : 0 violation sur un breadcrumb de détail', async () => {
    const { expectNoAxeViolations } = await import('@/test/axe');
    const { container } = render(
      <Breadcrumb segments={emailsBreadcrumb('campaigns', 'Été 2026')} />,
    );
    await expectNoAxeViolations(container);
  });

  it('F02-U — entityLabel : jamais de segment vide (fallback id tronqué)', () => {
    expect(entityLabel('  ', 'abcdef123456')).toBe('abcdef12…');
    expect(entityLabel('Été 2026', 'x')).toBe('Été 2026');
    expect(entityLabel(undefined, 'abcdef123456', 'Run')).toBe('Run abcdef12…');
  });
});

/* ── Palette enrichie ─────────────────────────────────────────────────────── */
describe('GlobalCommandPalette — F02', () => {
  async function openPalette() {
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    return screen.findByRole('dialog');
  }

  it('F02-C-029 — Ctrl-K ouvre la palette (non-mac)', async () => {
    render(<GlobalCommandPalette />);
    expect(await openPalette()).toBeInTheDocument();
  });

  it('F02-C-024/025 — « suppr » trouve Suppression ; sélection navigue', async () => {
    const user = userEvent.setup();
    render(<GlobalCommandPalette />);
    await openPalette();
    await user.type(screen.getByRole('textbox', { name: /recherche commandes/i }), 'suppr');

    const option = await screen.findByText(/liste de suppression/i);
    await user.click(option);
    expect(push).toHaveBeenCalledWith('/admin/emails/suppression');
  });

  it('F02-C-027 — les 9 sections présentes en Navigation (dont Suppression, Events, Listmonk)', async () => {
    render(<GlobalCommandPalette />);
    const dialog = await openPalette();
    for (const label of [
      /dashboard emails/i,
      /emails transactionnels/i,
      /^campagnes$/i,
      /automatisations/i,
      /^audiences$/i,
      /templates html/i,
      /liste de suppression/i,
      /events \(debug\)/i,
      /listmonk \(admin natif\)/i,
    ]) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    // + l'entrée Runs automations (spec F02)
    expect(within(dialog).getByText(/runs automations/i)).toBeInTheDocument();
  });

  it('F02-C-026 — placeholder mentionne Cmd-K ET Ctrl-K', async () => {
    render(<GlobalCommandPalette />);
    await openPalette();
    expect(screen.getByRole('textbox', { name: /recherche commandes/i })).toHaveAttribute(
      'placeholder',
      expect.stringMatching(/Cmd-K.*Ctrl-K/),
    );
  });

  it('F02-C-030 — Esc ferme la palette', async () => {
    const user = userEvent.setup();
    render(<GlobalCommandPalette />);
    await openPalette();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
