import { describe, expect, it } from 'vitest';

import { detectClientAssistantLeadTrigger } from './assistant-reply-lead-trigger.client';

describe('detectClientAssistantLeadTrigger', () => {
  it('detecte une phrase de formulaire explicite', () => {
    const result = detectClientAssistantLeadTrigger(
      'Je vous affiche le formulaire juste ici.',
      'fr',
    );

    expect(result).toMatchObject({
      shouldOffer: true,
      reason: 'manual',
      copyKey: 'manual',
      source: 'client-safety-net',
    });
  });

  it('detecte une demande de rappel', () => {
    const result = detectClientAssistantLeadTrigger(
      'Laissez votre numero, une conseillere vous rappellera.',
      'fr',
    );

    expect(result?.reason).toBe('explicit-request');
  });

  it('detecte une phrase de commande', () => {
    const result = detectClientAssistantLeadTrigger(
      'Pour finaliser votre commande, laissez vos coordonnees.',
      'fr',
    );

    expect(result?.reason).toBe('explicit-request');
  });

  it('ignore les textes neutres', () => {
    expect(
      detectClientAssistantLeadTrigger('Le prix du kit est de 290 MAD.', 'fr'),
    ).toBeNull();
  });

  it('ignore les negations', () => {
    expect(
      detectClientAssistantLeadTrigger('Pas besoin de formulaire ici.', 'fr'),
    ).toBeNull();
  });
});
