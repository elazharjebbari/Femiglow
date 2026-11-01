/** Lien de `/admin/leads` : garde les filtres en cours, revient à la page 1. */
export type LeadsQuery = Record<string, string | number | undefined>;

export function leadsHref(current: LeadsQuery, patch: LeadsQuery): string {
  const params = new URLSearchParams();
  const merged: LeadsQuery = { ...current, page: undefined, ...patch };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === '') continue;
    if (key === 'page' && Number(value) <= 1) continue;
    if (key === 'period' && value === 'all') continue;
    if (key === 'sort' && value === 'created_desc') continue;
    if (key === 'pageSize' && Number(value) === 25) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/admin/leads?${query}` : '/admin/leads';
}
