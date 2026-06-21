// @vitest-environment jsdom
/**
 * F05 P3.2-c3 — CÂBLAGE de l'assistance dans CampaignWizard (G11).
 *
 *  - CMP-ASSIST-001 : à l'étape Contenu, le menu insère un merge-tag dans le corps ;
 *  - CMP-ASSIST-002 : à l'étape Sujet, le menu insère un merge-tag dans le sujet ;
 *  - CMP-ASSIST-003 : le menu expose l'avertissement honnête sur les tags conditionnels ;
 *  - CMP-ASSIST-004 : à l'étape Planification, un raccourci remplit l'input datetime-local.
 *
 * On ouvre directement la bonne étape via `initialStep` (reprise P3.2-c2) → ni
 * navigation ni sélection d'audience → aucun fetch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { CampaignWizard } from '@/components/admin/emails/wizard/CampaignWizard';

const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function baseInitial() {
  return {
    name: 'Campagne test',
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
      lists={[] as never}
      templates={[] as never}
      audiences={[]}
      listmonkError={null}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  finalizeCampaign.mockResolvedValue({ campaignId: 1 });
  updateCampaignDraft.mockResolvedValue(undefined);
  saveWizardProgress.mockResolvedValue({ ok: true, rev: 1, updatedAt: '2026-06-20T10:00:00.000Z' });
});
afterEach(() => vi.clearAllMocks());

describe('F05 — assistance câblée dans CampaignWizard', () => {
  it('CMP-ASSIST-001 — étape Contenu : insertion d’un merge-tag dans le corps', async () => {
    const user = userEvent.setup();
    renderWizard({ initialStep: 3 });
    const body = screen.getByLabelText('Corps HTML') as HTMLTextAreaElement;
    expect(body.value).not.toContain('{{ .Subscriber.Email }}');
    await user.click(screen.getByRole('button', { name: /Insérer un champ/i }));
    await user.click(screen.getByRole('menuitem', { name: /E-mail du contact/i }));
    expect((screen.getByLabelText('Corps HTML') as HTMLTextAreaElement).value).toContain(
      '{{ .Subscriber.Email }}',
    );
  });

  it('CMP-ASSIST-002 — étape Sujet : insertion d’un merge-tag dans le sujet', async () => {
    const user = userEvent.setup();
    renderWizard({ initialStep: 4 });
    const subject = screen.getByLabelText('Sujet') as HTMLInputElement;
    expect(subject.value).toBe('');
    await user.click(screen.getByRole('button', { name: /Insérer un champ/i }));
    await user.click(screen.getByRole('menuitem', { name: /Nom du contact/i }));
    expect((screen.getByLabelText('Sujet') as HTMLInputElement).value).toContain(
      '{{ .Subscriber.Name }}',
    );
  });

  it('CMP-ASSIST-003 — l’avertissement honnête sur les tags conditionnels est présent', async () => {
    const user = userEvent.setup();
    renderWizard({ initialStep: 3 });
    await user.click(screen.getByRole('button', { name: /Insérer un champ/i }));
    expect(screen.getByText(/souvent vide pour les audiences/i)).toBeInTheDocument();
  });

  it('CMP-ASSIST-004 — étape Planification : un raccourci remplit l’input datetime-local', async () => {
    const user = userEvent.setup();
    renderWizard({ initialStep: 5 });
    await user.click(screen.getByRole('radio', { name: /Planifier/i }));
    const input = screen.getByLabelText('Date et heure d’envoi') as HTMLInputElement;
    expect(input.value).toBe('');
    await user.click(screen.getByRole('button', { name: /Demain 9 h/i }));
    expect(input.value).toMatch(DATETIME_LOCAL);
    expect(new Date(input.value).getTime()).toBeGreaterThan(Date.now());
  });
});
