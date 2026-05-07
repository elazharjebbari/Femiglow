/**
 * Tests d'intégration de GtmVisualizationClient.
 *
 * MSW (msw/node) ne capture pas les paths relatifs en jsdom sans baseURL
 * absolue. On mocke `window.fetch` directement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GraphDescriptor } from '@/lib/tracking/gtm/viz/descriptor';
import type { ConfigVersionSummary } from './GtmConfigVersionList';
import { GtmVisualizationClient } from './GtmVisualizationClient';

const DESCRIPTOR_PROD: GraphDescriptor = {
  folders: [
    {
      id: 'F-08',
      name: '08 — Chat assistant',
      color: 'sauge-profond',
      items: [
        {
          kind: 'tag',
          name: 'GA4 Evt — chat_widget_open',
          type: 'gaawe',
          triggers: [{ name: 'CE — chat_widget_open', type: 'customEvent' }],
          setupTags: [],
        },
      ],
    },
  ],
  orphans: [],
  totalTags: 1,
  totalTriggers: 1,
  totalVariables: 5,
};

const VERSION_FIXTURE: ConfigVersionSummary = {
  id: '11111111-2222-3333-4444-555555555555',
  name: 'v1 — initial',
  notes: null,
  createdAt: new Date(Date.now() - 1000).toISOString(),
  createdBy: 'adm_test',
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  // Mock URL.createObjectURL / revokeObjectURL pour éviter les exceptions jsdom
  if (!('createObjectURL' in URL)) {
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  } else {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockOk(body: unknown, type: 'json' | 'text' = 'json') {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: type === 'json' ? async () => body : async () => ({}),
    text: type === 'text' ? async () => String(body) : async () => '',
  } as Response);
}

describe('GtmVisualizationClient — render initial', () => {
  it('affiche le badge env initial + le canvas SVG', () => {
    render(
      <GtmVisualizationClient
        initialDescriptor={DESCRIPTOR_PROD}
        initialEnv="production"
        configs={[VERSION_FIXTURE]}
        activeConfigId={VERSION_FIXTURE.id}
      />,
    );
    expect(screen.getAllByText(/production/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/08 — Chat assistant/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /conteneur GTM/i })).toBeInTheDocument();
  });

  it('rend le sélecteur Configuration avec defaults + active + versions', () => {
    render(
      <GtmVisualizationClient
        initialDescriptor={DESCRIPTOR_PROD}
        initialEnv="production"
        configs={[VERSION_FIXTURE]}
        activeConfigId={VERSION_FIXTURE.id}
      />,
    );
    const select = screen.getByLabelText(/configuration/i);
    expect(select).toBeInTheDocument();
    expect(select).toHaveDisplayValue(/Defaults/i);
  });

  it('rend les 4 boutons d\'action (SVG / PNG / Mermaid / Plein écran)', () => {
    render(
      <GtmVisualizationClient
        initialDescriptor={DESCRIPTOR_PROD}
        initialEnv="production"
        configs={[]}
        activeConfigId={null}
      />,
    );
    expect(screen.getByRole('button', { name: /^SVG$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^PNG$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mermaid$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plein écran/i })).toBeInTheDocument();
  });
});

describe('GtmVisualizationClient — switch env', () => {
  it('refetch /visualization quand l\'env change', async () => {
    const user = userEvent.setup();
    mockOk({ descriptor: DESCRIPTOR_PROD, env: 'stage' });

    render(
      <GtmVisualizationClient
        initialDescriptor={DESCRIPTOR_PROD}
        initialEnv="production"
        configs={[]}
        activeConfigId={null}
      />,
    );

    await user.click(screen.getByRole('tab', { name: /^stage/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('env=stage'),
        expect.objectContaining({ credentials: 'include' }),
      );
    });
  });

  it("inclut configId dans la query si autre que 'defaults'", async () => {
    const user = userEvent.setup();
    mockOk({ descriptor: DESCRIPTOR_PROD, env: 'production' });

    render(
      <GtmVisualizationClient
        initialDescriptor={DESCRIPTOR_PROD}
        initialEnv="production"
        configs={[VERSION_FIXTURE]}
        activeConfigId={VERSION_FIXTURE.id}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/configuration/i), VERSION_FIXTURE.id);

    await waitFor(() => {
      const matched = fetchMock.mock.calls.some(([u]) =>
        String(u).includes(`configId=${VERSION_FIXTURE.id}`),
      );
      expect(matched).toBe(true);
    });
  });
});

describe('GtmVisualizationClient — téléchargement SVG', () => {
  it('crée un blob et déclenche un download au clic', async () => {
    const user = userEvent.setup();

    // Stub HTMLAnchorElement.click pour ne pas naviguer
    const anchorClicks: string[] = [];
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      anchorClicks.push((this as HTMLAnchorElement).download);
    };

    try {
      render(
        <GtmVisualizationClient
          initialDescriptor={DESCRIPTOR_PROD}
          initialEnv="production"
          configs={[]}
          activeConfigId={null}
        />,
      );
      await user.click(screen.getByRole('button', { name: /^SVG$/ }));
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(anchorClicks[0]).toMatch(/^gtm-viz-production-\d{4}-\d{2}-\d{2}\.svg$/);
    } finally {
      HTMLAnchorElement.prototype.click = origClick;
    }
  });
});

describe('GtmVisualizationClient — copie Mermaid', () => {
  it('fetch format=mermaid puis copie au presse-papier', async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);

    mockOk('flowchart LR\n  A --> B\n', 'text');

    render(
      <GtmVisualizationClient
        initialDescriptor={DESCRIPTOR_PROD}
        initialEnv="production"
        configs={[]}
        activeConfigId={null}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Mermaid$/ }));

    await waitFor(() => {
      const matched = fetchMock.mock.calls.some(([u]) =>
        String(u).includes('format=mermaid'),
      );
      expect(matched).toBe(true);
    });
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('flowchart LR'));
    });
    await waitFor(() => {
      expect(screen.getByText(/Mermaid copié/i)).toBeInTheDocument();
    });
  });
});

describe('GtmVisualizationClient — plein écran', () => {
  it("ouvre le modal au clic + ferme avec Esc", async () => {
    const user = userEvent.setup();
    render(
      <GtmVisualizationClient
        initialDescriptor={DESCRIPTOR_PROD}
        initialEnv="production"
        configs={[]}
        activeConfigId={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: /plein écran/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('GtmVisualizationClient — erreurs', () => {
  it('affiche un bandeau alert si le fetch échoue', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'oops' } }),
      text: async () => 'oops',
    } as Response);

    render(
      <GtmVisualizationClient
        initialDescriptor={DESCRIPTOR_PROD}
        initialEnv="production"
        configs={[]}
        activeConfigId={null}
      />,
    );

    await user.click(screen.getByRole('tab', { name: /^stage/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
