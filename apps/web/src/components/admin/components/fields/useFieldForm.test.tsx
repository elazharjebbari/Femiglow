/**
 * RTL — useFieldForm + ConflictModal (P7).
 *
 * Couvre :
 *   - debounce 800 ms : un seul PATCH après plusieurs FIELD_CHANGED rapides
 *   - flush() : save immédiat
 *   - SAVE_FAILED : message d'erreur conservé, current intact
 *   - 409 → CONFLICT_DETECTED + ConflictModal
 *   - keep-local → forceSave (PATCH sans If-Match)
 *   - accept-remote → reloadFromServer (GET → RELOAD)
 *   - publish : flush + POST par champ + reload
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor, render, screen, fireEvent } from '@testing-library/react';
import { http, HttpResponse, server } from '@/test/msw/server';

import { useFieldForm, SAVE_DEBOUNCE_MS } from './useFieldForm';
import { makeInitialField } from './reducer';
import { ConflictModal } from './ConflictModal';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

const COMP = 'home-hero';
const BASE = `/api/admin/components/${COMP}/fields`;

function setup() {
  return renderHook(() =>
    useFieldForm({
      componentKey: COMP,
      locale: 'fr',
      initial: {
        title: makeInitialField('Hello', '2026-05-05T10:00:00.000Z'),
      },
    }),
  );
}

describe('useFieldForm — debounce + autosave', () => {
  it('un seul PATCH après plusieurs FIELD_CHANGED rapides', async () => {
    let patchCount = 0;
    server.use(
      http.patch(`${BASE}/title`, async () => {
        patchCount++;
        return HttpResponse.json({
          binding: { updatedAt: '2026-05-05T11:00:00.000Z' },
        });
      }),
    );

    vi.useFakeTimers();
    const { result } = setup();

    act(() => result.current.onChange('title', 'a'));
    act(() => result.current.onChange('title', 'ab'));
    act(() => result.current.onChange('title', 'abc'));

    // Avant debounce : aucun PATCH.
    expect(patchCount).toBe(0);

    await act(async () => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS + 50);
    });
    vi.useRealTimers();

    await waitFor(() => expect(patchCount).toBe(1));
    await waitFor(() => {
      expect(result.current.state.fields.title!.lastSavedAt).toBeTruthy();
    });
  });

  it('flush() persiste immédiatement sans attendre debounce', async () => {
    let patchCount = 0;
    server.use(
      http.patch(`${BASE}/title`, async () => {
        patchCount++;
        return HttpResponse.json({
          binding: { updatedAt: '2026-05-05T12:00:00.000Z' },
        });
      }),
    );

    const { result } = setup();
    act(() => result.current.onChange('title', 'flushed'));
    await act(async () => {
      await result.current.flush('title');
    });
    expect(patchCount).toBe(1);
  });

  it('SAVE_FAILED conserve current et l\'erreur', async () => {
    server.use(
      http.patch(`${BASE}/title`, async () =>
        HttpResponse.json(
          { error: { code: 'validation_failed', message: 'Trop court' } },
          { status: 422 },
        ),
      ),
    );

    const { result } = setup();
    act(() => result.current.onChange('title', 'x'));
    await act(async () => {
      await result.current.flush('title');
    });
    expect(result.current.state.fields.title!.error).toBe('Trop court');
    expect(result.current.state.fields.title!.current).toBe('x');
    expect(result.current.state.fields.title!.saving).toBe(false);
  });

  it('409 ouvre la modale conflit', async () => {
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

    const { result } = setup();
    act(() => result.current.onChange('title', 'mine'));
    await act(async () => {
      await result.current.flush('title');
    });
    expect(result.current.state.conflict).toBeTruthy();
    expect(result.current.state.conflict!.localValue).toBe('mine');
    expect(result.current.state.conflict!.remoteValue).toBe('Server version');
  });
});

describe('useFieldForm — résolution conflit', () => {
  it('forceSave POST sans If-Match et clôt la modale', async () => {
    let firstCall = true;
    let lastIfMatch: string | null = null;
    server.use(
      http.patch(`${BASE}/title`, async ({ request }) => {
        if (firstCall) {
          firstCall = false;
          return HttpResponse.json(
            {
              error: {
                code: 'version_conflict',
                message: 'Conflit',
                details: {
                  remoteValue: 'X',
                  remoteUpdatedAt: '2026-05-05T13:00:00.000Z',
                  remoteAuthorId: null,
                },
              },
            },
            { status: 409 },
          );
        }
        lastIfMatch = request.headers.get('if-match');
        return HttpResponse.json({
          binding: { updatedAt: '2026-05-05T14:00:00.000Z' },
        });
      }),
    );

    const { result } = setup();
    act(() => result.current.onChange('title', 'mine'));
    await act(async () => {
      await result.current.flush('title');
    });
    expect(result.current.state.conflict).toBeTruthy();

    await act(async () => {
      await result.current.forceSave('title');
    });
    expect(lastIfMatch).toBeNull();
    expect(result.current.state.conflict).toBeNull();
    expect(result.current.state.fields.title!.lastSavedAt).toBeTruthy();
  });

  it('reloadFromServer remplace les fields via GET', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({
          componentKey: COMP,
          locale: 'fr',
          fields: [
            {
              key: 'title',
              label: 'T',
              type: 'text',
              required: false,
              published: { value: 'Server', updatedAt: '2026-05-05T15:00:00.000Z' },
              draft: null,
            },
          ],
        }),
      ),
    );
    const { result } = setup();
    await act(async () => {
      await result.current.reloadFromServer();
    });
    expect(result.current.state.fields.title!.current).toBe('Server');
    expect(result.current.state.fields.title!.ifMatch).toBe('2026-05-05T15:00:00.000Z');
    expect(result.current.state.conflict).toBeNull();
  });
});

describe('useFieldForm — publish', () => {
  it('flush + POST par champ + reload', async () => {
    let patchCount = 0;
    let publishCount = 0;
    let reloadCount = 0;
    server.use(
      http.patch(`${BASE}/title`, () => {
        patchCount++;
        return HttpResponse.json({
          binding: { updatedAt: '2026-05-05T16:00:00.000Z' },
        });
      }),
      http.post(`${BASE}/title/publish`, () => {
        publishCount++;
        return HttpResponse.json({ binding: { updatedAt: '2026-05-05T17:00:00.000Z' } });
      }),
      http.get(BASE, () => {
        reloadCount++;
        return HttpResponse.json({
          componentKey: COMP,
          locale: 'fr',
          fields: [
            {
              key: 'title',
              label: 'T',
              type: 'text',
              required: false,
              published: { value: 'New', updatedAt: '2026-05-05T17:00:00.000Z' },
              draft: null,
            },
          ],
        });
      }),
    );

    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.onChange('title', 'New'));
    // Le timer est armé : publish doit le flusher en premier.
    vi.useRealTimers();
    await act(async () => {
      await result.current.publish();
    });
    expect(patchCount).toBe(1);
    expect(publishCount).toBe(1);
    expect(reloadCount).toBe(1);
    expect(result.current.state.publishing).toBe(false);
    expect(result.current.state.publishError).toBeNull();
  });

  it('ignore les 404 publish (pas de draft) et publie le reste', async () => {
    server.use(
      http.post(`${BASE}/title/publish`, () =>
        HttpResponse.json(
          { error: { code: 'not_found', message: 'Aucun draft' } },
          { status: 404 },
        ),
      ),
      http.get(BASE, () =>
        HttpResponse.json({ componentKey: COMP, locale: 'fr', fields: [] }),
      ),
    );

    const { result } = setup();
    await act(async () => {
      await result.current.publish();
    });
    expect(result.current.state.publishing).toBe(false);
    expect(result.current.state.publishError).toBeNull();
  });
});

describe('ConflictModal', () => {
  it('rend les deux versions et appelle les callbacks', () => {
    const keep = vi.fn();
    const accept = vi.fn();
    render(
      <ConflictModal
        conflict={{
          fieldKey: 'title',
          localValue: 'A',
          remoteValue: 'B',
          remoteUpdatedAt: '2026-05-05T13:00:00.000Z',
          remoteAuthorId: 'adm_1',
        }}
        onKeepLocal={keep}
        onAcceptRemote={accept}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Votre version' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Version sur le serveur' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Garder la mienne' }));
    expect(keep).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre celle du serveur' }));
    expect(accept).toHaveBeenCalled();
  });
});
