/**
 * F08 étape 3 — SnapshotsPanel (AUD-03/06/11) :
 *  - cycle : auto-refresh 4 s tant que pending/running, arrêt à done
 *    (C-068/069) ; errored → Relancer, anti double-clic (C-070/071) ;
 *  - drift vs live : âge relatif, écart ▲/▼ + %, surlignage > 10 % + bandeau
 *    re-snapshoter, purge auto (C-072..076) ;
 *  - membres : « Charger plus » cumulatif sans doublon, disparition à
 *    l'épuisement, grille réseau, export CSV (C-077..080).
 *
 * Router mocké LOCALEMENT avec un objet STABLE : le mock global retourne un
 * nouvel objet par render → l'effet d'intervalle serait désarmé/réarmé à
 * chaque render (gotcha F03-C-014).
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { delay, server, http, HttpResponse } from '@/test/msw/server';
import { SnapshotsPanel, type SnapshotRow } from '../SnapshotsPanel';
import { shortDate } from '../drift';

const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return { ...actual, useRouter: () => routerMock };
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
beforeEach(() => {
  routerMock.refresh.mockClear();
});
afterAll(() => server.close());

const NOW = new Date('2026-06-10T12:00:00Z');

function snap(partial: Partial<SnapshotRow> & { id: string }): SnapshotRow {
  return {
    status: 'done',
    size: 1100,
    createdAt: '2026-06-07T12:00:00Z', // J-3
    purgeableAfter: '2026-09-05T12:00:00Z',
    erroredReason: null,
    ...partial,
  };
}

const MEMBERS_URL = (sid: string) =>
  `/api/admin/emails/audiences/aud-1/snapshot/${sid}/members`;

function membersHandler(total: number, opts: { duplicateFirst?: boolean } = {}) {
  const requests: Array<{ limit: number; offset: number }> = [];
  server.use(
    http.get(MEMBERS_URL('s1'), ({ request }) => {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get('limit') ?? 50);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      requests.push({ limit, offset });
      const members = [];
      for (let i = offset; i < Math.min(offset + limit, total); i++) {
        members.push({ email: `m${i}@x.test`, name: null });
      }
      // Doublon volontaire : la 2e page rejoue le 1er email de la 1re page
      // (total mouvant entre deux clics) — le panel doit dédoublonner.
      if (opts.duplicateFirst && offset > 0 && members.length > 0) {
        members[0] = { email: 'm0@x.test', name: null };
      }
      return HttpResponse.json({ members, total, limit, offset });
    }),
  );
  return requests;
}

describe('F08 — cycle snapshots (C-068..071)', () => {
  it('F08-C-068 — router.refresh appelé toutes les 4 s tant que running', async () => {
    vi.useFakeTimers();
    render(
      <SnapshotsPanel
        audienceId="aud-1"
        snapshots={[snap({ id: 's1', status: 'running' })]}
        liveCount={null}
      />,
    );
    expect(screen.getByTestId('snapshot-autorefresh')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    expect(routerMock.refresh).toHaveBeenCalledTimes(3);
  });

  it("F08-C-069 — quand tous les snapshots sont done, l'intervalle est dégagé", async () => {
    vi.useFakeTimers();
    render(
      <SnapshotsPanel
        audienceId="aud-1"
        snapshots={[snap({ id: 's1' }), snap({ id: 's2' })]}
        liveCount={null}
      />,
    );
    expect(screen.queryByTestId('snapshot-autorefresh')).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it('F08-C-070 — errored : erroredReason + bouton Relancer (POST manuel)', async () => {
    let posts = 0;
    server.use(
      http.post('/api/admin/emails/audiences/aud-1/snapshot', () => {
        posts += 1;
        return HttpResponse.json({ snapshotId: 's2', size: 0, status: 'pending' });
      }),
    );
    render(
      <SnapshotsPanel
        audienceId="aud-1"
        snapshots={[snap({ id: 's1', status: 'errored', erroredReason: 'max depth exceeded' })]}
        liveCount={null}
      />,
    );
    expect(screen.getByTestId('snapshot-error-reason-s1').textContent).toContain(
      'max depth exceeded',
    );
    fireEvent.click(screen.getByTestId('snapshot-retry-s1'));
    await waitFor(() => expect(posts).toBe(1));
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("F08-C-071 — double-clic sur Relancer n'émet qu'un seul POST", async () => {
    let posts = 0;
    server.use(
      http.post('/api/admin/emails/audiences/aud-1/snapshot', async () => {
        posts += 1;
        await delay(50);
        return HttpResponse.json({ snapshotId: 's2', size: 0, status: 'pending' });
      }),
    );
    render(
      <SnapshotsPanel
        audienceId="aud-1"
        snapshots={[snap({ id: 's1', status: 'errored', erroredReason: 'boom' })]}
        liveCount={null}
      />,
    );
    const btn = screen.getByTestId('snapshot-retry-s1');
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
    expect(posts).toBe(1);
  });
});

describe('F08 — drift vs live (C-072..076)', () => {
  it("F08-C-072 — une ligne done affiche « créé il y a 3 j »", () => {
    vi.useFakeTimers({ now: NOW });
    render(
      <SnapshotsPanel audienceId="aud-1" snapshots={[snap({ id: 's1' })]} liveCount={null} />,
    );
    expect(screen.getByTestId('snapshot-age-s1').textContent).toBe('créé il y a 3 j');
  });

  it('F08-C-073 — size=1100, live=1234 affiche « +134 (+12 %) »', () => {
    render(
      <SnapshotsPanel audienceId="aud-1" snapshots={[snap({ id: 's1' })]} liveCount={1234} />,
    );
    expect(screen.getByTestId('snapshot-drift-s1').textContent).toContain('+134 (+12 %)');
  });

  it('F08-C-074 — un écart de 12 % surligne la ligne + bandeau « ⚠ Écart > 10 % »', () => {
    render(
      <SnapshotsPanel audienceId="aud-1" snapshots={[snap({ id: 's1' })]} liveCount={1234} />,
    );
    expect(screen.getByTestId('snapshot-row-s1')).toHaveAttribute('data-drift-alert', 'true');
    const banner = screen.getByTestId('drift-banner');
    expect(banner.textContent).toContain("Écart > 10 % avec l'audience live");
    expect(within(banner).getByTestId('drift-resnapshot')).toBeInTheDocument();
  });

  it("F08-C-075 — un écart de 8 % n'affiche pas le bandeau d'alerte", () => {
    render(
      <SnapshotsPanel audienceId="aud-1" snapshots={[snap({ id: 's1' })]} liveCount={1188} />,
    );
    expect(screen.getByTestId('snapshot-drift-s1').textContent).toContain('+88 (+8 %)');
    expect(screen.queryByTestId('drift-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('snapshot-row-s1')).not.toHaveAttribute('data-drift-alert');
  });

  it('F08-C-076 — une ligne affiche « purge auto le JJ/MM »', () => {
    render(
      <SnapshotsPanel audienceId="aud-1" snapshots={[snap({ id: 's1' })]} liveCount={null} />,
    );
    const expected = shortDate('2026-09-05T12:00:00Z');
    expect(screen.getByTestId('snapshot-purge-s1').textContent).toBe(
      `purge auto le ${expected}`,
    );
  });
});

describe('F08 — membres paginés (C-077..080)', () => {
  it('F08-C-077 — « Charger plus » fetch offset=50 et cumule sans doublon', async () => {
    const requests = membersHandler(120, { duplicateFirst: true });
    render(
      <SnapshotsPanel audienceId="aud-1" snapshots={[snap({ id: 's1' })]} liveCount={null} />,
    );
    fireEvent.click(screen.getByTestId('snapshot-members-s1'));
    await waitFor(() =>
      expect(screen.getByTestId('members-count').textContent).toMatch(/50\s*\/\s*120/),
    );
    expect(requests[0]).toEqual({ limit: 50, offset: 0 });

    fireEvent.click(screen.getByTestId('members-load-more'));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toEqual({ limit: 50, offset: 50 });
    // 50 + 50 dont 1 doublon (m0 rejoué) → 99 affichés, jamais 2× le même.
    await waitFor(() =>
      expect(screen.getByTestId('members-count').textContent).toMatch(/99\s*\/\s*120/),
    );
    expect(screen.getAllByText('m0@x.test')).toHaveLength(1);
  });

  it('F08-C-078 — le bouton Charger plus disparaît quand members.length === total', async () => {
    membersHandler(60);
    render(
      <SnapshotsPanel audienceId="aud-1" snapshots={[snap({ id: 's1', size: 60 })]} liveCount={null} />,
    );
    fireEvent.click(screen.getByTestId('snapshot-members-s1'));
    await waitFor(() => expect(screen.getByTestId('members-load-more')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('members-load-more'));
    await waitFor(() =>
      expect(screen.getByTestId('members-count').textContent).toMatch(/60\s*\/\s*60/),
    );
    expect(screen.queryByTestId('members-load-more')).not.toBeInTheDocument();
  });

  it('F08-C-079 — grille réseau membres : 401/500/404/network → alert ; hang → chargement honnête', async () => {
    for (const respond of [
      () => HttpResponse.json({ error: 'Non autorisé' }, { status: 401 }),
      () => HttpResponse.json({}, { status: 500 }),
      () => HttpResponse.json({ error: 'Snapshot introuvable' }, { status: 404 }),
      () => HttpResponse.error(),
    ]) {
      document.body.innerHTML = '';
      server.resetHandlers();
      server.use(http.get(MEMBERS_URL('s1'), respond));
      render(
        <SnapshotsPanel audienceId="aud-1" snapshots={[snap({ id: 's1' })]} liveCount={null} />,
      );
      fireEvent.click(screen.getByTestId('snapshot-members-s1'));
      const err = await screen.findByTestId('members-error');
      expect(err).toHaveAttribute('role', 'alert');
    }

    // hang → « Chargement des membres… » persiste, aucune liste fantôme.
    document.body.innerHTML = '';
    server.resetHandlers();
    server.use(
      http.get(MEMBERS_URL('s1'), async () => {
        await delay('infinite');
        return HttpResponse.json({ members: [], total: 0 });
      }),
    );
    render(
      <SnapshotsPanel audienceId="aud-1" snapshots={[snap({ id: 's1' })]} liveCount={null} />,
    );
    fireEvent.click(screen.getByTestId('snapshot-members-s1'));
    await screen.findByText('Chargement des membres…');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120));
    });
    expect(screen.getByText('Chargement des membres…')).toBeInTheDocument();
    expect(screen.queryByTestId('members-count')).not.toBeInTheDocument();
  });

  it('F08-C-080 — une ligne done expose un lien Exporter CSV ?format=csv', () => {
    render(
      <SnapshotsPanel audienceId="aud-1" snapshots={[snap({ id: 's1' })]} liveCount={null} />,
    );
    const link = screen.getByTestId('snapshot-export-s1');
    expect(link).toHaveAttribute(
      'href',
      '/api/admin/emails/audiences/aud-1/snapshot/s1/members?format=csv',
    );
  });
});
