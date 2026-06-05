// @vitest-environment jsdom
/**
 * VAGUE 4 — CAMPAGNES — CampaignWizard : test-send, confirmation chiffrée,
 * blocage tant que l'estimation est inconnue, combobox d'audience recherchable.
 *
 * Oracles :
 *  - UX4-CAMPAGNES-001 : à l'étape Vérification, le bloc test-send appelle
 *    sendCampaignTest avec l'email saisi ; feedback succès inline (role=status).
 *  - UX4-CAMPAGNES-005 : la case de confirmation affiche le compte chiffré ;
 *    le bouton Envoyer est disabled tant que l'estimation vaut null/'…'.
 *  - UX4-CAMPAGNES-006 : le sélecteur d'audience est un combobox recherchable
 *    (EntityCombobox) ; la liste filtre sur la saisie.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse } from '@/test/msw/server';

// ── Mock des server actions ─────────────────────────────────────────────────
const finalizeCampaign = vi.fn();
const updateCampaignDraft = vi.fn();
const sendCampaignTest = vi.fn();
vi.mock('@/lib/admin/emails/wizard-actions', () => ({
  finalizeCampaign: (...a: unknown[]) => finalizeCampaign(...a),
  updateCampaignDraft: (...a: unknown[]) => updateCampaignDraft(...a),
  sendCampaignTest: (...a: unknown[]) => sendCampaignTest(...a),
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

import { CampaignWizard } from '@/components/admin/emails/wizard/CampaignWizard';

const LISTS = [
  { id: 11, name: 'Clientes Casablanca', subscriberCount: 1200, type: 'public', optin: 'single' },
  { id: 12, name: 'Newsletter générale', subscriberCount: 3400, type: 'public', optin: 'double' },
];
const TEMPLATES = [{ id: 5, name: 'Rituel printemps', type: 'campaign', subject: 'x' }];
const AUDIENCES = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Aïd 2026', slug: 'aid-2026', snapshotCount: 0 },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Ramadan VIP', slug: 'ramadan-vip', snapshotCount: 2 },
];
const AUD_ID = AUDIENCES[0]!.id;

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
      audiences={AUDIENCES}
      listmonkError={null}
      adminEmail="nadia@femiglow-maroc.com"
      {...overrides}
    />,
  );
}

function audienceHandlers(size = 50000) {
  return [
    http.get(`/api/admin/emails/audiences/${AUD_ID}`, () =>
      HttpResponse.json({ rules: { kind: 'all', conditions: [] }, exclusionFlags: {} }),
    ),
    http.post('/api/admin/emails/audiences/preview-size', () =>
      HttpResponse.json({ size, durationMs: 5 }),
    ),
  ];
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

beforeEach(() => {
  finalizeCampaign.mockResolvedValue({ campaignId: 777 });
  updateCampaignDraft.mockResolvedValue(undefined);
  sendCampaignTest.mockResolvedValue({ ok: true, email: 'nadia@femiglow-maroc.com' });
  server.use(...audienceHandlers());
});

const NAME_PLACEHOLDER = /Bienvenue printemps/i;
const SUBJECT_PLACEHOLDER = /Découvre nos rituels/i;

/** Avance jusqu'à l'étape 6 avec l'audience native (size par défaut 50000). */
async function fillUntilStep6(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Aïd 2026 — offre');
  await user.click(screen.getByRole('button', { name: /Suivant/i }));
  await user.click(screen.getAllByRole('radio')[0]!); // 1re audience
  await screen.findByText('50000');
  await user.click(screen.getByRole('button', { name: /Suivant/i }));
  await user.click(screen.getByRole('button', { name: /Suivant/i })); // 3
  await user.type(screen.getByPlaceholderText(SUBJECT_PLACEHOLDER), '✨ Aïd Moubarak — rituel offert');
  await user.click(screen.getByRole('button', { name: /Suivant/i })); // 4
  await user.click(screen.getByRole('button', { name: /Suivant/i })); // 5
  await screen.findByText(/Vérification finale/i);
}

// ── UX4-CAMPAGNES-006 — combobox audience recherchable ──────────────────────
describe('UX4-CAMPAGNES-006 — sélecteur d’audience = combobox recherchable', () => {
  it('UX4-CAMPAGNES-006 : le combobox audience filtre la liste sur la saisie', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Filtre');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));

    // Les 2 audiences sont présentes au départ (2 radios).
    expect(screen.getAllByRole('radio')).toHaveLength(2);

    // Le combobox existe (EntityCombobox) et filtre la liste de radios.
    const combo = screen.getByRole('combobox', { name: /Rechercher une audience/i });
    await user.type(combo, 'Ramadan');
    // « Aïd 2026 » disparaît, « Ramadan VIP » reste → 1 seul radio.
    expect(await screen.findByText('🎯 Ramadan VIP')).toBeInTheDocument();
    expect(screen.queryByText('🎯 Aïd 2026')).not.toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
  });
});

// ── UX4-CAMPAGNES-005 — confirmation chiffrée + garde estimation ────────────
describe('UX4-CAMPAGNES-005 — confirmation chiffrée + blocage estimation', () => {
  it('UX4-CAMPAGNES-005 : la case de confirmation affiche le compte chiffré', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillUntilStep6(user);
    // Le compte chiffré (50000) figure dans la case de confirmation.
    expect(screen.getByTestId('confirm-count')).toHaveTextContent('50000');
    expect(screen.getByText(/Je confirme l’envoi à/i)).toBeInTheDocument();
  });

  it('UX4-CAMPAGNES-005b : Envoyer reste disabled tant que l’estimation vaut « … »', async () => {
    // preview-size qui HANG → audiencePreviewSize reste null → estimation « … ».
    const user = userEvent.setup();
    server.use(
      http.post('/api/admin/emails/audiences/preview-size', async () => {
        await new Promise(() => {}); // ne résout jamais
        return HttpResponse.json({ size: 1 });
      }),
    );
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Estimation lente');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getAllByRole('radio')[0]!);
    // L'estimation reste « … » (jamais un nombre fantôme).
    expect(await screen.findByText('…')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 3
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 4
    await user.type(screen.getByPlaceholderText(SUBJECT_PLACEHOLDER), 'Sujet estimation lente');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 5
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 6
    await screen.findByText(/Vérification finale/i);

    // Bannière de blocage + bouton désactivé MÊME en cochant l'ack.
    expect(screen.getByText(/Estimation des destinataires en cours/i)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    const sendBtn = screen.getByRole('button', { name: /Envoyer maintenant/i });
    expect(sendBtn).toBeDisabled();
    await user.click(sendBtn).catch(() => {});
    expect(finalizeCampaign).not.toHaveBeenCalled();
  });
});

// ── UX4-CAMPAGNES-001 — test-send ───────────────────────────────────────────
describe('UX4-CAMPAGNES-001 — test-send (épreuve)', () => {
  it('UX4-CAMPAGNES-001 : le bloc test-send appelle sendCampaignTest + feedback succès', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillUntilStep6(user);

    // Email prérempli avec l'email admin de session.
    const testInput = screen.getByRole('combobox', { name: /Adresse e-mail du test/i });
    expect(testInput).toHaveValue('nadia@femiglow-maroc.com');

    await user.click(screen.getByRole('button', { name: /Envoyer le test/i }));
    expect(sendCampaignTest).toHaveBeenCalledTimes(1);
    expect(sendCampaignTest.mock.calls[0]![0]).toMatchObject({
      id: 'draft-1',
      email: 'nadia@femiglow-maroc.com',
    });
    // Feedback succès inline (role=status).
    const status = await screen.findByRole('status');
    expect(within(status).getByText(/Épreuve envoyée/i)).toBeInTheDocument();
  });

  it('UX4-CAMPAGNES-001b : échec test-send → feedback erreur (role=alert), pas de blocage envoi', async () => {
    const user = userEvent.setup();
    sendCampaignTest.mockResolvedValueOnce({
      ok: false,
      error: 'Sélectionne un template Listmonk avant d’envoyer une épreuve.',
    });
    renderWizard();
    await fillUntilStep6(user);
    await user.click(screen.getByRole('button', { name: /Envoyer le test/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/template Listmonk/i);
    // L'envoi de masse reste possible (le test est indépendant).
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /Envoyer maintenant/i })).toBeEnabled();
  });
});
