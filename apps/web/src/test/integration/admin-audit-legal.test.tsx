/**
 * Vérifie que /admin/audit?resource=legalPage :
 *  - filtre les events sur resource_type='legal_page'
 *  - rend le bon onglet actif
 *  - affiche le label FR pour les actions legal.*
 *  - rend un lien vers /admin/legal/<slug>/edit pour la colonne Cible
 *
 * On render le composant server async via la pattern Next.js : on appelle
 * directement la fonction async qui retourne JSX, puis on inspect le
 * tree React.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import type { AdminSession } from '@/lib/auth/session';

const sessionMock: AdminSession = {
  adminId: 'adm_1',
  email: 'admin@x',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => Promise.resolve(sessionMock),
}));

vi.mock('@/components/admin/AdminShell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const listMock = vi.fn();
vi.mock('@/lib/audit/list-events', () => ({
  listAuditEventsByResourceType: (type: string, limit: number) => listMock(type, limit),
}));

import AuditPage from '@/app/admin/audit/page';

beforeAll(() => {
  // suppress console.error from Next router not mounted
});
afterAll(() => {});

beforeEach(() => {
  listMock.mockReset();
});

afterEach(() => {});

describe('/admin/audit — onglet legalPage', () => {
  it('rend le label "Pages légales" dans la nav onglets', async () => {
    listMock.mockResolvedValue([]);
    const ui = await AuditPage({ searchParams: { resource: 'legalPage' } });
    const { container } = render(ui as React.ReactElement);
    expect(container.textContent).toContain('Pages légales');
  });

  it('filtre par resource_type="legal_page" quand resource=legalPage', async () => {
    listMock.mockResolvedValue([]);
    await AuditPage({ searchParams: { resource: 'legalPage' } });
    expect(listMock).toHaveBeenCalledWith('legal_page', 200);
  });

  it('affiche le label FR "Page publiée" pour l\'action legal.page.published', async () => {
    listMock.mockResolvedValue([
      {
        id: 'ae_1',
        action: 'legal.page.published',
        actorId: 'adm_A',
        resourceType: 'legal_page',
        resourceId: 'lp_x',
        meta: { slug: 'cgv', version: 2 },
        createdAt: new Date('2026-05-13T10:00:00Z'),
      },
    ]);
    const ui = await AuditPage({ searchParams: { resource: 'legalPage' } });
    const { container } = render(ui as React.ReactElement);
    expect(container.textContent).toContain('Publiée');
    // Le code action brut est dans title (tooltip), pas en texte affiché
    expect(container.innerHTML).toContain('title="legal.page.published"');
  });

  it('rend un lien vers /admin/legal/<slug>/edit pour la colonne Cible', async () => {
    listMock.mockResolvedValue([
      {
        id: 'ae_2',
        action: 'legal.page.updated',
        actorId: 'adm_B',
        resourceType: 'legal_page',
        resourceId: 'lp_x',
        meta: { slug: 'cgv', fields: ['title'] },
        createdAt: new Date(),
      },
    ]);
    const ui = await AuditPage({ searchParams: { resource: 'legalPage' } });
    const { container } = render(ui as React.ReactElement);
    expect(container.innerHTML).toContain('href="/admin/legal/cgv/edit"');
    expect(container.textContent).toContain('/legal/cgv');
  });

  it('rend les 9 actions legal avec leur label FR', async () => {
    const actions = [
      'legal.page.created',
      'legal.page.updated',
      'legal.page.archived',
      'legal.page.submitted-review',
      'legal.page.published',
      'legal.page.restored',
      'legal.placement.upserted',
      'legal.placement.toggled',
      'legal.template-var.updated',
    ];
    listMock.mockResolvedValue(
      actions.map((action, i) => ({
        id: `ae_${i}`,
        action,
        actorId: 'adm_X',
        resourceType: 'legal_page',
        resourceId: 'lp_x',
        meta: { slug: 'cgv' },
        createdAt: new Date(),
      })),
    );
    const ui = await AuditPage({ searchParams: { resource: 'legalPage' } });
    const { container } = render(ui as React.ReactElement);
    expect(container.textContent).toContain('Page créée');
    expect(container.textContent).toContain('Page mise à jour');
    expect(container.textContent).toContain('Soumise à revue');
    expect(container.textContent).toContain('Publiée');
    expect(container.textContent).toContain('Restaurée');
    expect(container.textContent).toContain('Placement modifié');
    expect(container.textContent).toContain('Variable modifiée');
  });

  it('affiche le panneau "Aucun événement" si la liste est vide', async () => {
    listMock.mockResolvedValue([]);
    const ui = await AuditPage({ searchParams: { resource: 'legalPage' } });
    const { container } = render(ui as React.ReactElement);
    expect(container.textContent).toContain('Aucun événement');
  });
});

describe('/admin/audit — back-compat onglets existants', () => {
  it('par défaut (pas de resource) → fallback componentField', async () => {
    listMock.mockResolvedValue([]);
    await AuditPage({});
    expect(listMock).toHaveBeenCalledWith('component_field_binding', 200);
  });

  it('resource inconnu → fallback componentField', async () => {
    listMock.mockResolvedValue([]);
    await AuditPage({ searchParams: { resource: 'inexistant' } });
    expect(listMock).toHaveBeenCalledWith('component_field_binding', 200);
  });
});
