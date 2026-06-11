/**
 * UX4-AUDIENCES-005 — AudienceDetailActions : le snapshot manuel (action de
 * masse) ouvre une confirmation affichant le count (preview-size) AVANT le POST.
 *
 * Oracle anti-« action de masse silencieuse » : cliquer « + Snapshot maintenant »
 * ne POST PAS immédiatement — il affiche d'abord « Figer N contacts ? » et n'envoie
 * le snapshot qu'après confirmation explicite. Anti double-clic vérifié.
 *
 * MSW : preview-size (count) + snapshot (POST). Lifecycle par fichier.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { AudienceDetailActions } from './AudienceDetailActions';
import type { ExclusionFlags, RulesGroup } from '@/lib/mail/audiences/rules-types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const RULES: RulesGroup = { kind: 'all', conditions: [{ kind: 'consent_marketing', value: true }] };
const EXCL: ExclusionFlags = {
  hard_bounce: true,
  unsubscribe: true,
  manual_suppression: true,
  marketing_optout: false,
};

describe('AudienceDetailActions — UX4-AUDIENCES-005 (snapshot confirmé)', () => {
  it('ouvre une confirmation avec le count avant de POSTer le snapshot', async () => {
    let snapshotPosted = 0;
    server.use(
      http.post('/api/admin/emails/audiences/preview-size', () =>
        HttpResponse.json({ size: 1234, durationMs: 5 }),
      ),
      http.post('/api/admin/emails/audiences/aud_1/snapshot', () => {
        snapshotPosted += 1;
        return HttpResponse.json({ snapshotId: 's1', size: 1234, status: 'done' });
      }),
    );

    render(<AudienceDetailActions audienceId="aud_1" rules={RULES} exclusionFlags={EXCL} />);

    // Premier clic : ouvre la confirmation et calcule le count — NE POST PAS.
    await act(async () => {
      fireEvent.click(screen.getByTestId('snapshot-btn'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('snapshot-confirm')).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByTestId('snapshot-confirm-count')).toHaveTextContent(/1\s?234/),
    );
    expect(snapshotPosted).toBe(0); // aucun POST tant qu'on n'a pas confirmé

    // Confirmer → POST.
    await act(async () => {
      fireEvent.click(screen.getByTestId('snapshot-confirm-btn'));
    });
    await waitFor(() => expect(snapshotPosted).toBe(1));
  });

  it('Annuler ferme la confirmation sans POST', async () => {
    let snapshotPosted = 0;
    server.use(
      http.post('/api/admin/emails/audiences/preview-size', () =>
        HttpResponse.json({ size: 7, durationMs: 5 }),
      ),
      http.post('/api/admin/emails/audiences/aud_2/snapshot', () => {
        snapshotPosted += 1;
        return HttpResponse.json({ snapshotId: 's', size: 7, status: 'done' });
      }),
    );

    render(<AudienceDetailActions audienceId="aud_2" rules={RULES} exclusionFlags={EXCL} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('snapshot-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('snapshot-confirm')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('snapshot-cancel'));
    });
    await waitFor(() =>
      expect(screen.queryByTestId('snapshot-confirm')).not.toBeInTheDocument(),
    );
    expect(snapshotPosted).toBe(0);
  });
});
