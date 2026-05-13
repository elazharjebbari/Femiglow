import { Button, Heading, Section, Text } from '@react-email/components';
import { BaseLayout } from './_shared/BaseLayout';

type Props = {
  firstName: string;
  messageExcerpt: string;
};

export default function ContactAcknowledgement({ firstName, messageExcerpt }: Props) {
  return (
    <BaseLayout
      preheader={`Bonjour ${firstName}, ton message est bien arrivé chez FemiGlow.`}
    >
      <Heading as="h2" className="m-0 font-display text-2xl text-brand-encre">
        Merci, {firstName} ✨
      </Heading>
      <Text className="mt-4 text-stone-700">
        On a bien reçu ton message — on revient vers toi sous 24 heures
        (jours ouvrés).
      </Text>
      <Section className="mt-4 rounded-lg bg-stone-50 p-4 text-stone-600">
        <Text className="m-0 italic">« {messageExcerpt} »</Text>
      </Section>
      <Text className="mt-4 text-stone-700">
        En attendant, tu peux découvrir nos rituels les plus aimés :
      </Text>
      <Section className="mt-4">
        <Button
          href="https://femiglow-maroc.com/rituels"
          className="inline-block rounded-md bg-brand-sauge px-5 py-3 text-sm font-medium text-white no-underline"
        >
          Découvrir les rituels →
        </Button>
      </Section>
    </BaseLayout>
  );
}
