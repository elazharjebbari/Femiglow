import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';

describe('Button — chargement', () => {
  it('garde le texte français par défaut', () => {
    render(<Button loading>Envoyer</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Un instant…');
  });

  it('affiche loadingLabel à la place', () => {
    render(
      <Button loading loadingLabel="لحظة من فضلك…">
        Envoyer
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('لحظة من فضلك…');
    expect(button).not.toHaveTextContent('Un instant');
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('hors chargement, affiche son libellé', () => {
    render(<Button loadingLabel="Saving…">Send</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Send');
  });
});
