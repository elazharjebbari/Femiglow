/**
 * OWBS P6 — funnel chat : `LeadFormBubble` confirme de façon optimiste.
 *  - flag ON  : succès affiché IMMÉDIATEMENT (sans attendre la réponse réseau).
 *  - flag OFF : reste en `submitting` tant que la réponse n'arrive pas (legacy).
 *
 * On contourne les libellés dynamiques (cf. tests skip existants) en ciblant les
 * inputs par id-suffix.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { server, http, HttpResponse } from '@/test/msw/server';
import { LeadFormBubble } from './LeadFormBubble';
import { useChatStore } from './chat-store';

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: vi.fn(), consent: {} }),
}));

const FLAG = 'NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED';
const ORIG = process.env[FLAG];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  if (ORIG === undefined) delete process.env[FLAG];
  else process.env[FLAG] = ORIG;
});
afterAll(() => server.close());

function openForm(): void {
  const s = useChatStore.getState();
  s.reset();
  s.setSession({ sessionId: 'cs_owbs', language: 'fr', greeting: '', suggestions: [], messages: [] });
  s.receiveLeadOffer({ messageId: 'm', reason: 'purchase-intent', copyKey: 'default' });
  s.openLeadForm();
}

async function fillAndSubmit(container: HTMLElement): Promise<void> {
  await userEvent.type(container.querySelector('input[id$="-firstName"]') as HTMLInputElement, 'Salma');
  await userEvent.type(container.querySelector('input[id$="-phone"]') as HTMLInputElement, '0600000000');
  await userEvent.click(container.querySelector('[data-testid="chat-lead-submit"]') as HTMLElement);
}

describe('LeadFormBubble — OWBS optimiste (P6)', () => {
  beforeEach(() => {
    // Réponse qui ne résout JAMAIS → isole le comportement « avant réponse ».
    server.use(
      http.post('/api/chat/lead/contact', () => new Promise<Response>(() => {}) as unknown as Response),
    );
  });

  it('flag ON → succès affiché immédiatement (sans attendre la réponse)', async () => {
    process.env[FLAG] = 'true';
    openForm();
    const { container } = render(<LeadFormBubble language="fr" />);
    await fillAndSubmit(container);
    await waitFor(() => expect(useChatStore.getState().leadOffer.status).toBe('success'));
  });

  it('flag OFF → reste en submitting tant que la réponse n\'arrive pas (legacy)', async () => {
    process.env[FLAG] = 'false';
    openForm();
    const { container } = render(<LeadFormBubble language="fr" />);
    await fillAndSubmit(container);
    await new Promise((r) => setTimeout(r, 50));
    expect(useChatStore.getState().leadOffer.status).toBe('submitting');
  });
});
