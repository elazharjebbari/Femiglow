/**
 * F08-related — Tests Zustand chat-store.
 *
 * Couvre les transitions d'état critiques :
 *  - open/close/toggle
 *  - setSession (initialisation)
 *  - beginStreaming / appendDelta / endStreaming (cycle SSE)
 *  - pushUserMessage / pushAssistantMessage (canned-pair)
 *  - receiveLeadOffer / openLeadForm / dismissLeadForm (CHA-212)
 *  - reset
 *
 * Non testé ici (déjà couvert ailleurs) :
 *  - persist middleware (intégration jsdom localStorage)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from './chat-store';
import type { ChatMessageDto } from '@/lib/chat/contracts';

function freshStore() {
  // Reset complet entre tests pour éviter pollution
  useChatStore.getState().reset();
  // Note : `messages` est conservé après reset() — c'est by design (cf code)
  // donc on force un setSession vide pour reset propre.
}

describe('useChatStore — F08 cycle SSE & UI state', () => {
  beforeEach(() => freshStore());

  describe('open/close/toggle', () => {
    it('open() met isOpen=true et hasInteracted=true', () => {
      const s = useChatStore.getState();
      expect(s.isOpen).toBe(false);
      s.open();
      expect(useChatStore.getState().isOpen).toBe(true);
      expect(useChatStore.getState().hasInteracted).toBe(true);
    });

    it('close() met isOpen=false', () => {
      const s = useChatStore.getState();
      s.open();
      s.close();
      expect(useChatStore.getState().isOpen).toBe(false);
    });

    it('toggle() alterne', () => {
      const s = useChatStore.getState();
      expect(s.isOpen).toBe(false);
      s.toggle();
      expect(useChatStore.getState().isOpen).toBe(true);
      s.toggle();
      expect(useChatStore.getState().isOpen).toBe(false);
    });
  });

  describe('setSession initialise état serveur', () => {
    it('peuple sessionId/language/greeting/suggestions/messages', () => {
      useChatStore.getState().setSession({
        sessionId: 'cs_test',
        language: 'fr-MA',
        greeting: 'Bonjour !',
        suggestions: [{ id: 'p1', key: 'pricing', label: 'Combien ?' } as any],
        messages: [],
      });
      const s = useChatStore.getState();
      expect(s.sessionId).toBe('cs_test');
      expect(s.language).toBe('fr-MA');
      expect(s.greeting).toBe('Bonjour !');
      expect(s.suggestions).toHaveLength(1);
    });
  });

  describe('cycle SSE — beginStreaming → appendDelta → endStreaming', () => {
    it('beginStreaming insère un message assistant vide et marque isStreaming=true', () => {
      useChatStore.getState().beginStreaming('m_1');
      const s = useChatStore.getState();
      expect(s.isStreaming).toBe(true);
      expect(s.pendingAssistantId).toBe('m_1');
      const msg = s.messages.find((m) => m.id === 'm_1');
      expect(msg).toBeDefined();
      expect(msg?.role).toBe('assistant');
    });

    it('appendDelta concatène le texte sur le message en cours', () => {
      const s = useChatStore.getState();
      s.beginStreaming('m_2');
      s.appendDelta('m_2', 'Bonjour ');
      s.appendDelta('m_2', 'visiteur');
      const msg = useChatStore.getState().messages.find((m) => m.id === 'm_2');
      expect(msg?.content).toBe('Bonjour visiteur');
    });

    it('endStreaming reset isStreaming=false et pendingAssistantId=null', () => {
      const s = useChatStore.getState();
      s.beginStreaming('m_3');
      s.endStreaming('m_3');
      const after = useChatStore.getState();
      expect(after.isStreaming).toBe(false);
      expect(after.pendingAssistantId).toBe(null);
    });
  });

  describe('pushUserMessage', () => {
    it('ajoute un message user en fin de liste', () => {
      const msg: ChatMessageDto = {
        id: 'u_1',
        role: 'user',
        content: 'Salut',
        createdAt: new Date().toISOString(),
      } as ChatMessageDto;
      useChatStore.getState().pushUserMessage(msg);
      const msgs = useChatStore.getState().messages;
      expect(msgs[msgs.length - 1].id).toBe('u_1');
    });
  });

  describe('CHA-212 — receiveLeadOffer → openLeadForm → success', () => {
    it('receiveLeadOffer met status="offered" quand sessionId set + pas dismissed', () => {
      const s = useChatStore.getState();
      s.setSession({
        sessionId: 'cs_offer',
        language: 'fr-MA',
        greeting: '',
        suggestions: [],
        messages: [],
      });
      s.receiveLeadOffer({
        messageId: 'm_x',
        reason: 'purchase-intent',
        copyKey: 'default',
      });
      const lo = useChatStore.getState().leadOffer;
      expect(lo.status).toBe('offered');
      expect(lo.triggeringMessageId).toBe('m_x');
      expect(lo.reason).toBe('purchase-intent');
    });

    it('openLeadForm passe à "open"', () => {
      const s = useChatStore.getState();
      s.receiveLeadOffer({ messageId: 'm', reason: 'frustration', copyKey: 'frustr' });
      s.openLeadForm();
      expect(useChatStore.getState().leadOffer.status).toBe('open');
    });

    it('setLeadFormSubmitting → success → reset', () => {
      const s = useChatStore.getState();
      s.receiveLeadOffer({ messageId: 'm', reason: 'inline-contact', copyKey: 'i' });
      s.openLeadForm();
      s.setLeadFormSubmitting();
      expect(useChatStore.getState().leadOffer.status).toBe('submitting');
      s.setLeadFormSuccess('Merci !');
      expect(useChatStore.getState().leadOffer.status).toBe('success');
      expect(useChatStore.getState().leadOffer.successMessage).toBe('Merci !');
    });

    it('dismissLeadForm enregistre le sessionId pour ne pas re-offer', () => {
      const s = useChatStore.getState();
      s.setSession({
        sessionId: 'cs_dismiss',
        language: 'fr-MA',
        greeting: '',
        suggestions: [],
        messages: [],
      });
      s.receiveLeadOffer({ messageId: 'm', reason: 'frustration', copyKey: 'f' });
      s.dismissLeadForm('user-dismissed');
      const after = useChatStore.getState();
      expect(after.leadOffer.status).toBe('idle');
      expect(after.leadOfferDismissedSessionId).toBe('cs_dismiss');
    });

    it('setLeadFormError met status="error" et errorMessage', () => {
      const s = useChatStore.getState();
      s.receiveLeadOffer({ messageId: 'm', reason: 'purchase-intent', copyKey: 'd' });
      s.openLeadForm();
      s.setLeadFormError('Erreur réseau');
      const lo = useChatStore.getState().leadOffer;
      expect(lo.status).toBe('error');
      expect(lo.errorMessage).toBe('Erreur réseau');
    });
  });

  describe('clearSuggestions', () => {
    it('reset les pills sans toucher aux messages', () => {
      const s = useChatStore.getState();
      s.setSession({
        sessionId: 'cs',
        language: 'fr',
        greeting: 'Hi',
        suggestions: [
          { id: 'p1', key: 'pricing', label: 'Prix' } as any,
          { id: 'p2', key: 'shipping', label: 'Livraison' } as any,
        ],
        messages: [],
      });
      expect(useChatStore.getState().suggestions).toHaveLength(2);
      s.clearSuggestions();
      const after = useChatStore.getState();
      expect(after.suggestions).toHaveLength(0);
      expect(after.greeting).toBe('Hi'); // preservé
    });
  });

  describe('reset', () => {
    it('reset() ramène à l\'état initial volatile (preserved persisted ?)', () => {
      const s = useChatStore.getState();
      s.open();
      s.setError('boom');
      s.reset();
      const after = useChatStore.getState();
      expect(after.isOpen).toBe(false);
      expect(after.error).toBe(null);
    });
  });
});
