/**
 * Hardening — LegalWizard : navigation back/forward préserve les saisies,
 * validation re-vérifiée au retour, erreur réseau pendant submit.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/msw/server';
import { LegalWizard } from '../LegalWizard';

const ZONES = [
  { key: 'footer-main', label: 'Footer', isRequired: true },
  { key: 'mobile-menu', label: 'Menu mobile', isRequired: false },
];

const VARS = [
  { key: 'COMPANY_NAME', value: 'FemiGlow', isRequired: true },
];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function advanceToStep(user: ReturnType<typeof userEvent.setup>, target: 1 | 2 | 3 | 4 | 5) {
  if (target === 1) return;
  await user.type(screen.getByPlaceholderText('mentions-legales'), 'cgv');
  await user.type(screen.getAllByRole('textbox')[1]!, 'Conditions de vente');
  if (target >= 2) await user.click(screen.getByRole('button', { name: /Suivant/ }));
  if (target >= 3) await user.click(screen.getByRole('button', { name: /Suivant/ }));
  if (target >= 3) await user.click(screen.getByLabelText(/Footer/));
  if (target >= 4) await user.click(screen.getByRole('button', { name: /Suivant/ }));
  if (target >= 5) await user.click(screen.getByRole('button', { name: /Suivant/ }));
}

describe('Wizard — navigation back/forward', () => {
  it('Précédent préserve l\'état step 1', async () => {
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);

    await user.type(screen.getByPlaceholderText('mentions-legales'), 'mentions');
    await user.type(screen.getAllByRole('textbox')[1]!, 'Mentions légales');
    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    // Step 2 → retour step 1
    await user.click(screen.getByRole('button', { name: /Précédent/ }));

    expect(screen.getByDisplayValue('mentions')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mentions légales')).toBeInTheDocument();
  });

  it('Précédent depuis step 5 préserve le body MD édité', async () => {
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);

    await advanceToStep(user, 2);
    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Contenu personnalisé qui a une longueur suffisante.');

    await user.click(screen.getByRole('button', { name: /Suivant/ })); // → 3
    await user.click(screen.getByLabelText(/Footer/));
    await user.click(screen.getByRole('button', { name: /Suivant/ })); // → 4
    await user.click(screen.getByRole('button', { name: /Suivant/ })); // → 5
    await user.click(screen.getByRole('button', { name: /Précédent/ })); // ← 4
    await user.click(screen.getByRole('button', { name: /Précédent/ })); // ← 3
    await user.click(screen.getByRole('button', { name: /Précédent/ })); // ← 2

    expect(screen.getByDisplayValue(/Contenu personnalisé/)).toBeInTheDocument();
  });

  it('Précédent depuis step 3 préserve les zones cochées', async () => {
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);

    await advanceToStep(user, 3);
    await user.click(screen.getByLabelText(/Menu mobile/));
    await user.click(screen.getByRole('button', { name: /Suivant/ })); // → 4
    await user.click(screen.getByRole('button', { name: /Précédent/ })); // ← 3

    const footerCheckbox = screen.getByLabelText(/Footer/) as HTMLInputElement;
    const mobileCheckbox = screen.getByLabelText(/Menu mobile/) as HTMLInputElement;
    expect(footerCheckbox.checked).toBe(true);
    expect(mobileCheckbox.checked).toBe(true);
  });
});

describe('Wizard — indicator visuel', () => {
  it('a aria-current="step" sur l\'étape courante', async () => {
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    await advanceToStep(user, 3);
    const stepNav = screen.getByLabelText('Étapes du wizard');
    const current = stepNav.querySelector('[aria-current="step"]');
    expect(current?.textContent).toMatch(/Placements/);
  });

  it('affiche le numéro de step (1./2./...) dans le label', () => {
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    expect(screen.getByText(/1\. Identité/)).toBeInTheDocument();
    expect(screen.getByText(/5\. Aperçu/)).toBeInTheDocument();
  });
});

describe('Wizard — soumission errors', () => {
  it('erreur réseau pendant submit → reste sur step 5 avec message', async () => {
    server.use(
      http.post('/api/admin/legal', () => HttpResponse.error()),
    );
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    await advanceToStep(user, 5);
    await user.click(screen.getByRole('button', { name: /Créer la page/ }));

    await waitFor(() => {
      // Step 5 toujours visible
      expect(screen.getByText(/Récapitulatif/)).toBeInTheDocument();
    });
  });

  it('500 puis succès au retry réussit', async () => {
    let calls = 0;
    server.use(
      http.post('/api/admin/legal', () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ error: { code: 'internal_error' } }, { status: 500 });
        }
        return HttpResponse.json({ id: 'lp_x', slug: 'cgv' }, { status: 201 });
      }),
      http.put('/api/admin/legal/placements', () => HttpResponse.json({ ok: true })),
    );
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    await advanceToStep(user, 5);

    await user.click(screen.getByRole('button', { name: /Créer la page/ }));
    await waitFor(() => expect(screen.getByText(/HTTP 500|internal/i)).toBeInTheDocument());

    // Retry
    await user.click(screen.getByRole('button', { name: /Créer la page/ }));
    await waitFor(() => expect(calls).toBe(2));
  });
});

describe('Wizard — slug validation edge', () => {
  it('refuse slug avec espaces, _, et autres', async () => {
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    const slugInput = screen.getByPlaceholderText('mentions-legales');

    for (const bad of ['has space', 'has_underscore', 'has.dot', 'UPPERCASE']) {
      await user.clear(slugInput);
      await user.type(slugInput, bad);
      expect(screen.getByText(/Caractères autorisés/)).toBeInTheDocument();
    }
  });

  it('accepte slug avec uniquement chiffres', async () => {
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    await user.type(screen.getByPlaceholderText('mentions-legales'), '2026');
    expect(screen.queryByText(/Caractères autorisés/)).not.toBeInTheDocument();
  });

  it('refuse description > 200 chars', async () => {
    const user = userEvent.setup();
    render(<LegalWizard zones={ZONES} templateVars={VARS} />);
    // L'input a maxLength=200, donc le navigateur empêche déjà la saisie au-delà.
    // On vérifie que l'attribut maxLength est bien posé.
    const inputs = screen.getAllByRole('textbox');
    const descInput = inputs[2] as HTMLInputElement;
    expect(descInput.maxLength).toBe(200);
  });
});
