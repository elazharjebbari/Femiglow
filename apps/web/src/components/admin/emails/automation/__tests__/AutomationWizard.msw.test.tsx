// @vitest-environment jsdom
/**
 * Module 05 — Automations, couche UI : AutomationWizard.
 *
 * Oracle directeur (anti-promesse-fausse, leçon R-004/R-005) : ce que le wizard
 * remet à `onSubmit` doit être EXACTEMENT ce que le moteur lit. On vérifie donc,
 * via la VRAIE chaîne de soumission (NewAutomationPageClient / EditAutomationPageClient
 * → server action `createAutomation` / `updateAutomation`, mockée pour observer
 * l'argument), que :
 *   - triggerType / triggerConfig.eventName  (event-dispatcher.ts → watchedEventName)
 *   - steps aux bons `kind`/unités           (runner.ts / step-types-v2.ts)
 *   - cooldownSeconds (SECONDES), quietHours* (HH:mm + tz), dailyCap (entier|null)
 *                                            (frequency.ts → checkCooldown/applyQuietHours/checkDailyCap)
 * arrivent aux bons NOMS et bonnes UNITÉS.
 *
 * Stack : Vitest + Testing Library + user-event. La persistance réelle de cette
 * UI passe par des SERVER ACTIONS (pas une route HTTP) → on les mocke via vi.mock
 * exactement comme CampaignWizard.msw.test.tsx, et on asserte l'argument EXACT
 * (l'équivalent du « body exact » pour ce périmètre). La grille 5 points
 * (succès/401/422/500/réseau) s'applique sur l'action de soumission, seule action
 * réseau du wizard.
 *
 * Réf matrice : docs/emailing/qa-campaign-2026-06/modules/05-automations/
 * IDs : AUT-UI-WIZ-*, AUT-UI-RT-*, AUT-UI-VAL-*, AUT-UI-FREQ-*, AUT-UI-NET-*, AUT-UI-A11Y-*
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mock des server actions (appelées DIRECTEMENT par les PageClients) ──────
const createAutomation = vi.fn();
const updateAutomation = vi.fn();
vi.mock('@/lib/admin/emails/automation-mutations', () => ({
  createAutomation: (...args: unknown[]) => createAutomation(...args),
  updateAutomation: (...args: unknown[]) => updateAutomation(...args),
}));

// ── Mock next/navigation router pour observer la redirection ────────────────
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

import { NewAutomationPageClient } from '@/app/admin/emails/automation/new/NewAutomationPageClient';
import { EditAutomationPageClient } from '@/app/admin/emails/automation/[id]/edit/EditAutomationPageClient';
import { AUTOMATION_EVENT_CATALOG } from '@/lib/mail/automation/step-types-v2';

const CATALOG = AUTOMATION_EVENT_CATALOG.map((e) => ({
  name: e.name,
  category: e.category,
  description: e.description,
}));

beforeEach(() => {
  createAutomation.mockResolvedValue({ id: 'aut_new_1' });
  updateAutomation.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Helpers de navigation du wizard ─────────────────────────────────────────
function renderNew() {
  return render(<NewAutomationPageClient eventsCatalog={CATALOG} />);
}

function nextBtn() {
  return screen.getByRole('button', { name: /Suivant/i });
}
function backBtn() {
  return screen.getByRole('button', { name: /Retour/i });
}

/** Remplit l'étape Identité (event trigger) et passe à l'étape Étapes. */
async function fillIdentity(
  user: ReturnType<typeof userEvent.setup>,
  opts: { name?: string; slug?: string; trigger?: string; eventName?: string } = {},
) {
  await user.type(screen.getByPlaceholderText(/Bienvenue/i), opts.name ?? 'Bienvenue flow');
  await user.type(screen.getByPlaceholderText('welcome-flow'), opts.slug ?? 'welcome-flow');
  if (opts.trigger) {
    // Le sélecteur de déclencheur est le 1er combobox de l'étape Identité.
    await user.selectOptions(screen.getAllByRole('combobox')[0]!, opts.trigger);
  }
  // event/subscription : sélectionner l'événement déclencheur
  const ev = opts.eventName ?? 'lead.created';
  const trig = opts.trigger ?? 'event';
  if (trig === 'event' || trig === 'subscription') {
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Événement déclencheur/i }),
      ev,
    );
  }
}

/** Ajoute un step `send` avec un template donné, depuis l'étape Étapes. */
async function addSendStep(user: ReturnType<typeof userEvent.setup>, template: string) {
  await user.click(screen.getByTestId('add-step-btn'));
  await user.click(screen.getByText('Envoyer email'));
  // L'éditeur s'ouvre automatiquement (openIdx = nouvel index).
  const tplInput = screen.getByPlaceholderText('welcome-1') as HTMLInputElement;
  await user.clear(tplInput);
  if (template) await user.type(tplInput, template);
}

// ════════════════════════════════════════════════════════════════════════════
// 1) CRÉATION COMPLÈTE — anti-promesse-fausse sur l'argument de createAutomation
// ════════════════════════════════════════════════════════════════════════════
describe('AutomationWizard — création complète (oracle anti-promesse-fausse)', () => {
  it('AUT-UI-WIZ-001 : wizard complet → createAutomation reçoit triggerConfig.eventName, steps, fréquence aux bons noms/unités', async () => {
    const user = userEvent.setup();
    renderNew();

    // Étape 0 — Identité (event trigger + eventName obligatoire)
    await fillIdentity(user, {
      name: 'Bienvenue + relance',
      slug: 'welcome-relance',
      trigger: 'event',
      eventName: 'lead.created',
    });
    await user.click(nextBtn());

    // Étape 1 — Étapes : un wait 30 min puis un send welcome-1
    await user.click(screen.getByTestId('add-step-btn'));
    await user.click(screen.getByText('Attendre'));
    const waitInput = screen.getByDisplayValue('60') as HTMLInputElement; // défaut 1h = 60 min
    // Remplacement atomique : sur un input number contrôlé, clear+type laisse un
    // artefact de clamping (Number('')→0→max). fireEvent.change pose la valeur d'un coup.
    fireEvent.change(waitInput, { target: { value: '30' } });
    await addSendStep(user, 'welcome-1');
    await user.click(nextBtn());

    // Étape 2 — Fréquence : cooldown 120 min, quiet hours 09:00–21:00, cap 3
    const cooldownInput = screen.getByDisplayValue('0') as HTMLInputElement;
    fireEvent.change(cooldownInput, { target: { value: '120' } }); // min → 7200 s
    const start = document.querySelector('input[type="time"]') as HTMLInputElement;
    const end = document.querySelectorAll('input[type="time"]')[1] as HTMLInputElement;
    await user.clear(start);
    await user.type(start, '09:00');
    await user.clear(end);
    await user.type(end, '21:00');
    const capInput = screen.getByPlaceholderText(/aucun plafond/i) as HTMLInputElement;
    await user.type(capInput, '3');
    await user.click(nextBtn());

    // Étape 3 — Revue : activer puis créer
    await user.click(screen.getByRole('checkbox', { name: /Activer immédiatement/i }));
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));

    expect(createAutomation).toHaveBeenCalledTimes(1);
    const arg = createAutomation.mock.calls[0]![0];

    // Identité + trigger : le dispatcher lit triggerConfig.eventName.
    expect(arg).toMatchObject({
      slug: 'welcome-relance',
      name: 'Bienvenue + relance',
      triggerType: 'event',
      triggerConfig: { eventName: 'lead.created' },
      active: true,
    });

    // Steps : kinds + unités attendues par le runner.
    expect(arg.steps).toEqual([
      { kind: 'wait', durationMs: 30 * 60_000 },
      { kind: 'send', template: 'welcome-1', payloadKeys: [] },
    ]);

    // Fréquence : cooldown en SECONDES (frequency.checkCooldown), HH:mm, cap entier.
    expect(arg.cooldownSeconds).toBe(120 * 60); // 7200 s
    expect(arg.quietHoursEnabled).toBe(true);
    expect(arg.quietHoursStart).toBe('09:00');
    expect(arg.quietHoursEnd).toBe('21:00');
    expect(arg.quietHoursTz).toBe('Africa/Casablanca');
    expect(arg.dailyCap).toBe(3);

    // Redirection post-création vers l'édition de l'id retourné.
    expect(push).toHaveBeenCalledWith('/admin/emails/automation/aut_new_1/edit');
  });

  it('AUT-UI-WIZ-002 : daily cap laissé vide → dailyCap=null (illimité, pas 0)', async () => {
    const user = userEvent.setup();
    renderNew();
    await fillIdentity(user, { slug: 'no-cap', eventName: 'order.placed' });
    await user.click(nextBtn());
    await addSendStep(user, 'welcome-1');
    await user.click(nextBtn());
    // ne touche pas au cap
    await user.click(nextBtn());
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));

    const arg = createAutomation.mock.calls[0]![0];
    expect(arg.dailyCap).toBeNull();
  });

  it('AUT-UI-WIZ-003 : cooldown 0 min → cooldownSeconds=0 (pas de cooldown)', async () => {
    const user = userEvent.setup();
    renderNew();
    await fillIdentity(user, { slug: 'zero-cd', eventName: 'cart.abandoned' });
    await user.click(nextBtn());
    await addSendStep(user, 'welcome-1');
    await user.click(nextBtn());
    await user.click(nextBtn());
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    expect(createAutomation.mock.calls[0]![0].cooldownSeconds).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2) ÉDITION / ROUND-TRIP — les valeurs reviennent EXACTES dans le formulaire
// ════════════════════════════════════════════════════════════════════════════
describe('AutomationWizard — édition round-trip', () => {
  const initial = {
    id: 'aut_edit_1',
    slug: 'existing-flow',
    name: 'Flow existant',
    triggerType: 'event' as const,
    triggerConfig: { eventName: 'cart.abandoned' },
    triggerConditions: null,
    steps: [
      { kind: 'wait' as const, durationMs: 2 * 3_600_000 }, // 2h
      { kind: 'send' as const, template: 'cart-recovery-1', payloadKeys: ['cartTotalMad'] },
    ],
    frequency: {
      cooldownSeconds: 3 * 3600, // 180 min
      quietHoursEnabled: true,
      quietHoursStart: '10:00',
      quietHoursEnd: '20:00',
      quietHoursTz: 'Africa/Casablanca',
      dailyCap: 5,
    },
    active: true,
  };

  function renderEdit() {
    return render(<EditAutomationPageClient initial={initial} eventsCatalog={CATALOG} />);
  }

  it('AUT-UI-RT-001 : Identité préremplie (nom, slug verrouillé, trigger, eventName)', () => {
    renderEdit();
    expect(screen.getByDisplayValue('Flow existant')).toBeInTheDocument();
    const slug = screen.getByDisplayValue('existing-flow') as HTMLInputElement;
    expect(slug.disabled).toBe(true); // slug immuable en édition
    // eventName du trigger restitué dans le sélecteur dédié
    const evSelect = screen.getByRole('combobox', { name: /Événement déclencheur/i }) as HTMLSelectElement;
    expect(evSelect.value).toBe('cart.abandoned');
  });

  it('AUT-UI-RT-002 : steps + fréquence restitués aux bonnes unités dans les éditeurs', async () => {
    const user = userEvent.setup();
    renderEdit();
    // Étape 1 — steps : labels fidèles
    await user.click(nextBtn());
    expect(screen.getByText(/Attendre 2 h/i)).toBeInTheDocument();
    expect(screen.getByText(/Envoyer « cart-recovery-1 »/i)).toBeInTheDocument();
    // Étape 2 — fréquence : cooldown 180 min, fenêtre 10:00–20:00, cap 5
    await user.click(nextBtn());
    expect(screen.getByDisplayValue('180')).toBeInTheDocument(); // 3h = 180 min
    expect(screen.getByDisplayValue('10:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
  });

  it('AUT-UI-RT-003 : sauvegarde sans modification → updateAutomation reçoit EXACTEMENT les valeurs initiales (round-trip sans dérive)', async () => {
    const user = userEvent.setup();
    renderEdit();
    await user.click(nextBtn()); // -> steps
    await user.click(nextBtn()); // -> fréquence
    await user.click(nextBtn()); // -> revue
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }));

    expect(updateAutomation).toHaveBeenCalledTimes(1);
    const arg = updateAutomation.mock.calls[0]![0];
    expect(arg).toMatchObject({
      id: 'aut_edit_1',
      slug: 'existing-flow',
      name: 'Flow existant',
      triggerType: 'event',
      triggerConfig: { eventName: 'cart.abandoned' },
      cooldownSeconds: 3 * 3600,
      quietHoursStart: '10:00',
      quietHoursEnd: '20:00',
      quietHoursTz: 'Africa/Casablanca',
      dailyCap: 5,
      active: true,
    });
    // Aucune dérive d'unité sur les steps.
    expect(arg.steps).toEqual([
      { kind: 'wait', durationMs: 2 * 3_600_000 },
      { kind: 'send', template: 'cart-recovery-1', payloadKeys: ['cartTotalMad'] },
    ]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3) STEPS — ajout / réordonnancement / suppression (depuis le wizard)
// ════════════════════════════════════════════════════════════════════════════
describe('AutomationWizard — édition des steps', () => {
  async function gotoSteps(user: ReturnType<typeof userEvent.setup>) {
    renderNew();
    await fillIdentity(user, { slug: 'steps-flow', eventName: 'lead.created' });
    await user.click(nextBtn());
  }

  it('AUT-UI-STEP-001 : ajout de 2 steps → ordre conservé jusqu\'à createAutomation', async () => {
    const user = userEvent.setup();
    await gotoSteps(user);
    // wait puis send
    await user.click(screen.getByTestId('add-step-btn'));
    await user.click(screen.getByText('Attendre'));
    await addSendStep(user, 'welcome-1');
    await user.click(nextBtn());
    await user.click(nextBtn());
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    const steps = createAutomation.mock.calls[0]![0].steps;
    expect(steps.map((s: { kind: string }) => s.kind)).toEqual(['wait', 'send']);
  });

  it('AUT-UI-STEP-002 : réordonnancement (↓) inverse l\'ordre persisté', async () => {
    const user = userEvent.setup();
    await gotoSteps(user);
    await user.click(screen.getByTestId('add-step-btn'));
    await user.click(screen.getByText('Attendre'));
    await addSendStep(user, 'welcome-1');
    // descend le step #1 (wait) sous le send
    const downBtns = screen.getAllByLabelText('Descendre');
    await user.click(downBtns[0]!);
    await user.click(nextBtn());
    await user.click(nextBtn());
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    const steps = createAutomation.mock.calls[0]![0].steps;
    expect(steps.map((s: { kind: string }) => s.kind)).toEqual(['send', 'wait']);
  });

  it('AUT-UI-STEP-003 : suppression d\'un step le retire du payload', async () => {
    const user = userEvent.setup();
    await gotoSteps(user);
    await user.click(screen.getByTestId('add-step-btn'));
    await user.click(screen.getByText('Attendre'));
    await addSendStep(user, 'welcome-1');
    // supprime le 1er (wait)
    const removeBtns = screen.getAllByLabelText('Supprimer');
    await user.click(removeBtns[0]!);
    await user.click(nextBtn());
    await user.click(nextBtn());
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    const steps = createAutomation.mock.calls[0]![0].steps;
    expect(steps).toEqual([{ kind: 'send', template: 'welcome-1', payloadKeys: [] }]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4) VALIDATION — promesses que le moteur ne peut pas tenir = bloquées
// ════════════════════════════════════════════════════════════════════════════
describe('AutomationWizard — validations bloquantes', () => {
  it('AUT-UI-VAL-001 : trigger event sans eventName → Suivant bloqué + message (sinon automation inerte)', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByPlaceholderText(/Bienvenue/i), 'Sans event');
    await user.type(screen.getByPlaceholderText('welcome-flow'), 'sans-event');
    // ne sélectionne PAS d'événement
    expect(nextBtn()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/déclenche cette automation/i);
  });

  it('AUT-UI-VAL-002 : sélection de l\'événement débloque Suivant', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByPlaceholderText(/Bienvenue/i), 'Avec event');
    await user.type(screen.getByPlaceholderText('welcome-flow'), 'avec-event');
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Événement déclencheur/i }),
      'order.placed',
    );
    expect(nextBtn()).toBeEnabled();
  });

  it('AUT-UI-VAL-003 : trigger schedule n\'exige PAS d\'eventName (pas de sélecteur)', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByPlaceholderText(/Bienvenue/i), 'Cron');
    await user.type(screen.getByPlaceholderText('welcome-flow'), 'cron-flow');
    await user.selectOptions(screen.getAllByRole('combobox')[0]!, 'schedule');
    expect(screen.queryByRole('combobox', { name: /Événement déclencheur/i })).not.toBeInTheDocument();
    expect(nextBtn()).toBeEnabled();
  });

  it('AUT-UI-VAL-004 : aucune étape → Suivant bloqué à l\'étape Étapes', async () => {
    const user = userEvent.setup();
    renderNew();
    await fillIdentity(user, { slug: 'empty-steps', eventName: 'lead.created' });
    await user.click(nextBtn());
    expect(screen.getByText(/Aucune étape/i)).toBeInTheDocument();
    expect(nextBtn()).toBeDisabled();
  });

  it('AUT-UI-VAL-005 : step send sans template → bloqué avec message (le runner ne pourrait pas envoyer)', async () => {
    const user = userEvent.setup();
    renderNew();
    await fillIdentity(user, { slug: 'no-template', eventName: 'lead.created' });
    await user.click(nextBtn());
    await addSendStep(user, ''); // template vidé
    expect(screen.getByRole('alert')).toHaveTextContent(/template/i);
    expect(nextBtn()).toBeDisabled();
    // renseigner un template débloque
    await user.type(screen.getByPlaceholderText('welcome-1'), 'welcome-1');
    expect(nextBtn()).toBeEnabled();
  });

  it('AUT-UI-VAL-006 : slug non kebab-case → Suivant bloqué', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByPlaceholderText(/Bienvenue/i), 'Mauvais slug');
    // l'input force déjà le kebab, mais un slug vide reste invalide
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Événement déclencheur/i }),
      'lead.created',
    );
    expect(nextBtn()).toBeDisabled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5) FRÉQUENCE — unités & fuseau Africa/Casablanca
// ════════════════════════════════════════════════════════════════════════════
describe('AutomationWizard — FrequencySettings', () => {
  async function gotoFrequency(user: ReturnType<typeof userEvent.setup>) {
    renderNew();
    await fillIdentity(user, { slug: 'freq-flow', eventName: 'lead.created' });
    await user.click(nextBtn());
    await addSendStep(user, 'welcome-1');
    await user.click(nextBtn());
  }

  it('AUT-UI-FREQ-001 : fuseau par défaut Africa/Casablanca persisté', async () => {
    const user = userEvent.setup();
    await gotoFrequency(user);
    const tzSelect = screen.getByDisplayValue('Africa/Casablanca');
    expect(tzSelect).toBeInTheDocument();
    await user.click(nextBtn());
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    expect(createAutomation.mock.calls[0]![0].quietHoursTz).toBe('Africa/Casablanca');
  });

  it('AUT-UI-FREQ-002 : désactiver quiet hours masque les champs et persiste quietHoursEnabled=false', async () => {
    const user = userEvent.setup();
    await gotoFrequency(user);
    const toggle = screen.getByRole('checkbox', { name: /plage horaire/i });
    await user.click(toggle); // décoche (défaut activé)
    expect(document.querySelector('input[type="time"]')).toBeNull();
    await user.click(nextBtn());
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    expect(createAutomation.mock.calls[0]![0].quietHoursEnabled).toBe(false);
  });

  it('AUT-UI-FREQ-003 : cap en minutes côté cooldown → secondes côté payload (conversion ×60)', async () => {
    const user = userEvent.setup();
    await gotoFrequency(user);
    const cooldownInput = screen.getByDisplayValue('0') as HTMLInputElement;
    fireEvent.change(cooldownInput, { target: { value: '45' } });
    await user.click(nextBtn());
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    expect(createAutomation.mock.calls[0]![0].cooldownSeconds).toBe(45 * 60);
  });

  it('AUT-UI-FREQ-004 : changer le fuseau pour Europe/Paris est persisté tel quel', async () => {
    const user = userEvent.setup();
    await gotoFrequency(user);
    await user.selectOptions(screen.getByDisplayValue('Africa/Casablanca'), 'Europe/Paris');
    await user.click(nextBtn());
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    expect(createAutomation.mock.calls[0]![0].quietHoursTz).toBe('Europe/Paris');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6) RÉCAP & ACTIVATION
// ════════════════════════════════════════════════════════════════════════════
describe('AutomationWizard — récapitulatif & activation', () => {
  async function gotoReview(user: ReturnType<typeof userEvent.setup>) {
    renderNew();
    await fillIdentity(user, { name: 'Récap flow', slug: 'recap-flow', eventName: 'lead.created' });
    await user.click(nextBtn());
    await addSendStep(user, 'welcome-1');
    await user.click(nextBtn());
    await user.click(nextBtn());
  }

  it('AUT-UI-WIZ-004 : la revue reflète nom, slug, trigger, nb de steps', async () => {
    const user = userEvent.setup();
    await gotoReview(user);
    const recap = screen.getByText(/Récapitulatif/i).closest('section')!;
    expect(within(recap).getByText('Récap flow')).toBeInTheDocument();
    expect(within(recap).getByText('recap-flow')).toBeInTheDocument();
    expect(within(recap).getByText('event')).toBeInTheDocument();
    expect(within(recap).getByText(/Étapes \(1\)/i)).toBeInTheDocument();
  });

  it('AUT-UI-WIZ-005 : créer sans cocher « activer » → active=false', async () => {
    const user = userEvent.setup();
    await gotoReview(user);
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    expect(createAutomation.mock.calls[0]![0].active).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7) GRILLE 5 POINTS sur la soumission (succès / 401 / 422 / 500 / réseau)
// ════════════════════════════════════════════════════════════════════════════
describe('AutomationWizard — grille d\'échecs sur la soumission', () => {
  async function gotoReview(user: ReturnType<typeof userEvent.setup>) {
    renderNew();
    await fillIdentity(user, { slug: 'fail-flow', eventName: 'lead.created' });
    await user.click(nextBtn());
    await addSendStep(user, 'welcome-1');
    await user.click(nextBtn());
    await user.click(nextBtn());
  }

  it('AUT-UI-NET-001 : succès → redirige vers l\'édition de l\'id créé', async () => {
    const user = userEvent.setup();
    await gotoReview(user);
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    expect(push).toHaveBeenCalledWith('/admin/emails/automation/aut_new_1/edit');
  });

  it('AUT-UI-NET-002 : 401 (session expirée) → message affiché, pas de redirection', async () => {
    const user = userEvent.setup();
    createAutomation.mockRejectedValueOnce(new Error('Session expirée / non autorisé'));
    await gotoReview(user);
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    expect(await screen.findByText(/Session|autoris/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('AUT-UI-NET-003 : 422 (validation) → message d\'erreur exact affiché', async () => {
    const user = userEvent.setup();
    createAutomation.mockRejectedValueOnce(new Error('Slug already used : fail-flow'));
    await gotoReview(user);
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    expect(await screen.findByText(/Slug already used/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('AUT-UI-NET-004 : 500 → message + bouton réactivé (pas de spinner figé)', async () => {
    const user = userEvent.setup();
    createAutomation.mockRejectedValueOnce(new Error('internal server error'));
    await gotoReview(user);
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    expect(await screen.findByText(/internal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer l'automation/i })).toBeEnabled();
  });

  it('AUT-UI-NET-005 : réseau pendant (hang) → bouton « ... » disabled, pas de double-appel', async () => {
    const user = userEvent.setup();
    let resolveFn: (v: unknown) => void = () => {};
    createAutomation.mockImplementationOnce(
      () => new Promise((res) => { resolveFn = res; }),
    );
    await gotoReview(user);
    const btn = screen.getByRole('button', { name: /Créer l'automation/i });
    await user.click(btn);
    const pending = await screen.findByRole('button', { name: '...' });
    expect(pending).toBeDisabled();
    await user.click(pending).catch(() => {});
    expect(createAutomation).toHaveBeenCalledTimes(1);
    resolveFn({ id: 'aut_late' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8) A11Y de base
// ════════════════════════════════════════════════════════════════════════════
describe('AutomationWizard — a11y', () => {
  it('AUT-UI-A11Y-001 : étape Identité — champs labellés (Nom, Slug, Déclencheur)', () => {
    renderNew();
    expect(screen.getByText('Nom')).toBeInTheDocument();
    expect(screen.getByText('Slug')).toBeInTheDocument();
    expect(screen.getByText('Déclencheur')).toBeInTheDocument();
  });

  it('AUT-UI-A11Y-002 : message de validation event manquant a role=alert', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByPlaceholderText('welcome-flow'), 'a11y');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('AUT-UI-A11Y-003 : boutons de réordonnancement step ont des aria-label explicites', async () => {
    const user = userEvent.setup();
    renderNew();
    await fillIdentity(user, { slug: 'a11y-steps', eventName: 'lead.created' });
    await user.click(nextBtn());
    await user.click(screen.getByTestId('add-step-btn'));
    await user.click(screen.getByText('Attendre'));
    expect(screen.getByLabelText('Monter')).toBeInTheDocument();
    expect(screen.getByLabelText('Descendre')).toBeInTheDocument();
    expect(screen.getByLabelText('Supprimer')).toBeInTheDocument();
  });

  it('AUT-UI-A11Y-004 : Retour désactivé à la 1re étape', () => {
    renderNew();
    expect(backBtn()).toBeDisabled();
  });
});
