import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { Kicker } from '@/components/ui/Kicker';
import { cn } from '@/lib/utils/cn';

export interface JournalCrossLinkProps {
  href: string;
  kicker: string;
  title: string;
  description: string;
}

export function JournalCrossLink({
  href,
  kicker,
  title,
  description,
}: JournalCrossLinkProps) {
  return (
    <section className="border-t border-encre/10 bg-sauge/10 py-16 sm:py-20">
      <Container width="prose">
        <Link
          href={href}
          className={cn(
            'group block space-y-3 border border-encre/15 bg-creme p-8 sm:p-10',
            'transition-all duration-base ease-out-soft',
            'hover:-translate-y-0.5 hover:border-encre',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px]',
            'focus-visible:outline-encre',
            'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
          )}
        >
          <Kicker>{kicker}</Kicker>
          <Heading as="h2" size="md" className="font-display">
            {title}
          </Heading>
          <Text size="body" tone="secondary">
            {description}
          </Text>
          <span
            className="inline-flex items-center gap-2 pt-2 text-sm uppercase tracking-[0.18em] text-encre"
            aria-hidden="true"
          >
            Lire
            <span className="transition-transform duration-base group-hover:translate-x-1 motion-reduce:transition-none">
              {'\u2192'}
            </span>
          </span>
        </Link>
      </Container>
    </section>
  );
}
