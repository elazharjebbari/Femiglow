import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LeadAckNotice } from './LeadAckNotice';

const props = {
  title: 'C’est noté, Salma.',
  body: 'Nous vous appelons au 06 26 62 88 30 pour confirmer votre commande.',
  compactLabel: 'Noté · on vous appelle au 06 26 62 88 30',
  phone: '06 26 62 88 30',
};

describe('LeadAckNotice', () => {
  it('carte complète : titre, annonce de l’appel, numéro isolé de gauche à droite', () => {
    render(<LeadAckNotice {...props} expanded />);
    const notice = screen.getByTestId('wizard-lead-ack');
    expect(notice).toHaveAttribute('data-expanded', 'true');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveTextContent(props.title);
    expect(notice).toHaveTextContent(props.body);
    const phone = screen.getByText(props.phone);
    expect(phone.tagName).toBe('BDI');
    expect(phone).toHaveAttribute('dir', 'ltr');
  });

  it('repliée : une ligne, sans le titre, avec le numéro', () => {
    render(<LeadAckNotice {...props} expanded={false} />);
    const notice = screen.getByTestId('wizard-lead-ack');
    expect(notice).toHaveAttribute('data-expanded', 'false');
    expect(notice).toHaveTextContent(props.compactLabel);
    expect(notice).not.toHaveTextContent(props.title);
  });

  it('texte sans le numéro : affiché tel quel, sans casser', () => {
    render(<LeadAckNotice {...props} body="Nous vous appelons bientôt." expanded />);
    expect(screen.getByTestId('wizard-lead-ack')).toHaveTextContent('Nous vous appelons bientôt.');
  });
});
