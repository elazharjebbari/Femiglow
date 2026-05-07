import type { CrossLink } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { CrossLinkCard } from './CrossLinkCard';

interface CrossLinkTriptyqueProps {
  links: CrossLink[];
}

export function CrossLinkTriptyque({ links }: CrossLinkTriptyqueProps) {
  return (
    <section className="bg-creme-warm py-16 sm:py-24" aria-label="Continuer la lecture">
      <Container width="page">
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6 lg:gap-10">
          {links.map((link) => (
            <li key={link.id}>
              <CrossLinkCard link={link} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
