import { describe, expect, it } from 'vitest';

import { detectAssistantReplyLeadTrigger } from './assistant-reply-lead-trigger';

describe('detectAssistantReplyLeadTrigger', () => {
  it('detecte une proposition explicite de formulaire', () => {
    const result = detectAssistantReplyLeadTrigger({
      assistantReply: 'Je vous affiche le formulaire juste ici pour etre rappelee.',
      currentIntent: 'misc',
      language: 'fr',
    });

    expect(result).toMatchObject({
      shouldOffer: true,
      reason: 'manual',
      copyKey: 'manual',
      source: 'assistant-reply-form',
      confidence: 'high',
    });
  });

  it('mappe les phrases de rappel vers explicit-request', () => {
    const result = detectAssistantReplyLeadTrigger({
      assistantReply: 'Laissez votre numero, une conseillere vous appellera rapidement.',
      currentIntent: 'misc',
      language: 'fr',
    });

    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('explicit-request');
    expect(result.copyKey).toBe('explicit-request');
  });

  it('mappe les phrases de commande vers purchase-intent', () => {
    const result = detectAssistantReplyLeadTrigger({
      assistantReply: 'Pour finaliser votre commande, je vous affiche le formulaire.',
      currentIntent: 'misc',
      language: 'fr',
    });

    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('manual');
    expect(result.copyKey).toBe('manual');
    expect(result.confidence).toBe('high');
  });

  it("raffine avec l'intent courant quand il est commercial", () => {
    const result = detectAssistantReplyLeadTrigger({
      assistantReply: 'Je vous affiche le formulaire juste ici.',
      currentIntent: 'purchase-intent',
      language: 'fr',
    });

    expect(result.reason).toBe('purchase-intent');
    expect(result.copyKey).toBe('purchase-intent');
  });

  it('detecte une proposition en arabe', () => {
    const result = detectAssistantReplyLeadTrigger({
      assistantReply: 'اتركي رقمك وسنتصل بك قريبا.',
      currentIntent: 'misc',
      language: 'ar',
    });

    expect(result.shouldOffer).toBe(true);
    expect(result.reason).toBe('explicit-request');
  });

  it('detecte une proposition en darija latinisee', () => {
    const result = detectAssistantReplyLeadTrigger({
      assistantReply: 'Khalli numero dyalek, ghadi n3ayto lik.',
      currentIntent: 'misc',
      language: 'ar-MA',
    });

    expect(result.shouldOffer).toBe(true);
  });

  it('ignore les textes informatifs sans invitation forte', () => {
    const result = detectAssistantReplyLeadTrigger({
      assistantReply: 'Le rituel contient une huile et une creme pour les ongles.',
      currentIntent: 'ingredient',
      language: 'fr',
    });

    expect(result.shouldOffer).toBe(false);
    expect(result.confidence).toBe('none');
  });

  it('ignore les negations', () => {
    const result = detectAssistantReplyLeadTrigger({
      assistantReply: 'Pas besoin de formulaire pour cette question.',
      currentIntent: 'misc',
      language: 'fr',
    });

    expect(result.shouldOffer).toBe(false);
  });
});
