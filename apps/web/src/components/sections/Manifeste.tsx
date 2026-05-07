import type { Manifeste as ManifesteData } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { Fleuron } from '@/components/ui/Fleuron';

interface ManifesteProps {
  data: ManifesteData;
}

export function Manifeste({ data }: ManifesteProps) {
  return (
    <section className="bg-sauge-soft py-24 sm:py-32" aria-labelledby="manifeste-title">
      <Container width="content">
        <div className="space-y-7 text-center">
          <Fleuron size="md" tone="sauge" />
          {data.kicker && <Kicker tone="sauge">{data.kicker}</Kicker>}
          <Heading
            as="h2"
            size="display-md"
            italic="always"
            id="manifeste-title"
            className="mx-auto max-w-content"
          >
            {data.title}
          </Heading>
          <div className="mx-auto max-w-prose space-y-5">
            {data.paragraphs.map((paragraph, index) => (
              <Text key={index} size="lead" italic family="display" balance>
                {paragraph}
              </Text>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
