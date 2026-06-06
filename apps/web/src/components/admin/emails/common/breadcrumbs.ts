/**
 * Construction des fils d'Ariane de la section emails (F02/NAV-F03).
 *
 * Mapping route → segments figé par la spec F02-navigation §4. Le helper est
 * PUR (testable par table) ; les écrans le consomment via le composant
 * existant `common/Breadcrumb`. Règles :
 *   - racine implicite « Emails » (lien vers /admin/emails) — sauf sur le
 *     dashboard où elle est la page courante ;
 *   - le DERNIER segment est la page courante (sans href — Breadcrumb pose
 *     aria-current=page) ;
 *   - les objets sans nom lisible reçoivent un fallback id tronqué (jamais de
 *     segment vide).
 */
import { EMAILS_ROOT, type BreadcrumbSegment } from './Breadcrumb';

const SECTION_LABELS: Record<string, { label: string; href: string }> = {
  transactional: { label: 'Transactionnel', href: '/admin/emails/transactional' },
  campaigns: { label: 'Campagnes', href: '/admin/emails/campaigns' },
  automation: { label: 'Automations', href: '/admin/emails/automation' },
  audiences: { label: 'Audiences', href: '/admin/emails/audiences' },
  templates: { label: 'Templates', href: '/admin/emails/templates' },
  suppression: { label: 'Suppression', href: '/admin/emails/suppression' },
  events: { label: 'Events', href: '/admin/emails/events' },
  listmonk: { label: 'Listmonk', href: '/admin/emails/listmonk' },
};

/** Jamais de segment vide : id tronqué à 8 caractères en dernier recours. */
export function entityLabel(name: string | null | undefined, id: string, prefix = ''): string {
  const base = name?.trim() ? name.trim() : `${id.slice(0, 8)}…`;
  return prefix ? `${prefix} ${base}` : base;
}

/**
 * Fil d'Ariane d'une page de la section.
 *  - dashboard : `emailsBreadcrumb()` → [Emails (courant)]
 *  - liste     : `emailsBreadcrumb('campaigns')` → [Emails, Campagnes (courant)]
 *  - détail    : `emailsBreadcrumb('campaigns', 'Été 2026')`
 *  - + profond : `emailsBreadcrumb('automation', 'Runs', 'Run 3a4b5c6d…')`
 * Les segments intermédiaires NOMMÉS peuvent porter un href via la forme objet.
 */
export function emailsBreadcrumb(
  section?: keyof typeof SECTION_LABELS,
  ...rest: Array<string | BreadcrumbSegment>
): BreadcrumbSegment[] {
  if (!section) return [{ label: EMAILS_ROOT.label }]; // dashboard = page courante

  const sec = SECTION_LABELS[section];
  const segments: BreadcrumbSegment[] = [EMAILS_ROOT];
  if (rest.length === 0) {
    segments.push({ label: sec!.label }); // liste = page courante
    return segments;
  }
  segments.push({ label: sec!.label, href: sec!.href });
  rest.forEach((part, i) => {
    const isLast = i === rest.length - 1;
    if (typeof part === 'string') {
      segments.push(isLast ? { label: part } : { label: part });
    } else {
      segments.push(isLast ? { label: part.label } : part);
    }
  });
  return segments;
}
