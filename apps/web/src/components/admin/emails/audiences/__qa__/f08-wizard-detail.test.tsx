/**
 * F08 étape 4 — wizard étape 3 + page détail + suppression (AUD-04, TRV-01) :
 *  - mode d'évaluation : textes détaillés verbatim + payload (C-081/082) ;
 *  - navigation 3 étapes + récap (C-084) ;
 *  - hint R-011 sur le détail si règle country (C-085/086) ;
 *  - suppression via ConfirmDialog socle : focus Annuler, 1 seul DELETE,
 *    échec garde le dialog + ligne préservée (C-087/088/089).
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
import { AudienceWizard } from '../AudienceWizard';
import { AudienceDetailActions } from '../AudienceDetailActions';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';

// ── Mocks RSC pour la page détail (C-085/086) ──────────────────────────────
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ({ email: 'admin@femiglow.test', adminId: 'adm-1' })),
  getAdminSession: vi.fn(async () => ({ email: 'admin@femiglow.test', adminId: 'adm-1' })),
}));
vi.mock('@/components/admin/AdminShell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
const getAudienceById = vi.fn();
vi.mock('@/lib/mail/audiences/queries', () => ({
  getAudienceById: (...args: unknown[]) => getAudienceById(...args),
  listSnapshotsForAudience: vi.fn(async () => []),
}));
vi.mock('@/lib/mail/audiences/preview', () => ({
  previewAudienceSize: vi.fn(async () => ({ size: 10, durationMs: 3 })),
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const VALID_RULES: RulesGroup = {
  kind: 'all',
  conditions: [{ kind: 'consent_marketing', value: true }],
};

beforeEach(() => {
  server.use(
    http.post('/api/admin/emails/audiences/preview-size', () =>
      HttpResponse.json({ size: 42, durationMs: 10 }),
    ),
    http.post('/api/admin/emails/audiences/preview-breakdown', () =>
      HttpResponse.json({ matched: 50, excluded: 8, deliverable: 42, durationMs: 10 }),
    ),
  );
});

async function next() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('next-btn'));
  });
}

async function gotoStep3FromCreate() {
  fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'VIP Maroc' } });
  await next(); // étape 2
  await waitFor(() =>
    expect(screen.getByTestId('exclusion-flags-fieldset')).toBeInTheDocument(),
  );
  // attendre que la preview ait répondu (alimente previewSize pour C-081)
  await waitFor(() => expect(screen.getByTestId('preview-count')).toBeInTheDocument());
  await next(); // étape 3
  expect(screen.getByText('Récapitulatif')).toBeInTheDocument();
}

describe('F08 — mode d’évaluation (AUD-04)', () => {
  it('F08-C-081 — les 2 radios portent leur texte détaillé verbatim (N injecté)', async () => {
    render(
      <AudienceWizard initial={{ slug: 'vip-maroc', name: 'VIP Maroc', rules: VALID_RULES }} />,
    );
    await gotoStep3FromCreate();
    expect(screen.getByTestId('eval-mode-dynamic-detail').textContent).toContain(
      "Les contacts qui rempliront les critères au moment du send seront inclus, même s'ils n'existent pas encore aujourd'hui.",
    );
    const staticDetail = screen.getByTestId('eval-mode-static-detail').textContent ?? '';
    expect(staticDetail).toContain('Seuls les 42 contacts actuels recevront');
    expect(staticDetail).toContain('reproductible (A/B, conformité)');
    expect(staticDetail).toContain('ignore les nouveaux inscrits');
  });

  it('F08-C-082 — sélectionner static envoie evaluationMode=static dans le POST', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/admin/emails/audiences', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'aud-new' });
      }),
    );
    render(
      <AudienceWizard initial={{ slug: 'vip-maroc', name: 'VIP Maroc', rules: VALID_RULES }} />,
    );
    await gotoStep3FromCreate();
    fireEvent.click(screen.getByLabelText(/Figer la liste maintenant/));
    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted!.evaluationMode).toBe('static');
  });

  it('F08-C-084 — Continuer/Retour naviguent entre les 3 étapes ; le récap restitue nom/slug', async () => {
    render(
      <AudienceWizard initial={{ slug: 'vip-maroc', name: 'VIP Maroc', rules: VALID_RULES }} />,
    );
    await gotoStep3FromCreate();
    expect(screen.getByText('VIP Maroc')).toBeInTheDocument();
    expect(screen.getByText('vip-maroc')).toBeInTheDocument();
    // Retour → étape 2 → Retour → étape 1.
    fireEvent.click(screen.getByTestId('prev-btn'));
    expect(screen.getByTestId('exclusion-flags-fieldset')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('prev-btn'));
    expect(screen.getByTestId('name-input')).toBeInTheDocument();
  });
});

describe('F08 — page détail : hint R-011 (C-085/086)', () => {
  function audienceFixture(rules: RulesGroup) {
    return {
      id: 'aud-1',
      slug: 'cibles',
      name: 'Cibles',
      description: null,
      rules,
      exclusionFlags: {
        hard_bounce: true,
        unsubscribe: true,
        manual_suppression: true,
        marketing_optout: false,
      },
      evaluationMode: 'dynamic',
      createdBy: 'admin@femiglow.test',
      createdAt: new Date('2026-06-01T10:00:00Z'),
    };
  }

  it("F08-C-085 — une règle country affiche le hint « préfixe téléphonique »", async () => {
    getAudienceById.mockResolvedValueOnce(
      audienceFixture({
        kind: 'all',
        conditions: [{ kind: 'country', operator: 'eq', value: 'MA' }],
      }),
    );
    const { default: AudienceDetailPage } = await import(
      '@/app/admin/emails/audiences/[id]/page'
    );
    render(await AudienceDetailPage({ params: { id: 'aud-1' } }));
    const hint = screen.getByTestId('country-hint');
    expect(hint.textContent).toContain('Ciblage par préfixe téléphonique (E.164)');
    expect(hint.textContent).toContain('les leads sans téléphone ne matchent pas ce critère');
  });

  it("F08-C-086 — sans règle country, pas de hint R-011", async () => {
    getAudienceById.mockResolvedValueOnce(audienceFixture(VALID_RULES));
    const { default: AudienceDetailPage } = await import(
      '@/app/admin/emails/audiences/[id]/page'
    );
    render(await AudienceDetailPage({ params: { id: 'aud-1' } }));
    expect(screen.queryByTestId('country-hint')).not.toBeInTheDocument();
  });
});

describe('F08 — suppression via ConfirmDialog (TRV-01, C-087..089)', () => {
  const PROPS = {
    audienceId: 'aud-1',
    rules: VALID_RULES,
    exclusionFlags: {
      hard_bounce: true,
      unsubscribe: true,
      manual_suppression: true,
      marketing_optout: false,
    },
  };

  it('F08-C-087 — Supprimer ouvre le ConfirmDialog danger (focus Annuler), zéro window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<AudienceDetailActions {...PROPS} />);
    fireEvent.click(screen.getByTestId('delete-btn'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Supprimer cette audience ?')).toBeInTheDocument();
    expect(dialog.textContent).toContain('Les snapshots existants sont conservés');
    expect(dialog.textContent).toContain('Action irréversible');
    // Focus initial sur Annuler (contrat socle F01).
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Annuler' })).toHaveFocus(),
    );
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("F08-C-088 — double-clic sur la confirmation n'émet qu'un seul DELETE", async () => {
    let deletes = 0;
    server.use(
      http.delete('/api/admin/emails/audiences/aud-1', async () => {
        deletes += 1;
        await delay(50);
        return HttpResponse.json({ ok: true });
      }),
    );
    render(<AudienceDetailActions {...PROPS} />);
    fireEvent.click(screen.getByTestId('delete-btn'));
    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: 'Supprimer' });
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(deletes).toBe(1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(deletes).toBe(1);
  });

  it('F08-C-089 — un 500 garde le dialog ouvert avec role=alert (ligne préservée)', async () => {
    server.use(
      http.delete('/api/admin/emails/audiences/aud-1', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    render(<AudienceDetailActions {...PROPS} />);
    fireEvent.click(screen.getByTestId('delete-btn'));
    const dialog = await screen.findByRole('dialog');
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    });
    // Le dialog reste ouvert (l'échec ne ferme jamais), avec une alerte interne.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toBeInTheDocument());
    // …et les actions de la page restent en place (la « ligne » est préservée).
    expect(screen.getByTestId('delete-btn')).toBeInTheDocument();
  });
});
