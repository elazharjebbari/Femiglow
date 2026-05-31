import { Button, Heading, Section, Text } from '@react-email/components';
import { BaseLayout } from './_shared/BaseLayout';

type Props = {
  firstName: string;
  cartItemsLabel: string;
  resumeUrl: string;
};

export default function CartAbandoned({ firstName, cartItemsLabel, resumeUrl }: Props) {
  return (
    <BaseLayout preheader={`${firstName}, ton panier t'attend chez FemiGlow ✨`}>
      <Heading as="h2" className="m-0 font-display text-2xl text-brand-encre">
        {firstName}, ton panier t'attend ✨
      </Heading>
      <Text className="mt-4 text-stone-700">
        Tu as laissé un panier en plan il y a une heure. On t'a gardé
        précieusement :
      </Text>
      <Section className="mt-4 rounded-lg bg-stone-50 p-4">
        <Text className="m-0 italic text-stone-600">{cartItemsLabel}</Text>
      </Section>
      <Text className="mt-4 text-stone-700">
        Reprends où tu en étais en un clic — pas besoin de tout retaper :
      </Text>
      <Section className="mt-4 text-center">
        <Button
          href={resumeUrl}
          className="inline-block rounded-md bg-brand-sauge px-6 py-3 text-sm font-medium text-white no-underline"
        >
          Reprendre mon panier →
        </Button>
      </Section>
      <Text className="mt-6 text-sm text-stone-600">
        Si tu as une question sur la commande, réponds simplement à ce mail
        — une conseillère te répond dans la journée.
      </Text>
    </BaseLayout>
  );
}
