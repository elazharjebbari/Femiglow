import { Container } from '@/components/ui/Container';

export function CartSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      aria-label="Lecture du panier en cours"
      className="py-12 sm:py-16"
    >
      <Container width="page">
        <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
          <ul className="space-y-6 motion-safe:animate-pulse">
            {[0, 1].map((i) => (
              <li
                key={i}
                className="grid grid-cols-[96px_1fr] gap-4 border-b border-encre/10 py-6 first:pt-0 sm:grid-cols-[120px_1fr_auto] sm:gap-6"
              >
                <div className="aspect-square w-24 bg-encre/5 sm:w-[120px]" />
                <div className="space-y-3">
                  <div className="h-5 w-3/5 bg-encre/10" />
                  <div className="h-3 w-1/3 bg-encre/5" />
                  <div className="h-11 w-44 bg-encre/5" />
                </div>
                <div className="hidden h-6 w-20 bg-encre/10 sm:block" />
              </li>
            ))}
          </ul>
          <aside className="space-y-4 motion-safe:animate-pulse">
            <div className="h-6 w-1/2 bg-encre/10" />
            <div className="h-4 w-full bg-encre/5" />
            <div className="h-4 w-2/3 bg-encre/5" />
            <div className="h-12 w-full bg-encre/10" />
          </aside>
        </div>
      </Container>
    </section>
  );
}
