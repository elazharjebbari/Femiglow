/**
 * UX4-AUDIENCES-001/004 — AudienceWizard (création + édition) sous MSW.
 *
 * Oracles :
 *  - 004 : le fieldset exclusionFlags (4 cases) modifie state.exclusionFlags et
 *          part au POST (création).
 *  - 001 : en mode 'edit', le wizard est pré-rempli depuis `initial` et soumet
 *          en PATCH /audiences/:id avec rules + exclusionFlags (slug exclu).
 *
 * MSW : on capture le body de la dernière mutation pour l'asserter. La preview
 * (preview-size / preview-breakdown) est aussi mockée (sinon onUnhandledRequest
 * 'error' casse). Lifecycle MSW par fichier (conventions §8).
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { AudienceWizard, type AudienceWizardInitial } from './AudienceWizard';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const VALID_RULES: RulesGroup = {
  kind: 'all',
  conditions: [{ kind: 'consent_marketing', value: true }],
};

/** Mock des routes de preview (toujours appelées dès l'étape 2). */
function mockPreview() {
  server.use(
    http.post('/api/admin/emails/audiences/preview-size', () =>
      HttpResponse.json({ size: 42, durationMs: 10 }),
    ),
    http.post('/api/admin/emails/audiences/preview-breakdown', () =>
      HttpResponse.json({ matched: 50, excluded: 8, deliverable: 42, durationMs: 10 }),
    ),
  );
}

async function gotoStep3() {
  // Étape 1 → renseigner nom (slug auto) → Continuer.
  fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'VIP Maroc' } });
  await act(async () => {
    fireEvent.click(screen.getByTestId('next-btn'));
  });
  // Étape 2 (Critères + Exclusions) → Continuer.
  await waitFor(() => expect(screen.getByTestId('exclusion-flags-fieldset')).toBeInTheDocument());
}

describe('AudienceWizard — UX4-AUDIENCES-004 (exclusion fieldset → POST)', () => {
  it('décocher une exclusion par défaut part dans le POST', async () => {
    mockPreview();
    let captured: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/admin/emails/audiences', async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'aud_new' });
      }),
    );

    // On part directement avec des rules valides via initial (mode create).
    const initial: AudienceWizardInitial = {
      slug: 'vip-maroc',
      name: 'VIP Maroc',
      rules: VALID_RULES,
    };
    render(<AudienceWizard initial={initial} />);

    await gotoStep3();

    // Les 4 cases existent ; on décoche hard_bounce et on coche marketing_optout.
    const hardBounce = screen.getByTestId('exclusion-hard_bounce') as HTMLInputElement;
    const mktOptout = screen.getByTestId('exclusion-marketing_optout') as HTMLInputElement;
    expect(hardBounce.checked).toBe(true);
    expect(mktOptout.checked).toBe(false);
    await act(async () => {
      fireEvent.click(hardBounce);
    });
    await act(async () => {
      fireEvent.click(mktOptout);
    });

    // Continuer vers étape 3 puis soumettre.
    await act(async () => {
      fireEvent.click(screen.getByTestId('next-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('submit-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await waitFor(() => expect(captured).not.toBeNull());
    const flags = (captured as unknown as { exclusionFlags: Record<string, boolean> })
      .exclusionFlags;
    expect(flags.hard_bounce).toBe(false); // décoché
    expect(flags.marketing_optout).toBe(true); // coché
    expect(flags.unsubscribe).toBe(true); // inchangé
  });
});

describe('AudienceWizard — UX4-AUDIENCES-001 (édition pré-remplie + PATCH)', () => {
  it('F08-C-083 (ex UX4-AUDIENCES-001) — mode edit : slug readOnly/disabled, exclu du PATCH', async () => {
    mockPreview();
    let method: string | null = null;
    let captured: Record<string, unknown> | null = null;
    server.use(
      http.patch('/api/admin/emails/audiences/aud_42', async ({ request }) => {
        method = request.method;
        captured = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'aud_42' });
      }),
    );

    const initial: AudienceWizardInitial = {
      slug: 'acheteuses',
      name: 'Acheteuses',
      description: 'Segment historique',
      rules: VALID_RULES,
      exclusionFlags: {
        hard_bounce: true,
        unsubscribe: true,
        manual_suppression: true,
        marketing_optout: true,
      },
      evaluationMode: 'static',
    };
    render(<AudienceWizard mode="edit" audienceId="aud_42" initial={initial} />);

    // Étape 1 pré-remplie : nom + slug (immutable/disabled).
    expect((screen.getByTestId('name-input') as HTMLInputElement).value).toBe('Acheteuses');
    const slug = screen.getByTestId('slug-input') as HTMLInputElement;
    expect(slug.value).toBe('acheteuses');
    expect(slug.disabled).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByTestId('next-btn'));
    });
    // Étape 2 : exclusion fieldset pré-coché conforme à initial.
    await waitFor(() => expect(screen.getByTestId('exclusion-flags-fieldset')).toBeInTheDocument());
    expect((screen.getByTestId('exclusion-marketing_optout') as HTMLInputElement).checked).toBe(
      true,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('next-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('submit-btn')).toBeInTheDocument());
    // Le libellé reflète l'édition.
    expect(screen.getByTestId('submit-btn')).toHaveTextContent(/Enregistrer/i);

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await waitFor(() => expect(captured).not.toBeNull());
    expect(method).toBe('PATCH');
    const body = captured as unknown as Record<string, unknown>;
    expect(body.rules).toEqual(VALID_RULES);
    expect(body.exclusionFlags).toBeDefined();
    // Slug NON envoyé en édition (immutable).
    expect(body.slug).toBeUndefined();
  });
});
