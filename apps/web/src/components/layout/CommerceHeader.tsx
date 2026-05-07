import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { Container } from '@/components/ui/Container';
import { routes } from '@/lib/routes';

export function CommerceHeader() {
  return (
    <header
      role="banner"
      className="border-b border-encre/5 bg-creme"
    >
      <Container width="page">
        <div className="flex h-20 items-center justify-between gap-6">
          <Logo size="sm" />
          <Link
            href={routes.home}
            className="text-sm uppercase tracking-[0.18em] text-encre/70 transition-colors hover:text-encre"
          >
            Retour à la maison
          </Link>
        </div>
      </Container>
    </header>
  );
}
