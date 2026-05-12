import { describe, expect, it } from 'vitest';
import { renderEmailFromRaw } from './email-templates';

const J45_TEMPLATE = `---
subject: Comment se porte votre rituel ?
preheader: Quarante-cinq jours sont passés.
from: La maison FemiGlow <maison@femiglow-maroc.com>
replyTo: info@femiglow-maroc.com
---

Bonjour {{firstName}},

[ Partager mon rituel ]({{ctaUrl}})

Avec soin,
Souheila · FemiGlow
`;

describe('renderEmailFromRaw', () => {
  it('parse front-matter et substitue variables', () => {
    const rendered = renderEmailFromRaw(J45_TEMPLATE, {
      firstName: 'Amal',
      ctaUrl: 'https://femiglow-maroc.com/?wall=share&order=x',
    });
    expect(rendered.subject).toBe('Comment se porte votre rituel ?');
    expect(rendered.body).toContain('Bonjour Amal');
    expect(rendered.body).toContain(
      'https://femiglow-maroc.com/?wall=share&order=x',
    );
    expect(rendered.from).toBe('La maison FemiGlow <maison@femiglow-maroc.com>');
    expect(rendered.replyTo).toBe('info@femiglow-maroc.com');
  });

  it('remplace variable manquante par chaîne vide', () => {
    const rendered = renderEmailFromRaw(J45_TEMPLATE, {
      firstName: 'Amal',
    });
    expect(rendered.body).not.toContain('{{ctaUrl}}');
  });

  it('preheader optionnel', () => {
    const rendered = renderEmailFromRaw(
      '---\nsubject: Test\n---\n\nCorps.',
      {},
    );
    expect(rendered.preheader).toBeNull();
  });
});
