import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { expectNoAxeViolations } from '@/test/axe';

import { LeadWebhookSettingsForm } from './LeadWebhookSettingsForm';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

function renderForm(): void {
  render(
    <LeadWebhookSettingsForm
      initialStep2WebhookEnabled
      initialStep1AbandonEnabled
      initialStep1AbandonTimeoutMinutes={5}
      initialConversationEnabled
      initialConversationMaxMessages={50}
      initialConversationMaxBytes={30000}
      initialInlineContactWebhookEnabled
    />,
  );
}

function okResponse(overrides: Record<string, boolean | number> = {}): Response {
  return new Response(
    JSON.stringify({
      settings: {
        leadStep2WebhookEnabled: true,
        leadStep1AbandonEnabled: true,
        leadStep1AbandonTimeoutMinutes: 5,
        leadWebhookConversationEnabled: true,
        leadWebhookConversationMaxMessages: 50,
        leadWebhookConversationMaxBytes: 30000,
        leadInlineContactWebhookEnabled: true,
        ...overrides,
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  refresh.mockReset();
});

describe('LeadWebhookSettingsForm', () => {
  it('sauvegarde un toggle et resynchronise avec la réponse serveur', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(okResponse({ leadStep2WebhookEnabled: false }));
    renderForm();

    await userEvent.click(screen.getByLabelText(/Envoyer après validation adresse/i));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      leadStep2WebhookEnabled: false,
    });
    await screen.findByRole('status');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/Envoyer après validation adresse/i)).not.toBeChecked();
  });

  it('borne les valeurs numériques avant PATCH pour éviter les rejets API', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(okResponse({ leadStep1AbandonTimeoutMinutes: 60 }))
      .mockResolvedValueOnce(okResponse({ leadWebhookConversationMaxMessages: 1 }))
      .mockResolvedValueOnce(okResponse({ leadWebhookConversationMaxBytes: 50000 }));
    renderForm();

    fireEvent.change(screen.getByLabelText(/Délai abandon/i), { target: { value: '999' } });
    fireEvent.blur(screen.getByLabelText(/Délai abandon/i));
    fireEvent.change(screen.getByLabelText(/Messages conversation/i), { target: { value: '-8' } });
    fireEvent.blur(screen.getByLabelText(/Messages conversation/i));
    fireEvent.change(screen.getByLabelText(/Budget conversation bytes/i), {
      target: { value: '999999' },
    });
    fireEvent.blur(screen.getByLabelText(/Budget conversation bytes/i));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)))).toEqual([
      { leadStep1AbandonTimeoutMinutes: 60 },
      { leadWebhookConversationMaxMessages: 1 },
      { leadWebhookConversationMaxBytes: 50000 },
    ]);
  });

  it('affiche une alerte sans refresh quand le serveur rejette la sauvegarde', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Données invalides' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderForm();

    await userEvent.click(screen.getByLabelText(/Scanner les abandons step 1/i));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Données invalides/i);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('désactive les limites conversation quand le transcript est désactivé', () => {
    render(
      <LeadWebhookSettingsForm
        initialStep2WebhookEnabled
        initialStep1AbandonEnabled
        initialStep1AbandonTimeoutMinutes={5}
        initialConversationEnabled={false}
        initialConversationMaxMessages={50}
        initialConversationMaxBytes={30000}
        initialInlineContactWebhookEnabled
      />,
    );

    expect(screen.getByLabelText(/Messages conversation/i)).toBeDisabled();
    expect(screen.getByLabelText(/Budget conversation bytes/i)).toBeDisabled();
  });

  it('respecte axe', async () => {
    const { container } = render(
      <LeadWebhookSettingsForm
        initialStep2WebhookEnabled
        initialStep1AbandonEnabled
        initialStep1AbandonTimeoutMinutes={5}
        initialConversationEnabled
        initialConversationMaxMessages={50}
        initialConversationMaxBytes={30000}
        initialInlineContactWebhookEnabled
      />,
    );

    await expectNoAxeViolations(container);
  });

  it('sauvegarde le toggle inline-contact et resynchronise avec la réponse serveur', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(okResponse({ leadInlineContactWebhookEnabled: false }));
    renderForm();

    await userEvent.click(screen.getByLabelText(/Webhook immédiat inline-contact/i));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      leadInlineContactWebhookEnabled: false,
    });
    await screen.findByRole('status');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/Webhook immédiat inline-contact/i)).not.toBeChecked();
  });

  it('revert le toggle inline-contact quand le serveur retourne false', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(okResponse({ leadInlineContactWebhookEnabled: true }));
    renderForm();

    // Toggle off
    await userEvent.click(screen.getByLabelText(/Webhook immédiat inline-contact/i));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Server responds with true (rejects the change)
    expect(screen.getByLabelText(/Webhook immédiat inline-contact/i)).toBeChecked();
  });
});