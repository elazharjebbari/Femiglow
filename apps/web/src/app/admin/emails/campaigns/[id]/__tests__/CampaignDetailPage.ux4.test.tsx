// @vitest-environment jsdom
/**
 * VAGUE 4 — CAMPAGNES — détail campagne : actions de pilotage selon le statut.
 *
 * Oracle UX4-CAMPAGNES-002 :
 *  - pour status='sending', le détail rend des boutons Pause / Annuler ;
 *  - « Annuler » exige une confirmation (window.confirm) ;
 *  - les transitions illégales sont ABSENTES (pas de bouton Reprendre pour
 *    une campagne sending ; pas de Pause/Annuler pour une campagne sent).
 *
 * La page est un RSC async : on mocke ses frontières de données, on l'« await »
 * pour obtenir l'arbre JSX, puis on le rend en jsdom. Les server actions sont
 * mockées (on observe l'appel, pas l'effet DB).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EmailCampaignLinkRow } from '@/lib/db/schema-emails';

// Frontières de données.
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ email: 'nadia@femiglow-maroc.com' }),
}));
const getCampaignDraft = vi.fn();
const getAudienceLabel = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/admin/emails/campaigns-queries', () => ({
  getCampaignDraft: (...a: unknown[]) => getCampaignDraft(...a),
  getAudienceLabel: (...a: unknown[]) => getAudienceLabel(...a),
}));

// Server actions : on observe l'appel (form action).
const pauseCampaign = vi.fn();
const resumeCampaign = vi.fn();
const cancelCampaign = vi.fn();
const refreshCampaignMetrics = vi.fn();
const discardCampaign = vi.fn();
const duplicateCampaign = vi.fn();
vi.mock('@/lib/admin/emails/wizard-actions', () => ({
  pauseCampaign: (...a: unknown[]) => pauseCampaign(...a),
  resumeCampaign: (...a: unknown[]) => resumeCampaign(...a),
  cancelCampaign: (...a: unknown[]) => cancelCampaign(...a),
  refreshCampaignMetrics: (...a: unknown[]) => refreshCampaignMetrics(...a),
  discardCampaign: (...a: unknown[]) => discardCampaign(...a),
  duplicateCampaign: (...a: unknown[]) => duplicateCampaign(...a),
}));

// AdminShell : enveloppe lourde (session/db) → coquille neutre en test.
vi.mock('@/components/admin/AdminShell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// next/navigation notFound : ne doit pas être déclenché ici.
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('notFound'); } }));

// `useFormStatus` (react-dom) n'est défini qu'au sein d'une soumission de form
// pilotée par le runtime React Server. En test unitaire jsdom on le neutralise
// (pending=false) — l'anti-double-clic est couvert ailleurs ; ici on teste la
// PRÉSENCE/ABSENCE des actions et la confirmation.
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();
  return { ...actual, useFormStatus: () => ({ pending: false }) };
});

import CampaignDetailPage from '@/app/admin/emails/campaigns/[id]/page';

function makeRow(over: Partial<EmailCampaignLinkRow> = {}): EmailCampaignLinkRow {
  return {
    id: 'camp_test',
    listmonkCampaignId: 777,
    status: 'sending',
    name: 'Aïd 2026',
    subject: '✨ Aïd Moubarak',
    preheader: 'Ton rituel',
    templateSlug: null,
    audienceLinkIds: [11, 12],
    payloadJson: {},
    scheduledFor: null,
    startedAt: new Date('2026-06-01T10:00:00Z'),
    finishedAt: null,
    sentCount: 1200,
    deliveredCount: 0,
    openCount: 300,
    clickCount: 20,
    bounceCount: 2,
    unsubscribeCount: 0,
    abVariant: null,
    createdByUserId: 'nadia@femiglow-maroc.com',
    audienceId: null,
    snapshotId: null,
    snapshotListmonkListId: null,
    createdAt: new Date('2026-06-01T09:00:00Z'),
    updatedAt: new Date('2026-06-01T11:00:00Z'),
    ...over,
  } as EmailCampaignLinkRow;
}

async function renderPage() {
  const el = await CampaignDetailPage({ params: { id: 'camp_test' } });
  return render(el);
}

beforeEach(() => {
  vi.clearAllMocks();
  getAudienceLabel.mockResolvedValue(null);
});

describe('UX4-CAMPAGNES-002 — actions de pilotage selon le statut', () => {
  it('UX4-CAMPAGNES-002 : status=sending rend Pause + Annuler, pas Reprendre/Supprimer', async () => {
    getCampaignDraft.mockResolvedValue(makeRow({ status: 'sending' }));
    await renderPage();
    expect(screen.getByRole('button', { name: /Mettre la campagne en pause/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annuler définitivement la campagne/i })).toBeInTheDocument();
    // Transitions illégales absentes pour sending :
    expect(screen.queryByRole('button', { name: /Reprendre l’envoi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Supprimer le brouillon/i })).not.toBeInTheDocument();
  });

  it('UX4-CAMPAGNES-002b : « Annuler » exige une confirmation (window.confirm)', async () => {
    getCampaignDraft.mockResolvedValue(makeRow({ status: 'sending' }));
    await renderPage();
    const user = userEvent.setup();

    // Refus de confirmation → preventDefault → l'action n'est pas soumise.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: /Annuler définitivement la campagne/i }));
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Annuler définitivement la campagne « Aïd 2026 »/i),
    );
  });

  it('UX4-CAMPAGNES-002c : status=paused rend Reprendre + Annuler (pas Pause)', async () => {
    getCampaignDraft.mockResolvedValue(makeRow({ status: 'paused' }));
    await renderPage();
    expect(screen.getByRole('button', { name: /Reprendre l’envoi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annuler définitivement la campagne/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mettre la campagne en pause/i })).not.toBeInTheDocument();
  });

  it('UX4-CAMPAGNES-002d : status=sent (terminal) → aucune action de transition', async () => {
    getCampaignDraft.mockResolvedValue(makeRow({ status: 'sent', finishedAt: new Date() }));
    await renderPage();
    expect(screen.queryByRole('button', { name: /Mettre la campagne en pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Annuler définitivement/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reprendre/i })).not.toBeInTheDocument();
    // Le bouton Rafraîchir reste toujours disponible.
    expect(screen.getByRole('button', { name: /Rafraîchir les métriques/i })).toBeInTheDocument();
  });

  it('UX4-CAMPAGNES-002e : status=draft → Supprimer (confirmé), pas Pause/Annuler/Reprendre', async () => {
    getCampaignDraft.mockResolvedValue(makeRow({ status: 'draft', listmonkCampaignId: null }));
    await renderPage();
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: /Supprimer le brouillon/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mettre la campagne en pause/i })).not.toBeInTheDocument();
    // UX-CAMP-015 — la suppression demande confirmation.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: /Supprimer le brouillon/i }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/Supprimer le brouillon « Aïd 2026 »/i));
  });

  it('UX-CAMP-005 : deep-link audience cliquable vers /audiences/{id}', async () => {
    getAudienceLabel.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Aïd 2026',
      slug: 'aid-2026',
    });
    getCampaignDraft.mockResolvedValue(
      makeRow({ status: 'sent', audienceId: '11111111-1111-1111-1111-111111111111', finishedAt: new Date() }),
    );
    await renderPage();
    const link = screen.getByRole('link', { name: /Aïd 2026/i });
    expect(link).toHaveAttribute('href', '/admin/emails/audiences/11111111-1111-1111-1111-111111111111');
  });

  it('UX-CAMP-006 : libellé métriques corrigé (poll, pas webhook) + Livrés/Désabos n/d', async () => {
    getCampaignDraft.mockResolvedValue(makeRow({ status: 'sent', finishedAt: new Date('2026-06-02T12:00:00Z') }));
    await renderPage();
    expect(screen.getByText(/poll Listmonk/i)).toBeInTheDocument();
    expect(screen.queryByText(/webhook Listmonk/i)).not.toBeInTheDocument();
    // Livrés et Désabos affichés « n/d » (2 occurrences).
    expect(screen.getAllByText('n/d')).toHaveLength(2);
  });
});
