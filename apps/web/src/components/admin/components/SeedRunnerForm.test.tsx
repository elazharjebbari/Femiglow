/**
 * RTL — SeedRunnerForm.
 *
 * Couvre :
 *  - rend les checkboxes (dryRun par défaut coché) et le bouton
 *  - submit → POST sur /api/admin/components/seed-from-docs avec le bon payload
 *  - rapport affiché quand le stream NDJSON renvoie un événement `done`
 *  - erreur affichée si la réponse n'est pas OK (auth, rate-limit, validation)
 *  - non-dryRun affiche le warning « DB modifiée »
 *  - axe sans violation
 *
 * Note : la route renvoie désormais du NDJSON (`application/x-ndjson`)
 * streamé. Le mock de `fetch` simule un `Response` avec un `ReadableStream`
 * en `body`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import { SeedRunnerForm } from './SeedRunnerForm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

interface NDJSONOptions {
  events: unknown[];
  ok?: boolean;
  contentType?: string;
}

/** Construit un mock Response avec un body NDJSON streamé. */
function ndjsonResponse({
  events,
  ok = true,
  contentType = 'application/x-ndjson; charset=utf-8',
}: NDJSONOptions): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const ev of events) {
        controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: ok ? 200 : 500,
    headers: { 'content-type': contentType },
  });
}

const REPORT_PAYLOAD = {
  components: { synced: 36 },
  animations: { synced: 7 },
  images: {
    total: 43,
    seeded: 43,
    skipped: 0,
    activated: 0,
    unmapped: ['kit/orphelin.png'],
    errors: [],
  },
  durationMs: 12_345,
};

const SUCCESS_EVENTS = [
  { type: 'phase', phase: 'images', total: 43, message: 'Optimisation…' },
  {
    type: 'item',
    phase: 'images',
    current: 1,
    total: 43,
    item: 'home/hero.png',
    status: 'seeded',
  },
  { type: 'done', report: REPORT_PAYLOAD },
];

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ndjsonResponse({ events: SUCCESS_EVENTS })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SeedRunnerForm', () => {
  it('rend dryRun coché par défaut + bouton « Lancer le dry-run »', () => {
    render(<SeedRunnerForm />);
    const dryRun = screen.getByRole('checkbox', { name: /dry-run/i });
    expect(dryRun).toBeChecked();
    expect(
      screen.getByRole('button', { name: /lancer le dry-run/i }),
    ).toBeInTheDocument();
  });

  it('submit → POST avec le bon payload', async () => {
    const fetchMock = vi.fn(async () => ndjsonResponse({ events: SUCCESS_EVENTS }));
    vi.stubGlobal('fetch', fetchMock);
    render(<SeedRunnerForm />);
    fireEvent.click(
      screen.getByRole('checkbox', { name: /auto-activer les bindings/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /lancer le dry-run/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/admin/components/seed-from-docs');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      autoActivate: true,
      dryRun: true,
    });
  });

  it('affiche le rapport quand le stream émet `done`', async () => {
    render(<SeedRunnerForm />);
    fireEvent.click(screen.getByRole('button', { name: /lancer le dry-run/i }));
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /seed terminé avec succès/i }),
      ).toBeInTheDocument();
    });
    // « 43 » apparaît pour total et seeded — au moins 2 occurrences attendues.
    expect(screen.getAllByText('43').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/non mappées \(1\)/i)).toBeInTheDocument();
  });

  it('affiche un état partiel (warning) quand le rapport contient des erreurs', async () => {
    const partialReport = {
      ...REPORT_PAYLOAD,
      images: {
        ...REPORT_PAYLOAD.images,
        errors: [{ path: 'kit/cassée.png', error: 'optimize failed' }],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ndjsonResponse({
          events: [
            ...SUCCESS_EVENTS.slice(0, -1),
            { type: 'done', report: partialReport },
          ],
        }),
      ),
    );
    render(<SeedRunnerForm />);
    fireEvent.click(screen.getByRole('button', { name: /lancer le dry-run/i }));
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /seed terminé avec des erreurs/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/erreurs \(1\)/i)).toBeInTheDocument();
  });

  it('affiche une erreur si la réponse !ok (réponse JSON synchrone)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { message: 'Trop de requêtes' } }),
            {
              status: 429,
              headers: { 'content-type': 'application/json' },
            },
          ),
      ),
    );
    render(<SeedRunnerForm />);
    fireEvent.click(screen.getByRole('button', { name: /lancer le dry-run/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/trop de requêtes/i);
    });
  });

  it('affiche une erreur si le stream émet `error`', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ndjsonResponse({
          events: [{ type: 'error', error: 'optimize failed: ENOSPC' }],
        }),
      ),
    );
    render(<SeedRunnerForm />);
    fireEvent.click(screen.getByRole('button', { name: /lancer le dry-run/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/optimize failed/i);
    });
  });

  it('warning visible quand dryRun désactivé', () => {
    render(<SeedRunnerForm />);
    fireEvent.click(screen.getByRole('checkbox', { name: /dry-run/i }));
    expect(
      screen.getByText(/db et le storage seront modifiés/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^lancer le seed$/i }),
    ).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<SeedRunnerForm />);
    await expectNoAxeViolations(container);
  });
});
