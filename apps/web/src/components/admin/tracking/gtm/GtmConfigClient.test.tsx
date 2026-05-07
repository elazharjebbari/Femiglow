/**
 * Tests d'intégration de GtmConfigClient.
 *
 * MSW (msw/node) ne capture pas les paths relatifs en jsdom sans baseURL
 * absolue. On mocke `window.fetch` directement avec vi.fn().
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GtmConfigClient } from './GtmConfigClient';
import type { ConfigVersionSummary } from './GtmConfigVersionList';

const VERSION_FIXTURE: ConfigVersionSummary = {
  id: '11111111-2222-3333-4444-555555555555',
  name: 'v1 — initial',
  notes: 'first version',
  createdAt: new Date(Date.now() - 1000 * 60).toISOString(),
  createdBy: 'adm_test',
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockOk(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok: status < 400,
    status,
    json: async () => body,
  } as Response);
}

function mockFail(status = 500, body: unknown = { error: { message: 'oops' } }) {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => body,
  } as Response);
}

describe('GtmConfigClient — initial render', () => {
  it('affiche le formulaire ET la liste', () => {
    // Refresh au mount → on mocke la réponse list
    mockOk({ activeId: null, versions: [] });
    render(<GtmConfigClient initialActiveId={null} initialVersions={[]} />);
    expect(screen.getByRole('heading', { name: /nouvelle configuration/i })).toBeInTheDocument();
    expect(screen.getByText(/historique \(0\)/i)).toBeInTheDocument();
  });

  it("affiche les versions initiales si fournies", () => {
    mockOk({ activeId: VERSION_FIXTURE.id, versions: [VERSION_FIXTURE] });
    render(
      <GtmConfigClient
        initialActiveId={VERSION_FIXTURE.id}
        initialVersions={[VERSION_FIXTURE]}
      />,
    );
    expect(screen.getByText('v1 — initial')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/historique \(1\)/i)).toBeInTheDocument();
  });
});

describe('GtmConfigClient — création', () => {
  it("POST /configs au submit, puis refresh la liste", async () => {
    const user = userEvent.setup();
    // 1. Refresh au mount
    mockOk({ activeId: null, versions: [] });
    // 2. POST création
    mockOk(
      {
        id: VERSION_FIXTURE.id,
        name: 'v1',
        notes: null,
        createdAt: VERSION_FIXTURE.createdAt,
        createdBy: 'adm',
        perEnv: {},
      },
      201,
    );
    // 3. Refresh post-création
    mockOk({ activeId: VERSION_FIXTURE.id, versions: [{ ...VERSION_FIXTURE, name: 'v1' }] });

    render(<GtmConfigClient initialActiveId={null} initialVersions={[]} />);

    await user.type(screen.getByPlaceholderText(/v1/), 'v1');
    await user.click(screen.getByRole('button', { name: /créer la version/i }));

    await waitFor(() => {
      // Au moins 2 fetch : refresh initial + POST
      expect(fetchMock).toHaveBeenCalled();
    });
    const calls = fetchMock.mock.calls;
    const post = calls.find(([_, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(post).toBeDefined();
    expect(post![0]).toBe('/api/admin/tracking/gtm/configs');
    const body = JSON.parse((post![1] as RequestInit).body as string);
    expect(body.name).toBe('v1');
  });

  it("affiche l'erreur du serveur si POST échoue", async () => {
    const user = userEvent.setup();
    mockOk({ activeId: null, versions: [] }); // refresh initial
    mockFail(400, { error: { message: 'Données invalides' } });

    render(<GtmConfigClient initialActiveId={null} initialVersions={[]} />);
    await user.type(screen.getByPlaceholderText(/v1/), 'v1');
    await user.click(screen.getByRole('button', { name: /créer la version/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/données invalides/i)).toBeInTheDocument();
    });
  });
});

describe('GtmConfigClient — activation', () => {
  it('POST /[id]/activate sur clic "Activer"', async () => {
    const user = userEvent.setup();
    const v2 = {
      id: '22222222-2222-3333-4444-555555555555',
      name: 'v2',
      notes: null,
      createdAt: new Date().toISOString(),
      createdBy: 'adm',
    };
    // refresh au mount
    mockOk({ activeId: VERSION_FIXTURE.id, versions: [v2, VERSION_FIXTURE] });
    // POST activate
    mockOk({ id: v2.id });
    // refresh post-activate
    mockOk({ activeId: v2.id, versions: [v2, VERSION_FIXTURE] });

    render(
      <GtmConfigClient
        initialActiveId={VERSION_FIXTURE.id}
        initialVersions={[v2, VERSION_FIXTURE]}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: /^activer$/i })[0]!);

    await waitFor(() => {
      const activateCall = fetchMock.mock.calls.find(([url]) =>
        String(url).includes(`/configs/${v2.id}/activate`),
      );
      expect(activateCall).toBeDefined();
      expect((activateCall![1] as RequestInit).method).toBe('POST');
    });
  });
});

describe('GtmConfigClient — suppression', () => {
  it("DELETE /[id] après confirmation", async () => {
    const user = userEvent.setup();
    const v2 = {
      id: '22222222-2222-3333-4444-555555555555',
      name: 'v2',
      notes: null,
      createdAt: new Date().toISOString(),
      createdBy: 'adm',
    };
    mockOk({ activeId: VERSION_FIXTURE.id, versions: [v2, VERSION_FIXTURE] });
    mockOk({ ok: true });
    mockOk({ activeId: VERSION_FIXTURE.id, versions: [VERSION_FIXTURE] });

    render(
      <GtmConfigClient
        initialActiveId={VERSION_FIXTURE.id}
        initialVersions={[v2, VERSION_FIXTURE]}
      />,
    );

    // 1er clic : passe en mode confirm
    await user.click(screen.getByRole('button', { name: /^supprimer$/i }));
    // 2e clic : confirm
    await user.click(screen.getByRole('button', { name: /confirmer/i }));

    await waitFor(() => {
      const del = fetchMock.mock.calls.find(([_, init]) =>
        (init as RequestInit | undefined)?.method === 'DELETE',
      );
      expect(del).toBeDefined();
      expect(String(del![0])).toContain(`/configs/${v2.id}`);
    });
  });
});
