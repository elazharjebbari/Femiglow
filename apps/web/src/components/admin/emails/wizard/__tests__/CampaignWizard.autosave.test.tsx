// @vitest-environment jsdom
/**
 * F05 P3.2-c2 — CÂBLAGE autosave dans CampaignWizard (le god-component).
 *
 * Garantit, sans réseau (timers factices + fireEvent synchrone — user-event +
 * fake timers s'entremêlent mal) :
 *  - CMP-AUTO-001 : la frappe déclenche un saveWizardProgress debounced, portant
 *    le champ + `expectedRev` seedé depuis `initialRev` (optimistic-lock) ;
 *  - CMP-AUTO-002 : le passage d'étape (Suivant) FLUSHE l'autosave immédiatement
 *    avec le nouveau `wizardStep` (reprise) ET conserve le checkpoint validé
 *    updateCampaignDraft (contrat CMP-MSW-003/012 préservé) ;
 *  - CMP-AUTO-003 : un `conflict` affiche la bannière de conflit et FIGE l'autosave ;
 *  - CMP-AUTO-004 : `initialStep` rouvre le wizard à la bonne étape (reprise) ;
 *  - CMP-AUTO-005 : l'indicateur reflète l'état "saved" ;
 *  - CMP-AUTO-006 : un nom < 3 car. est OMIS du patch (jamais d'échec Zod), les
 *    autres champs restant sauvés (sémantique patch partiel U-033).
 *
 * Les server actions sont mockées ; aucune sélection d'audience → aucun fetch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const finalizeCampaign = vi.fn();
const updateCampaignDraft = vi.fn();
const sendCampaignTest = vi.fn();
const saveWizardProgress = vi.fn();
vi.mock('@/lib/admin/emails/wizard-actions', () => ({
  finalizeCampaign: (...a: unknown[]) => finalizeCampaign(...a),
  updateCampaignDraft: (...a: unknown[]) => updateCampaignDraft(...a),
  sendCampaignTest: (...a: unknown[]) => sendCampaignTest(...a),
  saveWizardProgress: (...a: unknown[]) => saveWizardProgress(...a),
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

import { CampaignWizard } from '@/components/admin/emails/wizard/CampaignWizard';

const LISTS = [{ id: 11, name: 'Clientes Casablanca', subscriberCount: 1200, type: 'public', optin: 'single' }];
const TEMPLATES = [{ id: 5, name: 'Rituel printemps', type: 'campaign', subject: 'x' }];

function baseInitial() {
  return {
    name: '',
    subject: '',
    preheader: null,
    audienceLinkIds: [] as number[],
    audienceId: null as string | null,
    listmonkTemplateId: null as number | null,
    scheduledFor: null,
    payloadJson: {} as Record<string, unknown>,
  };
}

function renderWizard(overrides: Partial<Parameters<typeof CampaignWizard>[0]> = {}) {
  return render(
    <CampaignWizard
      draftId="draft-1"
      initial={baseInitial()}
      lists={LISTS as never}
      templates={TEMPLATES as never}
      audiences={[]}
      listmonkError={null}
      {...overrides}
    />,
  );
}

const NAME_PLACEHOLDER = /Bienvenue printemps/i;

/** Saisie synchrone du nom (un seul change → un seul schedule). */
function typeName(value: string) {
  fireEvent.change(screen.getByPlaceholderText(NAME_PLACEHOLDER), { target: { value } });
}

/** Avance le debounce (2 s) en flushant les microtâches du save. */
async function flushDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  finalizeCampaign.mockResolvedValue({ campaignId: 1 });
  updateCampaignDraft.mockResolvedValue(undefined);
  saveWizardProgress.mockResolvedValue({ ok: true, rev: 1, updatedAt: '2026-06-20T10:00:00.000Z' });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('F05 — CampaignWizard autosave (câblage P3.2-c2)', () => {
  it('CMP-AUTO-001 — la frappe déclenche un save debounced (champ + expectedRev=initialRev)', async () => {
    renderWizard({ initialRev: 4 });
    typeName('Promo Aïd');
    expect(saveWizardProgress).not.toHaveBeenCalled(); // pas avant le debounce
    await flushDebounce();
    expect(saveWizardProgress).toHaveBeenCalledTimes(1);
    expect(saveWizardProgress.mock.calls[0]![0]).toMatchObject({
      id: 'draft-1',
      name: 'Promo Aïd',
      wizardStep: 1,
      expectedRev: 4, // optimistic-lock seedé depuis initialRev
    });
  });

  it('CMP-AUTO-002 — Suivant flushe saveWizardProgress(wizardStep=2) ET garde updateCampaignDraft', async () => {
    renderWizard();
    typeName('Campagne reprise');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Suivant/i }));
    });
    // Contrat préservé : le checkpoint validé est bien écrit.
    expect(updateCampaignDraft).toHaveBeenCalled();
    expect(updateCampaignDraft.mock.calls[0]![0]).toMatchObject({ id: 'draft-1', name: 'Campagne reprise' });
    // Flush immédiat (sans avancer le debounce) du nouveau wizard_step.
    expect(saveWizardProgress).toHaveBeenCalled();
    expect(saveWizardProgress.mock.calls.at(-1)![0]).toMatchObject({
      id: 'draft-1',
      wizardStep: 2,
      name: 'Campagne reprise',
    });
    expect(screen.getByText('2. Audience')).toBeInTheDocument();
  });

  it('CMP-AUTO-003 — conflict → bannière de conflit + gel (aucun save ultérieur)', async () => {
    saveWizardProgress.mockResolvedValue({ ok: false, reason: 'conflict' });
    renderWizard();
    typeName('Conflit test');
    await flushDebounce();
    expect(saveWizardProgress).toHaveBeenCalledTimes(1);
    // Bannière de conflit + affordance de rechargement.
    expect(screen.getByTestId('autosave-conflict')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recharger/i })).toBeInTheDocument();
    // Gel : toute frappe ultérieure ne relance PAS de save (jamais d'écrasement).
    typeName('Conflit test suite');
    await flushDebounce();
    expect(saveWizardProgress).toHaveBeenCalledTimes(1);
  });

  it('CMP-AUTO-004 — initialStep rouvre le wizard à la bonne étape (reprise)', () => {
    renderWizard({ initialStep: 4 });
    expect(screen.getByText('4. Sujet & preheader')).toBeInTheDocument();
    expect(screen.queryByText('1. Nom interne')).not.toBeInTheDocument();
  });

  it('CMP-AUTO-005 — l’indicateur passe à "saved" après un enregistrement réussi', async () => {
    renderWizard();
    expect(screen.getByTestId('autosave-status')).toHaveAttribute('data-status', 'idle');
    typeName('Indicateur');
    await flushDebounce();
    const ind = screen.getByTestId('autosave-status');
    expect(ind).toHaveAttribute('data-status', 'saved');
    expect(ind).toHaveTextContent(/Enregistré/i);
  });

  it('CMP-AUTO-006 — un nom < 3 car. est OMIS du patch, les autres champs sont sauvés', async () => {
    renderWizard();
    typeName('ab'); // invalide (< 3)
    await flushDebounce();
    expect(saveWizardProgress).toHaveBeenCalledTimes(1);
    const arg = saveWizardProgress.mock.calls[0]![0];
    expect(arg).not.toHaveProperty('name'); // nom invalide jamais autosauvé
    expect(arg).toMatchObject({ id: 'draft-1', wizardStep: 1 }); // le reste l'est
  });
});
