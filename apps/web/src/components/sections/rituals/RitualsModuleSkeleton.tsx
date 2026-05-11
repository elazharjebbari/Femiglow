import { Container } from '@/components/ui/Container';

/**
 * Skeleton du module compact pendant le fetch RSC.
 * Garde la place exacte pour éviter le CLS.
 */
export function RitualsModuleSkeleton() {
  return (
    <section
      aria-hidden="true"
      data-testid="rituals-module-skeleton"
      className="border-y border-encre/10 py-[var(--ritual-module-padding-block-mobile)] sm:py-[var(--ritual-module-padding-block)]"
    >
      <Container width="wide">
        <div className="mx-auto h-[120px] max-w-2xl space-y-3 text-center">
          <div className="mx-auto h-3 w-32 bg-sauge-soft" />
          <div className="mx-auto h-8 w-64 bg-sauge-soft/80" />
          <div className="mx-auto h-3 w-48 bg-sauge-soft/60" />
        </div>
        <ul className="mx-auto mt-10 grid gap-[var(--ritual-module-grid-gap)] sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="border border-[var(--ritual-card-border-color)] bg-[var(--ritual-card-bg)] p-[var(--ritual-card-padding)]"
            >
              <div className="aspect-[var(--ritual-module-card-aspect)] w-full bg-sauge-soft" />
              <div className="mt-4 space-y-2">
                <div className="h-3 w-3/4 bg-sauge-soft" />
                <div className="h-3 w-1/2 bg-sauge-soft" />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <div className="mx-auto h-4 w-48 bg-sauge-soft" />
        </div>
      </Container>
    </section>
  );
}
