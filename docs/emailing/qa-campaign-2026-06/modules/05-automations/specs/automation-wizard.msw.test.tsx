/**
 * AUT-MSW-130/135/138..143 — AutomationWizard : navigation, validation,
 * grille d'échecs au submit (anti faux-succès, anti double-submit).
 *
 * Le wizard reçoit `onSubmit` (server action createAutomation/updateAutomation).
 * Dans la pyramide du dossier, la couche composant pilote `onSubmit` avec un
 * double qui REPRODUIT les réponses serveur (200/401/422/500/hang) — exactement
 * comme MSW reproduit un endpoint. Le contrat testé : le wizard ne doit JAMAIS
 * naviguer (= faux succès) sur erreur, doit afficher la cause, et ne doit pas
 * double-soumettre pendant un appel en vol.
 *
 * Réf : src/components/admin/emails/automation/AutomationWizard.tsx ; F-051.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutomationWizard } from '@/components/admin/emails/automation/AutomationWizard';
import type { AutomationStep } from '@/lib/mail/automation/step-types-v2';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const STEPS: AutomationStep[] = [
  { kind: 'send', template: 'cart-abandoned', payloadKeys: ['firstName'] },
];

/** Rend le wizard pré-rempli au step Revue (3) avec un onSubmit injecté. */
function renderAtReview(onSubmit: (s: unknown) => Promise<{ id: string } | void>) {
  return render(
    <AutomationWizard
      onSubmit={onSubmit}
      initial={{
        step: 3,
        slug: 'welcome-flow',
        name: 'Bienvenue J+3',
        triggerType: 'event',
        steps: STEPS,
      }}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe('AutomationWizard — validation & navigation', () => {
  it('AUT-MSW-130 : slug invalide bloque le bouton Suivant à l’étape Identité', async () => {
    const user = userEvent.setup();
    render(<AutomationWizard onSubmit={vi.fn()} initial={{ step: 0, slug: '', name: '' }} />);
    // canNext exige slug kebab-case + name non vide -> bouton désactivé.
    const next = screen.getByRole('button', { name: /suivant/i });
    expect(next).toBeDisabled();
    await user.type(screen.getByPlaceholderText(/Bienvenue/i), 'Test');
    await user.type(screen.getByPlaceholderText(/welcome-flow/i), 'welcome-flow');
    expect(screen.getByRole('button', { name: /suivant/i })).toBeEnabled();
  });

  it('AUT-MSW-137 : la revue reflète fidèlement slug/trigger/étapes', () => {
    renderAtReview(vi.fn());
    expect(screen.getByText('welcome-flow')).toBeInTheDocument();
    expect(screen.getByText('event')).toBeInTheDocument();
    expect(screen.getByText(/Étapes \(1\)/)).toBeInTheDocument();
  });
});

describe('AutomationWizard — grille d’échecs au submit', () => {
  it('AUT-MSW-138 : 200 → navigation vers la liste/édition (succès)', async () => {
    const user = userEvent.setup();
    renderAtReview(vi.fn().mockResolvedValue({ id: 'aut_123' }));
    await user.click(screen.getByRole('button', { name: /créer l'automation/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/emails/automation/aut_123/edit'));
  });

  it('AUT-MSW-139 : 401 → message session, AUCUNE navigation (anti faux-succès)', async () => {
    const user = userEvent.setup();
    renderAtReview(vi.fn().mockRejectedValue(new Error('unauthorized: session expirée')));
    await user.click(screen.getByRole('button', { name: /créer l'automation/i }));
    expect(await screen.findByText(/session|autoris/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('AUT-MSW-140 : 422 slug dupliqué → message validation visible, pas de navigation', async () => {
    const user = userEvent.setup();
    renderAtReview(vi.fn().mockRejectedValue(new Error('Slug already used : welcome-flow')));
    await user.click(screen.getByRole('button', { name: /créer l'automation/i }));
    expect(await screen.findByText(/slug already used/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('AUT-MSW-141 : 500 → message d’erreur générique, état conservé, retry possible', async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error('internal server error'))
      .mockResolvedValueOnce({ id: 'aut_retry' });
    renderAtReview(onSubmit);
    const btn = screen.getByRole('button', { name: /créer l'automation/i });
    await user.click(btn);
    expect(await screen.findByText(/internal server error/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    // Le bouton est de nouveau cliquable (submitting remis à false sur erreur).
    await user.click(screen.getByRole('button', { name: /créer l'automation/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/emails/automation/aut_retry/edit'));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('AUT-MSW-142 : hang → loading visible et un seul appel (anti double-submit)', async () => {
    const user = userEvent.setup();
    let resolve!: (v: { id: string }) => void;
    const onSubmit = vi.fn(() => new Promise<{ id: string }>((r) => { resolve = r; }));
    renderAtReview(onSubmit);
    const btn = screen.getByRole('button', { name: /créer l'automation/i });
    await user.click(btn);
    // Pendant l'appel : libellé '...' + bouton désactivé.
    expect(screen.getByRole('button', { name: '...' })).toBeDisabled();
    // Double-clic tenté : ignoré car disabled.
    await user.click(screen.getByRole('button', { name: '...' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolve({ id: 'aut_late' });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it('AUT-MSW-143 : erreur réseau → message réseau, état conservé', async () => {
    const user = userEvent.setup();
    renderAtReview(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await user.click(screen.getByRole('button', { name: /créer l'automation/i }));
    expect(await screen.findByText(/failed to fetch/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
