# F40 — Admin leads management (CRUD + outcome + export CSV)

## 1. Description

### Cible
Console admin pour gérer les leads capturés via chat. Operations : lister, filtrer,
chercher, voir détail, **modifier outcome** (converted/dismissed), exporter CSV.

### Dette audit
- **I1** — `attributeConversion` jamais appelé en runtime → outcome doit être set manuellement
- **Audit 2026-05-17 #1.2-1.5** — pas d'UI outcome, pas d'export CSV, pas de pagination, pas
  de webhook `outcome_changed`

## 2. Comportement attendu

### Pages
- `/admin/chat/leads` — liste paginée avec filtres
- `/admin/chat/leads/[id]` — détail + édition outcome

### Filtres
- Status : pending / contacted / converted / dismissed
- Période : du / au
- Recherche : prénom / téléphone / message
- Tri : date (desc default), status

### Actions ligne
- Voir détail
- Changer outcome (inline select)
- Marquer "contacté" (timestamp + handledBy auto)
- Supprimer (RGPD, suppression douce avec `forgotten_at`)

### Export CSV
- Colonnes : id, created_at, firstName, phone, reason, outcome, sessionId, language
- Filtres préservés
- Filename : `leads-YYYY-MM-DD.csv`

### Webhooks
- À chaque outcome change → POST `lead.outcome_changed` à webhook configuré (audit #1.5)

## 3. Tests proposés (~18 cas)

### Unit — Repo level
```typescript
describe('leadRepo', () => {
  it('lists with pagination', async () => {
    await seedLeads(50);
    const page1 = await leadRepo.list({ page: 1, perPage: 20 });
    expect(page1.items).toHaveLength(20);
    expect(page1.total).toBe(50);
    expect(page1.hasNext).toBe(true);
  });

  it('filters by status', async () => {
    await seedLeads(10, { status: 'pending' });
    await seedLeads(5, { status: 'converted' });
    const r = await leadRepo.list({ status: 'converted' });
    expect(r.items).toHaveLength(5);
  });

  it('searches by phone', async () => {
    await seedLeads(10);
    const lead = chatLeadFactory.build({ phone: '0612345678' });
    await db.insert(chatLead).values(lead);
    const r = await leadRepo.list({ search: '0612' });
    expect(r.items.map((l) => l.id)).toContain(lead.id);
  });

  it('marks outcome with timestamp', async () => {
    const lead = await seedLead();
    await leadRepo.updateOutcome(lead.id, 'converted', { actorId: 'admin_test' });
    const updated = await leadRepo.byId(lead.id);
    expect(updated?.outcome).toBe('converted');
    expect(updated?.handledBy).toBe('admin_test');
    expect(updated?.handledAt).toBeInstanceOf(Date);
  });
});
```

### Integration — Endpoint outcome
```typescript
describe('PUT /api/admin/chat/leads/[id]/outcome', () => {
  it('updates outcome + emits webhook event', async () => {
    const lead = await seedLead();
    await loginAsAdminApi('admin@test.com');

    const res = await fetch(`/api/admin/chat/leads/${lead.id}/outcome`, {
      method: 'PUT', body: JSON.stringify({ outcome: 'converted' }),
    });
    expect(res.status).toBe(200);

    // Vérif DB
    const updated = await leadRepo.byId(lead.id);
    expect(updated?.outcome).toBe('converted');

    // Vérif webhook
    const calls = getWebhookCalls();
    expect(calls.some((c) => c.body.event === 'lead.outcome_changed')).toBe(true);
  });

  it('returns 403 for non-admin', async () => {
    const lead = await seedLead();
    await loginAsSupportApi('support@test.com');
    const res = await fetch(`/api/admin/chat/leads/${lead.id}/outcome`, {
      method: 'PUT', body: JSON.stringify({ outcome: 'converted' }),
    });
    expect(res.status).toBe(403);
  });
});
```

### Integration — Export CSV
```typescript
describe('GET /api/admin/chat/leads/export.csv', () => {
  it('returns CSV with headers + filtered rows', async () => {
    await seedLeads(10, { status: 'converted' });
    await seedLeads(5, { status: 'pending' });

    const res = await fetch('/api/admin/chat/leads/export.csv?status=converted');
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    const lines = text.split('\n').filter(Boolean);
    expect(lines).toHaveLength(11); // 1 header + 10 rows
    expect(lines[0]).toContain('first_name,phone,outcome');
  });

  it('escapes commas and quotes properly', async () => {
    await db.insert(chatLead).values(chatLeadFactory.build({
      firstName: 'Leila, Khadija', // commas
      lastMessage: 'Bonjour "monsieur"', // quotes
    }));
    const text = await (await fetch('/api/admin/chat/leads/export.csv')).text();
    expect(text).toContain('"Leila, Khadija"');
    expect(text).toContain('"Bonjour ""monsieur"""');
  });
});
```

### Component — UI
```typescript
import { AdminLeadsListPage } from './page';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('<AdminLeadsListPage />', () => {
  it('renders 20 rows with pagination', async () => {
    server.use(http.get('/api/admin/chat/leads',
      () => HttpResponse.json({ items: Array.from({length:20}, ()=>leadFactory.build()), total: 50, hasNext: true })));
    render(<AdminLeadsListPage />);
    expect(await screen.findAllByRole('row')).toHaveLength(21); // header + 20
    expect(screen.getByRole('button', { name: /suivant/i })).toBeEnabled();
  });

  it('filters by status', async () => {
    const user = userEvent.setup();
    render(<AdminLeadsListPage />);
    await user.selectOptions(screen.getByRole('combobox', { name: /statut/i }), 'converted');
    // Verify request fired with ?status=converted
  });

  it('changes outcome via inline select', async () => {
    const user = userEvent.setup();
    server.use(http.put('/api/admin/chat/leads/:id/outcome', () => HttpResponse.json({ ok: true })));
    render(<AdminLeadsListPage />);
    const row = await screen.findByRole('row', { name: /0612345678/ });
    await user.selectOptions(row.querySelector('select[name="outcome"]')!, 'converted');
    await waitFor(() => expect(screen.getByText(/converti/i)).toBeVisible());
  });

  it('exports CSV on click', async () => {
    const user = userEvent.setup();
    const download = vi.spyOn(window, 'fetch').mockResolvedValue(new Response('csv,content', {
      headers: { 'content-disposition': 'attachment; filename=leads.csv' },
    }) as any);
    render(<AdminLeadsListPage />);
    await user.click(screen.getByRole('button', { name: /exporter csv/i }));
    expect(download).toHaveBeenCalledWith(expect.stringContaining('/leads/export.csv'), expect.any(Object));
  });
});
```

### E2E — Parcours complet
```typescript
test('@critical admin updates lead outcome and CSV reflects change', async ({ page }) => {
  await loginAsAdmin(page);
  await seedLeads([{ firstName: 'Leila', phone: '0612345678', outcome: 'pending' }]);

  const leads = new AdminLeadsListPOM(page);
  await leads.goto();
  await leads.setOutcome('0612345678', 'converted');

  const csv = await leads.exportCsv();
  expect(csv).toContain('0612345678,converted');
});
```

## 4. Test matrix
18 cas (voir [test-matrix.csv](test-matrix.csv)).

## 5. Risques audit
- I1 (test négatif `attributeConversion` jamais appelé runtime)
- Audit 2026-05-17 #1.2-1.5 (tous résolus si feature livrée)

## Métadonnées
- Owner: Backend + Frontend
- Priorité: P0 (résout 4 dettes audit)
