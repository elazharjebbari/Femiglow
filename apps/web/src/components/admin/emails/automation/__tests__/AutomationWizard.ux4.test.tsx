// @vitest-environment jsdom
/**
 * UX-AUT-001 / UX-AUT-002 — AutomationWizard, raffinements vague 4.
 *
 * UX4-AUTOMATIONS-001 : l'étape Identité rend un AudienceRulesBuilder lié à
 *   state.triggerConditions ; éditer puis recharger (édition) ne perd PAS les
 *   conditions (la page edit les charge en RulesGroup|null, plus `as null`).
 * UX4-AUTOMATIONS-002 : les triggerType schedule/webhook sont marqués « non
 *   opérationnels » et désactivent l'activation + bandeau role=alert.
 *
 * On passe par les vrais PageClients (New/Edit) → server actions mockées pour
 * observer l'argument EXACT remis (oracle anti-promesse-fausse).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createAutomation = vi.fn();
const updateAutomation = vi.fn();
vi.mock('@/lib/admin/emails/automation-mutations', () => ({
  createAutomation: (...args: unknown[]) => createAutomation(...args),
  updateAutomation: (...args: unknown[]) => updateAutomation(...args),
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { NewAutomationPageClient } from '@/app/admin/emails/automation/new/NewAutomationPageClient';
import { EditAutomationPageClient } from '@/app/admin/emails/automation/[id]/edit/EditAutomationPageClient';
import { AUTOMATION_EVENT_CATALOG } from '@/lib/mail/automation/step-types-v2';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';

const CATALOG = AUTOMATION_EVENT_CATALOG.map((e) => ({
  name: e.name,
  category: e.category,
  description: e.description,
}));

beforeEach(() => {
  createAutomation.mockResolvedValue({ id: 'aut_x' });
  updateAutomation.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

function nextBtn() {
  return screen.getByRole('button', { name: /Suivant/i });
}

async function fillIdentity(
  user: ReturnType<typeof userEvent.setup>,
  opts: { slug?: string; eventName?: string } = {},
) {
  await user.type(screen.getByPlaceholderText(/Bienvenue/i), 'Flow');
  await user.type(screen.getByPlaceholderText('welcome-flow'), opts.slug ?? 'flow');
  await user.selectOptions(
    screen.getByRole('combobox', { name: /Événement déclencheur/i }),
    opts.eventName ?? 'lead.created',
  );
}

async function addSendStep(user: ReturnType<typeof userEvent.setup>, template: string) {
  await user.click(screen.getByTestId('add-step-btn'));
  await user.click(screen.getByText('Envoyer email'));
  const tplInput = screen.getByRole('combobox', { name: /template/i });
  await user.type(tplInput, template);
}

describe('AutomationWizard — triggerConditions (UX4-AUTOMATIONS-001)', () => {
  it('UX4-AUTOMATIONS-001a : activer le ciblage rend un AudienceRulesBuilder et persiste les conditions', async () => {
    const user = userEvent.setup();
    render(<NewAutomationPageClient eventsCatalog={CATALOG} />);

    await fillIdentity(user, { slug: 'targeted', eventName: 'lead.created' });

    // Par défaut : aucune condition (le builder n'est pas rendu).
    expect(screen.queryByTestId('rules-group-0')).not.toBeInTheDocument();

    // Activer le ciblage fin → le builder apparaît.
    await user.click(
      screen.getByRole('checkbox', { name: /conditions de déclenchement/i }),
    );
    const builder = await screen.findByTestId('rules-group-0');
    expect(builder).toBeInTheDocument();

    // Ajouter un critère via le menu du builder.
    await user.click(within(builder).getByTestId('add-rule-btn'));
    await user.click(within(builder).getByTestId('add-rule-has_tag'));

    // Naviguer jusqu'à la soumission.
    await user.click(nextBtn());
    await addSendStep(user, 'welcome-1');
    await user.click(nextBtn());
    await user.click(nextBtn());
    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));

    expect(createAutomation).toHaveBeenCalledTimes(1);
    const arg = createAutomation.mock.calls[0]![0];
    // Les conditions sont remises au moteur (RulesGroup non vide), pas null.
    expect(arg.triggerConditions).toBeTruthy();
    expect(arg.triggerConditions.kind).toBe('all');
    expect(arg.triggerConditions.conditions.length).toBeGreaterThanOrEqual(1);
  });

  it('UX4-AUTOMATIONS-001b : édition d’une automation avec conditions → le builder est pré-rempli (pas écrasé)', async () => {
    const user = userEvent.setup();
    const conditions: RulesGroup = {
      kind: 'all',
      conditions: [{ kind: 'has_tag', tag: 'vip' }],
    };
    const initial = {
      id: 'aut_edit_1',
      slug: 'existing',
      name: 'Existante',
      triggerType: 'event' as const,
      triggerConfig: { eventName: 'lead.created' },
      triggerConditions: conditions,
      steps: [{ kind: 'send' as const, template: 'welcome-1', payloadKeys: [] }],
      frequency: {
        cooldownSeconds: 0,
        quietHoursEnabled: true,
        quietHoursStart: '08:00',
        quietHoursEnd: '22:00',
        quietHoursTz: 'Africa/Casablanca',
        dailyCap: null,
      },
      active: true,
    };

    render(<EditAutomationPageClient initial={initial} eventsCatalog={CATALOG} />);

    // Le ciblage est déjà actif (conditions non nulles) → builder visible avec le critère.
    expect(screen.getByRole('checkbox', { name: /conditions de déclenchement/i })).toBeChecked();
    expect(screen.getByTestId('rules-group-0')).toBeInTheDocument();

    // Soumettre SANS toucher aux conditions : elles doivent être conservées.
    // (Aller jusqu'à la revue puis Enregistrer.)
    await user.click(nextBtn()); // → Étapes
    await user.click(nextBtn()); // → Fréquence
    await user.click(nextBtn()); // → Revue
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }));

    expect(updateAutomation).toHaveBeenCalledTimes(1);
    const arg = updateAutomation.mock.calls[0]![0];
    expect(arg.triggerConditions).toEqual(conditions);
  });
});

describe('AutomationWizard — schedule/webhook non opérationnels (UX4-AUTOMATIONS-002)', () => {
  it('UX4-AUTOMATIONS-002 : schedule → bandeau role=alert + activation désactivée + active=false à la soumission', async () => {
    const user = userEvent.setup();
    render(<NewAutomationPageClient eventsCatalog={CATALOG} />);

    await user.type(screen.getByPlaceholderText(/Bienvenue/i), 'Cron');
    await user.type(screen.getByPlaceholderText('welcome-flow'), 'cron-flow');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Déclencheur' }),
      'schedule',
    );

    // Bandeau d'avertissement role=alert présent dès l'étape Identité.
    expect(
      screen.getAllByRole('alert').some((el) => /opérationnel/i.test(el.textContent ?? '')),
    ).toBe(true);

    // Naviguer jusqu'à la revue (schedule n'exige pas d'eventName).
    await user.click(nextBtn());
    await addSendStep(user, 'welcome-1');
    await user.click(nextBtn());
    await user.click(nextBtn());

    // À la revue : la case « Activer » est désactivée + bandeau.
    const activateCheckbox = screen.getByRole('checkbox', { name: /Activer immédiatement/i });
    expect(activateCheckbox).toBeDisabled();
    expect(screen.getAllByRole('alert').some((el) => /opérationnel/i.test(el.textContent ?? ''))).toBe(true);

    await user.click(screen.getByRole('button', { name: /Créer l'automation/i }));
    const arg = createAutomation.mock.calls[0]![0];
    // Garde-fou : jamais actif pour un déclencheur non câblé.
    expect(arg.triggerType).toBe('schedule');
    expect(arg.active).toBe(false);
  });

  it('UX4-AUTOMATIONS-002b : webhook est également marqué non opérationnel', async () => {
    const user = userEvent.setup();
    render(<NewAutomationPageClient eventsCatalog={CATALOG} />);
    await user.type(screen.getByPlaceholderText(/Bienvenue/i), 'Hook');
    await user.type(screen.getByPlaceholderText('welcome-flow'), 'hook-flow');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Déclencheur' }),
      'webhook',
    );
    expect(
      screen.getAllByRole('alert').some((el) => /opérationnel/i.test(el.textContent ?? '')),
    ).toBe(true);
  });
});
