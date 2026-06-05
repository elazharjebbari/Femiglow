/**
 * UX4-PARCOURS-002 — Le formulaire newsletter (double opt-in) DOIT être
 * réellement monté dans une section publique (pas seulement défini puis jamais
 * importé).
 *
 * Issue (UX-PUB-002) : NewsletterForm portait tout le flux double opt-in mais
 * son point d'entrée public était fragile. La source de vérité du montage est
 * `NewsletterBlock` (section publique rendue par la home `/`, le journal, et
 * chaque article — cf. `src/app/[locale]/page.tsx`, `journal/page.tsx`, etc.).
 *
 * Cette suite prouve DEUX choses :
 *   1. Le call-site existe et résout : `NewsletterBlock` rend bien
 *      `NewsletterForm` (champ email + consentement + bouton d'inscription).
 *   2. La section est correctement labellisée (a11y) et porte le titre éditorial.
 *
 * Le montage passe par `next/dynamic({ ssr:false })` : en jsdom, le chunk est
 * chargé de façon asynchrone → on attend l'apparition du champ via `findBy*`.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NewsletterBlock } from './NewsletterBlock';

describe('UX4-PARCOURS-002 — NewsletterForm monté dans une section publique', () => {
  it('UX4-PARCOURS-002 : NewsletterBlock rend le formulaire newsletter (email + consentement + CTA)', async () => {
    render(<NewsletterBlock source="home-bottom" />);

    // Le champ email du formulaire double opt-in apparaît une fois le chunk
    // dynamique résolu (preuve que le call-site est réel et fonctionnel).
    expect(await screen.findByLabelText(/votre adresse email/i)).toBeInTheDocument();

    // Le consentement explicite (literal(true) côté schéma) est présent.
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    // Le CTA d'inscription est présent.
    expect(
      screen.getByRole('button', { name: /recevoir la lettre/i }),
    ).toBeInTheDocument();
  });

  it('UX4-PARCOURS-002 : la section porte un libellé accessible et le titre éditorial', async () => {
    render(<NewsletterBlock source="journal-bottom" title="Une lettre par saison." />);
    // Attendre la résolution du chunk pour éviter un act() warning résiduel.
    await screen.findByLabelText(/votre adresse email/i);

    const region = screen.getByRole('region', { name: /une lettre par saison/i });
    expect(region).toBeInTheDocument();
  });
});
