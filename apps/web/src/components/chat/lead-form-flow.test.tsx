/**
 * CHA-225 — Test d'intégration React du flow complet de capture lead.
 *
 * Pourquoi ce test :
 *   La suite de tests précédente (1481 verts) couvrait les modules
 *   isolés (orchestrateur, repos avec mocks, schémas) mais AUCUN test
 *   ne mettait `<MessageList />` et `<LeadFormBubble />` en relation
 *   avec `useChatStore` pour vérifier que :
 *
 *     SSE.lead-form-offer
 *       → store.receiveLeadOffer()
 *       → MessageList affiche LeadFormBubble en `offered`
 *       → clic CTA → status=open → form visible
 *       → submit → POST /api/chat/lead/contact (stub) → success
 *
 *   C'est exactement ce qu'on a observé en prod : tout passait au
 *   niveau unitaire mais le widget ne s'affichait jamais en bout de
 *   chaîne. Ce test garantit le contrat E2E côté front.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageList } from './MessageList';
import { useChatStore } from './chat-store';

// jsdom n'implémente pas Element.prototype.scrollTo. MessageList l'appelle
// dans un useEffect (auto-scroll de la conversation). On stub no-op pour
// éviter les exceptions React lors du rendu.
if (
  typeof Element !== 'undefined' &&
  typeof (Element.prototype as { scrollTo?: unknown }).scrollTo !== 'function'
) {
  (Element.prototype as { scrollTo: () => void }).scrollTo = () => {};
}

function resetStore(opts: { sessionId?: string | null } = {}): void {
  useChatStore.setState({
    sessionId: opts.sessionId ?? 'sess-test',
    language: 'fr',
    isOpen: true,
    isStreaming: false,
    messages: [],
    pendingAssistantId: null,
    error: null,
    greeting: '',
    suggestions: [],
    leadOffer: {
      status: 'idle',
      triggeringMessageId: null,
      reason: null,
      copyKey: null,
      errorMessage: null,
      successMessage: null,
    },
    leadOfferDismissedSessionId: null,
    leadCapturedSessionId: null,
    hasInteracted: false,
  });
}

function pushAssistantMessage(id: string, content: string): void {
  useChatStore.setState((s) => ({
    messages: [
      ...s.messages,
      {
        id,
        role: 'assistant',
        content,
        language: 'fr',
        status: 'sent',
        createdAt: new Date().toISOString(),
      },
    ],
  }));
}

let restoreFetch: () => void = () => {};
function stubFetchOk(json: unknown): void {
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify(json), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof globalThis.fetch;
  restoreFetch = () => {
    globalThis.fetch = original;
  };
}

function stubFetchError(status: number, json: unknown): void {
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify(json), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof globalThis.fetch;
  restoreFetch = () => {
    globalThis.fetch = original;
  };
}

beforeEach(() => {
  resetStore();
  // CHAT-063 — Le LeadFormBubble pré-remplit firstName/phone depuis
  // localStorage. On nettoie entre chaque test pour rester déterministe.
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
});

afterEach(() => {
  restoreFetch();
  restoreFetch = () => {};
});

describe('Lead-form flow — full UI integration (CHA-225)', () => {
  it("affiche la bulle d'offre IMMÉDIATEMENT après receiveLeadOffer (purchase-intent)", () => {
    pushAssistantMessage('m1', 'Bien sûr, voici comment commander.');
    act(() => {
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm1',
        reason: 'purchase-intent',
        copyKey: 'purchase-intent',
      });
    });

    render(<MessageList />);

    const offer = screen.getByTestId('chat-lead-offer');
    expect(offer).toBeInTheDocument();
    expect(offer).toHaveAttribute('data-reason', 'purchase-intent');
    // CTA visible.
    expect(screen.getByTestId('chat-lead-cta')).toBeInTheDocument();
  });

  it("affiche la bulle d'offre pour 'inline-contact' (téléphone détecté)", () => {
    pushAssistantMessage('m2', 'OK, je note ton numéro.');
    act(() => {
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm2',
        reason: 'inline-contact',
        copyKey: 'inline-contact',
      });
    });

    render(<MessageList />);

    const offer = screen.getByTestId('chat-lead-offer');
    expect(offer).toHaveAttribute('data-reason', 'inline-contact');
  });

  it("clic sur CTA → ouvre le formulaire (status=open)", async () => {
    const user = userEvent.setup();
    pushAssistantMessage('m1', 'Voici…');
    act(() => {
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm1',
        reason: 'purchase-intent',
        copyKey: 'purchase-intent',
      });
    });

    render(<MessageList />);
    await user.click(screen.getByTestId('chat-lead-cta'));

    expect(useChatStore.getState().leadOffer.status).toBe('open');
    expect(screen.getByTestId('chat-lead-form')).toBeInTheDocument();
    expect(screen.getByTestId('chat-lead-submit')).toBeInTheDocument();
  });

  it("submit du formulaire → POST /api/chat/lead/contact + state=success", async () => {
    const user = userEvent.setup();
    pushAssistantMessage('m1', 'Voici…');
    act(() => {
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm1',
        reason: 'purchase-intent',
        copyKey: 'purchase-intent',
      });
      useChatStore.getState().openLeadForm();
    });

    stubFetchOk({
      ok: true,
      leadId: 'cl_test',
      outcomeMessage: 'Merci, on te rappelle bientôt.',
    });

    render(<MessageList />);
    const form = screen.getByTestId('chat-lead-form');
    expect(form).toHaveAttribute('data-reason', 'purchase-intent');

    const firstNameInput = form.querySelector(
      'input[autocomplete="given-name"]',
    ) as HTMLInputElement;
    const phoneInput = form.querySelector(
      'input[type="tel"]',
    ) as HTMLInputElement;
    expect(firstNameInput).toBeTruthy();
    expect(phoneInput).toBeTruthy();

    await user.type(firstNameInput, 'Hamid');
    await user.type(phoneInput, '0612345678');
    await user.click(screen.getByTestId('chat-lead-submit'));

    await waitFor(() => {
      expect(useChatStore.getState().leadOffer.status).toBe('success');
    });

    // Vérifie que le POST a bien envoyé le bon payload côté contrat.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const callArgs = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0]!;
    expect(callArgs[0]).toBe('/api/chat/lead/contact');
    const body = JSON.parse(String(callArgs[1].body));
    expect(body).toMatchObject({
      sessionId: 'sess-test',
      triggerReason: 'purchase-intent',
      firstName: 'Hamid',
      phoneRaw: '0612345678',
      consent: true,
      language: 'fr',
    });
    expect(body.consentVersion).toBeTruthy();

    // Le bandeau de succès remplace le formulaire.
    expect(screen.queryByTestId('chat-lead-form')).not.toBeInTheDocument();
    expect(screen.getByText(/rappelle/i)).toBeInTheDocument();
  });

  it("erreur HTTP → state=error + message d'erreur visible", async () => {
    const user = userEvent.setup();
    pushAssistantMessage('m1', 'Voici…');
    act(() => {
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm1',
        reason: 'inline-contact',
        copyKey: 'inline-contact',
      });
      useChatStore.getState().openLeadForm();
    });

    stubFetchError(429, { error: 'rate-limited' });

    render(<MessageList />);
    const form = screen.getByTestId('chat-lead-form');
    const firstNameInput = form.querySelector(
      'input[autocomplete="given-name"]',
    ) as HTMLInputElement;
    const phoneInput = form.querySelector(
      'input[type="tel"]',
    ) as HTMLInputElement;
    await user.type(firstNameInput, 'Hamid');
    await user.type(phoneInput, '0612345678');
    await user.click(screen.getByTestId('chat-lead-submit'));

    await waitFor(() => {
      expect(useChatStore.getState().leadOffer.status).toBe('error');
    });
    // Message d'erreur traduit (FR).
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it("validation locale : prénom < 2 caractères → state=error sans appel HTTP", async () => {
    const user = userEvent.setup();
    pushAssistantMessage('m1', 'Voici…');
    act(() => {
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm1',
        reason: 'purchase-intent',
        copyKey: 'purchase-intent',
      });
      useChatStore.getState().openLeadForm();
    });

    stubFetchOk({ ok: true, leadId: 'cl_x', outcomeMessage: 'OK' });

    render(<MessageList />);
    const form = screen.getByTestId('chat-lead-form');
    const phoneInput = form.querySelector(
      'input[type="tel"]',
    ) as HTMLInputElement;
    // Prénom volontairement trop court (1 char).
    const firstNameInput = form.querySelector(
      'input[autocomplete="given-name"]',
    ) as HTMLInputElement;
    await user.type(firstNameInput, 'X');
    await user.type(phoneInput, '0612345678');
    await user.click(screen.getByTestId('chat-lead-submit'));

    await waitFor(() => {
      expect(useChatStore.getState().leadOffer.status).toBe('error');
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("dismiss l'offre → bulle disparaît + une raison FAIBLE (after-hours) reste bloquée", async () => {
    const user = userEvent.setup();
    pushAssistantMessage('m1', 'Voici…');
    act(() => {
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm1',
        reason: 'purchase-intent',
        copyKey: 'purchase-intent',
      });
    });

    render(<MessageList />);
    await user.click(screen.getByTestId('chat-lead-dismiss-offer'));

    expect(screen.queryByTestId('chat-lead-offer')).not.toBeInTheDocument();
    expect(useChatStore.getState().leadOfferDismissedSessionId).toBe('sess-test');

    // CHA-229 — Une raison FAIBLE (after-hours) qui arrive après dismiss
    // est ignorée : on ne harcèle pas la visiteuse avec des heuristiques
    // « soft » alors qu'elle a déjà fermé la bulle.
    act(() => {
      pushAssistantMessage('m2', 'Encore…');
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm2',
        reason: 'after-hours',
        copyKey: 'after-hours',
      });
    });
    expect(screen.queryByTestId('chat-lead-offer')).not.toBeInTheDocument();
  });

  it("CHA-229 : dismiss puis explicit-request → la bulle SE RÉ-AFFICHE (raison forte)", async () => {
    const user = userEvent.setup();
    pushAssistantMessage('m1', 'Voici…');
    act(() => {
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm1',
        reason: 'purchase-intent',
        copyKey: 'purchase-intent',
      });
    });

    render(<MessageList />);
    await user.click(screen.getByTestId('chat-lead-dismiss-offer'));
    expect(screen.queryByTestId('chat-lead-offer')).not.toBeInTheDocument();

    // La visiteuse change d'avis et demande explicitement à parler à un
    // humain (« je veux qu'on m'appelle »). C'est précisément le bug
    // reporté en prod : avant CHA-229, le dismiss bloquait à vie ;
    // maintenant les raisons fortes passent outre.
    act(() => {
      pushAssistantMessage('m2', "Je veux qu'on m'appelle.");
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm2',
        reason: 'explicit-request',
        copyKey: 'explicit-request',
      });
    });
    const offer = await screen.findByTestId('chat-lead-offer');
    expect(offer).toHaveAttribute('data-reason', 'explicit-request');
  });

  it("CHA-229 : dismiss puis inline-contact (numéro tapé) → la bulle SE RÉ-AFFICHE", () => {
    pushAssistantMessage('m1', 'Voici…');
    act(() => {
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm1',
        reason: 'after-hours',
        copyKey: 'after-hours',
      });
      useChatStore.getState().dismissLeadForm();
    });
    expect(useChatStore.getState().leadOfferDismissedSessionId).toBe('sess-test');

    // La visiteuse tape son numéro plus tard dans le chat. Le lead anonyme
    // est créé côté DB par l'orchestrator ; côté UI on doit afficher la
    // bulle de consent RGPD pour confirmer ses coordonnées.
    act(() => {
      pushAssistantMessage('m2', 'Mon numéro est 06 12 34 56 78.');
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm2',
        reason: 'inline-contact',
        copyKey: 'inline-contact',
      });
    });

    render(<MessageList />);
    expect(screen.getByTestId('chat-lead-offer')).toHaveAttribute(
      'data-reason',
      'inline-contact',
    );
  });

  it("CHA-229 : lead déjà CAPTURÉ → aucune raison (même forte) ne ré-ouvre la bulle", () => {
    pushAssistantMessage('m1', 'Voici…');
    // Capture réussie pour la session.
    act(() => {
      useChatStore.setState({ leadCapturedSessionId: 'sess-test' });
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm1',
        reason: 'explicit-request',
        copyKey: 'explicit-request',
      });
    });
    render(<MessageList />);
    // Même une raison forte ne ré-ouvre pas après capture.
    expect(screen.queryByTestId('chat-lead-offer')).not.toBeInTheDocument();
  });

  it("rendu RTL pour language=ar", () => {
    pushAssistantMessage('m1', 'مرحبا');
    useChatStore.setState({ language: 'ar' });
    act(() => {
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm1',
        reason: 'purchase-intent',
        copyKey: 'purchase-intent',
      });
    });
    render(<MessageList />);
    expect(screen.getByTestId('chat-lead-offer')).toHaveAttribute('dir', 'rtl');
  });

  it("CHAT-063 : pré-remplit firstName + phone depuis localStorage", async () => {
    window.localStorage.setItem(
      'fg.chat.lead-prefill.v1',
      JSON.stringify({
        firstName: 'Salma',
        phone: '+212600112233',
        country: 'MA',
        savedAt: Date.now(),
      }),
    );
    pushAssistantMessage('m1', 'Voici…');
    act(() => {
      useChatStore.getState().receiveLeadOffer({
        messageId: 'm1',
        reason: 'purchase-intent',
        copyKey: 'purchase-intent',
      });
      useChatStore.getState().openLeadForm();
    });
    render(<MessageList />);
    const form = await screen.findByTestId('chat-lead-form');
    const firstName = form.querySelector(
      'input[autocomplete="given-name"]',
    ) as HTMLInputElement;
    const phone = form.querySelector('input[type="tel"]') as HTMLInputElement;
    await waitFor(() => {
      expect(firstName.value).toBe('Salma');
      expect(phone.value).toBe('+212600112233');
    });
  });
});
