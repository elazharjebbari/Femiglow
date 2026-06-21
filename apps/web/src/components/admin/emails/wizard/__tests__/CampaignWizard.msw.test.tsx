// @vitest-environment jsdom
/**
 * Module 03 — CampaignWizard : navigation, validations étape par étape, grille
 * d'échecs sur la finalisation (200/401/422/500/hang), et appels réseau audience
 * (preview-size) interceptés MSW.
 *
 * Stack : Vitest + Testing Library + user-event + MSW partagé (@/test/msw/server).
 *  - Les server actions (`finalizeCampaign`, `updateCampaignDraft`) sont appelées
 *    DIRECTEMENT par le composant → mock via vi.mock pour observer les args et
 *    simuler les rejets (l'action server lève une Error côté client).
 *  - Les `fetch` audience (`/api/admin/emails/audiences/{id}` + `/preview-size`)
 *    passent par le réseau → interceptés MSW.
 *
 * Couvre : CMP-MSW-001..030, CMP-UNIT-031/032 (validations via le composant).
 * Réf matrice : docs/emailing/qa-campaign-2026-06/modules/03-campagnes/test-matrix.csv
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse } from '@/test/msw/server';

// ── Mock des server actions (appelées directement, pas via fetch) ──────────
const finalizeCampaign = vi.fn();
const updateCampaignDraft = vi.fn();
// saveWizardProgress = autosave debounced/flush (P3.2-c). Mocké pour compléter
// la surface réelle du composant ; ces tests n'observent QUE updateCampaignDraft
// (checkpoint d'étape) — couverture autosave : CampaignWizard.autosave.test.tsx.
const saveWizardProgress = vi.fn();
vi.mock('@/lib/admin/emails/wizard-actions', () => ({
  finalizeCampaign: (...args: unknown[]) => finalizeCampaign(...args),
  updateCampaignDraft: (...args: unknown[]) => updateCampaignDraft(...args),
  saveWizardProgress: (...args: unknown[]) => saveWizardProgress(...args),
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
const TEMPLATES = [{ id: 5, name: 'Rituel printemps', type: 'campaign', subject: 'x' }];
const AUDIENCES = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Aïd 2026', slug: 'aid-2026', snapshotCount: 0 },
];
const AUD_ID = AUDIENCES[0]!.id;

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
  saveWizardProgress.mockResolvedValue({ ok: true, rev: 1, updatedAt: '2026-06-20T10:00:00.000Z' });
  server.use(...defaultAudienceHandlers());
});

const NAME_PLACEHOLDER = /Bienvenue printemps/i;
const SUBJECT_PLACEHOLDER = /Découvre nos rituels/i;

/** Avance jusqu'à l'étape 6 (audience native, mode now). */
async function fillUntilStep6(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Aïd 2026 — offre');
  await user.click(screen.getByRole('button', { name: /Suivant/i }));
  // Étape 2 : audience native (un seul radio à ce stade)
  await user.click(screen.getByRole('radio'));
  await screen.findByText('50000');
  await user.click(screen.getByRole('button', { name: /Suivant/i }));
  // Étape 3 : corps par défaut (> 10 car.)
  await user.click(screen.getByRole('button', { name: /Suivant/i }));
  // Étape 4 : sujet
  await user.type(screen.getByPlaceholderText(SUBJECT_PLACEHOLDER), '✨ Aïd Moubarak — ton rituel offert');
  await user.click(screen.getByRole('button', { name: /Suivant/i }));
  // Étape 5 : mode now par défaut
  await user.click(screen.getByRole('button', { name: /Suivant/i }));
  await screen.findByText(/Vérification finale/i);
}

describe('CampaignWizard — navigation & validations', () => {
  it('CMP-MSW-001 : nom < 3 caractères bloque le passage', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'ab');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    expect(screen.getByText(/au moins 3 caractères/i)).toBeInTheDocument();
    expect(screen.getByText('1. Nom interne')).toBeInTheDocument(); // reste étape 1
  });

  it('CMP-MSW-002 : nom de 3 caractères autorise Suivant', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Aïd');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    expect(await screen.findByText('2. Audience')).toBeInTheDocument();
  });

  it('CMP-MSW-003 : persistDraft appelé au passage d\'étape avec name correct', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Campagne persistée');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    // updateCampaignDraft reçoit l'id du draft + le name saisi.
    expect(updateCampaignDraft).toHaveBeenCalled();
    expect(updateCampaignDraft.mock.calls[0]![0]).toMatchObject({
      id: 'draft-1',
      name: 'Campagne persistée',
    });
  });

  it('CMP-MSW-004 : aucune source audience bloque', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Campagne X');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    expect(screen.getByText(/au moins une liste OU une audience/i)).toBeInTheDocument();
    expect(screen.getByText('2. Audience')).toBeInTheDocument(); // reste étape 2
  });

  it('CMP-MSW-005/008 : audience native vide la legacy et déclenche preview-size', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Aïd 2026');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    // coche d'abord une liste legacy…
    const legacyCb = screen.getAllByRole('checkbox')[0]!;
    await user.click(legacyCb);
    expect(legacyCb).toBeChecked();
    // …puis sélectionne l'audience native → la liste legacy est décochée
    await user.click(screen.getByRole('radio'));
    expect(legacyCb).not.toBeChecked();
    // preview-size (50000) doit s'afficher + mention snapshot dynamique
    expect(await screen.findByText('50000')).toBeInTheDocument();
    expect(screen.getAllByText(/snapshot dynamique/i).length).toBeGreaterThanOrEqual(1);
  });

  it('CMP-MSW-006 : sélection liste legacy vide l\'audience native', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Mixte');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    // audience native d'abord
    await user.click(screen.getByRole('radio'));
    await screen.findByText('50000');
    expect(screen.getByRole('radio')).toBeChecked();
    // puis liste legacy → radio audience décoché
    await user.click(screen.getAllByRole('checkbox')[0]!);
    expect(screen.getByRole('radio')).not.toBeChecked();
    expect(screen.getAllByRole('checkbox')[0]!).toBeChecked();
  });

  it('CMP-MSW-007 : cocher 2 listes legacy additionne les compteurs estimés', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Promo listes');
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
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Aïd 2026');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    // La taille reste un placeholder « … », jamais un nombre fantôme.
    expect(await screen.findByText('…')).toBeInTheDocument();
    expect(screen.queryByText(/50000/)).not.toBeInTheDocument();
  });

  it('CMP-MSW-010 : GET audience 401 → preview non lancé, pas de faux total', async () => {
    const user = userEvent.setup();
    renderWizard();
    let previewCalled = false;
    server.use(
      http.get(`/api/admin/emails/audiences/${AUD_ID}`, () =>
        new HttpResponse('Unauthorized', { status: 401 }),
      ),
      http.post('/api/admin/emails/audiences/preview-size', () => {
        previewCalled = true;
        return HttpResponse.json({ size: 99999 });
      }),
    );
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Aïd 2026');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    // Sélection conservée, aucune valeur numérique fantôme.
    expect(screen.getByRole('radio')).toBeChecked();
    expect(await screen.findByText('…')).toBeInTheDocument();
    expect(previewCalled).toBe(false);
    expect(screen.queryByText(/99999/)).not.toBeInTheDocument();
  });

  it('CMP-MSW-011 : corps < 10 caractères bloque l\'étape 3', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Corps court');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    await screen.findByText('50000');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // -> 3
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, 'court');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    expect(screen.getByText(/corps du mail est trop court/i)).toBeInTheDocument();
    expect(screen.getByText('3. Contenu')).toBeInTheDocument();
  });

  it('CMP-MSW-012 : sélection template Listmonk persiste templateId', async () => {
    // UX-CAMP-007 — le <select> natif est devenu un EntityCombobox recherchable.
    // On sélectionne via la liste d'options (la valeur = nom du template, l'id
    // réel est résolu en interne et persisté).
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Avec template');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    await screen.findByText('50000');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // -> 3
    const tplInput = screen.getByRole('combobox', { name: /Template Listmonk/i });
    await user.type(tplInput, 'Rituel');
    const option = await screen.findByRole('option', { name: /Rituel printemps/i });
    await user.click(option);
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // -> 4 (persist)
    const lastCall = updateCampaignDraft.mock.calls.at(-1)![0];
    expect(lastCall).toMatchObject({ listmonkTemplateId: 5 });
  });

  it('CMP-MSW-013 : sujet < 3 caractères bloque l\'étape 4', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Sujet court');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    await screen.findByText('50000');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 3
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 4
    await user.type(screen.getByPlaceholderText(SUBJECT_PLACEHOLDER), 'ab');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    expect(screen.getByText(/sujet doit faire au moins 3 caractères/i)).toBeInTheDocument();
    expect(screen.getByText('4. Sujet & preheader')).toBeInTheDocument();
  });

  it('CMP-MSW-014 : compteur de caractères sujet exact', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Compteur');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    await screen.findByText('50000');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 3
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 4
    await user.type(screen.getByPlaceholderText(SUBJECT_PLACEHOLDER), 'Bonjour');
    expect(screen.getByText('7/140')).toBeInTheDocument();
  });

  it('CMP-MSW-015/016 : planif scheduled exige une date future', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Planifiée');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    await screen.findByText('50000');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 3
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 4
    await user.type(screen.getByPlaceholderText(SUBJECT_PLACEHOLDER), 'Sujet planifié');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 5
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

  it('CMP-MSW-017 : date future autorise l\'étape 6', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Planif OK');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    await screen.findByText('50000');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 3
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 4
    await user.type(screen.getByPlaceholderText(SUBJECT_PLACEHOLDER), 'Sujet planifié');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 5
    await user.click(screen.getByRole('radio', { name: /Planifier/i }));
    const dt = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16);
    await user.type(dt, future);
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    expect(await screen.findByText(/Vérification finale/i)).toBeInTheDocument();
  });

  it('CMP-MSW-018 : Précédent conserve les saisies', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Conservation');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    await screen.findByText('50000');
    await user.click(screen.getByRole('button', { name: /Précédent/i }));
    // Retour étape 1 : le nom est conservé
    expect(screen.getByDisplayValue('Conservation')).toBeInTheDocument();
    // Re-avance : audience toujours sélectionnée
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    expect(screen.getByRole('radio')).toBeChecked();
  });

  it('CMP-MSW-019 : Précédent désactivé à l\'étape 1', () => {
    renderWizard();
    expect(screen.getByRole('button', { name: /Précédent/i })).toBeDisabled();
  });

  it('CMP-MSW-020 : Précédent ne revalide pas l\'étape courante', async () => {
    const user = userEvent.setup();
    renderWizard();
    // Étape 1 avec nom invalide « ab » mais on remplit assez pour avancer puis
    // revenir : goPrev ne doit déclencher AUCUN message d'erreur de validation.
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Valide');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // -> 2
    // À l'étape 2 sans sélection, goPrev ne valide pas l'étape 2.
    await user.click(screen.getByRole('button', { name: /Précédent/i }));
    expect(screen.queryByText(/au moins une liste OU une audience/i)).not.toBeInTheDocument();
    expect(screen.getByText('1. Nom interne')).toBeInTheDocument();
  });

  it('CMP-MSW-021 : étape 6 affiche le récap fidèle', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillUntilStep6(user);
    // Le récap reprend le nom, le sujet saisis.
    expect(screen.getByText('Aïd 2026 — offre')).toBeInTheDocument();
    expect(screen.getByText('✨ Aïd Moubarak — ton rituel offert')).toBeInTheDocument();
    expect(screen.getByText(/Envoi immédiat/i)).toBeInTheDocument();
  });
});

describe('CampaignWizard — finalisation (grille d\'échecs)', () => {
  it('CMP-MSW-022/023 : envoi désactivé sans ack + submit sans ack n\'appelle pas finalize', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillUntilStep6(user);
    const sendBtn = screen.getByRole('button', { name: /Envoyer maintenant/i });
    expect(sendBtn).toBeDisabled();
    // Un clic forcé sur un bouton disabled n'a aucun effet.
    await user.click(sendBtn).catch(() => {});
    expect(finalizeCampaign).not.toHaveBeenCalled();
  });

  it('CMP-MSW-024 : envoi nominal appelle finalizeCampaign(sendNow=true) puis redirige', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillUntilStep6(user);
    await user.click(screen.getByRole('checkbox')); // ack
    await user.click(screen.getByRole('button', { name: /Envoyer maintenant/i }));
    expect(finalizeCampaign).toHaveBeenCalledTimes(1);
    expect(finalizeCampaign.mock.calls[0]![0]).toMatchObject({ id: 'draft-1', sendNow: true });
    expect(push).toHaveBeenCalledWith('/admin/emails/campaigns/draft-1');
  });

  it('CMP-MSW-025 : finalize 401 → message session, pas de redirection, ack conservé', async () => {
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

  it('CMP-MSW-026 : finalize 422 → message validation affiché', async () => {
    const user = userEvent.setup();
    finalizeCampaign.mockRejectedValueOnce(new Error('Validation échouée : sujet manquant'));
    renderWizard();
    await fillUntilStep6(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Envoyer maintenant/i }));
    // Le message d'erreur exact remonté par l'action (pas le label « Sujet » du récap).
    expect(await screen.findByText(/Validation échouée/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('CMP-MSW-027 : finalize 500 → message générique + bouton réactivé (pas de spinner figé)', async () => {
    const user = userEvent.setup();
    finalizeCampaign.mockRejectedValueOnce(new Error('internal server error'));
    renderWizard();
    await fillUntilStep6(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Envoyer maintenant/i }));
    expect(await screen.findByText(/internal|erreur/i)).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: /Envoyer maintenant/i }));
    // Pendant le pending : libellé « Envoi… », bouton disabled.
    const spinner = await screen.findByRole('button', { name: /Envoi…/i });
    expect(spinner).toBeDisabled();
    // Un second clic ne déclenche pas un 2e appel.
    await user.click(spinner).catch(() => {});
    expect(finalizeCampaign).toHaveBeenCalledTimes(1);
    resolveFn({ campaignId: 1 });
  });

  it('CMP-MSW-029 : mode scheduled → libellé « Planifier » + sendNow=false', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), 'Planif demain');
    await user.click(screen.getByRole('button', { name: /Suivant/i }));
    await user.click(screen.getByRole('radio'));
    await screen.findByText('50000');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 3
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 4
    await user.type(screen.getByPlaceholderText(SUBJECT_PLACEHOLDER), 'Sujet planifié');
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 5
    await user.click(screen.getByRole('radio', { name: /Planifier/i }));
    const dt = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16);
    await user.type(dt, future);
    await user.click(screen.getByRole('button', { name: /Suivant/i })); // 6
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Planifier/i }));
    expect(finalizeCampaign).toHaveBeenCalledTimes(1);
    expect(finalizeCampaign.mock.calls[0]![0]).toMatchObject({ sendNow: false });
  });
});

describe('CampaignWizard — bandeau Listmonk', () => {
  it('CMP-MSW-030 : listmonkError affiche un bandeau d\'alerte au chargement', () => {
    renderWizard({ listmonkError: 'connexion refusée' });
    expect(screen.getByText(/Listmonk : connexion refusée/i)).toBeInTheDocument();
  });
});
