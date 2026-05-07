import type { ReactNode } from 'react';
import type { RituelInterview } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { Image } from '@/components/ui/Image';
import { Reveal } from '@/components/patterns/Reveal';
import { Fleuron } from '@/components/ui/Fleuron';

interface InterviewQRProps {
  data: RituelInterview;
  /**
   * Slot media déjà résolu côté serveur (`<ComponentMedia>`) qui remplace
   * `data.portrait`. Garde la légende (nomInterviewee) intacte.
   */
  portraitSlot?: ReactNode;
}

export function InterviewQR({ data, portraitSlot }: InterviewQRProps) {
  const exergueIndex = Math.floor(data.questions.length / 2);

  return (
    <section
      aria-labelledby="interview-titre"
      className="bg-creme py-20 lg:py-28"
    >
      <Container width="page">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            {(portraitSlot || data.portrait) && (
              <div className="lg:sticky lg:top-24">
                {portraitSlot ? (
                  portraitSlot
                ) : (
                  data.portrait && (
                    <Image
                      src={data.portrait.src}
                      alt={data.portrait.alt}
                      width={data.portrait.width}
                      height={data.portrait.height}
                      ratio="4:5"
                      sizes="(min-width: 1024px) 30vw, 100vw"
                    />
                  )
                )}
                <Text
                  size="lead"
                  family="display"
                  italic
                  className="mt-6 font-script text-3xl"
                >
                  {data.nomInterviewee}
                </Text>
              </div>
            )}
          </div>

          <div className="lg:col-span-8">
            <Reveal>
              <Kicker tone="champagne" withRule>
                Conversation
              </Kicker>
            </Reveal>
            <Reveal delay={80}>
              <Heading
                id="interview-titre"
                as="h2"
                size="display-md"
                italic="always"
                className="mt-5"
              >
                {data.introduction}
              </Heading>
            </Reveal>

            <div className="mt-12 space-y-12">
              {data.questions.map((qa, i) => (
                <div key={qa.id}>
                  <Reveal delay={i * 80}>
                    <dl className="space-y-3">
                      <div className="space-y-3">
                        <dt>
                          <Kicker tone="default">{qa.question}</Kicker>
                        </dt>
                        <dd>
                          <Text size="body" prose>
                            {qa.reponse}
                          </Text>
                        </dd>
                      </div>
                    </dl>
                  </Reveal>
                  {i === exergueIndex && i < data.questions.length - 1 && (
                    <Exergue quote={qa.reponse} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Exergue({ quote }: { quote: string }) {
  const sentence = quote.split('.')[0]?.trim() ?? quote;
  return (
    <figure className="my-16 flex flex-col items-center gap-4 text-center">
      <Fleuron size="sm" tone="champagne" />
      <blockquote className="max-w-prose">
        <Text size="lead" family="display" italic balance>
          «&#8239;{sentence}.&#8239;»
        </Text>
      </blockquote>
      <Fleuron size="sm" tone="champagne" />
    </figure>
  );
}
