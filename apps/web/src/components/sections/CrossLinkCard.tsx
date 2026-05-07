import Link from 'next/link';
import type { CrossLink } from '@/lib/schemas';
import { Heading } from '@/components/ui/Heading';
import { Image } from '@/components/ui/Image';
import { Kicker } from '@/components/ui/Kicker';

interface CrossLinkCardProps {
  link: CrossLink;
}

export function CrossLinkCard({ link }: CrossLinkCardProps) {
  return (
    <Link
      href={link.href}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre/40 focus-visible:ring-offset-4 focus-visible:ring-offset-creme-warm"
    >
      <div className="overflow-hidden">
        <Image
          src={link.image.src}
          alt={link.image.alt}
          width={link.image.width}
          height={link.image.height}
          ratio="4:5"
          sizes="(min-width: 1024px) 28vw, 100vw"
          className="transition-transform duration-700 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </div>
      <div className="mt-5 space-y-2">
        <Kicker tone="champagne">{link.kicker}</Kicker>
        <Heading
          as="h3"
          size="sm"
          italic="auto"
          className="text-encre/70 transition-colors group-hover:text-encre"
        >
          {link.titre} <span aria-hidden="true">&rarr;</span>
        </Heading>
      </div>
    </Link>
  );
}
