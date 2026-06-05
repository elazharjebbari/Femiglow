// @vitest-environment jsdom
/**
 * VAGUE 4 — CAMPAGNES — liste : recherche + filtre statut + pagination via URL.
 *
 * Oracle UX4-CAMPAGNES-007 :
 *  - la liste campagnes filtre par statut via searchParams (la page RSC passe
 *    `searchParams.status` à `listCampaigns`) ;
 *  - la barre de filtres (client, `useUrlFilters`) écrit le statut dans l'URL
 *    via `router.replace`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EmailCampaignLinkRow } from '@/lib/db/schema-emails';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ email: 'nadia@femiglow-maroc.com' }),
}));
const listCampaigns = vi.fn();
vi.mock('@/lib/admin/emails/campaigns-queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/emails/campaigns-queries')>();
  return { ...actual, listCampaigns: (...a: unknown[]) => listCampaigns(...a) };
});
vi.mock('@/lib/admin/emails/wizard-actions', () => ({
  duplicateCampaign: vi.fn(),
  createCampaignDraftAction: vi.fn(),
}));
vi.mock('@/components/admin/AdminShell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();
  return {
    ...actual,
    useFormStatus: () => ({ pending: false }),
    // useFormState(action, initial) → [state, dispatch] (React 18 react-dom).
    useFormState: (_action: unknown, initial: unknown) => [initial, vi.fn()],
  };
});

// next/navigation pour la barre de filtres client (useUrlFilters).
const replace = vi.fn();
let currentSearch = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/admin/emails/campaigns',
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import CampaignsListPage from '@/app/admin/emails/campaigns/page';
import { CampaignsFilterBar } from '@/app/admin/emails/campaigns/CampaignsListClient';

function row(over: Partial<EmailCampaignLinkRow> = {}): EmailCampaignLinkRow {
  return {
    id: 'camp_1',
    listmonkCampaignId: null,
    status: 'draft',
    name: 'Campagne A',
    subject: 'Sujet A',
    preheader: null,
    templateSlug: null,
    audienceLinkIds: [],
    payloadJson: {},
    scheduledFor: null,
    startedAt: null,
    finishedAt: null,
    sentCount: 0,
    deliveredCount: 0,
    openCount: 0,
    clickCount: 0,
    bounceCount: 0,
    unsubscribeCount: 0,
    abVariant: null,
    createdByUserId: 'nadia@femiglow-maroc.com',
    audienceId: null,
    snapshotId: null,
    snapshotListmonkListId: null,
    createdAt: new Date('2026-06-01T09:00:00Z'),
    updatedAt: new Date('2026-06-01T09:00:00Z'),
    ...over,
  } as EmailCampaignLinkRow;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentSearch = '';
  listCampaigns.mockResolvedValue({
    rows: [row({ id: 'camp_sent', name: 'Aïd envoyée', status: 'sent' })],
    total: 1,
    page: 1,
    pageSize: 20,
    pageCount: 1,
  });
});
afterEach(() => vi.clearAllMocks());

describe('UX4-CAMPAGNES-007 — liste filtrable par statut via searchParams', () => {
  it('UX4-CAMPAGNES-007 : la page RSC passe searchParams.status à listCampaigns', async () => {
    const el = await CampaignsListPage({ searchParams: { status: 'sent', q: 'Aïd', page: '2' } });
    render(el);
    expect(listCampaigns).toHaveBeenCalledTimes(1);
    expect(listCampaigns.mock.calls[0]![0]).toMatchObject({ status: 'sent', q: 'Aïd', page: 2 });
    // La campagne filtrée s'affiche.
    expect(screen.getByText('Aïd envoyée')).toBeInTheDocument();
  });

  it('UX4-CAMPAGNES-007b : la barre de filtres écrit le statut dans l’URL (router.replace)', async () => {
    const user = userEvent.setup();
    render(<CampaignsFilterBar />);
    await user.selectOptions(screen.getByRole('combobox', { name: /Filtrer par statut/i }), 'sent');
    const arg = replace.mock.calls.at(-1)?.[0] as string;
    expect(arg).toContain('status=sent');
  });

  it('UX4-CAMPAGNES-007c : la recherche texte écrit q dans l’URL (Enter)', async () => {
    const user = userEvent.setup();
    render(<CampaignsFilterBar />);
    const search = screen.getByRole('searchbox', { name: /Rechercher une campagne/i });
    await user.type(search, 'rituel{Enter}');
    const arg = replace.mock.calls.at(-1)?.[0] as string;
    expect(arg).toContain('q=rituel');
  });
});
