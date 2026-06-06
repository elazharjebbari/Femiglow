/**
 * EmptyState — état vide unifié de la section emails (SOC-F03 / TRV-09).
 *
 * Remplace les 3 patterns concurrents relevés par l'audit (box pointillée
 * +emoji / ligne de table grise / phrase nue). Deux variantes :
 *   - 'empty'    : il n'y a RIEN — expliquer l'absence + CTA de création ;
 *   - 'filtered' : il y a des données mais le FILTRE n'en retient aucune —
 *     citer le filtre + CTA « Réinitialiser le filtre ».
 */
import type { ReactNode } from 'react';
import Link from 'next/link';

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  cta?: { label: string; onClick?: () => void; href?: string };
  variant?: 'empty' | 'filtered';
};

export function EmptyState({ icon, title, body, cta, variant = 'empty' }: EmptyStateProps) {
  return (
    <div
      role="status"
      data-variant={variant}
      className="rounded-lg border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center"
    >
      {icon ? (
        <div aria-hidden="true" className="mb-2 text-3xl">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
      {body ? <div className="mt-1 text-sm text-stone-500">{body}</div> : null}
      {cta ? (
        cta.href ? (
          <Link
            href={cta.href}
            className="mt-4 inline-block rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            {cta.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            className="mt-4 inline-block rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            {cta.label}
          </button>
        )
      ) : null}
    </div>
  );
}
