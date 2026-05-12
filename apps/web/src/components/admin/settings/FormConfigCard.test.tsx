/**
 * Tests FormConfigCard — rend label / version / badge actif/inactif + link href.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormConfigCard } from './FormConfigCard';

describe('FormConfigCard', () => {
  it('rend label, version courante et description', () => {
    render(
      <FormConfigCard
        href="/admin/settings/form-config/wizard_kit"
        label="Wizard Kit"
        description="Wizard intégré sur la page /kit"
        version={4}
        active
        updatedAt="2026-05-12T10:00:00Z"
        updatedBy="adm_1"
      />,
    );
    expect(screen.getByText('Wizard Kit')).toBeInTheDocument();
    expect(screen.getByText('Wizard intégré sur la page /kit')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/version courante/i)).toBeInTheDocument();
  });

  it('badge "Actif · vN" quand active=true', () => {
    render(
      <FormConfigCard
        href="/x"
        label="K"
        description=""
        version={7}
        active
        updatedAt="2026-05-12T10:00:00Z"
      />,
    );
    expect(screen.getByText(/Actif/)).toBeInTheDocument();
    expect(screen.getByText(/v7/)).toBeInTheDocument();
  });

  it('badge "Inactif" quand active=false', () => {
    render(
      <FormConfigCard
        href="/x"
        label="K"
        description=""
        version={1}
        active={false}
        updatedAt="2026-05-12T10:00:00Z"
      />,
    );
    expect(screen.getByText('Inactif')).toBeInTheDocument();
  });

  it('rend un Link avec le href fourni', () => {
    render(
      <FormConfigCard
        href="/admin/settings/form-config/wizard_kit"
        label="Wizard Kit"
        description=""
        version={1}
        active
        updatedAt="2026-05-12T10:00:00Z"
      />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/admin/settings/form-config/wizard_kit');
  });

  it('affiche "—" quand updatedAt invalide', () => {
    render(
      <FormConfigCard
        href="/x"
        label="K"
        description=""
        version={1}
        active
        updatedAt="not-a-date"
      />,
    );
    expect(screen.getByText(/Dernière édition —/)).toBeInTheDocument();
  });

  it('affiche updatedBy quand fourni', () => {
    render(
      <FormConfigCard
        href="/x"
        label="K"
        description=""
        version={1}
        active
        updatedAt="2026-05-12T10:00:00Z"
        updatedBy="adm_42"
      />,
    );
    expect(screen.getByText(/adm_42/)).toBeInTheDocument();
  });
});
