import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GtmTemplatePicker } from './GtmTemplatePicker';

describe('GtmTemplatePicker', () => {
  it('affiche le bouton "Partir d’un template"', () => {
    render(<GtmTemplatePicker onPick={() => {}} />);
    expect(screen.getByRole('button', { name: /partir d.un template/i })).toBeInTheDocument();
  });

  it('ouvre la modale au clic et liste les 4 templates', async () => {
    const user = userEvent.setup();
    render(<GtmTemplatePicker onPick={() => {}} />);
    await user.click(screen.getByRole('button', { name: /partir d.un template/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Les 4 templates sont des boutons aria-pressed
    const cards = screen.getAllByRole('button', { pressed: false });
    // au moins 4 cartes templates + bouton fermer/appliquer
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  it('appelle onPick avec le perEnv du template sélectionné', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<GtmTemplatePicker onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: /partir d.un template/i }));

    // Sélectionner le template Sandbox
    await user.click(screen.getByRole('button', { name: /sandbox/i }));
    // Cliquer Appliquer
    await user.click(screen.getByRole('button', { name: /appliquer le template/i }));

    expect(onPick).toHaveBeenCalledTimes(1);
    const arg = onPick.mock.calls[0]![0];
    expect(arg.production.enabledProviders).toEqual([]);
  });

  it('le bouton Appliquer est désactivé tant qu\'aucun template n\'est sélectionné', async () => {
    const user = userEvent.setup();
    render(<GtmTemplatePicker onPick={() => {}} />);
    await user.click(screen.getByRole('button', { name: /partir d.un template/i }));
    expect(
      screen.getByRole('button', { name: /appliquer le template/i }),
    ).toBeDisabled();
  });
});
