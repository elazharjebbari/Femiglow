import { describe, expect, it } from 'vitest';
import { detectAutoFlags } from './auto-flags';

describe('detectAutoFlags', () => {
  it('texte propre = aucun flag critique', () => {
    const flags = detectAutoFlags(
      'Trois mois et l’ongle a retrouvé sa nervure tranquillement.',
    );
    expect(flags).not.toContain('link_external');
    expect(flags).not.toContain('all_caps');
  });

  it('détecte link_external https', () => {
    const flags = detectAutoFlags('voir https://exemple.com pour plus');
    expect(flags).toContain('link_external');
  });

  it('détecte link_external www', () => {
    const flags = detectAutoFlags('voir www.exemple.com');
    expect(flags).toContain('link_external');
  });

  it('détecte email_in_body', () => {
    const flags = detectAutoFlags('contactez moi à test@exemple.com');
    expect(flags).toContain('email_in_body');
  });

  it('détecte phone_in_body Maroc', () => {
    const flags = detectAutoFlags('mon numéro +212600000000');
    expect(flags).toContain('phone_in_body');
  });

  it('détecte body_short', () => {
    const flags = detectAutoFlags('court');
    expect(flags).toContain('body_short');
  });

  it('détecte body_long > 500', () => {
    const flags = detectAutoFlags('a'.repeat(550));
    expect(flags).toContain('body_long');
  });

  it('détecte all_caps > 50%', () => {
    const flags = detectAutoFlags('JE RECOMMANDE VRAIMENT BEAUCOUP');
    expect(flags).toContain('all_caps');
  });

  it('ne détecte pas all_caps si normal', () => {
    const flags = detectAutoFlags('Je recommande vraiment ce rituel chez moi');
    expect(flags).not.toContain('all_caps');
  });

  it('détecte repetition de caractères', () => {
    const flags = detectAutoFlags('Wahouuuuuu c’était bien');
    expect(flags).toContain('repetition');
  });

  it('détecte forbidden_word par défaut', () => {
    const flags = detectAutoFlags('c’est un vrai miracle ce truc');
    expect(flags).toContain('forbidden_word');
  });

  it('forbiddenWords custom override le défaut', () => {
    const flags = detectAutoFlags('un mot interdit', {
      forbiddenWords: ['interdit'],
    });
    expect(flags).toContain('forbidden_word');
  });
});
