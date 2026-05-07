import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';

interface CrossLink {
  kicker: string;
  title: string;
  description?: string;
  href: string;
  cta: string;
}

interface CrossLinksProps {
  links: CrossLink[];
}

export function CrossLinks({ links }: CrossLinksProps) {
  return (
    <section className="py-20 sm:py-24">
      <Container width="wide">
        <ul className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <li key={link.href} className="group">
              <Link href={link.href} className="block space-y-3 transition-colors">
                <Kicker>{link.kicker}</Kicker>
                <Heading as="h3" size="md">
                  {link.title}
                </Heading>
                {link.description && (
                  <Text size="body" tone="secondary">
                    {link.description}
                  </Text>
                )}
                <span className="inline-block border-b border-encre pb-1 text-sm uppercase tracking-[0.18em]">
                  {link.cta}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
