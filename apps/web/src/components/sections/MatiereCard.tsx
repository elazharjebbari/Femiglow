import type { Matiere } from '@/lib/schemas';
import { Heading } from '@/components/ui/Heading';
import { MatiereIcon } from '@/components/icons/matieres/MatiereIcon';
import { cn } from '@/lib/utils/cn';

interface MatiereCardProps {
  matiere: Matiere;
  /** Phase 9 i18n — libellés des termes (Origine/Pourquoi). Défaut FR. */
  labels?: { origine: string; pourquoi: string };
}

const DEFAULT_MATIERE_LABELS = { origine: 'Origine', pourquoi: 'Pourquoi' };

const ambianceClass: Record<Matiere['ambiance'], string> = {
  champagne: 'bg-champagne/20',
  sauge: 'bg-sauge-soft',
  creme: 'bg-creme',
  petale: 'bg-petale/30',
};

export function MatiereCard({
  matiere,
  labels = DEFAULT_MATIERE_LABELS,
}: MatiereCardProps) {
  return (
    <article
      className={cn(
        'flex h-full flex-col gap-5 p-8 sm:p-10',
        ambianceClass[matiere.ambiance],
      )}
    >
      <MatiereIcon slug={matiere.iconSlug} className="h-8 w-8 text-encre/60" />
      <Heading as="h3" size="sm" italic="auto">
        {matiere.nom}
      </Heading>
      <dl className="space-y-4 border-t border-encre/10 pt-4 font-body text-sm text-encre/80">
        <div className="space-y-1">
          <dt className="font-display text-xs uppercase tracking-[0.18em] text-encre/50">
            {labels.origine}
          </dt>
          <dd>{matiere.origine}</dd>
        </div>
        <div className="space-y-1">
          <dt className="font-display text-xs uppercase tracking-[0.18em] text-encre/50">
            {labels.pourquoi}
          </dt>
          <dd>{matiere.pourquoi}</dd>
        </div>
      </dl>
    </article>
  );
}
