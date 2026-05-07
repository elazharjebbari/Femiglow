import type { RituelSciences } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { Reveal } from '@/components/patterns/Reveal';
import { Footnote, SourcesList } from '@/components/patterns/Footnote';
import { SchemaSVG } from '@/components/patterns/SchemaSVG';

interface SciencesDuSoinProps {
  data: RituelSciences;
}

const REF_PATTERN = /\[(\d+)\]/;

function parseSourceRef(ref?: string): number | null {
  if (!ref) return null;
  const match = REF_PATTERN.exec(ref);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

export function SciencesDuSoin({ data }: SciencesDuSoinProps) {
  return (
    <section
      aria-labelledby="sciences-titre"
      className="bg-ciel-soft/50 py-20 lg:py-28"
    >
      <Container width="page">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <Kicker tone="default" withRule>
              Sciences du soin
            </Kicker>
          </Reveal>
          <Reveal delay={80}>
            <Heading
              id="sciences-titre"
              as="h2"
              size="display-md"
              italic="always"
              className="mt-5"
            >
              {data.titre}
            </Heading>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-3 lg:gap-12">
          {data.essais.map((essai, i) => {
            const refN = parseSourceRef(essai.sourceRef);
            return (
              <Reveal key={essai.id} delay={i * 100}>
                <article className="space-y-3">
                  <Kicker tone="champagne">0{i + 1}</Kicker>
                  <Heading as="h3" size="sm" italic="never">
                    {essai.titre}
                  </Heading>
                  <Text size="body">
                    {essai.paragraphe}
                    {refN !== null && <Footnote n={refN} />}
                  </Text>
                </article>
              </Reveal>
            );
          })}
        </div>

        <div className="mt-20 flex justify-center">
          <SchemaSVG />
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <SourcesList sources={data.sourcesAcademiques} />
        </div>
      </Container>
    </section>
  );
}
