/**
 * Breadcrumb — fil d'Ariane réutilisable de la zone /admin/emails.
 *
 * Remplace les back-links mono-niveau ad hoc aux libellés divergents
 * (« ← Dashboard », « ← Dashboard emails », ou absence totale) recensés par
 * l'audit UX-TRANSVERSE-006. Un seul libellé racine canonique, un trail complet
 * sur les pages de détail.
 *
 * A11y : `<nav aria-label="Fil d'Ariane">` + liste ordonnée ; le dernier segment
 * (page courante) porte `aria-current="page"` et n'est pas un lien.
 *
 * Présentationnel pur (pas de `'use client'`) — utilisable côté RSC.
 */
import Link from 'next/link';

export interface BreadcrumbSegment {
  label: string;
  /** Absent = segment courant (non cliquable). */
  href?: string;
}

export const EMAILS_ROOT: BreadcrumbSegment = {
  label: 'Emails',
  href: '/admin/emails',
};

export function Breadcrumb({ segments }: { segments: BreadcrumbSegment[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-stone-500">
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          return (
            <li key={`${seg.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 ? (
                <span aria-hidden="true" className="text-stone-300">
                  ›
                </span>
              ) : null}
              {isLast || !seg.href ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={isLast ? 'font-medium text-stone-700' : 'text-stone-500'}
                >
                  {seg.label}
                </span>
              ) : (
                <Link
                  href={seg.href}
                  className="text-stone-500 underline-offset-2 transition hover:text-stone-700 hover:underline"
                >
                  {seg.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
