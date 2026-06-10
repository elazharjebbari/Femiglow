// @vitest-environment jsdom
/**
 * P0.3 — quick-wins de l'audit UX emails : un test de régression NOMINATIF
 * par correctif (regression_ref = ID de la matrice d'audit).
 *
 * Réf : docs/emailing/audit-ux-interfaces-2026-06/technique/07-plan-action-global.yaml (P0.3)
 *  - SUP-01  : lien « Liste de suppression » dans les quick-links du dashboard
 *  - AUTO-04 : libellé daily cap = plafond GLOBAL de l'automation
 *  - CKPT-02 : raisons d'ignorés bulk traduites en FR
 *  - DASH-07 : « Bounce permanent » (libellé complet) dans les 2 maps
 *  - DASH-10 : placeholder palette mentionne Cmd-K ET Ctrl-K
 *  - AUD-01  : règles has_tag/not_has_tag non sélectionnables (M5.5 non livré)
 *  - LMK-04  : wizard étape 2 — panne Listmonk ≠ « Crée-en une »
 *  (EVT-05 : vérifié déjà conforme — overflow-x-auto présent sur les 2 tables,
 *   aucun changement ; constat consigné dans la matrice.)
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';

// ── Mocks server actions + navigation (pattern CampaignWizard.msw.test) ────
const finalizeCampaign = vi.fn();
const updateCampaignDraft = vi.fn();
vi.mock('@/lib/admin/emails/wizard-actions', () => ({
  finalizeCampaign: (...args: unknown[]) => finalizeCampaign(...args),
  updateCampaignDraft: (...args: unknown[]) => updateCampaignDraft(...args),
}));
const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

// ── Mocks du dashboard RSC (données + enfants lourds, hors sujet ici) ──────
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ({ email: 'admin@femiglow-maroc.com' })),
}));
vi.mock('@/lib/admin/emails/queries', () => ({
  getOutboxKpiForWindow: vi.fn(async () => ({
    total: 0, sent: 0, delivered: 0, failed: 0, dlq: 0, pendingNow: 0,
  })),
  listRecentOutbox: vi.fn(async () => []),
}));
vi.mock('@/lib/mail/transactional/summary', () => ({
  summarizeOutbox: vi.fn(async () => ({
    window: '7d', delivered: 0, queued: 0, failed: 0, hardBounced: 0,
    sent: 0, webhookLastSuccessAt: null, sparkline: [],
  })),
}));
vi.mock('@/lib/admin/emails/health', () => ({
  checkEmailingHealth: vi.fn(async () => ({
    level: 'ok', timestamp: '2026-06-06T10:00:00.000Z', checks: { db: { ok: false } },
  })),
}));
vi.mock('@/lib/db/client', () => ({ db: () => null }));
vi.mock('@/app/api/admin/emails/health/checks', () => ({
  checkEmailingInfraHealth: vi.fn(async () => ({ level: 'ok', checks: {} })),
}));
vi.mock('@/components/admin/AdminShell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/admin/emails/HealthBadge', () => ({ HealthBadge: () => null }));
vi.mock('@/components/admin/emails/KpiCards', () => ({
  KpiCards: () => null,
  StatusBadge: () => null,
}));
vi.mock('@/components/admin/emails/DashboardAutoRefresh', () => ({
  DashboardAutoRefresh: () => null,
}));
vi.mock('@/components/admin/emails/WindowSelector', () => ({
  WindowSelector: () => null,
}));

import AdminEmailsPage from '@/app/admin/emails/page';
import { FrequencySettings, type FrequencyValue } from '@/components/admin/emails/automation/FrequencySettings';
import { formatSkipReasons } from '@/lib/mail/transactional/skip-reasons';
import { STATUS_META, statusLabel } from '@/components/admin/emails/common/StatusBadge';
import { GlobalCommandPalette } from '@/components/admin/emails/GlobalCommandPalette';
import { AudienceRulesBuilder } from '@/components/admin/emails/audiences/AudienceRulesBuilder';
import { CampaignWizard } from '@/components/admin/emails/wizard/CampaignWizard';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('P0.3 SUP-01 — navigation vers la liste de suppression', () => {
  it('le dashboard expose un quick-link vers /admin/emails/suppression', async () => {
    render(await AdminEmailsPage({}));
    const link = screen.getByRole('link', { name: /liste de suppression/i });
    expect(link).toHaveAttribute('href', '/admin/emails/suppression');
  });
});

describe('P0.3 AUTO-04 — libellé du daily cap', () => {
  const value: FrequencyValue = {
    cooldownSeconds: 0,
    quietHoursEnabled: false,
    quietHoursStart: '21:00',
    quietHoursEnd: '09:00',
    quietHoursTz: 'Africa/Casablanca',
    dailyCap: null,
  };

  it('annonce un plafond GLOBAL pour l’automation, plus jamais « par destinataire »', () => {
    render(<FrequencySettings value={value} onChange={vi.fn()} />);
    expect(
      screen.getByText(/plafond d'envois par jour \(global, pour cette automation\)/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/par destinataire/i)).not.toBeInTheDocument();
    expect(screen.getByText(/tous destinataires confondus/i)).toBeInTheDocument();
  });
});

describe('P0.3 CKPT-02 — raisons d’ignorés traduites', () => {
  it('traduit not_found et wrong_status, déduplique, et reste honnête sur l’inconnu', () => {
    expect(
      formatSkipReasons([
        { reason: 'not_found' },
        { reason: 'wrong_status' },
        { reason: 'wrong_status' },
      ]),
    // Oracle amendé F04-U-028 (P2.2) : l'agrégation COMPTE désormais chaque
    // raison (« 1 non trouvé · 2 statut non relançable ») — intention préservée
    // (traduit + dédupliqué + honnête).
    ).toBe('1 non trouvé · 2 statut non relançable');
    // Raison inconnue : clé brute plutôt que silence (pas de faux confort).
    expect(formatSkipReasons([{ reason: 'mystery' }])).toBe('mystery');
    expect(formatSkipReasons(undefined)).toBe('');
  });
});

describe('P0.3 DASH-07 — libellé « Bounce permanent » complet', () => {
  it('STATUS_META canonique + statusLabel rendent le libellé non tronqué', () => {
    expect(STATUS_META.bounced_permanent.label).toBe('Bounce permanent');
    expect(statusLabel('bounced_permanent')).toBe('Bounce permanent');
  });
});

describe('P0.3 DASH-10 — palette ⌘K : placeholder multiplateforme', () => {
  it('mentionne Cmd-K ET Ctrl-K une fois ouverte au clavier (Ctrl-K)', async () => {
    render(<GlobalCommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByRole('textbox', { name: /recherche commandes/i });
    expect(input).toHaveAttribute(
      'placeholder',
      expect.stringMatching(/Cmd-K \/ Ctrl-K/),
    );
  });
});

describe('P0.3 AUD-01 — règles tags neutralisées (M5.5 non livré)', () => {
  const emptyGroup = { kind: 'all' as const, conditions: [] };

  it('has_tag / not_has_tag sont visibles mais désactivées, avec la raison', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AudienceRulesBuilder value={emptyGroup} onChange={onChange} />);

    await user.click(screen.getByTestId('add-rule-btn'));
    const hasTag = screen.getByTestId('add-rule-has_tag');
    const notHasTag = screen.getByTestId('add-rule-not_has_tag');

    expect(hasTag).toBeDisabled();
    expect(hasTag).toHaveAttribute('aria-disabled', 'true');
    expect(hasTag).toHaveTextContent(/bientôt — M5\.5/);
    expect(notHasTag).toBeDisabled();

    await user.click(hasTag).catch(() => {});
    expect(onChange).not.toHaveBeenCalled();
  });

  it('les autres règles restent sélectionnables (non-régression du menu)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AudienceRulesBuilder value={emptyGroup} onChange={onChange} />);

    await user.click(screen.getByTestId('add-rule-btn'));
    await user.click(screen.getByTestId('add-rule-order_count'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as { conditions: Array<{ kind: string }> };
    expect(next.conditions[0]!.kind).toBe('order_count');
  });
});

describe('P0.3 LMK-04 — wizard étape 2 : panne Listmonk dite honnêtement', () => {
  function baseInitial(name: string) {
    return {
      name,
      subject: '',
      preheader: null,
      audienceLinkIds: [] as number[],
      audienceId: null as string | null,
      listmonkTemplateId: null,
      scheduledFor: null,
      payloadJson: {} as Record<string, unknown>,
    };
  }

  async function goToStep2(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /suivant/i }));
    await screen.findByRole('heading', { name: /2\. audience/i });
  }

  it('listes vides + listmonkError → alerte indispo, PAS le conseil « Crée-en une »', async () => {
    updateCampaignDraft.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <CampaignWizard
        draftId="11111111-1111-1111-1111-111111111111"
        initial={baseInitial('Campagne test P0')}
        lists={[]}
        templates={[]}
        audiences={[]}
        listmonkError="Listmonk indisponible (timeout)"
      />,
    );
    await goToStep2(user);

    const alert = screen
      .getAllByRole('alert')
      .find((el) => /listes ne peuvent pas être chargées/i.test(el.textContent ?? ''));
    expect(alert).toBeDefined();
    expect(alert!).toHaveTextContent(/Listmonk est indisponible/i);
    expect(alert!).toHaveTextContent(/audience FemiGlow/i);
    expect(
      screen.queryByText(/Aucune liste Listmonk\. Crée-en une/i),
    ).not.toBeInTheDocument();
  });

  it('listes vides SANS erreur → le hint de création reste (non-régression)', async () => {
    updateCampaignDraft.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <CampaignWizard
        draftId="22222222-2222-2222-2222-222222222222"
        initial={baseInitial('Campagne test P0 bis')}
        lists={[]}
        templates={[]}
        audiences={[]}
        listmonkError={null}
      />,
    );
    await goToStep2(user);

    expect(screen.getByText(/Aucune liste Listmonk\. Crée-en une/i)).toBeInTheDocument();
    expect(screen.queryByText(/Listmonk est indisponible/i)).not.toBeInTheDocument();
  });
});
