// @vitest-environment jsdom
/**
 * F03 — sélecteur de fenêtre (DASH-01) : batterie F03-C-001/002/005.
 * (C-003/C-004 — données et hrefs qui suivent la fenêtre — sont au niveau
 * page : dashboard-page.f03.test.tsx, la fenêtre vit dans l'URL.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push, refresh: vi.fn() }),
}));

import { WindowSelector } from '@/components/admin/emails/WindowSelector';

afterEach(() => vi.clearAllMocks());

describe('F03 — WindowSelector', () => {
  it('F03-C-001 — radiogroup : 3 radios, « 7 j » coché par défaut', () => {
    render(<WindowSelector value="7d" />);
    const group = screen.getByRole('radiogroup', { name: /fenêtre/i });
    const radios = screen.getAllByRole('radio');
    expect(group).toBeInTheDocument();
    expect(radios).toHaveLength(3);
    expect(screen.getByRole('radio', { name: '7 j' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '24 h' })).toHaveAttribute('aria-checked', 'false');
  });

  it("F03-C-002 — clic « 30 j » → router.replace('?window=30d') (PAS de push : zéro entrée d'historique)", async () => {
    const user = userEvent.setup();
    render(<WindowSelector value="7d" />);
    await user.click(screen.getByRole('radio', { name: '30 j' }));
    expect(replace).toHaveBeenCalledWith('/admin/emails?window=30d', { scroll: false });
    expect(push).not.toHaveBeenCalled();
  });

  it('F03-C-002b — re-cliquer la fenêtre déjà active ne navigue PAS', async () => {
    const user = userEvent.setup();
    render(<WindowSelector value="7d" />);
    await user.click(screen.getByRole('radio', { name: '7 j' }));
    expect(replace).not.toHaveBeenCalled();
  });

  it('F03-C-005 — flèche droite déplace la sélection au radio suivant', async () => {
    const user = userEvent.setup();
    render(<WindowSelector value="7d" />);
    screen.getByRole('radio', { name: '7 j' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(replace).toHaveBeenCalledWith('/admin/emails?window=30d', { scroll: false });
    expect(screen.getByRole('radio', { name: '30 j' })).toHaveFocus();
  });
});
