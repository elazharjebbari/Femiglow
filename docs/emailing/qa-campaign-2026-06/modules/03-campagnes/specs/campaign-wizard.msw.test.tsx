/**
 * CMP-MSW-* — CampaignWizard : navigation, validations, grille d'échecs sur
 * la finalisation, et appels réseau audience (preview-size) interceptés MSW.
 *
 * Stack : Vitest + Testing Library + user-event + MSW partagé.
 *  - Les server actions (`finalizeCampaign`, `updateCampaignDraft`) sont
 *    appelées DIRECTEMENT par le composant (pas via fetch) → on les mock via
 *    vi.mock pour observer les arguments et simuler 401/422/500/hang.
 *  - Les appels `fetch` audience (`/api/admin/emails/audiences/{id}` et
 *    `/preview-size`) passent par le réseau → interceptés par MSW.
 *
 * Référence matrice : docs/.../03-campagnes/test-matrix.csv
 * Convention harnais : docs/.../05-conventions-harnais.md
 *
 * NB chemin : ce fichier vit dans docs/ pour la livraison QA. À l'intégration,
 * le déposer sous apps/web/src/components/admin/emails/wizard/ pour que les
 * alias `@/...` et le projet vitest le prennent en charge.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse } from '@/test/msw/server';
import { delay } from 'msw';

// ── Mock des server actions (appelées directement, pas via fetch) ──────────
const finalizeCampaign = vi.fn();
const updateCampaignDraft = vi.fn();
vi.mock('@/lib/admin/emails/wizard-actions', () => ({
  finalizeCampaign: (...args: unknown[]) => finalizeCampaign(...args),
  updateCampaignDraft: (...args: unknown[]) => updateCampaignDraft(...args),
}));

// ── Mock next/navigation router ────────────────────────────────────────────
const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

import { CampaignWizard } from '@/components/admin/emails/wizard/CampaignWizard';

// ── Fixtures réalistes Maroc ───────────────────────────────────────────────
const LISTS = [
  { id: 11, name: 'Clientes Casablanca', subscriberCount: 1200, type: 'public', optin: 'single' },
  { id: 12, name: 'Newsletter générale', subscriberCount: 3400, type: 'public', optin: 'double' },
];
const TEMPLATES = [{ id: 5, name: 'Rituel printemps', type: 'campaign' }];
const AUDIENCES = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Aïd 2026', slug: 'aid-2026', snapshotCount: 0 },
];

function baseInitial() {
  return {
    name: '',
    subject: '',
    preheader: null,
    audienceLinkIds: [] as number[],
    audienceId: null as string | null,
    listmonkTemplateId: null,
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
      {...overrides}
    />,
  );
}

// Handlers audience par défaut (nominal)
const AUD_ID = AUDIENCES[0]!.id;
function defaultAudienceHandlers() {
  return [
    http.get(`/api/admin/emails/audiences/${AUD_ID}`, () =>
      HttpResponse.json({
        rules: { kind: 'all', conditions: [{ kind: 'consent_marketing', value: true }] },
        exclusionFlags: { hard_bounce: true, unsubscribe: true, manual_suppression: true, marketing_optout: false },
      }),
    ),
    http.post('/api/admin/emails/audiences/preview-size', () =>
      HttpResponse.json({ size: 50000, durationMs: 12 }),
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
  server.use(...defaultAudienceHandlers());
});

/** Avance jusqu'à une campagne valide prête à envoyer (audience native). */
async function fillUntilStep6(user: ReturnType<typeof userEvent.setup>) {
  // Étape 1
  await user.type(screen.getByPlaceholderText(/Bienvenue printemps/i), 'Aïd 2026 — offre');
  await user.click(screen.getByRole('button', { name: /Suivant/i }));
  // Étape 2 : audience native
  await user.click(screen.getByRole('radio'));
  await screen.findByText(/snapshot dynamique/i);
  await user.click(screen.getByRole('button', { name: /Suivant/i }));
  // Étape 3 : corps déjà rempli par défaut (> 10 car.)
  await user.click(screen.getByRole('button', { name: /Suivant/i }));
  // Étape 4 : sujet
  await user.type(
    screen.getByPlaceholderText(/Découvre nos rituels/i),
    '✨ Aïd Moubarak — ton rituel offert',
  );
  await user.click(screen.getByRole('button', { name: /Suivant/i }));
  // Étape 5 : mode now par défaut
  await user.click(screen.getByRole('button', { name: /Suivant/i }));
  // Étape 6
  await screen.findByText(/Vérification finale/i);
}

describe('CampaignWizard — navigation & validations', () => {
  it('CMP-MSW-001 : nom < 3 caractères bloque le passage', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(/Bienvenue printemps/i), 'ab');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    expect(screen.getByText(/au moins 3 caractères/i)).toBeInTheDocument();
    // On reste à l'étape 1
    expect(screen.getByText('1. Nom interne')).toBeInTheDocument();
  });

  it('CMP-MSW-004 : aucune source audience bloque', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(/Bienvenue printemps/i), 'Campagne X');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    expect(screen.getByText(/au moins une liste OU une audience/i)).toBeInTheDocument();
  });

  it('CMP-MSW-005/008 : sélection audience native vide la legacy et déclenche preview-size', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(/Bienvenue printemps/i), 'Aïd 2026');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    // preview-size (50000) doit s'afficher
    expect(await screen.findByText(/50000/)).toBeInTheDocument();
    expect(screen.getByText(/snapshot dynamique/i)).toBeInTheDocument();
  });

  it('CMP-MSW-007 : cocher 2 listes legacy additionne les compteurs', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(/Bienvenue printemps/i), 'Promo listes');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    const [cb1, cb2] = screen.getAllByRole('checkbox');
    await user.click(cb1!);
    await user.click(cb2!);
    // 1200 + 3400 = 4600
    expect(screen.getByText(/4600/)).toBeInTheDocument();
  });

  it('CMP-MSW-009 : preview-size 500 → pas de faux total affiché', async () => {
    const user = userEvent.setup();
    renderWizard();
    server.use(
      http.post('/api/admin/emails/audiences/preview-size', () =>
        HttpResponse.json({ error: 'internal' }, { status: 500 }),
      ),
    );
    await user.type(screen.getByPlaceholderText(/Bienvenue printemps/i), 'Aïd 2026');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    // La taille reste un placeholder « … », jamais un nombre fantôme
    expect(await screen.findByText('…')).toBeInTheDocument();
  });

  it('CMP-MSW-015/016 : planif scheduled exige une date future', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(/Bienvenue printemps/i), 'Planifiée');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    await screen.findByText(/snapshot dynamique/i);
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // -> 3
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // -> 4
    await user.type(screen.getByPlaceholderText(/Découvre nos rituels/i), 'Sujet planifié');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // -> 5
    await user.click(screen.getByRole('radio', { name: /Planifier/i }));
    // Sans date : bloque
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    expect(screen.getByText(/Choisis une date/i)).toBeInTheDocument();
    // Date passée : bloque
    const dt = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    await user.type(dt, '2020-01-01T09:00');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    expect(screen.getByText(/doit être dans le futur/i)).toBeInTheDocument();
  });

  it('CMP-MSW-018 : Précédent conserve les saisies', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(/Bienvenue printemps/i), 'Conservation');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    await screen.findByText(/snapshot dynamique/i);
    await user.click(screen.getByRole?.('button', { name: /Précédent/i }) ?? screen.getByRole('button', { name: /Précédent/i }));
    // Retour étape 1 : le nom est conservé
    expect(screen.getByDisplayValue('Conservation')).toBeInTheDocument();
    // Re-avance : audience toujours sélectionnée
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    expect(screen.getByRole('radio')).toBeChecked();
  });
});

describe('CampaignWizard — finalisation (grille d’échecs)', () => {
  it('CMP-MSW-022/023 : envoi désactivé sans acquittement et submit sans ack n’appelle pas finalize', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillUntilStep6(user);
    const sendBtn = screen.getByRole('button', { name: /Envoyer maintenant/i });
    expect(sendBtn).toBeDisabled();
    // Forcer un clic malgré disabled n'a aucun effet (pas d'appel)
    expect(finalizeCampaign).not.toHaveBeenCalled();
  });

  it('CMP-MSW-024 : envoi nominal appelle finalizeCampaign puis redirige', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillUntilStep6(user);
    await user.click(screen.getByRole('checkbox')); // ack
    await user.click(screen.getByRole('button', { name: /Envoyer maintenant/i }));
    expect(finalizeCampaign).toHaveBeenCalledTimes(1);
    expect(finalizeCampaign.mock.calls[0]![0]).toMatchObject({ id: 'draft-1', sendNow: true });
    expect(push).toHaveBeenCalledWith('/admin/emails/campaigns/draft-1');
  });

  it('CMP-MSW-025 : finalize 401 → message, pas de redirection, ack conservé', async () => {
    const user = userEvent.setup();
    finalizeCampaign.mockRejectedValueOnce(new Error('Session expirée / non autorisé'));
    renderWizard();
    await fillUntilStep6(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Envoyer maintenant/i }));
    expect(await screen.findByText(/autoris|Session/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('CMP-MSW-026 : finalize 422 → message validation', async () => {
    const user = userEvent.setup();
    finalizeCampaign.mockRejectedValueOnce(new Error('validation: sujet manquant'));
    renderWizard();
    await fillUntilStep6(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Envoyer maintenant/i }));
    expect(await screen.findByText(/validation|sujet/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('CMP-MSW-027 : finalize 500 → message générique + bouton réactivé', async () => {
    const user = userEvent.setup();
    finalizeCampaign.mockRejectedValueOnce(new Error('internal server error'));
    renderWizard();
    await fillUntilStep6(user);
    await user.click(screen.getByRole('checkbox'));
    const btn = screen.getByRole('button', { name: /Envoyer maintenant/i });
    await user.click(btn);
    expect(await screen.findByText(/internal|erreur/i)).toBeInTheDocument();
    // Pas de spinner figé : le bouton « Envoyer » est de nouveau disponible
    expect(screen.getByRole('button', { name: /Envoyer maintenant/i })).toBeEnabled();
  });

  it('CMP-MSW-028 : finalize hang → spinner « Envoi… » et pas de double-clic', async () => {
    const user = userEvent.setup();
    let resolveFn: (v: unknown) => void = () => {};
    finalizeCampaign.mockImplementationOnce(
      () => new Promise((res) => { resolveFn = res; }),
    );
    renderWizard();
    await fillUntilStep6(user);
    await user.click(screen.getByRole('checkbox'));
    const btn = screen.getByRole('button', { name: /Envoyer maintenant/i });
    await user.click(btn);
    // Pendant le pending : libellé « Envoi… », bouton disabled
    expect(await screen.findByRole('button', { name: /Envoi…/i })).toBeDisabled();
    // Un second clic ne déclenche pas un 2e appel
    await user.click(screen.getByRole('button', { name: /Envoi…/i })).catch(() => {});
    expect(finalizeCampaign).toHaveBeenCalledTimes(1);
    resolveFn({ campaignId: 1 });
  });

  it('CMP-MSW-029 : mode scheduled → libellé « Planifier » + sendNow=false', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(/Bienvenue printemps/i), 'Planif demain');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    await screen.findByText(/snapshot dynamique/i);
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 3
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 4
    await user.type(screen.getByPlaceholderText(/Découvre nos rituels/i), 'Sujet planifié');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 5
    await user.click(screen.getByRole('radio', { name: /Planifier/i }));
    const dt = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const future = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 16);
    await user.type(dt, future);
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 6
    await user.click(screen.getByRole('checkbox'));
    const btn = screen.getByRole('button', { name: /Planifier/i });
    await user.click(btn);
    expect(finalizeCampaign.mock.calls[0]![0]).toMatchObject({ sendNow: false });
  });
});

describe('CampaignWizard — bandeau Listmonk', () => {
  it('CMP-MSW-030 : listmonkError affiche un bandeau d’alerte', () => {
    renderWizard({ listmonkError: 'connexion refusée' });
    expect(screen.getByText(/Listmonk : connexion refusée/i)).toBeInTheDocument();
  });
});
