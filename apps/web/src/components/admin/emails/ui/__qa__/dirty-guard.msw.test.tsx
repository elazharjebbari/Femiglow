// @vitest-environment jsdom
/**
 * F01 — use-dirty-guard / UnsavedChangesGuard (SOC-F07 / TRV-10) :
 * batterie F01-C-061..064.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

import { UnsavedChangesGuard } from '@/components/admin/emails/ui/use-dirty-guard';

/** Harnais : formulaire sale + lien interne + bouton Enregistrer. */
function Harness({ initialDirty = true }: { initialDirty?: boolean }) {
  const [dirty, setDirty] = useState(initialDirty);
  return (
    <div>
      <a
        href="/admin/emails/campaigns"
        // Filet jsdom : si le guard n'a pas intercepté (cas « propre »), on
        // neutralise la navigation native en phase BUBBLE (le guard, lui,
        // intercepte en CAPTURE — il passe donc toujours avant).
        onClick={(e) => e.preventDefault()}
      >
        Campagnes
      </a>
      <button type="button" onClick={() => setDirty(false)}>
        Enregistrer
      </button>
      <UnsavedChangesGuard isDirty={dirty} />
    </div>
  );
}

function dispatchBeforeUnload(): boolean {
  const e = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
}

afterEach(() => vi.clearAllMocks());

describe('UnsavedChangesGuard', () => {
  it('F01-C-061 — sale : le handler beforeunload est armé (preventDefault)', () => {
    render(<Harness />);
    expect(dispatchBeforeUnload()).toBe(true);
  });

  it('F01-C-062 — sale + clic lien interne : dialog « Modifications non enregistrées », navigation suspendue', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('link', { name: /campagnes/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/modifications non enregistrées/i);
    expect(push).not.toHaveBeenCalled(); // suspendue

    // « Rester » referme sans naviguer…
    await user.click(within(dialog).getByRole('button', { name: /^rester$/i }));
    expect(push).not.toHaveBeenCalled();

    // …« Quitter sans enregistrer » navigue vers le href intercepté.
    await user.click(screen.getByRole('link', { name: /campagnes/i }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: /quitter sans enregistrer/i,
      }),
    );
    expect(push).toHaveBeenCalledWith('/admin/emails/campaigns');
  });

  it('F01-C-063 — désarmé après save : plus d’invite, navigation libre', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    expect(dispatchBeforeUnload()).toBe(false);
    await user.click(screen.getByRole('link', { name: /campagnes/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('F01-C-064 — propre dès le départ : aucun handler, navigation libre', async () => {
    const user = userEvent.setup();
    render(<Harness initialDirty={false} />);
    expect(dispatchBeforeUnload()).toBe(false);
    await user.click(screen.getByRole('link', { name: /campagnes/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
