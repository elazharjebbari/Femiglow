import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GtmConfigVersionList } from './GtmConfigVersionList';

const VERSIONS = [
  {
    id: 'uuid-v3',
    name: 'v3 — pixels mobile',
    notes: 'switch Meta vers pixel mobile',
    createdAt: new Date(Date.now() - 1000 * 60).toISOString(),
    createdBy: 'admin_test',
  },
  {
    id: 'uuid-v2',
    name: 'v2',
    notes: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    createdBy: 'admin_test',
  },
];

describe('GtmConfigVersionList', () => {
  it('affiche un état vide si versions=[]', () => {
    render(
      <GtmConfigVersionList activeId={null} versions={[]} onActivate={async () => {}} onDelete={async () => {}} />,
    );
    expect(screen.getByText(/aucune version/i)).toBeInTheDocument();
  });

  it('marque la version active avec un badge "Active"', () => {
    render(
      <GtmConfigVersionList
        activeId="uuid-v3"
        versions={VERSIONS}
        onActivate={async () => {}}
        onDelete={async () => {}}
      />,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
    // v2 archivée
    expect(screen.getByText('Archivée')).toBeInTheDocument();
  });

  it('appelle onActivate au clic sur "Activer" d\'une version archivée', async () => {
    const onActivate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <GtmConfigVersionList
        activeId="uuid-v3"
        versions={VERSIONS}
        onActivate={onActivate}
        onDelete={async () => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Activer' }));
    expect(onActivate).toHaveBeenCalledWith('uuid-v2');
  });

  it('demande confirmation avant de supprimer', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <GtmConfigVersionList
        activeId="uuid-v3"
        versions={VERSIONS}
        onActivate={async () => {}}
        onDelete={onDelete}
      />,
    );
    // 1er clic = entre en mode confirm
    await user.click(screen.getByRole('button', { name: /^supprimer$/i }));
    expect(onDelete).not.toHaveBeenCalled();
    // 2e clic = confirme
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    expect(onDelete).toHaveBeenCalledWith('uuid-v2');
  });

  it('ne montre pas de bouton Supprimer pour la version active', () => {
    render(
      <GtmConfigVersionList
        activeId="uuid-v3"
        versions={VERSIONS}
        onActivate={async () => {}}
        onDelete={async () => {}}
      />,
    );
    // Il n'y a qu'un bouton Supprimer (pour v2 archivée), pas pour v3 active.
    expect(screen.getAllByRole('button', { name: /^supprimer$/i })).toHaveLength(1);
  });
});
