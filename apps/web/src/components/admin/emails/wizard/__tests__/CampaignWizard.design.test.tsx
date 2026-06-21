// @vitest-environment jsdom
/**
 * F05 P3.2-c4 — DESIGN (layer D) : adoption des primitives socle dans le wizard.
 *
 * Garde anti-régression complétant le verrou couleur (qui prouve l'absence de
 * couleur brute) : ici on prouve que les actions/bandeaux passent bien par
 * Button (data-variant) et Banner (data-tone), pas par des `<button>`/`<p>` nus.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/admin/emails/wizard-actions', () => ({
  finalizeCampaign: vi.fn(),
  updateCampaignDraft: vi.fn().mockResolvedValue(undefined),
  sendCampaignTest: vi.fn(),
  saveWizardProgress: vi.fn().mockResolvedValue({ ok: true, rev: 1, updatedAt: '2026-06-20T10:00:00.000Z' }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { CampaignWizard } from '@/components/admin/emails/wizard/CampaignWizard';

function renderWizard(overrides: Partial<Parameters<typeof CampaignWizard>[0]> = {}) {
  return render(
    <CampaignWizard
      draftId="draft-1"
      initial={{
        name: '',
        subject: '',
        preheader: null,
        audienceLinkIds: [],
        audienceId: null,
        listmonkTemplateId: null,
        scheduledFor: null,
        payloadJson: {},
      }}
      lists={[] as never}
      templates={[] as never}
      audiences={[]}
      listmonkError={null}
      {...overrides}
    />,
  );
}

afterEach(() => vi.clearAllMocks());

describe('F05 — CampaignWizard design (primitives socle)', () => {
  it('CMP-DESIGN-001 — le footer utilise des Button socle (data-variant)', () => {
    renderWizard();
    expect(screen.getByRole('button', { name: /Précédent/i })).toHaveAttribute('data-variant', 'secondary');
    expect(screen.getByRole('button', { name: /Suivant/i })).toHaveAttribute('data-variant', 'primary');
  });

  it('CMP-DESIGN-002 — les erreurs s’affichent via Banner socle (data-tone=danger)', () => {
    renderWizard();
    fireEvent.change(screen.getByPlaceholderText(/Bienvenue printemps/i), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: /Suivant/i }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-tone', 'danger');
    expect(alert).toHaveTextContent(/au moins 3 caractères/i);
  });

  it('CMP-DESIGN-003 — le bandeau Listmonk passe par Banner (data-tone=warning)', () => {
    renderWizard({ listmonkError: 'connexion refusée' });
    const banner = screen.getByText(/Listmonk : connexion refusée/i).closest('[data-tone]');
    expect(banner).toHaveAttribute('data-tone', 'warning');
  });
});
