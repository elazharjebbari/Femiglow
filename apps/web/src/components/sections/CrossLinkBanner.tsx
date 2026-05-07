import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Image } from '@/components/ui/Image';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';

interface CrossLinkBannerProps {
  kicker: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  image: { src: string; alt: string; width: number; height: number };
}

export function CrossLinkBanner({
  kicker,
  title,
  description,
  ctaLabel,
  href,
  image,
}: CrossLinkBannerProps) {
  return (
    <section aria-labelledby="journal-crosslink-title" className="bg-creme py-16 sm:py-20">
      <Container width="page">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            ratio="4:3"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
          <div className="space-y-5">
            <Kicker withRule>{kicker}</Kicker>
            <Heading as="h2" size="lg" italic="always" id="journal-crosslink-title">
              {title}
            </Heading>
            <Text size="lead" tone="secondary">
              {description}
            </Text>
            <p className="pt-2">
              <Link
                href={href}
                className="inline-flex items-center gap-2 border-b border-encre/40 pb-1 font-body text-sm uppercase tracking-[0.2em] text-encre transition-colors hover:border-encre"
              >
                {ctaLabel}
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
