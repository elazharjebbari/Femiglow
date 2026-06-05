/**
 * UX4-AUDIENCES-008 — AudienceRowActions : duplication d'audience + lien d'édition.
 *
 * Oracles :
 *  - « Modifier » pointe vers la page d'édition [id]/edit (UX-AUD-001) ;
 *  - « Dupliquer » lit l'audience source (GET) puis POST un clone (slug -copie,
 *    nom « (copie) », rules/exclusions copiées) — anti double-clic (UX-AUD-008).
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
import { AudienceRowActions } from './AudienceRowActions';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('AudienceRowActions — UX4-AUDIENCES-008', () => {
  it('« Modifier » pointe vers la page d édition', () => {
    render(<AudienceRowActions audienceId="aud_9" audienceName="VIP" />);
    const link = screen.getByTestId('row-edit-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/admin/emails/audiences/aud_9/edit');
  });

  it('« Dupliquer » lit la source puis POST un clone', async () => {
    let postedBody: Record<string, unknown> | null = null;
    server.use(
      http.get('/api/admin/emails/audiences/aud_9', () =>
        HttpResponse.json({
          slug: 'vip',
          name: 'VIP',
          description: 'Segment',
          rules: { kind: 'all', conditions: [{ kind: 'consent_marketing', value: true }] },
          exclusionFlags: {
            hard_bounce: true,
            unsubscribe: true,
            manual_suppression: true,
            marketing_optout: false,
          },
          evaluationMode: 'dynamic',
        }),
      ),
      http.post('/api/admin/emails/audiences', async ({ request }) => {
        postedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'aud_clone' });
      }),
    );

    render(<AudienceRowActions audienceId="aud_9" audienceName="VIP" />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('row-duplicate-btn'));
    });

    await waitFor(() => expect(postedBody).not.toBeNull());
    const body = postedBody as unknown as Record<string, unknown>;
    expect(body.slug).toBe('vip-copie');
    expect(body.name).toBe('VIP (copie)');
    expect(body.rules).toEqual({
      kind: 'all',
      conditions: [{ kind: 'consent_marketing', value: true }],
    });
    expect(body.exclusionFlags).toBeDefined();
  });
});
