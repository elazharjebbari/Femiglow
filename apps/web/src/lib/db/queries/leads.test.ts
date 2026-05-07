import { describe, it, expect, beforeEach } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import {
  createLead,
  getLeadById,
  isValidTransition,
  listLeads,
  nextValidStatuses,
  updateLeadStatus,
} from './leads';

describe('queries.leads', () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it('crée puis retrouve un lead', async () => {
    const created = await createLead({ email: 'A@B.co', name: 'Anna' });
    expect(created.email).toBe('a@b.co');
    const found = await getLeadById(created.id);
    expect(found?.lead.email).toBe('a@b.co');
  });

  it('liste avec filtre statut', async () => {
    await createLead({ email: 'a@x.co' });
    const second = await createLead({ email: 'b@x.co' });
    await updateLeadStatus(second.id, 'qualified');
    const result = await listLeads({ status: 'qualified' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe(second.id);
  });

  it('paginate correctement', async () => {
    for (let i = 0; i < 30; i += 1) {
      await createLead({ email: `u${i}@x.co` });
    }
    const page1 = await listLeads({ pageSize: 10, page: 1 });
    const page2 = await listLeads({ pageSize: 10, page: 2 });
    expect(page1.rows).toHaveLength(10);
    expect(page2.rows).toHaveLength(10);
    expect(page1.total).toBe(30);
    expect(page1.rows.map((r) => r.id)).not.toEqual(page2.rows.map((r) => r.id));
  });

  it('valide les transitions de statut', () => {
    expect(isValidTransition('new', 'qualified')).toBe(true);
    expect(isValidTransition('won' as never, 'new' as never)).toBe(false);
    expect(isValidTransition('archived', 'new')).toBe(false);
    expect(isValidTransition('converted', 'archived')).toBe(true);
  });

  it('nextValidStatuses retourne la liste cohérente', () => {
    expect(nextValidStatuses('new')).toContain('qualified');
    expect(nextValidStatuses('archived')).toEqual([]);
  });

  it('refuse de mettre à jour un lead inexistant', async () => {
    await expect(updateLeadStatus('l_unknown', 'qualified')).rejects.toThrow();
  });
});
