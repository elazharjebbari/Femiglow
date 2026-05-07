/**
 * RTL — FieldsPanel (P8).
 *
 * Couvre :
 *   - rendu groupé des champs par `field.group`
 *   - compteur "n champs en brouillon" et état du bouton publier
 *   - 409 → ConflictModal visible
 *   - publish flow nominal (flush + publish + reload)
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse, server } from '@/test/msw/server';

import { FieldsPanel } from './FieldsPanel';
import { makeInitialField } from './reducer';
import type { ComponentFieldDefinition } from '@/lib/db/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

const COMP = 'home-hero';
const BASE = `/api/admin/components/${COMP}/fields`;

const TITLE: ComponentFieldDefinition = {
  key: 'title',
  label: 'Titre',
  type: 'text',
  required: true,
  group: 'Contenu',
  order: 1,
};

const SUBTITLE: ComponentFieldDefinition = {
  key: 'subtitle',
  label: 'Sous-titre',
  type: 'text',
  required: false,
  group: 'Contenu',
  order: 2,
};

const COLOR: ComponentFieldDefinition = {
  key: 'accent',
  label: 'Couleur',
  type: 'color-token',
  required: false,
  group: 'Apparence',
  order: 1,
};

function setup(initialOverrides?: Record<string, ReturnType<typeof makeInitialField>>) {
  return render(
    <FieldsPanel
      componentKey={COMP}
      fieldDefs={[TITLE, SUBTITLE, COLOR]}
      initialFields={
        initialOverrides ?? {
          title: makeInitialField('Bienvenue', '2026-05-05T10:00:00.000Z'),
          subtitle: makeInitialField('Sous', '2026-05-05T10:00:00.000Z'),
          accent: makeInitialField('creme', '2026-05-05T10:00:00.000Z'),
        }
      }
      locale="fr"
    />,
  );
}

describe('FieldsPanel — rendu', () => {
  it('groupe les champs par `group` et préserve l\'ordre', () => {
    setup();
    const legends = screen.getAllByRole('group').map((g) => g.querySelector('legend')?.textContent);
    expect(legends).toEqual(['Contenu', 'Apparence']);
    // Les inputs textbox sont dans l'ordre title puis subtitle.
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes[0]).toHaveAccessibleName(/Titre/);
    expect(textboxes[1]).toHaveAccessibleName(/Sous-titre/);
  });

  it('affiche "Aucune modification en attente" et désactive le bouton publier au repos', () => {
    setup();
    expect(screen.getByText(/Aucune modification en attente/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publier les modifications/ })).toBeDisabled();
  });

  it('incrémente le compteur dirty quand un champ change et active le bouton publier', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Titre/), { target: { value: 'Nouveau' } });
    expect(screen.getByText(/champ.* en brouillon/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publier les modifications/ })).not.toBeDisabled();
  });
});

describe('FieldsPanel — conflit', () => {
  it('ouvre la ConflictModal sur 409', async () => {
    server.use(
      http.patch(`${BASE}/title`, async () =>
        HttpResponse.json(
          {
            error: {
              code: 'version_conflict',
              message: 'Conflit',
              details: {
                remoteValue: 'Server version',
                remoteUpdatedAt: '2026-05-05T13:00:00.000Z',
                remoteAuthorId: 'adm_2',
              },
            },
          },
          { status: 409 },
        ),
      ),
    );

    vi.useFakeTimers();
    setup();
    fireEvent.change(screen.getByLabelText(/Titre/), { target: { value: 'Mine' } });
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Votre version' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Version sur le serveur' })).toBeInTheDocument();
  });
});

describe('FieldsPanel — publish', () => {
  it('flush + publish + reload sur clic du bouton', async () => {
    let patchCount = 0;
    let publishCount = 0;
    let reloadCount = 0;
    server.use(
      http.patch(`${BASE}/:fieldKey`, () => {
        patchCount++;
        return HttpResponse.json({
          binding: { updatedAt: '2026-05-05T16:00:00.000Z' },
        });
      }),
      http.post(`${BASE}/:fieldKey/publish`, () => {
        publishCount++;
        return HttpResponse.json({
          binding: { updatedAt: '2026-05-05T17:00:00.000Z' },
        });
      }),
      http.get(BASE, () => {
        reloadCount++;
        return HttpResponse.json({
          componentKey: COMP,
          locale: 'fr',
          fields: [
            {
              key: 'title',
              label: 'Titre',
              type: 'text',
              required: false,
              published: { value: 'Nouveau', updatedAt: '2026-05-05T17:00:00.000Z' },
              draft: null,
            },
          ],
        });
      }),
    );

    setup();
    fireEvent.change(screen.getByLabelText(/Titre/), { target: { value: 'Nouveau' } });

    const publishBtn = screen.getByRole('button', { name: /Publier les modifications/ });
    await act(async () => {
      fireEvent.click(publishBtn);
    });

    await waitFor(() => {
      expect(patchCount).toBeGreaterThanOrEqual(1);
      expect(publishCount).toBeGreaterThanOrEqual(1);
      expect(reloadCount).toBe(1);
    });
  });
});
