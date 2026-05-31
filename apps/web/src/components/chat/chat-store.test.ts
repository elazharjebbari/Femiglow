/**
 * CHA-231 — Tests du store chat (gaps 2 + 3).
 *
 * Vérifie :
 *  - Gap 2 : buffer offer quand le formulaire est ouvert/submitting.
 *  - Gap 3 : `force=true` bypasse `leadOfferDismissedSessionId`.
 *  - Promotion du buffer à dismiss/success.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { useChatStore } from './chat-store';

const SESSION = 'cs_test_store';

function reset(): void {
  useChatStore.getState().reset();
  // Pose une session id pour que les checks `=== sessionId` fonctionnent.
  useChatStore.setState({ sessionId: SESSION });
}

describe('chat-store — receiveLeadOffer (CHA-231 gap 2 + 3)', () => {
  beforeEach(() => {
    reset();
  });

  it('accepte la première offre quand le formulaire est idle', () => {
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm1',
      reason: 'purchase-intent',
      copyKey: 'purchase-intent',
    });
    const s = useChatStore.getState();
    expect(s.leadOffer.status).toBe('offered');
    expect(s.leadOffer.triggeringMessageId).toBe('m1');
    expect(s.pendingLeadOffer).toBeNull();
  });

  it('ignore l\'offre si le lead a déjà été capturé pour la session', () => {
    useChatStore.setState({ leadCapturedSessionId: SESSION });
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm1',
      reason: 'purchase-intent',
      copyKey: 'purchase-intent',
    });
    expect(useChatStore.getState().leadOffer.status).toBe('idle');
  });

  it('ignore l\'offre si dismissal est posée ET force=false', () => {
    useChatStore.setState({ leadOfferDismissedSessionId: SESSION });
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm1',
      reason: 'purchase-intent',
      copyKey: 'purchase-intent',
    });
    expect(useChatStore.getState().leadOffer.status).toBe('idle');
  });

  it('GAP 3 — force=true bypasse la dismissal', () => {
    useChatStore.setState({ leadOfferDismissedSessionId: SESSION });
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm1',
      reason: 'explicit-request',
      copyKey: 'explicit-request',
      force: true,
    });
    const s = useChatStore.getState();
    expect(s.leadOffer.status).toBe('offered');
    expect(s.leadOfferDismissedSessionId).toBeNull(); // bypass clear le flag
  });

  it('GAP 2 — buffer si formulaire ouvert', () => {
    // Première offre → status=offered.
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm1',
      reason: 'purchase-intent',
      copyKey: 'purchase-intent',
    });
    // User ouvre le formulaire (saisie en cours).
    useChatStore.getState().openLeadForm();
    expect(useChatStore.getState().leadOffer.status).toBe('open');

    // Deuxième offre arrive → buffer, ne pas écraser.
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm2',
      reason: 'negotiation',
      copyKey: 'negotiation',
    });
    const s = useChatStore.getState();
    expect(s.leadOffer.status).toBe('open');
    expect(s.leadOffer.triggeringMessageId).toBe('m1'); // pas écrasé
    expect(s.pendingLeadOffer).not.toBeNull();
    expect(s.pendingLeadOffer?.triggeringMessageId).toBe('m2');
    expect(s.pendingLeadOffer?.reason).toBe('negotiation');
  });

  it('GAP 2 — buffer si formulaire submitting', () => {
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm1',
      reason: 'purchase-intent',
      copyKey: 'purchase-intent',
    });
    useChatStore.getState().openLeadForm();
    useChatStore.getState().setLeadFormSubmitting();
    expect(useChatStore.getState().leadOffer.status).toBe('submitting');

    useChatStore.getState().receiveLeadOffer({
      messageId: 'm2',
      reason: 'wholesaler',
      copyKey: 'wholesaler',
    });
    expect(useChatStore.getState().pendingLeadOffer?.reason).toBe('wholesaler');
  });

  it('GAP 2 — promotion du buffer après dismiss', () => {
    // m1 active, m2 buffer.
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm1',
      reason: 'purchase-intent',
      copyKey: 'purchase-intent',
    });
    useChatStore.getState().openLeadForm();
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm2',
      reason: 'negotiation',
      copyKey: 'negotiation',
    });
    expect(useChatStore.getState().pendingLeadOffer).not.toBeNull();

    // User dismiss m1.
    useChatStore.getState().dismissLeadForm();
    const s = useChatStore.getState();
    // m2 doit être promu en active offer.
    expect(s.leadOffer.status).toBe('offered');
    expect(s.leadOffer.triggeringMessageId).toBe('m2');
    expect(s.leadOffer.reason).toBe('negotiation');
    expect(s.pendingLeadOffer).toBeNull();
  });

  it('GAP 2 — buffer écrase si une 3e offre arrive avant dismiss', () => {
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm1',
      reason: 'purchase-intent',
      copyKey: 'purchase-intent',
    });
    useChatStore.getState().openLeadForm();
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm2',
      reason: 'negotiation',
      copyKey: 'negotiation',
    });
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm3',
      reason: 'wholesaler',
      copyKey: 'wholesaler',
    });
    expect(useChatStore.getState().pendingLeadOffer?.triggeringMessageId).toBe('m3');
  });

  it('GAP 2 — pas de promotion si lead déjà capturé', () => {
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm1',
      reason: 'purchase-intent',
      copyKey: 'purchase-intent',
    });
    useChatStore.getState().openLeadForm();
    useChatStore.getState().setLeadFormSuccess('Ok');
    // Tentative d'offre post-success → ignorée.
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm2',
      reason: 'negotiation',
      copyKey: 'negotiation',
    });
    expect(useChatStore.getState().pendingLeadOffer).toBeNull();
    expect(useChatStore.getState().leadOffer.status).toBe('success');
  });

  it('GAP 2 + 3 — buffer avec force=true bypass la dismissal après promotion', () => {
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm1',
      reason: 'purchase-intent',
      copyKey: 'purchase-intent',
    });
    useChatStore.getState().openLeadForm();
    useChatStore.getState().receiveLeadOffer({
      messageId: 'm2',
      reason: 'explicit-request',
      copyKey: 'explicit-request',
      force: true,
    });
    useChatStore.getState().dismissLeadForm();
    const s = useChatStore.getState();
    expect(s.leadOffer.status).toBe('offered');
    expect(s.leadOffer.triggeringMessageId).toBe('m2');
    // Le force=true clear la dismissal.
    expect(s.leadOfferDismissedSessionId).toBeNull();
  });
});
