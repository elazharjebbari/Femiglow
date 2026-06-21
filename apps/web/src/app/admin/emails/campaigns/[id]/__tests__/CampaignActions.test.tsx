// @vitest-environment jsdom
/**
 * F05 P3.3-d — CampaignActions : confirmation socle (ConfirmDialog) + actions
 * directes, après migration depuis window.confirm.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const pauseCampaign = vi.fn();
const resumeCampaign = vi.fn();
const cancelCampaign = vi.fn();
const refreshCampaignMetrics = vi.fn();
const discardCampaign = vi.fn();
vi.mock('@/lib/admin/emails/wizard-actions', () => ({
  pauseCampaign: (...a: unknown[]) => pauseCampaign(...a),
  resumeCampaign: (...a: unknown[]) => resumeCampaign(...a),
  cancelCampaign: (...a: unknown[]) => cancelCampaign(...a),
  refreshCampaignMetrics: (...a: unknown[]) => refreshCampaignMetrics(...a),
  discardCampaign: (...a: unknown[]) => discardCampaign(...a),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { CampaignActions } from '@/app/admin/emails/campaigns/[id]/CampaignActions';

const ALL_CAPS = { canPause: true, canResume: true, canCancel: true, canDiscard: true };

function renderActions(caps: Partial<typeof ALL_CAPS> = {}) {
  return render(
    <CampaignActions id="camp-1" name="Aïd 2026" caps={{ ...ALL_CAPS, ...caps }} />,
  );
}

beforeEach(() => {
  pauseCampaign.mockResolvedValue(undefined);
  resumeCampaign.mockResolvedValue(undefined);
  cancelCampaign.mockResolvedValue(undefined);
  refreshCampaignMetrics.mockResolvedValue(undefined);
  discardCampaign.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe('F05 — CampaignActions (socle v2)', () => {
  it('CMP-ACT-001 — n’affiche que les actions autorisées par les caps', () => {
    renderActions({ canPause: false, canResume: false, canCancel: false, canDiscard: false });
    expect(screen.getByRole('button', { name: /Rafraîchir/i })).toBeInTheDocument(); // toujours
    expect(screen.queryByRole('button', { name: /Mettre la campagne en pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Annuler définitivement/i })).not.toBeInTheDocument();
  });

  it('CMP-ACT-002 — « Annuler l’envoi » OUVRE un ConfirmDialog (n’appelle pas l’action tout de suite)', async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('button', { name: /Annuler définitivement/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(cancelCampaign).not.toHaveBeenCalled(); // confirmation requise
  });

  it('CMP-ACT-003 — confirmer le dialog appelle cancelCampaign', async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('button', { name: /Annuler définitivement/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Annuler l.envoi/i }));
    expect(cancelCampaign).toHaveBeenCalledTimes(1);
  });

  it('CMP-ACT-004 — « Revenir » ferme le dialog SANS appeler l’action', async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('button', { name: /Annuler définitivement/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Revenir/i }));
    expect(cancelCampaign).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('CMP-ACT-005 — « Rafraîchir » appelle l’action directement (pas de dialog)', async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('button', { name: /Rafraîchir/i }));
    expect(refreshCampaignMetrics).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('CMP-ACT-006 — « Mettre en pause » appelle pauseCampaign directement', async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('button', { name: /Mettre la campagne en pause/i }));
    expect(pauseCampaign).toHaveBeenCalledTimes(1);
  });

  it('CMP-ACT-007 — « Supprimer » OUVRE un ConfirmDialog de suppression', async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('button', { name: /Supprimer le brouillon/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /Supprimer le brouillon/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^Supprimer$/ })).toBeInTheDocument();
  });
});
