import { describe, expect, it } from 'vitest';

import { leadsHref } from './leads-url';

describe('leadsHref', () => {
  it('garde les filtres et revient à la page 1', () => {
    expect(leadsHref({ search: 'ali', page: 3 }, { channel: 'instagram' })).toBe(
      '/admin/leads?search=ali&channel=instagram',
    );
  });

  it('retire un filtre passé à undefined', () => {
    expect(leadsHref({ channel: 'instagram', kind: 'paid' }, { channel: undefined })).toBe(
      '/admin/leads?kind=paid',
    );
  });

  it('page suivante : le numéro est gardé', () => {
    expect(leadsHref({ kind: 'paid' }, { page: 2 })).toBe('/admin/leads?kind=paid&page=2');
  });

  it('les valeurs par défaut n’encombrent pas l’adresse', () => {
    expect(leadsHref({ period: 'all', sort: 'created_desc', pageSize: 25 }, {})).toBe(
      '/admin/leads',
    );
  });
});
