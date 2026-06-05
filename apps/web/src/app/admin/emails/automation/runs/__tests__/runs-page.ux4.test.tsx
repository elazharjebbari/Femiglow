// @vitest-environment jsdom
/**
 * UX-AUT-007 / UX4-AUTOMATIONS-005 — /admin/emails/automation/runs : index filtrable.
 *
 * Oracles :
 *  - la page RSC lit les filtres depuis searchParams (status/automationId/email)
 *    et les pré-remplit dans la barre de filtres (form GET) ;
 *  - un run errored expose un bouton « Relancer » ;
 *  - un run running expose « Annuler » ;
 *  - le lien drill-down « Runs de cette automation » est porté par la liste.
 *
 * On rend la page RSC (async) avec `getDb` mocké : le stub renvoie un jeu de
 * runs fixe et capture le `where` appliqué (preuve du filtrage searchParams).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ email: 'admin@test' }),
}));
vi.mock('@/components/admin/AdminShell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();
  return {
    ...actual,
    useFormStatus: () => ({ pending: false }),
    useFormState: (_action: unknown, initial: unknown) => [initial, vi.fn()],
  };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/emails/automation/runs',
  useSearchParams: () => new URLSearchParams(''),
}));

// ── Stub drizzle : capture le where + renvoie un jeu de runs fixe ───────────
const captured = { whereCount: 0 };
const RUNS = [
  {
    id: 'run_err',
    automationId: 'auto_1',
    recipientEmail: 'errored@exemple.test',
    triggeredAt: new Date('2026-06-01T10:00:00Z'),
    currentStep: 1,
    status: 'errored',
    nextActionAt: null,
  },
  {
    id: 'run_run',
    automationId: 'auto_1',
    recipientEmail: 'running@exemple.test',
    triggeredAt: new Date('2026-06-01T11:00:00Z'),
    currentStep: 0,
    status: 'running',
    nextActionAt: new Date('2026-06-02T08:00:00Z'),
  },
];
const AUTOS = [{ id: 'auto_1', name: 'Relance panier', slug: 'cart-1' }];

function makeQuery(rows: unknown[]) {
  const q: Record<string, unknown> = {};
  q.from = () => q;
  q.where = () => {
    captured.whereCount++;
    return q;
  };
  q.orderBy = () => q;
  q.limit = () => q;
  q.offset = () => Promise.resolve(rows);
  // table sans pagination (automations / count) : thenable direct.
  q.then = (resolve: (v: unknown) => void) => resolve(rows);
  return q;
}

let selectCall = 0;
const fakeDb = {
  select: (_cols?: unknown) => {
    selectCall++;
    // Ordre des Promise.all : [runs, count, automations].
    if (selectCall === 1) return makeQuery(RUNS);
    if (selectCall === 2) return makeQuery([{ n: RUNS.length }]);
    return makeQuery(AUTOS);
  },
};

vi.mock('@/lib/db/client', () => ({
  db: () => fakeDb,
}));

import AutomationRunsPage from '@/app/admin/emails/automation/runs/page';

beforeEach(() => {
  captured.whereCount = 0;
  selectCall = 0;
});
afterEach(() => vi.clearAllMocks());

describe('UX4-AUTOMATIONS-005 — runs index filtrable', () => {
  it('UX4-AUTOMATIONS-005a : status searchParams pré-remplit le filtre + applique un where', async () => {
    const el = await AutomationRunsPage({ searchParams: { status: 'errored' } });
    render(el);

    const statusSelect = screen.getByLabelText('Statut') as HTMLSelectElement;
    expect(statusSelect.value).toBe('errored');
    // Le filtre status a produit un where (preuve du filtrage searchParams).
    expect(captured.whereCount).toBeGreaterThan(0);
  });

  it('UX4-AUTOMATIONS-005b : un run errored expose « Relancer », un run running expose « Annuler »', async () => {
    const el = await AutomationRunsPage({ searchParams: {} });
    render(el);

    expect(screen.getByRole('button', { name: /Relancer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annuler/i })).toBeInTheDocument();
  });

  it('UX4-AUTOMATIONS-005c : automationId searchParams pré-sélectionne l’automation', async () => {
    const el = await AutomationRunsPage({ searchParams: { automationId: 'auto_1' } });
    render(el);
    const autoSelect = screen.getByLabelText('Automation') as HTMLSelectElement;
    expect(autoSelect.value).toBe('auto_1');
    // L'entête nomme l'automation filtrée (dans un <strong>).
    const strong = screen.getByText('Relance panier', { selector: 'strong' });
    expect(strong).toBeInTheDocument();
  });
});
