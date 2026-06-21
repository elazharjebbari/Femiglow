/**
 * Filtre + tri PURS de la liste des templates (F07 P3.4-l, Lot 6).
 * Hors composant → testable sans DOM ; le client n'orchestre que l'état.
 */

export type TemplateListItem = {
  id: string;
  slug: string;
  name: string;
  subjectTmpl: string;
  /** ISO 8601 (sérialisé par le RSC). */
  updatedAt: string;
};

export type SortKey = 'slug' | 'name' | 'updatedAt';
export type SortDir = 'asc' | 'desc';

/** Recherche plein-texte tolérante (slug / nom / sujet), insensible à la casse. */
export function filterTemplates(items: TemplateListItem[], query: string): TemplateListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (t) =>
      t.slug.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.subjectTmpl.toLowerCase().includes(q),
  );
}

/** Tri stable (copie) ; dates comparées en ISO (ordre lexical = chronologique). */
export function sortTemplates(
  items: TemplateListItem[],
  key: SortKey,
  dir: SortDir,
): TemplateListItem[] {
  const sorted = [...items].sort((a, b) => {
    const cmp =
      key === 'updatedAt'
        ? a.updatedAt.localeCompare(b.updatedAt)
        : a[key].localeCompare(b[key], 'fr', { sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}
