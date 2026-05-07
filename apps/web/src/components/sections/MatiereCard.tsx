import type { Matiere } from '@/lib/schemas';
import { Heading } from '@/components/ui/Heading';
import { MatiereIcon } from '@/components/icons/matieres/MatiereIcon';
import { cn } from '@/lib/utils/cn';

interface MatiereCardProps {
  matiere: Matiere;
}

const ambianceClass: Record<Matiere['ambiance'], string> = {
  champagne: 'bg-champagne/20',
  sauge: 'bg-sauge-soft',
  creme: 'bg-creme',
  petale: 'bg-petale/30',
};

export function MatiereCard({ matiere }: MatiereCardProps) {
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
            Origine
          </dt>
          <dd>{matiere.origine}</dd>
        </div>
        <div className="space-y-1">
          <dt className="font-display text-xs uppercase tracking-[0.18em] text-encre/50">
            Pourquoi
          </dt>
          <dd>{matiere.pourquoi}</dd>
        </div>
      </dl>
    </article>
  );
}
