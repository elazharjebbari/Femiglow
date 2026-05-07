import Link from 'next/link';
import { Container } from '@/components/ui/Container';

interface ContactCrossLink {
  href: string;
  label: string;
}

interface ContactCrossLinksProps {
  links: ContactCrossLink[];
}

export function ContactCrossLinks({ links }: ContactCrossLinksProps) {
  return (
    <section className="border-t border-encre/10 bg-creme py-12">
      <Container width="content">
        <nav aria-label="Liens contextuels" className="text-center">
          <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-encre/80">
            {links.map((link, index) => (
              <li key={link.href} className="flex items-center gap-3">
                {index > 0 && (
                  <span aria-hidden="true" className="text-encre/40">
                    {'\u00B7'}
                  </span>
                )}
                <Link
                  href={link.href}
                  className="underline decoration-encre/20 underline-offset-4 transition-colors duration-base hover:decoration-encre"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </section>
  );
}
