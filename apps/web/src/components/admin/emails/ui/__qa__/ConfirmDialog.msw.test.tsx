// @vitest-environment jsdom
/**
 * F01 — ConfirmDialog (SOC-F01 / TRV-01) : batterie F01-C-001..014 + F01-A-015.
 * Réf : technique/fonctionnalites/F01-socle-feedback/{02-spec,03-batterie}.
 *
 * Harnais = consommateur CANONIQUE : un bouton déclencheur ouvre le dialog,
 * onConfirm exécute la mutation (MSW) puis ferme ; un rejet laisse le dialog
 * ouvert. C'est exactement le contrat que les écrans adopteront en P1.5+.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse, delay } from '@/test/msw/server';
import { expectNoAxeViolations } from '@/test/axe';

import { ConfirmDialog } from '@/components/admin/emails/ui/ConfirmDialog';

const ACTION = '/api/admin/emails/transactional/bulk-suppress';

/** Compteur de requêtes partagé, remis à zéro par test. */
let posts: Array<unknown> = [];
function armAction(status = 200, hang = false) {
  server.use(
    http.post(ACTION, async ({ request }) => {
      posts.push(await request.json().catch(() => null));
      if (hang) await delay('infinite');
      if (status !== 200) return HttpResponse.json({ error: 'x' }, { status });
      return HttpResponse.json({ suppressed: 3, skipped: 0 });
    }),
  );
}

/** Harnais canonique : déclencheur + dialog contrôlé + mutation réseau. */
function Harness({
  requireText,
  busyLabel,
}: {
  requireText?: string;
  busyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        ⊘ Marquer en suppression
      </button>
      <ConfirmDialog
        open={open}
        title="Bloquer 3 adresses ?"
        body={
          <p>
            3 destinataires distincts seront retirés de tous les envois. Cette
            action est irréversible depuis cet écran.
          </p>
        }
        confirmLabel="Supprimer"
        busyLabel={busyLabel}
        variant="danger"
        requireText={requireText}
        onConfirm={async () => {
          const res = await fetch(ACTION, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ids: ['a', 'b', 'c'] }),
          });
          if (!res.ok) throw new Error(`Échec (HTTP ${res.status}). Réessaie.`);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /marquer en suppression/i }));
  return screen.findByRole('dialog');
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  posts = [];
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('ConfirmDialog — ouverture, focus, fermetures sans agir', () => {
  it('F01-C-001 — ouverture : role=dialog aria-modal=true + titre lu', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('Bloquer 3 adresses ?')).toBeInTheDocument();
  });

  it('F01-C-002 — focus initial sur Annuler', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    const cancel = within(dialog).getByRole('button', { name: /^annuler$/i });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
  });

  it('F01-C-003 — Échap ferme sans agir (aucun POST)', async () => {
    armAction();
    const user = userEvent.setup();
    render(<Harness />);
    await openDialog(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('F01-C-004 — clic backdrop ferme sans agir', async () => {
    armAction();
    const user = userEvent.setup();
    render(<Harness />);
    await openDialog(user);
    await user.click(screen.getByTestId('confirm-dialog-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('F01-C-013 — le focus revient au déclencheur après Annuler', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /^annuler$/i }));
    const trigger = screen.getByRole('button', { name: /marquer en suppression/i });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('F01-C-014 — focus piégé : Tab reboucle dans le dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    // 6 tabulations : quel que soit le cycle, le focus reste DANS le dialog.
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});

describe('ConfirmDialog — sémantique danger + conséquences', () => {
  it('F01-C-005 — bouton = verbe (« Supprimer », jamais « OK ») + tone danger', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    const confirm = within(dialog).getByRole('button', { name: /^supprimer$/i });
    expect(confirm).toHaveAttribute('data-tone', 'danger');
    expect(within(dialog).queryByRole('button', { name: /^ok$/i })).not.toBeInTheDocument();
  });

  it('F01-C-006 — conséquences explicites dans le corps', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    expect(dialog).toHaveTextContent(/3 destinataires distincts seront retirés/i);
    expect(dialog).toHaveTextContent(/irréversible/i);
  });
});

describe('ConfirmDialog — saisie de confirmation (massif)', () => {
  it('F01-C-007 — requireText : bouton désactivé tant que la saisie ≠ SUPPRIMER', async () => {
    const user = userEvent.setup();
    render(<Harness requireText="SUPPRIMER" />);
    const dialog = await openDialog(user);
    const confirm = within(dialog).getByRole('button', { name: /^supprimer$/i });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox'), 'SUPPRIM');
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox'), 'ER');
    expect(confirm).toBeEnabled();
  });

  it('F01-C-008 — saisie insensible casse/espaces («  supprimer  » active)', async () => {
    const user = userEvent.setup();
    render(<Harness requireText="SUPPRIMER" />);
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByRole('textbox'), '  supprimer  ');
    expect(within(dialog).getByRole('button', { name: /^supprimer$/i })).toBeEnabled();
  });
});

describe('ConfirmDialog — exécution de l’action (grille réseau)', () => {
  it('F01-C-009 — confirmation : un POST et UN SEUL, puis fermeture', async () => {
    armAction();
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /^supprimer$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(posts).toHaveLength(1);
    expect(posts[0]).toEqual({ ids: ['a', 'b', 'c'] });
  });

  it('F01-C-010 — double-Enter ne soumet pas deux fois', async () => {
    armAction(200, true); // hang : la 1re soumission reste en vol
    const user = userEvent.setup();
    render(<Harness />);
    await openDialog(user);
    // Le focus initial est sur Annuler (où Enter garde son sens naturel
    // d'annulation — dérogation sécurité) : on se place sur Supprimer.
    await user.tab();
    await user.keyboard('{Enter}{Enter}');
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts).toHaveLength(1);
  });

  it('F01-C-011 — busy pendant le hang : « Suppression… », désactivé, aria-busy', async () => {
    armAction(200, true);
    const user = userEvent.setup();
    render(<Harness busyLabel="Suppression…" />);
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /^supprimer$/i }));
    const busy = await within(dialog).findByRole('button', { name: /suppression…/i });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
  });

  it('F01-C-012 — 500 : dialog OUVERT, role=alert, saisie préservée', async () => {
    armAction(500);
    const user = userEvent.setup();
    render(<Harness requireText="SUPPRIMER" />);
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByRole('textbox'), 'SUPPRIMER');
    await user.click(within(dialog).getByRole('button', { name: /^supprimer$/i }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/échec/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument(); // resté ouvert
    expect(within(dialog).getByRole('textbox')).toHaveValue('SUPPRIMER'); // saisie conservée
  });
});

describe('ConfirmDialog — a11y', () => {
  it('F01-A-015 — axe : 0 violation serious/critical sur le dialog ouvert', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness requireText="SUPPRIMER" />);
    await openDialog(user);
    await expectNoAxeViolations(container);
  });
});
